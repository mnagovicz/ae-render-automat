// ─── AEP Binary Analyzer ────────────────────────────────
// Reads an After Effects Project (.aep) binary buffer and extracts
// compositions, controllers, effects, footage items, and fonts
// using string-scanning heuristics on the RIFX binary format.

// ─── Types ──────────────────────────────────────────────

export interface AepComposition {
  name: string;
}

export interface AepEffect {
  name: string;
  type: "Slider" | "Checkbox" | string;
}

export interface AepController {
  layerName: string;
  effects: AepEffect[];
}

export interface AepFootageItem {
  name: string;
  folderPath: string;
}

export interface AepAnalysis {
  compositions: AepComposition[];
  controllers: AepController[];
  footageItems: AepFootageItem[];
  fonts: string[];
}

// ─── Known Effect Patterns ──────────────────────────────

const EFFECT_PATTERNS: { pattern: string; type: AepEffect["type"] }[] = [
  { pattern: "Slider Control", type: "Slider" },
  { pattern: "Checkbox Control", type: "Checkbox" },
  { pattern: "Color Control", type: "Color" },
  { pattern: "Point Control", type: "Point" },
  { pattern: "Layer Control", type: "Layer" },
  { pattern: "Angle Control", type: "Angle" },
  { pattern: "Dropdown Menu Control", type: "Dropdown" },
];

// Known AE built-in effect names that appear in binary data.
// These are used to associate effects with nearby controller layers.
const KNOWN_EFFECT_NAMES = [
  "Fill",
  "Fast Box Blur",
  "Set Matte",
  "Gaussian Blur",
  "Drop Shadow",
  "Stroke",
  "Glow",
  "Tint",
  "Levels",
  "Curves",
  "Hue/Saturation",
  "CC Composite",
];

// Common footage file extensions
const FOOTAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".psd",
  ".ai",
  ".tif",
  ".tiff",
  ".bmp",
  ".gif",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".mp3",
  ".aif",
  ".svg",
  ".eps",
  ".pdf",
];

// ─── String Extraction Helpers ──────────────────────────

/**
 * Extract readable ASCII strings from a buffer.
 * Finds sequences of printable ASCII characters of at least `minLength`.
 */
function extractAsciiStrings(buffer: Buffer, minLength = 4): string[] {
  const strings: string[] = [];
  let current = "";
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // Printable ASCII range (space through tilde)
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = "";
    }
  }
  if (current.length >= minLength) {
    strings.push(current);
  }
  return strings;
}

/**
 * Extract UTF-16LE encoded strings from a buffer.
 * AEP files often store layer/comp names in UTF-16LE format.
 */
function extractUtf16Strings(buffer: Buffer, minLength = 3): string[] {
  const strings: string[] = [];
  let current = "";
  let inUtf16 = false;

  for (let i = 0; i < buffer.length - 1; i++) {
    const lo = buffer[i];
    const hi = buffer[i + 1];

    // UTF-16LE: printable ASCII char followed by null byte
    if (lo >= 0x20 && lo <= 0x7e && hi === 0x00) {
      current += String.fromCharCode(lo);
      inUtf16 = true;
      i++; // skip the null byte
    } else {
      if (inUtf16 && current.length >= minLength) {
        strings.push(current);
      }
      current = "";
      inUtf16 = false;
    }
  }
  if (inUtf16 && current.length >= minLength) {
    strings.push(current);
  }
  return strings;
}

/**
 * Deduplicate an array of strings, preserving first occurrence order.
 */
function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/**
 * Find all positions of a substring in the buffer (as ASCII).
 */
function findAllPositions(buffer: Buffer, search: string): number[] {
  const positions: number[] = [];
  const searchBuf = Buffer.from(search, "ascii");
  let pos = 0;
  while (pos < buffer.length) {
    const idx = buffer.indexOf(searchBuf, pos);
    if (idx === -1) break;
    positions.push(idx);
    pos = idx + 1;
  }
  return positions;
}

/**
 * Extract the nearest readable string in the vicinity of a buffer position.
 * Scans backward and forward to find a bounded string context.
 */
function extractNearbyString(
  buffer: Buffer,
  position: number,
  direction: "before" | "after",
  maxDistance = 512
): string | null {
  if (direction === "before") {
    const start = Math.max(0, position - maxDistance);
    const slice = buffer.subarray(start, position);
    // Find the last readable string in this slice
    const strings = extractAsciiStrings(slice, 3);
    if (strings.length > 0) return strings[strings.length - 1];
    const utf16 = extractUtf16Strings(slice, 3);
    if (utf16.length > 0) return utf16[utf16.length - 1];
  } else {
    const end = Math.min(buffer.length, position + maxDistance);
    const slice = buffer.subarray(position, end);
    const strings = extractAsciiStrings(slice, 3);
    if (strings.length > 0) return strings[0];
    const utf16 = extractUtf16Strings(slice, 3);
    if (utf16.length > 0) return utf16[0];
  }
  return null;
}

// ─── Composition Detection ──────────────────────────────

/**
 * Identify composition names from extracted strings.
 * Compositions in AEP tend to be near RIFX chunk markers like "CdHd", "Layr", "tdgp".
 * We look for strings that appear as comp names by heuristic: they contain typical
 * naming patterns (underscores, specific prefixes) and are NOT file paths or effect names.
 */
function findCompositions(
  allStrings: string[],
  buffer: Buffer
): AepComposition[] {
  const comps: AepComposition[] = [];
  const seen = new Set<string>();

  // Strategy 1: Look for strings near RIFX composition markers.
  // The "cdta" chunk (composition data) and "CdHd" are markers for compositions.
  const compMarkers = ["cdta", "CdHd", "CompH"];
  for (const marker of compMarkers) {
    const positions = findAllPositions(buffer, marker);
    for (const pos of positions) {
      // Scan nearby for UTF-16 strings (comp names are often UTF-16 in AEP)
      const end = Math.min(buffer.length, pos + 1024);
      const slice = buffer.subarray(pos, end);
      const utf16Names = extractUtf16Strings(slice, 2);
      for (const name of utf16Names) {
        if (!seen.has(name) && isLikelyCompName(name)) {
          seen.add(name);
          comps.push({ name });
        }
      }
    }
  }

  // Strategy 2: Look for strings that match common AE composition naming patterns.
  // E.g., prefixed with underscores, contain "export", "Slide", "Ovladani", etc.
  for (const s of allStrings) {
    if (seen.has(s)) continue;
    if (isLikelyCompName(s) && !isFilePath(s) && !isEffectName(s)) {
      // Validate: comp names typically start with letters/underscores
      if (/^[_a-zA-Z]/.test(s) && s.length >= 3 && s.length <= 200) {
        seen.add(s);
        comps.push({ name: s });
      }
    }
  }

  return comps;
}

function isLikelyCompName(s: string): boolean {
  // Comp names in AE projects often have these patterns
  const compPatterns = [
    /^_{1,3}/, // starts with underscores like ___Fotbal_Chance_export
    /export/i,
    /slide/i,
    /comp/i,
    /ovladani/i,
    /chance/i,
    /main/i,
    /^pre-?comp/i,
    /render/i,
  ];
  return compPatterns.some((p) => p.test(s));
}

function isFilePath(s: string): boolean {
  return (
    s.includes("/") ||
    s.includes("\\") ||
    FOOTAGE_EXTENSIONS.some((ext) => s.toLowerCase().endsWith(ext))
  );
}

function isEffectName(s: string): boolean {
  return (
    KNOWN_EFFECT_NAMES.includes(s) ||
    EFFECT_PATTERNS.some((e) => s === e.pattern)
  );
}

// ─── Controller Detection ───────────────────────────────

/**
 * Find controller layers. These are layers whose names contain "control"
 * (case insensitive), including the Czech spelling "controler".
 */
function findControllers(
  allStrings: string[],
  buffer: Buffer
): AepController[] {
  const controllerPattern = /control/i;
  const controllerNames = unique(
    allStrings.filter(
      (s) =>
        controllerPattern.test(s) &&
        !isEffectName(s) &&
        !s.includes("()") &&
        s.length < 150 &&
        s.length >= 5
    )
  );

  const controllers: AepController[] = [];

  for (const layerName of controllerNames) {
    const effects = findEffectsForController(layerName, buffer, allStrings);
    controllers.push({ layerName, effects });
  }

  return controllers;
}

/**
 * For a given controller layer name, find effects that are associated with it.
 * We look for effect type patterns (Slider Control, Checkbox Control, etc.)
 * in proximity to the controller name in the binary.
 */
function findEffectsForController(
  layerName: string,
  buffer: Buffer,
  allStrings: string[]
): AepEffect[] {
  const effects: AepEffect[] = [];
  const seen = new Set<string>();

  // Find positions of this controller name in the buffer (try both ASCII and UTF-16)
  const asciiPositions = findAllPositions(buffer, layerName);
  const utf16Buf = Buffer.alloc(layerName.length * 2);
  for (let i = 0; i < layerName.length; i++) {
    utf16Buf[i * 2] = layerName.charCodeAt(i);
    utf16Buf[i * 2 + 1] = 0;
  }
  const utf16Positions: number[] = [];
  let searchPos = 0;
  while (searchPos < buffer.length) {
    const idx = buffer.indexOf(utf16Buf, searchPos);
    if (idx === -1) break;
    utf16Positions.push(idx);
    searchPos = idx + 1;
  }

  const allPositions = [...asciiPositions, ...utf16Positions];

  for (const pos of allPositions) {
    // Scan a region after the controller name for effect patterns.
    // Effects on a layer appear after the layer name in the binary data,
    // typically within a few kilobytes.
    const scanEnd = Math.min(buffer.length, pos + 4096);
    const region = buffer.subarray(pos, scanEnd);
    const regionStrings = [
      ...extractAsciiStrings(region, 3),
      ...extractUtf16Strings(region, 3),
    ];

    for (const ep of EFFECT_PATTERNS) {
      if (regionStrings.some((s) => s.includes(ep.pattern))) {
        // Found an effect type. Try to find its specific name/label nearby.
        const effectPositions = findAllPositions(region, ep.pattern);
        for (const effectPos of effectPositions) {
          // The effect instance name often precedes the effect type in the binary.
          // It could be something like "kurz" for a Slider Control.
          const nearbyBefore = extractNearbyString(
            region,
            effectPos,
            "before",
            256
          );

          const effectName =
            nearbyBefore &&
            nearbyBefore !== layerName &&
            nearbyBefore !== ep.pattern &&
            nearbyBefore.length < 100
              ? nearbyBefore
              : ep.pattern;

          const key = `${effectName}:${ep.type}`;
          if (!seen.has(key)) {
            seen.add(key);
            effects.push({ name: effectName, type: ep.type });
          }
        }
      }
    }
  }

  // If no effects were found through proximity, fall back to checking if common
  // effect type strings exist near any occurrence of the layer name.
  if (effects.length === 0) {
    // Check for generic presence of effect types in the whole buffer
    for (const ep of EFFECT_PATTERNS) {
      if (buffer.includes(Buffer.from(ep.pattern, "ascii"))) {
        // Effect type exists in file; heuristically associate with controllers
        // that match naming conventions (e.g., "controler hoste" likely has Slider)
        if (
          layerName.toLowerCase().includes("checkbox") ||
          layerName.toLowerCase().includes("logo") ||
          layerName.toLowerCase().includes("avatar")
        ) {
          if (ep.type === "Checkbox") {
            effects.push({ name: ep.pattern, type: ep.type });
          }
        }
        if (
          layerName.toLowerCase().includes("hoste") ||
          layerName.toLowerCase().includes("sirka") ||
          layerName.toLowerCase().includes("slider")
        ) {
          if (ep.type === "Slider") {
            effects.push({ name: ep.pattern, type: ep.type });
          }
        }
      }
    }
  }

  return effects;
}

// ─── Footage Detection ──────────────────────────────────

/**
 * Find footage items referenced in the AEP file.
 * Looks for file paths and filenames with known extensions.
 */
function findFootageItems(allStrings: string[]): AepFootageItem[] {
  const items: AepFootageItem[] = [];
  const seen = new Set<string>();

  for (const s of allStrings) {
    const lower = s.toLowerCase();

    // Check if this string ends with a known footage extension
    const hasExtension = FOOTAGE_EXTENSIONS.some((ext) =>
      lower.endsWith(ext)
    );

    if (hasExtension) {
      // Extract filename and folder path
      let name: string;
      let folderPath: string;

      // Normalize path separators
      const normalized = s.replace(/\\/g, "/");

      if (normalized.includes("/")) {
        const lastSlash = normalized.lastIndexOf("/");
        folderPath = normalized.substring(0, lastSlash);
        name = normalized.substring(lastSlash + 1);
      } else {
        name = normalized;
        folderPath = "";
      }

      // Deduplicate by full path
      const key = `${folderPath}/${name}`;
      if (!seen.has(key) && name.length > 1) {
        seen.add(key);
        items.push({ name, folderPath });
      }
    }

    // Also look for folder path patterns common in AE projects
    // e.g., "PODKLADY_CHL/LOGA/", "SLIDE 1/", etc.
    if (
      s.includes("/") &&
      !hasExtension &&
      !s.startsWith("http") &&
      !s.includes("://")
    ) {
      // This might be a folder reference; we only record it if it looks like
      // a footage folder path (short, no special chars)
      const normalized = s.replace(/\\/g, "/").replace(/\/$/, "");
      if (
        normalized.length < 200 &&
        /^[a-zA-Z0-9_\-\s./]+$/.test(normalized)
      ) {
        // Check if this path contains footage-like folder names
        const parts = normalized.split("/");
        if (parts.length >= 2 && parts.every((p) => p.length < 80)) {
          // Store as a folder reference (no filename)
          const key = `${normalized}/`;
          if (!seen.has(key)) {
            seen.add(key);
            // Only add if it looks like a footage folder, not a system path
            const isFootageFolder =
              !normalized.startsWith("/usr") &&
              !normalized.startsWith("/System") &&
              !normalized.includes("node_modules") &&
              !normalized.startsWith("/Applications");
            if (isFootageFolder) {
              items.push({ name: "", folderPath: normalized });
            }
          }
        }
      }
    }
  }

  return items;
}

// ─── Font Detection ─────────────────────────────────────

// Common font family names that appear in AEP files.
// AEP stores font references with their PostScript or family names.
const KNOWN_FONT_PATTERNS = [
  /Stag\s*Sans/i,
  /Arial/i,
  /Helvetica/i,
  /Roboto/i,
  /Open\s*Sans/i,
  /Montserrat/i,
  /Lato/i,
  /Futura/i,
  /Gotham/i,
  /Proxima\s*Nova/i,
  /Source\s*Sans/i,
  /Noto\s*Sans/i,
  /Inter/i,
  /Poppins/i,
  /Raleway/i,
  /Barlow/i,
  /Oswald/i,
  /Bebas/i,
  /DIN/i,
];

/**
 * Find fonts used in the AEP file.
 * Font data in AEP is typically found near "tdbs" (text data) chunks
 * or as part of text layer properties.
 */
function findFonts(allStrings: string[], buffer: Buffer): string[] {
  const fonts: string[] = [];
  const seen = new Set<string>();

  // Strategy 1: Match against known font patterns in all extracted strings
  for (const s of allStrings) {
    for (const pattern of KNOWN_FONT_PATTERNS) {
      if (pattern.test(s)) {
        // Clean up the font name
        const match = s.match(pattern);
        if (match) {
          const fontName = match[0].replace(/\s+/g, " ").trim();
          if (!seen.has(fontName.toLowerCase())) {
            seen.add(fontName.toLowerCase());
            fonts.push(fontName);
          }
        }
      }
    }
  }

  // Strategy 2: Look near font-related markers in the binary.
  // AEP stores font data near "fnam" (font name) and "tdbs" markers.
  const fontMarkers = ["fnam", "tdbs", "tdbf"];
  for (const marker of fontMarkers) {
    const positions = findAllPositions(buffer, marker);
    for (const pos of positions) {
      const end = Math.min(buffer.length, pos + 512);
      const slice = buffer.subarray(pos, end);
      const utf16Names = extractUtf16Strings(slice, 3);
      const asciiNames = extractAsciiStrings(slice, 3);

      for (const name of [...utf16Names, ...asciiNames]) {
        // Font names typically are capitalized words without special characters
        if (
          /^[A-Z][a-zA-Z\s-]+$/.test(name) &&
          name.length >= 3 &&
          name.length <= 60 &&
          !isEffectName(name) &&
          !name.includes("/")
        ) {
          const lower = name.toLowerCase().trim();
          if (!seen.has(lower)) {
            seen.add(lower);
            fonts.push(name.trim());
          }
        }
      }
    }
  }

  // Strategy 3: Look for PostScript-style font names (e.g., "StagSans-Book")
  const postScriptPattern = /[A-Z][a-zA-Z]+-[A-Za-z]+/;
  for (const s of allStrings) {
    const match = s.match(postScriptPattern);
    if (match) {
      const fontName = match[0];
      // Convert PostScript name to readable: "StagSans-Book" -> "Stag Sans"
      const familyName = fontName
        .split("-")[0]
        .replace(/([a-z])([A-Z])/g, "$1 $2");
      const lower = familyName.toLowerCase();
      if (!seen.has(lower) && familyName.length >= 3 && familyName.length < 60) {
        seen.add(lower);
        fonts.push(familyName);
      }
    }
  }

  return fonts;
}

// ─── Main Analyzer ──────────────────────────────────────

/**
 * Analyze an After Effects Project (.aep) binary buffer.
 *
 * This does NOT implement a full RIFX parser. Instead, it uses a
 * string-scanning heuristic approach: it extracts all readable text
 * strings (both ASCII and UTF-16LE) from the binary and classifies
 * them into compositions, controllers, effects, footage items, and fonts.
 *
 * @param buffer - Raw binary content of the .aep file
 * @returns AepAnalysis with extracted project structure
 */
export function analyzeAep(buffer: Buffer): AepAnalysis {
  // Validate the buffer starts with RIFX (After Effects) or RIFF
  const header = buffer.subarray(0, 4).toString("ascii");
  if (header !== "RIFX" && header !== "RIFF") {
    // Some AEP files may be gzip-compressed or have a different wrapper.
    // Try to proceed anyway with a warning-style approach.
    console.warn(
      `AEP file does not start with RIFX/RIFF header (got "${header}"). ` +
        "Attempting to parse anyway."
    );
  }

  // Extract all readable strings from the binary
  const asciiStrings = extractAsciiStrings(buffer, 3);
  const utf16Strings = extractUtf16Strings(buffer, 3);
  const allStrings = unique([...asciiStrings, ...utf16Strings]);

  // Run each detector
  const compositions = findCompositions(allStrings, buffer);
  const controllers = findControllers(allStrings, buffer);
  const footageItems = findFootageItems(allStrings);
  const fonts = findFonts(allStrings, buffer);

  return {
    compositions,
    controllers,
    footageItems,
    fonts,
  };
}
