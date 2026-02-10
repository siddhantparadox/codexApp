import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { hostname } from "node:os";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { URL } from "node:url";

import { toString as toQrString } from "qrcode";
import { WebSocketServer, type RawData, type WebSocket } from "ws";

import { buildPairingPayload, createPairingToken, isAuthorized, resolveAdvertisedHost } from "./pairing";

interface BridgeServerOptions {
  host: string;
  port: number;
  advertisedHost?: string;
  pairingToken?: string;
  mode?: "lan" | "tailscale";
  codexBin?: string;
  codexArgs?: string[];
}

export class BridgeServer {
  private readonly host: string;
  private readonly port: number;
  private readonly mode: "lan" | "tailscale";
  private readonly pairingToken: string;
  private readonly codexBin: string;
  private readonly codexArgs: string[];

  private readonly clients = new Set<WebSocket>();
  private readonly httpServer;
  private readonly wsServer;
  private readonly advertisedHost: string;

  private codexProcess?: ReturnType<typeof spawn>;
  private started = false;

  constructor(options: BridgeServerOptions) {
    this.host = options.host;
    this.port = options.port;
    this.mode = options.mode ?? "lan";
    this.pairingToken = options.pairingToken ?? createPairingToken();
    this.codexBin = options.codexBin ?? "codex";
    this.codexArgs = options.codexArgs ?? ["app-server"];
    this.advertisedHost = resolveAdvertisedHost(options.advertisedHost, this.mode);

    this.httpServer = createServer((req, res) => this.handleHttp(req, res));
    this.wsServer = new WebSocketServer({ noServer: true });

    this.httpServer.on("upgrade", (request, socket, head) => {
      const parsed = new URL(request.url ?? "/", `http://${request.headers.host}`);
      if (parsed.pathname !== "/ws") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      if (!isAuthorized(this.pairingToken, request.headers.authorization, parsed.searchParams.get("token"))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wsServer.handleUpgrade(request, socket, head, (ws) => {
        this.wsServer.emit("connection", ws, request);
      });
    });

    this.wsServer.on("connection", (ws) => this.handleSocket(ws));
  }

  get wsUrl(): string {
    return `ws://${this.advertisedHost}:${this.port}/ws`;
  }

  get pairingPayload() {
    return buildPairingPayload({
      machineName: hostname(),
      mode: this.mode,
      wsUrl: this.wsUrl,
      pairingToken: this.pairingToken,
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.spawnCodex();

    await new Promise<void>((resolve) => {
      this.httpServer.listen(this.port, this.host, () => resolve());
    });

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.clients.forEach((client) => client.close());

    await new Promise<void>((resolve) => {
      this.wsServer.close(() => resolve());
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    this.codexProcess?.kill("SIGTERM");
    this.started = false;
  }

  async printPairingQr(): Promise<void> {
    const payload = JSON.stringify(this.pairingPayload);
    const qr = await toQrString(payload, { type: "terminal", small: true });

    console.log("\nScan this QR payload in Codex Mobile:\n");
    console.log(String(qr));
    console.log(payload);
  }

  private spawnCodex(): void {
    const shell = process.platform === "win32"
      ? (process.env.CODEX_SHELL ?? "pwsh.exe")
      : false;

    this.codexProcess = spawn(this.codexBin, this.codexArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
      shell,
    });

    this.codexProcess.on("error", (error) => {
      console.error(`Failed to start codex app-server: ${error.message}`);
      this.broadcastJson({
        method: "bridge/error",
        params: {
          message: `Failed to start codex app-server: ${error.message}`,
        },
      });
    });

    const stdout = this.codexProcess.stdout;
    if (stdout) {
      const rl = createInterface({ input: stdout });
      rl.on("line", (line) => {
        this.broadcastRaw(line);
      });
    }

    this.codexProcess.stderr?.on("data", (chunk) => {
      console.error(`[codex app-server] ${chunk.toString().trim()}`);
    });

    this.codexProcess.on("exit", (code, signal) => {
      this.broadcastJson({
        method: "bridge/codexExited",
        params: {
          code,
          signal,
        },
      });
    });
  }

  private handleSocket(ws: WebSocket): void {
    this.clients.add(ws);
    ws.send(
      JSON.stringify({
        method: "bridge/connected",
        params: {
          ts: Date.now(),
        },
      }),
    );

    ws.on("message", (data) => this.handleClientMessage(ws, data));
    ws.on("close", () => {
      this.clients.delete(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, data: RawData): void {
    const text = this.rawDataToText(data);

    try {
      JSON.parse(text);
    } catch {
      ws.send(
        JSON.stringify({
          method: "bridge/error",
          params: { message: "Invalid JSON payload" },
        }),
      );
      return;
    }

    const stdin = this.codexProcess?.stdin;
    if (!stdin || stdin.destroyed || !stdin.writable) {
      ws.send(
        JSON.stringify({
          method: "bridge/error",
          params: { message: "Codex app-server stdin is unavailable" },
        }),
      );
      return;
    }

    stdin.write(`${text}\n`);
  }

  private rawDataToText(data: RawData): string {
    if (typeof data === "string") {
      return data;
    }

    if (Array.isArray(data)) {
      const chunks = data.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      return Buffer.concat(chunks).toString("utf8");
    }

    if (Buffer.isBuffer(data)) {
      return data.toString("utf8");
    }

    if (data instanceof ArrayBuffer) {
      return Buffer.from(data).toString("utf8");
    }

    return Buffer.from(data).toString("utf8");
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const parsed = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && parsed.pathname === "/health") {
      this.writeJson(res, 200, {
        ok: true,
        connectedClients: this.clients.size,
      });
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/pairing") {
      this.writeJson(res, 200, this.pairingPayload);
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/") {
      this.writeJson(res, 200, {
        service: "codex-remote-bridge",
        wsUrl: this.wsUrl,
        pairingPath: "/pairing",
      });
      return;
    }

    this.writeJson(res, 404, { error: "Not Found" });
  }

  private broadcastRaw(line: string): void {
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(line);
      }
    }
  }

  private broadcastJson(payload: unknown): void {
    const serialized = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(serialized);
      }
    }
  }

  private writeJson(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.setHeader("content-length", Buffer.byteLength(body));
    res.end(body);
  }
}
