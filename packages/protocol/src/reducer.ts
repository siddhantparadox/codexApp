import type {
  AgentMessageItem,
  CommandExecutionItem,
  JsonRpcNotification,
  PlanEntry,
  PlanItem,
  ReasoningItem,
  ThreadItem,
  TurnPlanUpdated,
} from "./types";

export interface CodexTimelineState {
  items: ThreadItem[];
  itemIndex: Record<string, number>;
  latestDiff?: string;
  latestPlan?: {
    explanation?: string;
    plan: PlanEntry[];
  };
}

export const createTimelineState = (): CodexTimelineState => ({
  items: [],
  itemIndex: {},
});

export function reduceNotification(
  state: CodexTimelineState,
  notification: JsonRpcNotification,
): CodexTimelineState {
  const params = (notification.params ?? {}) as Record<string, unknown>;

  switch (notification.method) {
    case "item/started":
    case "item/completed": {
      const item = params.item as ThreadItem | undefined;
      if (!item || !item.id) {
        return state;
      }

      const existingIndex = state.itemIndex[item.id];
      if (existingIndex === undefined) {
        return {
          ...state,
          items: [...state.items, item],
          itemIndex: {
            ...state.itemIndex,
            [item.id]: state.items.length,
          },
        };
      }

      const items = [...state.items];
      const previous = items[existingIndex];
      if (!previous) {
        return state;
      }
      items[existingIndex] = previous.type === item.type ? ({ ...previous, ...item } as ThreadItem) : item;
      return {
        ...state,
        items,
      };
    }

    case "item/agentMessage/delta": {
      const itemId = params.itemId as string | undefined;
      const delta = params.delta as string | undefined;
      if (!itemId || !delta) {
        return state;
      }

      const idx = state.itemIndex[itemId];
      if (idx === undefined) {
        return state;
      }

      const existing = state.items[idx] as AgentMessageItem;
      if (existing.type !== "agentMessage") {
        return state;
      }

      const items = [...state.items];
      items[idx] = {
        ...existing,
        text: `${existing.text ?? ""}${delta}`,
      };

      return {
        ...state,
        items,
      };
    }

    case "item/commandExecution/outputDelta": {
      const itemId = params.itemId as string | undefined;
      const delta = params.delta as string | undefined;
      if (!itemId || delta === undefined) {
        return state;
      }

      const idx = state.itemIndex[itemId];
      if (idx === undefined) {
        return state;
      }

      const existing = state.items[idx] as CommandExecutionItem;
      if (existing.type !== "commandExecution") {
        return state;
      }

      const items = [...state.items];
      items[idx] = {
        ...existing,
        aggregatedOutput: `${existing.aggregatedOutput ?? ""}${delta}`,
      };

      return {
        ...state,
        items,
      };
    }

    case "item/plan/delta": {
      const itemId = params.itemId as string | undefined;
      const delta = params.delta as string | undefined;
      if (!itemId || !delta) {
        return state;
      }

      const idx = state.itemIndex[itemId];
      if (idx === undefined) {
        return state;
      }

      const existing = state.items[idx] as PlanItem;
      if (existing.type !== "plan") {
        return state;
      }

      const items = [...state.items];
      items[idx] = {
        ...existing,
        text: `${existing.text ?? ""}${delta}`,
      };

      return {
        ...state,
        items,
      };
    }

    case "item/reasoning/summaryPartAdded":
    case "item/reasoning/summaryTextDelta": {
      const itemId = params.itemId as string | undefined;
      if (!itemId) {
        return state;
      }

      const idx = state.itemIndex[itemId];
      if (idx === undefined) {
        return state;
      }

      const existing = state.items[idx] as ReasoningItem;
      if (existing.type !== "reasoning") {
        return state;
      }

      const summary = [...(existing.summary ?? [])];
      const targetIndex =
        (params.summaryIndex as number | undefined) ??
        (summary.length ? summary.length - 1 : 0);
      const current = summary[targetIndex] ?? {};

      if (notification.method === "item/reasoning/summaryPartAdded") {
        summary[targetIndex] = current;
      } else {
        const delta = params.delta as string | undefined;
        if (delta === undefined) {
          return state;
        }
        summary[targetIndex] = {
          ...current,
          text: `${current.text ?? ""}${delta}`,
        };
      }

      const items = [...state.items];
      items[idx] = {
        ...existing,
        summary,
      };

      return {
        ...state,
        items,
      };
    }

    case "turn/diff/updated": {
      const diff = params.diff as string | undefined;
      if (diff === undefined) {
        return state;
      }

      return {
        ...state,
        latestDiff: diff,
      };
    }

    case "turn/plan/updated": {
      const planPayload = params as unknown as TurnPlanUpdated;
      const latestPlan = planPayload.explanation
        ? {
            explanation: planPayload.explanation,
            plan: Array.isArray(planPayload.plan) ? planPayload.plan : [],
          }
        : {
            plan: Array.isArray(planPayload.plan) ? planPayload.plan : [],
          };

      return {
        ...state,
        latestPlan,
      };
    }

    default:
      return state;
  }
}
