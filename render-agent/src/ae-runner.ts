import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface AeRunnerOptions {
  aePath: string;
  jsxFilePath: string;
  outputMp4Path: string;
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
}

export function runAfterEffects(options: AeRunnerOptions): Promise<void> {
  const {
    aePath,
    jsxFilePath,
    outputMp4Path,
    timeoutMs = 600000, // 10 min default
    onProgress,
  } = options;

  return new Promise((resolve, reject) => {
    console.log(`[AE Runner] Starting After Effects: ${aePath}`);
    console.log(`[AE Runner] JSX Script: ${jsxFilePath}`);

    const args = ["-r", jsxFilePath];

    // Use aerender for headless or afterfx for scripted
    const isAeRender = aePath.toLowerCase().includes("aerender");
    if (isAeRender) {
      // aerender mode: provide additional args
      args.length = 0;
      args.push("-s", jsxFilePath);
    }

    const proc = spawn(aePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      console.log(`[AE stdout] ${text.trim()}`);

      // Try to parse progress from AE output
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
        reject(
          new Error(
            `After Effects exited with code ${code}. stderr: ${stderr}`
          )
        );
        return;
      }

      // Verify output exists
      if (!fs.existsSync(outputMp4Path)) {
        // Give AE a moment to finalize file
        setTimeout(() => {
          if (fs.existsSync(outputMp4Path)) {
            resolve();
          } else {
            reject(
              new Error(`Output file not found: ${outputMp4Path}`)
            );
          }
        }, 2000);
        return;
      }

      resolve();
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start After Effects: ${err.message}`));
    });

    // Simulate progress while waiting (if no progress from AE)
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
