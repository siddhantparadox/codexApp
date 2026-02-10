import { describe, expect, it } from "vitest";
import { CodexClient, type MessageTransport } from "./client";

function createMockTransport() {
  const listeners = new Set<(message: any) => void>();
  const sent: any[] = [];

  const transport: MessageTransport = {
    send: (message) => {
      sent.push(message);
    },
    onMessage: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    transport,
    sent,
    emit: (message: any) => listeners.forEach((listener) => listener(message)),
  };
}

describe("CodexClient", () => {
  it("sends initialize then initialized", async () => {
    const mock = createMockTransport();
    const client = new CodexClient(mock.transport);

    const pending = client.initialize({ name: "mobile", title: "Mobile", version: "1.0.0" });
    const init = mock.sent[0];

    mock.emit({ id: init.id, result: { userAgent: "test" } });

    await expect(pending).resolves.toEqual({ userAgent: "test" });
    expect(mock.sent[0].method).toBe("initialize");
    expect(mock.sent[1].method).toBe("initialized");
  });

  it("emits server requests", () => {
    const mock = createMockTransport();
    const client = new CodexClient(mock.transport);

    let capturedMethod = "";
    client.onServerRequest((request) => {
      capturedMethod = request.method;
    });

    mock.emit({ id: 999, method: "item/commandExecution/requestApproval", params: {} });

    expect(capturedMethod).toBe("item/commandExecution/requestApproval");
  });

  it("rejects requests on error responses", async () => {
    const mock = createMockTransport();
    const client = new CodexClient(mock.transport);

    const pending = client.threadRead({ threadId: "thr_1", includeTurns: true });
    const request = mock.sent[0];

    mock.emit({ id: request.id, error: { code: 123, message: "Not found" } });

    await expect(pending).rejects.toThrow("Not found");
  });

  it("supports account endpoints", async () => {
    const mock = createMockTransport();
    const client = new CodexClient(mock.transport);

    const accountPending = client.accountRead();
    const accountReq = mock.sent[0];
    expect(accountReq.method).toBe("account/read");

    mock.emit({
      id: accountReq.id,
      result: {
        account: { type: "chatgpt", email: "dev@example.com", planType: "pro" },
        requiresOpenaiAuth: true,
      },
    });

    await expect(accountPending).resolves.toEqual({
      account: { type: "chatgpt", email: "dev@example.com", planType: "pro" },
      requiresOpenaiAuth: true,
    });
  });
});
