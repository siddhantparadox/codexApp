import type {
  AccountRateLimitsReadResult,
  AccountReadResult,
  ApprovalDecision,
  CommandApprovalRequest,
  FileApprovalRequest,
  JsonRpcFailure,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
  ThreadListResult,
  TurnState,
  UserInput,
} from "./types";

export interface MessageTransport {
  send: (message: JsonRpcRequest | JsonRpcNotification | JsonRpcResponse) => void;
  onMessage: (listener: (message: JsonRpcMessage) => void) => () => void;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class CodexClient {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private unsubscribe?: () => void;
  private notificationListeners = new Set<(notification: JsonRpcNotification) => void>();
  private requestListeners = new Set<(request: JsonRpcRequest) => void>();

  constructor(private readonly transport: MessageTransport) {
    this.unsubscribe = transport.onMessage((message) => this.handleMessage(message));
  }

  dispose(): void {
    this.unsubscribe?.();
    this.pending.forEach(({ reject }) => reject(new Error("Client disposed")));
    this.pending.clear();
  }

  onNotification(listener: (notification: JsonRpcNotification) => void): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onServerRequest(listener: (request: JsonRpcRequest) => void): () => void {
    this.requestListeners.add(listener);
    return () => this.requestListeners.delete(listener);
  }

  async initialize(clientInfo: { name: string; title: string; version: string }): Promise<unknown> {
    const result = await this.request("initialize", { clientInfo });
    this.notify("initialized", {});
    return result;
  }

  threadStart(params: {
    model?: string;
    cwd?: string;
    sandbox?: string;
    approvalPolicy?: string;
    personality?: string;
  }): Promise<{ thread: { id: string } }> {
    return this.request("thread/start", params);
  }

  threadResume(params: { threadId: string }): Promise<{ thread: { id: string } }> {
    return this.request("thread/resume", params);
  }

  threadFork(params: { threadId: string }): Promise<{ thread: { id: string } }> {
    return this.request("thread/fork", params);
  }

  threadList(params?: {
    cursor?: string | null;
    limit?: number;
    sortKey?: "created_at" | "updated_at";
    archived?: boolean;
    sourceKinds?: string[];
    modelProviders?: string[];
  }): Promise<ThreadListResult> {
    return this.request("thread/list", params ?? {});
  }

  turnStart(params: {
    threadId: string;
    input: UserInput[];
    model?: string;
    effort?: string;
    cwd?: string;
    approvalPolicy?: string;
    sandboxPolicy?: unknown;
  }): Promise<{ turn: TurnState }> {
    return this.request("turn/start", params);
  }

  turnInterrupt(params: { threadId: string; turnId: string }): Promise<unknown> {
    return this.request("turn/interrupt", params);
  }

  threadRead(params: { threadId: string; includeTurns?: boolean }): Promise<unknown> {
    return this.request("thread/read", params);
  }

  accountRead(params?: { refreshToken?: boolean }): Promise<AccountReadResult> {
    return this.request("account/read", params ?? { refreshToken: false });
  }

  accountRateLimitsRead(): Promise<AccountRateLimitsReadResult> {
    return this.request("account/rateLimits/read");
  }

  respondToCommandApproval(
    requestId: number,
    params: { decision: ApprovalDecision; acceptSettings?: unknown },
  ): void {
    this.respond(requestId, params);
  }

  respondToFileApproval(requestId: number, params: { decision: ApprovalDecision }): void {
    this.respond(requestId, params);
  }

  isCommandApproval(request: JsonRpcRequest): request is JsonRpcRequest<CommandApprovalRequest> {
    return request.method === "item/commandExecution/requestApproval";
  }

  isFileApproval(request: JsonRpcRequest): request is JsonRpcRequest<FileApprovalRequest> {
    return request.method === "item/fileChange/requestApproval";
  }

  private request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;

    const message: JsonRpcRequest = params === undefined ? { id, method } : { id, method, params };
    this.transport.send(message);

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  private notify(method: string, params?: unknown): void {
    const message: JsonRpcNotification = params === undefined ? { method } : { method, params };
    this.transport.send(message);
  }

  private respond(id: number, result: unknown): void {
    this.transport.send({ id, result } as JsonRpcSuccess);
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (this.isResponse(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if ("error" in message) {
        pending.reject(new Error(message.error.message));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    if (this.isRequest(message)) {
      this.requestListeners.forEach((listener) => listener(message));
      return;
    }

    this.notificationListeners.forEach((listener) => listener(message));
  }

  private isResponse(message: JsonRpcMessage): message is JsonRpcFailure | JsonRpcSuccess {
    return "id" in message && ("result" in message || "error" in message);
  }

  private isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
    return "id" in message && "method" in message;
  }
}
