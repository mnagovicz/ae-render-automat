import { ApiClient } from "./api-client";

export class HeartbeatManager {
  private intervalId: NodeJS.Timeout | null = null;
  private client: ApiClient;
  private intervalMs: number;

  constructor(client: ApiClient, intervalMs: number = 30000) {
    this.client = client;
    this.intervalMs = intervalMs;
  }

  start() {
    this.stop();
    this.send();
    this.intervalId = setInterval(() => this.send(), this.intervalMs);
    console.log(
      `[Heartbeat] Started (interval: ${this.intervalMs}ms)`
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async send() {
    try {
      await this.client.heartbeat();
    } catch (err) {
      console.error("[Heartbeat] Failed:", (err as Error).message);
    }
  }
}
