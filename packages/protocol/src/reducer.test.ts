import { describe, expect, it } from "vitest";
import { createTimelineState, reduceNotification } from "./reducer";

describe("reduceNotification", () => {
  it("tracks agent message deltas", () => {
    const state1 = reduceNotification(createTimelineState(), {
      method: "item/started",
      params: { item: { id: "i1", type: "agentMessage", text: "Hi" } },
    });

    const state2 = reduceNotification(state1, {
      method: "item/agentMessage/delta",
      params: { itemId: "i1", delta: " there" },
    });

    expect((state2.items[0] as any).text).toBe("Hi there");
  });

  it("tracks command output deltas", () => {
    const state1 = reduceNotification(createTimelineState(), {
      method: "item/started",
      params: {
        item: {
          id: "cmd_1",
          type: "commandExecution",
          aggregatedOutput: "$ git status\n",
        },
      },
    });

    const state2 = reduceNotification(state1, {
      method: "item/commandExecution/outputDelta",
      params: { itemId: "cmd_1", delta: "M src/App.tsx\n" },
    });

    expect((state2.items[0] as any).aggregatedOutput).toContain("M src/App.tsx");
  });

  it("stores turn plan updates", () => {
    const state = reduceNotification(createTimelineState(), {
      method: "turn/plan/updated",
      params: {
        turnId: "turn_1",
        explanation: "Plan",
        plan: [{ step: "A", status: "pending" }],
      },
    });

    expect(state.latestPlan?.plan[0]?.step).toBe("A");
  });

  it("applies plan text deltas", () => {
    const state1 = reduceNotification(createTimelineState(), {
      method: "item/started",
      params: {
        item: {
          id: "plan_1",
          type: "plan",
          text: "Step 1",
        },
      },
    });

    const state2 = reduceNotification(state1, {
      method: "item/plan/delta",
      params: { itemId: "plan_1", delta: " and step 2" },
    });

    expect((state2.items[0] as any).text).toBe("Step 1 and step 2");
  });

  it("applies reasoning summary deltas", () => {
    const state1 = reduceNotification(createTimelineState(), {
      method: "item/started",
      params: {
        item: {
          id: "rsn_1",
          type: "reasoning",
          summary: [],
        },
      },
    });

    const state2 = reduceNotification(state1, {
      method: "item/reasoning/summaryPartAdded",
      params: { itemId: "rsn_1", summaryIndex: 0 },
    });

    const state3 = reduceNotification(state2, {
      method: "item/reasoning/summaryTextDelta",
      params: { itemId: "rsn_1", summaryIndex: 0, delta: "Analyzing dependencies" },
    });

    expect((state3.items[0] as any).summary?.[0]?.text).toBe("Analyzing dependencies");
  });
});
