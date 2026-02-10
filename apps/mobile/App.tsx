
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";

import {
  CodexClient,
  createTimelineState,
  reduceNotification,
  type AccountInfo,
  type AccountRateLimits,
  type CodexTimelineState,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type MessageTransport,
  type ThreadItem,
  type ThreadSummary,
} from "@codex-remote/protocol";

import { parsePairingPayload, withToken } from "./src/pairing";
import { isThreadUnavailableError } from "./src/connectionErrors";
import { loadSavedConnections, persistSavedConnections } from "./src/storage";
import { colors } from "./src/theme";
import type { SavedConnection } from "./src/types";

type ConnState = "idle" | "connecting" | "connected" | "error";

interface PendingApproval {
  requestId: number;
  method: "item/commandExecution/requestApproval" | "item/fileChange/requestApproval";
  threadId: string;
  reason?: string;
  risk?: string;
  parsedCmd?: string[];
}

type Row =
  | { key: string; type: "item"; item: ThreadItem }
  | { key: string; type: "approval"; approval: PendingApproval }
  | { key: string; type: "plan"; text: string }
  | { key: string; type: "diff"; text: string };

interface LiveSession {
  ws: WebSocket;
  client: CodexClient;
}

const QUICK_ACTIONS = [
  { label: "Run tests", prompt: "Run tests, summarize failures, and suggest fixes." },
  { label: "Run lint", prompt: "Run lint, fix safe issues, and summarize remaining warnings." },
  { label: "Explain CI", prompt: "Explain likely CI failure causes and propose a fix." },
] as const;

const MOBILE_THREAD_SOURCES = ["appServer"];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  topTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 16, textAlign: "center" },
  topSub: { color: colors.textSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, textAlign: "center" },
  list: { flex: 1, padding: 12 },
  userWrap: { alignItems: "flex-end", marginBottom: 10 },
  userBubble: { backgroundColor: colors.accent, borderRadius: 14, borderTopRightRadius: 6, maxWidth: "90%", padding: 10 },
  userText: { color: colors.bg, fontSize: 15, fontWeight: "700" },
  card: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface1, marginBottom: 10 },
  cardBody: { padding: 12 },
  cardTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 },
  text: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  codeWrap: { marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.bg, padding: 10 },
  code: { color: colors.accent, fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  deny: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface2, alignItems: "center", paddingVertical: 8 },
  allow: { flex: 1, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", paddingVertical: 8 },
  denyText: { color: colors.textPrimary, fontWeight: "700" },
  allowText: { color: colors.bg, fontWeight: "800" },
  composer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface1, padding: 10 },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#13628A", borderRadius: 999, backgroundColor: "#082536", paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  badgeText: { color: colors.info, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  inputRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  smallBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface1, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, maxHeight: 120, paddingVertical: 4 },
  send: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  footerMeta: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 8, opacity: 0.7 },
  footerMetaText: { color: colors.textSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  onboarding: { flex: 1, justifyContent: "center", padding: 20, gap: 14 },
  h1: { color: colors.textPrimary, fontSize: 38, fontWeight: "800", textAlign: "center" },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 14, minHeight: 56, alignItems: "center", justifyContent: "center" },
  btnSecondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 56, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { color: colors.bg, fontSize: 20, fontWeight: "800" },
  btnSecondaryText: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  helper: { color: colors.textSecondary, textAlign: "center", fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 16 },
  modalCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface1, padding: 14, gap: 10 },
  modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  inputField: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface2, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 10 },
  drawerWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", flexDirection: "row" },
  drawer: { width: "84%", backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border },
  drawerHeader: { padding: 12, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  drawerTitle: { color: colors.textPrimary, fontSize: 32, fontWeight: "800" },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface1, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8 },
  section: { color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 10, marginBottom: 6, fontWeight: "700" },
  thread: { borderRadius: 10, padding: 10, marginBottom: 5 },
  threadActive: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface1 },
  threadTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  threadMeta: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
});

function makeConnectionId(name: string): string {
  return `${name}-${Date.now()}`;
}

function previewTitle(thread: ThreadSummary): string {
  const preview = thread.preview?.trim();
  if (!preview) return "New chat";
  return preview.length > 44 ? `${preview.slice(0, 44)}...` : preview;
}

function toText(data: unknown): string {
  return typeof data === "string" ? data : "";
}

function upsertThread(list: ThreadSummary[], incoming: ThreadSummary): ThreadSummary[] {
  const idx = list.findIndex((item) => item.id === incoming.id);
  if (idx === -1) return [incoming, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...incoming };
  return next;
}

function threadGroup(ts?: number): "Today" | "Yesterday" | "Previous 7 days" | "Older" {
  if (!ts) return "Older";
  const now = new Date();
  const target = new Date(ts * 1000);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const days = Math.floor((a - b) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  return "Older";
}

function buildRows(state: CodexTimelineState, approvals: PendingApproval[], selectedThreadId: string | null): Row[] {
  const rows: Row[] = state.items.map((item) => ({ key: `item-${item.id}`, type: "item", item }));
  approvals.filter((a) => a.threadId === selectedThreadId).forEach((approval) => rows.push({ key: `approval-${approval.requestId}`, type: "approval", approval }));
  if (state.latestPlan?.plan.length) {
    rows.push({ key: "plan-latest", type: "plan", text: state.latestPlan.plan.map((entry) => `${entry.status === "completed" ? "[x]" : "[ ]"} ${entry.step}`).join("\n") });
  }
  if (state.latestDiff) rows.push({ key: "diff-latest", type: "diff", text: state.latestDiff });
  return rows;
}

function statusLabel(state: ConnState): string {
  if (state === "connected") return "Connected";
  if (state === "connecting") return "Connecting";
  if (state === "error") return "Error";
  return "Offline";
}

function accountName(account: AccountInfo | null): string {
  if (!account) return "local_user";
  if (account.type === "chatgpt") return account.email ?? "chatgpt_user";
  if (account.type === "chatgptAuthTokens") return account.email ?? "managed_tokens";
  return "api_key_user";
}

function accountPlan(account: AccountInfo | null): string {
  if (!account) return "Local Mode";
  if (account.type === "chatgpt" || account.type === "chatgptAuthTokens") return account.planType ?? "ChatGPT";
  return "API Key";
}

export default function App(): React.ReactElement {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [timelines, setTimelines] = useState<Record<string, CodexTimelineState>>({});
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [running, setRunning] = useState(false);
  const [turnId, setTurnId] = useState<string | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [manualName, setManualName] = useState("My Computer");
  const [manualWsUrl, setManualWsUrl] = useState("ws://127.0.0.1:8787/ws");
  const [manualToken, setManualToken] = useState("");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [expandedCommands, setExpandedCommands] = useState<Record<string, boolean>>({});
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [expandedDiff, setExpandedDiff] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [rateLimits, setRateLimits] = useState<AccountRateLimits | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectInFlightRef = useRef(false);
  const autoConnectAttemptedRef = useRef<string | null>(null);
  const selectedThreadRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Row> | null>(null);
  selectedThreadRef.current = selectedThreadId;

  const activeConnection = useMemo(() => connections.find((item) => item.id === activeConnectionId) ?? null, [connections, activeConnectionId]);
  const timeline = selectedThreadId ? timelines[selectedThreadId] ?? createTimelineState() : createTimelineState();
  const rows = useMemo(() => buildRows(timeline, approvals, selectedThreadId), [timeline, approvals, selectedThreadId]);
  const elapsed = !running || !turnStartedAt ? 0 : Math.floor((Date.now() - turnStartedAt) / 1000);

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => previewTitle(thread).toLowerCase().includes(q) || thread.id.toLowerCase().includes(q));
  }, [query, threads]);

  const groupedThreads = useMemo(() => {
    const grouped: Record<string, ThreadSummary[]> = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
    filteredThreads.forEach((thread) => grouped[threadGroup(thread.updatedAt ?? thread.createdAt)].push(thread));
    return grouped;
  }, [filteredThreads]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    void loadSavedConnections().then((stored) => {
      const now = Math.floor(Date.now() / 1000);
      const valid = stored.filter((connection) => connection.expiresAt > now);
      setConnections(valid);
      if (valid.length) setActiveConnectionId(valid[0].id);
    }).catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    void persistSavedConnections(connections);
  }, [connections]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [rows.length]);

  const disconnect = useCallback(() => {
    connectInFlightRef.current = false;
    const active = sessionRef.current;
    if (active) {
      intentionalCloseRef.current = true;
      active.client.dispose();
      active.ws.close();
    } else {
      intentionalCloseRef.current = false;
    }
    sessionRef.current = null;
    setConnState("idle");
    setThreads([]);
    setSelectedThreadId(null);
    setTimelines({});
    setApprovals([]);
    setRunning(false);
    setTurnId(null);
    setTurnStartedAt(null);
  }, []);

  const onNotification = useCallback((notification: JsonRpcNotification) => {
    if (notification.method.startsWith("bridge/")) return;
    if (notification.method === "turn/started") {
      const params = (notification.params ?? {}) as { turn?: { id?: string } };
      setTurnId(params.turn?.id ?? null);
      setRunning(true);
      setTurnStartedAt(Date.now());
    }
    if (notification.method === "turn/completed") {
      setTurnId(null);
      setRunning(false);
      setTurnStartedAt(null);
    }
    if (notification.method === "account/rateLimits/updated") {
      const params = (notification.params ?? {}) as { rateLimits?: AccountRateLimits };
      if (params.rateLimits) setRateLimits(params.rateLimits);
      return;
    }
    const params = (notification.params ?? {}) as { threadId?: string; thread?: ThreadSummary };
    if (notification.method === "thread/started" && params.thread?.id) setThreads((current) => upsertThread(current, params.thread as ThreadSummary));
    const threadId = params.threadId ?? selectedThreadRef.current;
    if (!threadId) return;
    if (notification.method.startsWith("item/") || notification.method.startsWith("turn/")) {
      setTimelines((current) => ({ ...current, [threadId]: reduceNotification(current[threadId] ?? createTimelineState(), notification) }));
    }
  }, []);

  const hydrateThread = useCallback(async (client: CodexClient, threadId: string): Promise<boolean> => {
    try {
      setSelectedThreadId(threadId);
      await client.threadResume({ threadId });
      const read = (await client.threadRead({ threadId, includeTurns: true })) as { thread?: { turns?: Array<{ items?: ThreadItem[] }> } };
      let state = createTimelineState();
      for (const turn of read.thread?.turns ?? []) {
        for (const item of turn.items ?? []) {
          state = reduceNotification(state, { method: "item/completed", params: { item } });
        }
      }
      setTimelines((current) => ({ ...current, [threadId]: state }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open thread";
      if (isThreadUnavailableError(message)) {
        setThreads((current) => current.filter((thread) => thread.id !== threadId));
        setSelectedThreadId(null);
        setError("A stale thread was removed. Start a new chat and retry.");
      } else {
        setError(message);
      }
      return false;
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    const client = sessionRef.current?.client;
    if (!client) return;
    const list = await client.threadList({ limit: 50, sortKey: "updated_at", sourceKinds: MOBILE_THREAD_SOURCES });
    setThreads(list.data ?? []);
  }, []);

  const connect = useCallback(async (connection: SavedConnection) => {
    if (connectInFlightRef.current) {
      return;
    }
    connectInFlightRef.current = true;

    const existing = sessionRef.current;
    if (existing) {
      intentionalCloseRef.current = true;
      existing.client.dispose();
      existing.ws.close();
      sessionRef.current = null;
    } else {
      intentionalCloseRef.current = false;
    }
    intentionalCloseRef.current = false;
    setError(null);
    setConnState("connecting");
    try {
      const ws = new WebSocket(withToken(connection.baseUrl, connection.pairingToken));
      const listeners = new Set<(message: JsonRpcMessage) => void>();
      const transport: MessageTransport = {
        send: (message) => ws.send(JSON.stringify(message)),
        onMessage: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Connection timed out")), 9000);
        ws.onopen = () => { clearTimeout(timer); resolve(); };
        ws.onerror = () => { clearTimeout(timer); reject(new Error("Unable to connect to bridge")); };
      });
      ws.onmessage = (event) => {
        const line = toText(event.data);
        if (!line) return;
        try {
          const parsed = JSON.parse(line) as JsonRpcMessage;
          listeners.forEach((listener) => listener(parsed));
        } catch {
          // Ignore malformed payloads.
        }
      };
      ws.onclose = () => {
        if (sessionRef.current && sessionRef.current.ws !== ws) {
          return;
        }

        sessionRef.current = null;
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false;
          setConnState("idle");
          return;
        }

        setConnState("error");
        setError((current) => current ?? "Connection to bridge was closed.");
      };
      const client = new CodexClient(transport);
      client.onNotification(onNotification);
      client.onServerRequest((request: JsonRpcRequest) => {
        if (request.method !== "item/commandExecution/requestApproval" && request.method !== "item/fileChange/requestApproval") return;
        const params = (request.params ?? {}) as { threadId: string; reason?: string; risk?: string; parsedCmd?: string[] };
        const method = request.method;
        setApprovals((current) => [...current, { requestId: request.id, method, threadId: params.threadId, reason: params.reason, risk: params.risk, parsedCmd: params.parsedCmd }]);
      });
      sessionRef.current = { ws, client };
      await client.initialize({ name: "codex_mobile", title: "Codex Mobile", version: "0.2.0" });
      const list = await client.threadList({ limit: 50, sortKey: "updated_at", sourceKinds: MOBILE_THREAD_SOURCES });
      setThreads(list.data ?? []);
      setSelectedThreadId(null);
      setTimelines({});
      try { const accountRead = await client.accountRead(); setAccount(accountRead.account); } catch { setAccount(null); }
      try { const limits = await client.accountRateLimitsRead(); setRateLimits(limits.rateLimits); } catch { setRateLimits(null); }
      setConnState("connected");
    } catch (err) {
      setConnState("error");
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      connectInFlightRef.current = false;
    }
  }, [onNotification]);

  useEffect(() => {
    if (!activeConnection) {
      autoConnectAttemptedRef.current = null;
      return;
    }
    if (autoConnectAttemptedRef.current === activeConnection.id) {
      return;
    }
    if (sessionRef.current || connectInFlightRef.current) {
      return;
    }

    autoConnectAttemptedRef.current = activeConnection.id;
    void connect(activeConnection);
  }, [activeConnection, connect]);
  const addConnection = useCallback((connection: SavedConnection) => {
    setConnections((current) => [connection, ...current.filter((item) => item.baseUrl !== connection.baseUrl)]);
    setActiveConnectionId(connection.id);
    setScannerOpen(false);
    setManualOpen(false);
    setScanLocked(false);
  }, []);

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (scanLocked) return;
    setScanLocked(true);
    try {
      const payload = parsePairingPayload(result.data);
      addConnection({ ...payload, id: makeConnectionId(payload.name), createdAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid QR payload");
    } finally {
      setTimeout(() => setScanLocked(false), 1400);
    }
  }, [addConnection, scanLocked]);

  const addManualConnection = useCallback(() => {
    if (!manualName || !manualWsUrl || !manualToken) {
      setError("Name, websocket URL, and token are required.");
      return;
    }
    try {
      const url = new URL(manualWsUrl);
      if (url.protocol !== "ws:" && url.protocol !== "wss:") throw new Error("URL must start with ws:// or wss://");
      addConnection({ v: 1, id: makeConnectionId(manualName), name: manualName, mode: "lan", baseUrl: manualWsUrl, pairingToken: manualToken, expiresAt: Math.floor(Date.now() / 1000) + 31536000, createdAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid websocket URL");
    }
  }, [addConnection, manualName, manualToken, manualWsUrl]);

  const createThread = useCallback(async (): Promise<string | null> => {
    const client = sessionRef.current?.client;
    if (!client) return null;
    const started = await client.threadStart({});
    const id = started.thread.id;
    const now = Math.floor(Date.now() / 1000);
    setThreads((current) => upsertThread(current, { id, preview: "New chat", createdAt: now, updatedAt: now, modelProvider: "openai" }));
    setSelectedThreadId(id);
    setTimelines((current) => ({ ...current, [id]: createTimelineState() }));
    return id;
  }, []);

  const sendPrompt = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const client = sessionRef.current?.client;
    if (!client) {
      setError("Bridge is not connected.");
      return;
    }
    let threadId = selectedThreadRef.current;
    if (!threadId) threadId = await createThread();
    if (!threadId) return;
    setTimelines((current) => ({ ...current, [threadId]: reduceNotification(current[threadId] ?? createTimelineState(), { method: "item/completed", params: { item: { type: "userMessage", id: `local-${Date.now()}`, content: [{ type: "text", text: trimmed }] } } }) }));
    setRunning(true);
    setTurnStartedAt(Date.now());
    try {
      await client.turnStart({ threadId, input: [{ type: "text", text: trimmed }] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start turn";
      if (isThreadUnavailableError(message)) {
        setThreads((current) => current.filter((thread) => thread.id !== threadId));
        if (selectedThreadRef.current === threadId) {
          setSelectedThreadId(null);
        }

        const fallbackThreadId = await createThread();
        if (fallbackThreadId) {
          try {
            await client.turnStart({ threadId: fallbackThreadId, input: [{ type: "text", text: trimmed }] });
            return;
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : "Failed to start turn");
          }
        } else {
          setError("Unable to create a new thread.");
        }
      } else {
        setError(message);
      }
      setRunning(false);
      setTurnStartedAt(null);
    }
  }, [createThread]);

  const sendMessage = useCallback(async () => {
    const text = composer.trim();
    if (!text) return;
    setComposer("");
    await sendPrompt(text);
  }, [composer, sendPrompt]);

  const stopTurn = useCallback(async () => {
    const client = sessionRef.current?.client;
    const threadId = selectedThreadRef.current;
    if (!client || !threadId || !turnId) return;
    await client.turnInterrupt({ threadId, turnId });
    setRunning(false);
    setTurnId(null);
    setTurnStartedAt(null);
  }, [turnId]);

  const decideApproval = useCallback((approval: PendingApproval, decision: "accept" | "decline") => {
    const client = sessionRef.current?.client;
    if (!client) return;
    if (approval.method === "item/commandExecution/requestApproval") client.respondToCommandApproval(approval.requestId, { decision });
    else client.respondToFileApproval(approval.requestId, { decision });
    setApprovals((current) => current.filter((item) => item.requestId !== approval.requestId));
  }, []);

  const renderRow = useCallback(({ item }: { item: Row }) => {
    if (item.type === "approval") {
      return <View style={styles.card}><View style={styles.cardBody}><Text style={styles.cardTitle}>TERMINAL PERMISSION</Text><Text style={styles.muted}>{item.approval.reason ?? "Action requires approval."}</Text>{item.approval.risk ? <Text style={styles.muted}>Risk: {item.approval.risk}</Text> : null}{item.approval.parsedCmd?.length ? <View style={styles.codeWrap}><Text style={styles.code}>$ {item.approval.parsedCmd.join(" ")}</Text></View> : null}<View style={styles.actionRow}><Pressable style={styles.deny} onPress={() => decideApproval(item.approval, "decline")}><Text style={styles.denyText}>Deny</Text></Pressable><Pressable style={styles.allow} onPress={() => decideApproval(item.approval, "accept")}><Text style={styles.allowText}>Allow</Text></Pressable></View></View></View>;
    }
    if (item.type === "plan") return <View style={styles.card}><View style={styles.cardBody}><Text style={styles.cardTitle}>EXECUTION PLAN</Text><Text style={styles.muted}>{item.text}</Text></View></View>;
    if (item.type === "diff") return <View style={styles.card}><View style={styles.cardBody}><Text style={styles.cardTitle}>CHANGES</Text><Pressable onPress={() => setExpandedDiff((v) => !v)}><Text style={styles.muted}>{expandedDiff ? "Hide diff" : "Show diff"}</Text></Pressable>{expandedDiff ? <View style={styles.codeWrap}><Text style={styles.code} numberOfLines={18}>{item.text}</Text></View> : null}</View></View>;
    if (item.item.type === "userMessage") {
      const text = item.item.content.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join(" ");
      return <View style={styles.userWrap}><View style={styles.userBubble}><Text style={styles.userText}>{text}</Text></View></View>;
    }
    if (item.item.type === "agentMessage") return <View style={styles.card}><View style={styles.cardBody}><Text style={styles.cardTitle}>CODEX</Text><Text style={styles.text}>{item.item.text || "..."}</Text></View></View>;
    if (item.item.type === "reasoning") return <View style={styles.card}><View style={styles.cardBody}><Text style={styles.cardTitle}>REASONING</Text><Text style={styles.muted}>{item.item.summary?.map((entry) => entry.text).filter(Boolean).join("\n") || "Reasoning in progress..."}</Text></View></View>;
    if (item.item.type === "commandExecution") {
      const command = item.item;
      const expanded = !!expandedCommands[item.item.id];
      const label = command.command?.join(" ") ?? "running command";
      return <View style={styles.card}><Pressable style={[styles.cardBody, { borderBottomWidth: expanded ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }]} onPress={() => setExpandedCommands((current) => ({ ...current, [item.item.id]: !current[item.item.id] }))}><Text style={styles.cardTitle}>TOOL ACTIVITY</Text><Text style={styles.muted} numberOfLines={1}>{label}</Text></Pressable>{expanded ? <View style={styles.cardBody}><View style={styles.codeWrap}><Text style={styles.code}>{`$ ${label}`}</Text>{command.aggregatedOutput ? <Text style={styles.code} numberOfLines={18}>{command.aggregatedOutput}</Text> : null}</View></View> : null}</View>;
    }
    if (item.item.type === "fileChange") {
      const fileChange = item.item;
      const expanded = !!expandedFiles[item.item.id];
      return <View style={styles.card}><Pressable style={[styles.cardBody, { borderBottomWidth: expanded ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }]} onPress={() => setExpandedFiles((current) => ({ ...current, [item.item.id]: !current[item.item.id] }))}><Text style={styles.cardTitle}>PENDING REVIEW</Text><Text style={styles.muted}>{(fileChange.changes?.length ?? 0).toString()} file(s) changed</Text></Pressable>{expanded && fileChange.changes?.[0]?.diff ? <View style={styles.cardBody}><View style={styles.codeWrap}><Text style={styles.code} numberOfLines={18}>{fileChange.changes[0].diff}</Text></View></View> : null}</View>;
    }
    return <View style={styles.card}><View style={styles.cardBody}><Text style={styles.cardTitle}>{item.item.type.toUpperCase()}</Text></View></View>;
  }, [decideApproval, expandedCommands, expandedDiff, expandedFiles]);
  if (scannerOpen) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onBarcodeScanned} />
        <View style={[styles.top, { position: "absolute", top: 0, width: "100%", backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={styles.row}>
            <Text style={styles.topTitle}>Scan bridge pairing QR</Text>
            <Pressable style={styles.topBtn} onPress={() => setScannerOpen(false)}><Text style={styles.topTitle}>×</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeConnectionId) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.onboarding}>
          <Text style={styles.h1}>Connect your{"\n"}computer</Text>
          <Text style={styles.helper}>Sync Codex with your local terminal to manage tasks and deploy code from your phone.</Text>
          <Pressable style={styles.btnPrimary} onPress={() => { void (async () => { if (!cameraPermission?.granted) { const permission = await requestCameraPermission(); if (!permission.granted) { setError("Camera permission denied."); return; } } setScannerOpen(true); })(); }}><Text style={styles.btnPrimaryText}>Scan QR code</Text></Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => setManualOpen(true)}><Text style={styles.btnSecondaryText}>Enter details manually</Text></Pressable>
          {error ? <Text style={[styles.helper, { color: colors.error }]}>{error}</Text> : null}
          <Text style={styles.helper}>Works on same Wi-Fi or via <Text style={{ color: colors.accent }}>Tailscale</Text>.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <View style={styles.row}>
          <Pressable style={styles.topBtn} onPress={() => setDrawerOpen(true)}><Text style={styles.topTitle}>☰</Text></Pressable>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.topTitle} numberOfLines={1}>{threads.find((thread) => thread.id === selectedThreadId) ? previewTitle(threads.find((thread) => thread.id === selectedThreadId) as ThreadSummary) : activeConnection?.name ?? "Codex"}</Text>
            <View style={[styles.row, { justifyContent: "center", gap: 6 }]}>
              <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: connState === "connected" ? colors.accent : connState === "error" ? colors.error : colors.textSecondary }} />
              <Text style={styles.topSub}>{statusLabel(connState)}</Text>
            </View>
          </View>
          <Pressable style={styles.topBtn} onPress={() => setSettingsOpen(true)}><Text style={styles.topTitle}>⋯</Text></Pressable>
        </View>
      </View>
      <FlatList ref={listRef} style={styles.list} data={rows} renderItem={renderRow} keyExtractor={(item) => item.key} contentContainerStyle={{ paddingBottom: 20 }} />
      <View style={styles.composer}>
        <View style={styles.badge}><Text style={styles.badgeText}>{running ? `Working... ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "Ready"}</Text></View>
        {running ? <Pressable onPress={() => void stopTurn()}><Text style={[styles.topSub, { color: colors.error, textAlign: "right", marginBottom: 8 }]}>Stop Task</Text></Pressable> : null}
        <View style={styles.inputRow}>
          <Pressable style={styles.smallBtn} onPress={() => setQuickOpen(true)}><Text style={styles.topTitle}>+</Text></Pressable>
          <TextInput style={styles.input} value={composer} onChangeText={setComposer} placeholder="Type a command or ask a question..." placeholderTextColor={colors.textSecondary} multiline />
          <Pressable style={styles.send} onPress={() => void sendMessage()} disabled={!composer.trim()}><Text style={[styles.topTitle, { color: colors.bg }]}>↑</Text></Pressable>
        </View>
        <View style={styles.footerMeta}>
          <Text style={styles.footerMetaText}>Context: {timeline.items.length} items</Text>
          <Text style={styles.footerMetaText}>{threads.find((thread) => thread.id === selectedThreadId)?.modelProvider ?? "codex"}</Text>
        </View>
        {error ? <Text style={[styles.helper, { color: colors.error, marginTop: 8 }]}>{error}</Text> : null}
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerWrap}>
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Codex</Text>
              <Pressable style={styles.btnPrimary} onPress={() => void createThread()}><Text style={styles.btnPrimaryText}>New Chat</Text></Pressable>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search threads..." placeholderTextColor={colors.textSecondary} style={styles.search} />
            </View>
            <View style={{ paddingHorizontal: 12 }}>
              {(["Today", "Yesterday", "Previous 7 days", "Older"] as const).map((section) => {
                const list = groupedThreads[section] ?? [];
                if (!list.length) return null;
                return (
                  <View key={section}>
                    <Text style={styles.section}>{section}</Text>
                    {list.map((thread) => (
                      <Pressable key={thread.id} style={[styles.thread, thread.id === selectedThreadId && styles.threadActive]} onPress={() => { const client = sessionRef.current?.client; if (!client) return; void hydrateThread(client, thread.id); setDrawerOpen(false); }}>
                        <Text style={styles.threadTitle} numberOfLines={1}>{previewTitle(thread)}</Text>
                        <Text style={styles.threadMeta}>{thread.modelProvider ?? "openai"} · {new Date((thread.updatedAt ?? thread.createdAt ?? 0) * 1000).toLocaleDateString()}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
            <View style={{ marginTop: "auto", padding: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
              <Pressable style={styles.btnSecondary} onPress={() => { disconnect(); setActiveConnectionId(null); setDrawerOpen(false); }}><Text style={styles.btnSecondaryText}>Connections</Text></Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => { setDrawerOpen(false); setSettingsOpen(true); }}><Text style={styles.btnSecondaryText}>Settings</Text></Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => { setDrawerOpen(false); setHelpOpen(true); }}><Text style={styles.btnSecondaryText}>Help</Text></Pressable>
              <Text style={styles.helper}>{accountName(account)} · {accountPlan(account)}</Text>
            </View>
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connection details</Text>
            <TextInput value={manualName} onChangeText={setManualName} placeholder="Machine name" placeholderTextColor={colors.textSecondary} style={styles.inputField} />
            <TextInput value={manualWsUrl} onChangeText={setManualWsUrl} placeholder="ws://host:8787/ws" placeholderTextColor={colors.textSecondary} style={styles.inputField} autoCapitalize="none" />
            <TextInput value={manualToken} onChangeText={setManualToken} placeholder="Pairing token" placeholderTextColor={colors.textSecondary} style={styles.inputField} autoCapitalize="none" />
            <View style={styles.actionRow}><Pressable style={styles.deny} onPress={() => setManualOpen(false)}><Text style={styles.denyText}>Cancel</Text></Pressable><Pressable style={styles.allow} onPress={addManualConnection}><Text style={styles.allowText}>Save</Text></Pressable></View>
          </View>
        </View>
      </Modal>

      <Modal visible={quickOpen} transparent animationType="fade" onRequestClose={() => setQuickOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Quick actions</Text>{QUICK_ACTIONS.map((action) => <Pressable key={action.label} style={styles.btnSecondary} onPress={() => { setQuickOpen(false); void sendPrompt(action.prompt); }}><Text style={styles.btnSecondaryText}>{action.label}</Text></Pressable>)}<Pressable style={styles.deny} onPress={() => setQuickOpen(false)}><Text style={styles.denyText}>Close</Text></Pressable></View></View>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Connection settings</Text><Text style={styles.muted}>Machine: {activeConnection?.name ?? "Unknown"}</Text><Text style={styles.muted}>Mode: {activeConnection?.mode ?? "lan"}</Text><Text style={styles.muted}>WebSocket: {activeConnection?.baseUrl ?? "-"}</Text><Text style={styles.muted}>Primary usage: {rateLimits?.primary ? `${Math.round(rateLimits.primary.usedPercent)}%` : "N/A"}</Text><View style={styles.actionRow}><Pressable style={styles.deny} onPress={() => { setSettingsOpen(false); setManualOpen(true); }}><Text style={styles.denyText}>Edit</Text></Pressable><Pressable style={styles.allow} onPress={() => { setSettingsOpen(false); if (activeConnection && connState !== "connected" && connState !== "connecting") { void connect(activeConnection); } else { void refreshThreads(); } }}><Text style={styles.allowText}>Refresh</Text></Pressable></View><View style={styles.actionRow}><Pressable style={styles.deny} onPress={() => { disconnect(); setSettingsOpen(false); }}><Text style={styles.denyText}>Disconnect</Text></Pressable><Pressable style={styles.allow} onPress={() => setSettingsOpen(false)}><Text style={styles.allowText}>Done</Text></Pressable></View></View></View>
      </Modal>

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Help & feedback</Text><Text style={styles.muted}>Use same Wi-Fi for LAN mode. For remote use, connect phone and computer to the same Tailscale tailnet.</Text><Text style={styles.muted}>If connection fails, check bridge health at http://host:8787/health and rescan QR.</Text><Pressable style={styles.allow} onPress={() => setHelpOpen(false)}><Text style={styles.allowText}>Close</Text></Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}
