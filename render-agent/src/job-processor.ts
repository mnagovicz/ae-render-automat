import * as fs from "fs";
import * as path from "path";
import { ApiClient, RenderJob } from "./api-client";
import { buildJsx } from "./jsx-builder";
import { runAfterEffects } from "./ae-runner";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

export class JobProcessor {
  private client: ApiClient;
  private workDir: string;
  private aePath: string;
  private s3: S3Client;
  private s3Bucket: string;

  constructor(
    client: ApiClient,
    workDir: string,
    aePath: string,
    s3: S3Client,
    s3Bucket: string
  ) {
    this.client = client;
    this.workDir = workDir;
    this.aePath = aePath;
    this.s3 = s3;
    this.s3Bucket = s3Bucket;
  }

  async process(job: RenderJob): Promise<void> {
    const jobDir = path.join(this.workDir, `job_${job.id}`);
    const footageDir = path.join(jobDir, "footage");
    const outputDir = path.join(jobDir, "output");

    try {
      // Create work directories
      fs.mkdirSync(jobDir, { recursive: true });
      fs.mkdirSync(footageDir, { recursive: true });
      fs.mkdirSync(outputDir, { recursive: true });

      console.log(`[Processor] Processing job ${job.id}`);

      // ── Step 1: Download AEP and assets ──
      await this.client.updateStatus(job.id, "DOWNLOADING", 5);

      const aepLocalPath = path.join(jobDir, job.template.aepFileName || "template.aep");

      if (job.template.aepFileUrl) {
        await this.downloadFromS3(job.template.aepFileUrl, aepLocalPath);
      }

      // Download job assets (uploaded images)
      for (const asset of job.jobAssets) {
        if (asset.folderPath && asset.footageItemName) {
          const assetDir = path.join(footageDir, asset.folderPath);
          fs.mkdirSync(assetDir, { recursive: true });
          const assetPath = path.join(assetDir, asset.footageItemName);
          await this.downloadFromS3(asset.fileUrl, assetPath);
        } else {
          const assetPath = path.join(footageDir, asset.originalName);
          await this.downloadFromS3(asset.fileUrl, assetPath);
        }
      }

      await this.client.updateStatus(job.id, "DOWNLOADING", 20);

      // ── Step 2: Build footage replacements ──
      const footageReplacements: { originalName: string; newFilePath: string }[] = [];

      for (const asset of job.jobAssets) {
        if (asset.footageItemName) {
          const replacementPath = asset.folderPath
            ? path.join(footageDir, asset.folderPath, asset.footageItemName)
            : path.join(footageDir, asset.originalName);
          footageReplacements.push({
            originalName: asset.footageItemName,
            newFilePath: replacementPath,
          });
        }
      }

      // ── Step 3: Generate JSX ──
      await this.client.updateStatus(job.id, "RENDERING", 25);

      const outputAepPath = path.join(outputDir, "output.aep");
      const outputMp4Path = path.join(outputDir, "output.mp4");

      const jsxCode = buildJsx(
        job,
        aepLocalPath,
        outputAepPath,
        outputMp4Path,
        footageReplacements
      );

      const jsxPath = path.join(jobDir, `job_${job.id}.jsx`);
      fs.writeFileSync(jsxPath, jsxCode, "utf-8");
      console.log(`[Processor] JSX written to ${jsxPath}`);

      // ── Step 4: Run After Effects ──
      await this.client.updateStatus(job.id, "RENDERING", 30);

      await runAfterEffects({
        aePath: this.aePath,
        jsxFilePath: jsxPath,
        outputMp4Path,
        timeoutMs: 600000, // 10 min
        onProgress: async (progress) => {
          const mapped = 30 + Math.floor(progress * 0.5); // Map 0-100 to 30-80
          try {
            await this.client.updateStatus(job.id, "RENDERING", mapped);
          } catch {
            // Ignore progress update errors
          }
        },
      });

      console.log(`[Processor] Render complete for job ${job.id}`);

      // ── Step 5: Upload results ──
      await this.client.updateStatus(job.id, "UPLOADING", 85);

      let mp4Key: string | undefined;
      let aepKey: string | undefined;

      if (fs.existsSync(outputMp4Path)) {
        mp4Key = `outputs/${job.id}/output.mp4`;
        await this.uploadToS3(outputMp4Path, mp4Key, "video/mp4");
        await this.client.updateStatus(job.id, "UPLOADING", 92);
      }

      if (fs.existsSync(outputAepPath)) {
        aepKey = `outputs/${job.id}/output.aep`;
        await this.uploadToS3(outputAepPath, aepKey, "application/octet-stream");
        await this.client.updateStatus(job.id, "UPLOADING", 98);
      }

      // ── Step 6: Submit result ──
      await this.client.submitResult(job.id, mp4Key, aepKey);
      await this.client.updateStatus(job.id, "COMPLETED", 100);

      console.log(`[Processor] Job ${job.id} completed successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Processor] Job ${job.id} failed:`, errorMessage);

      try {
        await this.client.updateStatus(
          job.id,
          "FAILED",
          undefined,
          errorMessage
        );
      } catch {
        console.error("[Processor] Failed to report error to API");
      }
    } finally {
      // Cleanup work directory
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
        console.log(`[Processor] Cleaned up ${jobDir}`);
      } catch {
        console.warn(`[Processor] Failed to cleanup ${jobDir}`);
      }
    }
  }

  private async downloadFromS3(key: string, localPath: string): Promise<void> {
    console.log(`[S3] Downloading ${key} -> ${localPath}`);

    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      })
    );

    const stream = response.Body;
    if (!stream) throw new Error(`Empty response for key ${key}`);

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const dir = path.dirname(localPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, Buffer.concat(chunks));
  }

  private async uploadToS3(
    localPath: string,
    key: string,
    contentType: string
  ): Promise<void> {
    console.log(`[S3] Uploading ${localPath} -> ${key}`);

    const body = fs.readFileSync(localPath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }
}
