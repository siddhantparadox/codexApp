export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcRequest<P = unknown> {
  id: number;
  method: string;
  params?: P;
}

export interface JsonRpcNotification<P = unknown> {
  method: string;
  params?: P;
}

export interface JsonRpcSuccess<R = unknown> {
  id: number;
  result: R;
}

export interface JsonRpcFailure {
  id: number;
  error: JsonRpcError;
}

export type JsonRpcResponse<R = unknown> = JsonRpcSuccess<R> | JsonRpcFailure;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export interface ThreadSummary {
  id: string;
  preview?: string;
  createdAt?: number;
  updatedAt?: number;
  modelProvider?: string;
}

export interface TurnState {
  id: string;
  status: "inProgress" | "completed" | "failed" | "interrupted";
  items: ThreadItem[];
  error: JsonValue | null;
}

export interface TextInput {
  type: "text";
  text: string;
}

export interface ImageInput {
  type: "image";
  url: string;
}

export interface LocalImageInput {
  type: "localImage";
  path: string;
}

export interface SkillInput {
  type: "skill";
  name: string;
  path: string;
}

export interface MentionInput {
  type: "mention";
  name: string;
  path: string;
}

export type UserInput = TextInput | ImageInput | LocalImageInput | SkillInput | MentionInput;

export interface ThreadItemBase {
  id: string;
  type: string;
}

export interface UserMessageItem extends ThreadItemBase {
  type: "userMessage";
  content: UserInput[];
}

export interface AgentMessageItem extends ThreadItemBase {
  type: "agentMessage";
  text: string;
}

export interface CommandExecutionItem extends ThreadItemBase {
  type: "commandExecution";
  command?: string[];
  cwd?: string;
  status?: "inProgress" | "completed" | "failed" | "declined";
  aggregatedOutput?: string;
  exitCode?: number;
  durationMs?: number;
}

export interface FileChange {
  path: string;
  kind: string;
  diff?: string;
}

export interface FileChangeItem extends ThreadItemBase {
  type: "fileChange";
  status?: "inProgress" | "completed" | "failed" | "declined";
  changes?: FileChange[];
}

export interface PlanItem extends ThreadItemBase {
  type: "plan";
  text: string;
}

export interface ReasoningSummaryPart {
  type?: string;
  text?: string;
}

export interface ReasoningSummary {
  text?: string;
  content?: ReasoningSummaryPart[];
}

export interface ReasoningItem extends ThreadItemBase {
  type: "reasoning";
  summary?: ReasoningSummary[];
  content?: unknown[];
}

export interface McpToolCallItem extends ThreadItemBase {
  type: "mcpToolCall";
  server?: string;
  tool?: string;
  status?: "inProgress" | "completed" | "failed";
  arguments?: JsonValue;
  result?: JsonValue;
  error?: JsonValue;
}

export interface WebSearchItem extends ThreadItemBase {
  type: "webSearch";
  query?: string;
}

export interface ImageViewItem extends ThreadItemBase {
  type: "imageView";
  path?: string;
}

export interface EnteredReviewModeItem extends ThreadItemBase {
  type: "enteredReviewMode";
  review?: string;
}

export interface ExitedReviewModeItem extends ThreadItemBase {
  type: "exitedReviewMode";
  review?: string;
}

export interface ContextCompactionItem extends ThreadItemBase {
  type: "contextCompaction";
}

export type ThreadItem =
  | UserMessageItem
  | AgentMessageItem
  | CommandExecutionItem
  | FileChangeItem
  | PlanItem
  | ReasoningItem
  | McpToolCallItem
  | WebSearchItem
  | ImageViewItem
  | EnteredReviewModeItem
  | ExitedReviewModeItem
  | ContextCompactionItem;

export interface CommandApprovalRequest {
  itemId: string;
  threadId: string;
  turnId: string;
  reason?: string;
  risk?: string;
  parsedCmd?: string[];
}

export interface FileApprovalRequest {
  itemId: string;
  threadId: string;
  turnId: string;
  reason?: string;
}

export type ApprovalDecision = "accept" | "decline";

export interface PlanEntry {
  step: string;
  status: "pending" | "inProgress" | "completed";
}

export interface ThreadListResult {
  data: ThreadSummary[];
  nextCursor: string | null;
}

export interface TurnPlanUpdated {
  turnId: string;
  explanation?: string;
  plan: PlanEntry[];
}

export interface AccountApiKey {
  type: "apiKey";
}

export interface AccountChatGpt {
  type: "chatgpt";
  email?: string;
  planType?: string;
}

export interface AccountChatGptAuthTokens {
  type: "chatgptAuthTokens";
  email?: string;
  planType?: string;
}

export type AccountInfo = AccountApiKey | AccountChatGpt | AccountChatGptAuthTokens;

export interface AccountReadResult {
  account: AccountInfo | null;
  requiresOpenaiAuth: boolean;
}

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number;
  resetsAt: number;
}

export interface AccountRateLimits {
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
}

export interface AccountRateLimitsReadResult {
  rateLimits: AccountRateLimits;
}
