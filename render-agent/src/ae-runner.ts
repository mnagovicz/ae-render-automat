import { spawn, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface AeRunnerOptions {
  aePath: string;
  jsxFilePath: string;
  outputMp4Path: string;
  ffmpegPath?: string;
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
}

export function runAfterEffects(options: AeRunnerOptions): Promise<void> {
  const {
    aePath,
    jsxFilePath,
    outputMp4Path,
    ffmpegPath = "ffmpeg",
    timeoutMs = 600000, // 10 min default
    onProgress,
  } = options;

  // AE 2022+ can't export H.264 directly — agent renders to lossless AVI first
  const outputMxfPath = outputMp4Path.replace(/\.mp4$/i, "_ae_output.mxf");

  return new Promise((resolve, reject) => {
    console.log(`[AE Runner] Starting After Effects: ${aePath}`);
    console.log(`[AE Runner] JSX Script: ${jsxFilePath}`);

    const args = ["-r", jsxFilePath];

    const isAeRender = aePath.toLowerCase().includes("aerender");
    if (isAeRender) {
      args.length = 0;
      args.push("-s", jsxFilePath);
    }

    const proc = spawn(aePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      console.log(`[AE stdout] ${text.trim()}`);

      const progressMatch = text.match(/PROGRESS:\s*(\d+)/);
      if (progressMatch && onProgress) {
        onProgress(parseInt(progressMatch[1]));
      }
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      console.error(`[AE stderr] ${text.trim()}`);
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`After Effects timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`After Effects exited with code ${code}. stderr: ${stderr}`));
        return;
      }

      // Check render_status.txt written by the JSX script
      const statusFilePath = path.join(path.dirname(outputMp4Path), "render_status.txt");
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, "utf-8").trim();
        const statusLines = statusContent.split("\n");
        if (statusLines[0].trim() === "FAILED") {
          const errorMsg = statusLines.slice(1).join("\n") || "Unknown render error";
          reject(new Error(errorMsg));
          return;
        }
        console.log("[AE Runner] render_status.txt: SUCCESS");
      }

      // Look for AVI output (lossless from AE)
      const mxfExists = fs.existsSync(outputMxfPath);
      const mp4Exists = fs.existsSync(outputMp4Path);

      if (mxfExists) {
        // Convert MXF → MP4 with ffmpeg
        console.log(`[AE Runner] Converting MXF → MP4 with ffmpeg...`);
        try {
          execSync(
            `"${ffmpegPath}" -y -i "${outputMxfPath}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${outputMp4Path}"`,
            { stdio: "pipe" }
          );
          console.log(`[AE Runner] ffmpeg conversion complete: ${outputMp4Path}`);
          // Clean up AVI
          try { fs.unlinkSync(outputMxfPath); } catch {}
          resolve();
        } catch (err) {
          reject(new Error(`ffmpeg conversion failed: ${(err as Error).message}`));
        }
        return;
      }

      if (mp4Exists) {
        // AE somehow exported MP4 directly (older version)
        resolve();
        return;
      }

      // Neither found — wait 2s and retry
      setTimeout(() => {
        if (fs.existsSync(outputMxfPath)) {
          console.log(`[AE Runner] MXF found after delay, converting...`);
          try {
            execSync(
              `"${ffmpegPath}" -y -i "${outputMxfPath}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${outputMp4Path}"`,
              { stdio: "pipe" }
            );
            try { fs.unlinkSync(outputMxfPath); } catch {}
            resolve();
          } catch (err) {
            reject(new Error(`ffmpeg conversion failed: ${(err as Error).message}`));
          }
        } else if (fs.existsSync(outputMp4Path)) {
          resolve();
        } else {
          reject(new Error(`Output file not found: ${outputMp4Path} (also checked ${outputMxfPath})`));
        }
      }, 2000);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start After Effects: ${err.message}`));
    });

    // Simulate progress while waiting
    if (onProgress) {
      let simulatedProgress = 10;
      const progressInterval = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 5;
          onProgress(simulatedProgress);
        }
      }, 10000);
      proc.on("close", () => clearInterval(progressInterval));
    }
  });
}
