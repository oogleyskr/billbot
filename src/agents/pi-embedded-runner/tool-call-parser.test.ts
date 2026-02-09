import { describe, expect, it } from "vitest";
import { createToolCallParserWrapper } from "./tool-call-parser.js";

// Helper to create a mock stream from events
function mockStream(events: Array<Record<string, unknown>>): AsyncIterable<unknown> {
  let index = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (index >= events.length) {
            return { value: undefined, done: true as const };
          }
          return { value: events[index++], done: false as const };
        },
      };
    },
  };
}

// Helper to collect events from an async iterable
async function collectEvents(
  stream: AsyncIterable<unknown>,
): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  for await (const event of stream) {
    events.push(event as Record<string, unknown>);
  }
  return events;
}

describe("createToolCallParserWrapper", () => {
  it("returns undefined when toolCallPatterns is empty array", () => {
    const result = createToolCallParserWrapper(undefined, { toolCallPatterns: [] });
    expect(result).toBeUndefined();
  });

  it("returns a wrapper when no compat provided (uses defaults)", () => {
    const result = createToolCallParserWrapper(undefined, undefined);
    expect(result).toBeDefined();
    expect(typeof result).toBe("function");
  });

  it("passes through events unchanged when no tool call tags in text", async () => {
    const events = [
      { type: "start", partial: {} },
      { type: "text_start", contentIndex: 0, partial: {} },
      { type: "text_delta", contentIndex: 0, delta: "Hello world" },
      { type: "text_end", contentIndex: 0 },
      {
        type: "done",
        reason: "stop",
        message: {
          content: [{ type: "text", text: "Hello world" }],
          stopReason: "stop",
        },
      },
    ];

    const mockStreamFn = () => mockStream(events);
    const wrapper = createToolCallParserWrapper(mockStreamFn as never, undefined);
    expect(wrapper).toBeDefined();

    const model = { id: "test", api: "openai-completions", provider: "test" } as never;
    const context = { messages: [] } as never;
    const result = wrapper!(model, context);
    const collected = await collectEvents(result as AsyncIterable<unknown>);

    expect(collected).toHaveLength(5);
    const doneEvent = collected[4] as {
      type: string;
      reason: string;
      message: { stopReason: string };
    };
    expect(doneEvent.type).toBe("done");
    expect(doneEvent.reason).toBe("stop");
    expect(doneEvent.message.stopReason).toBe("stop");
  });

  it("transforms <tool_call> tags in done message into toolCall content blocks", async () => {
    const textWithToolCall =
      'I will search for that.\n<tool_call>{"name": "web_search", "arguments": {"query": "test"}}</tool_call>';

    const events = [
      { type: "start", partial: {} },
      {
        type: "done",
        reason: "stop",
        message: {
          content: [{ type: "text", text: textWithToolCall }],
          stopReason: "stop",
        },
      },
    ];

    const mockStreamFn = () => mockStream(events);
    const wrapper = createToolCallParserWrapper(mockStreamFn as never, undefined);
    const model = { id: "test", api: "openai-completions", provider: "test" } as never;
    const context = { messages: [] } as never;
    const result = wrapper!(model, context);
    const collected = await collectEvents(result as AsyncIterable<unknown>);

    expect(collected).toHaveLength(2);
    const doneEvent = collected[1] as {
      type: string;
      reason: string;
      message: {
        content: Array<{
          type: string;
          text?: string;
          name?: string;
          arguments?: Record<string, unknown>;
        }>;
        stopReason: string;
      };
    };
    expect(doneEvent.reason).toBe("toolUse");
    expect(doneEvent.message.stopReason).toBe("toolUse");

    // Should have the remaining text block and a tool call block
    const textBlock = doneEvent.message.content.find((b) => b.type === "text");
    const toolCallBlock = doneEvent.message.content.find((b) => b.type === "toolCall");

    expect(textBlock?.text).toBe("I will search for that.");
    expect(toolCallBlock?.name).toBe("web_search");
    expect(toolCallBlock?.arguments).toEqual({ query: "test" });
  });

  it("handles multiple tool calls in same text block", async () => {
    const textWithToolCalls = [
      '<tool_call>{"name": "read_file", "arguments": {"path": "/tmp/a.txt"}}</tool_call>',
      '<tool_call>{"name": "write_file", "arguments": {"path": "/tmp/b.txt", "content": "hello"}}</tool_call>',
    ].join("\n");

    const events = [
      {
        type: "done",
        reason: "stop",
        message: {
          content: [{ type: "text", text: textWithToolCalls }],
          stopReason: "stop",
        },
      },
    ];

    const mockStreamFn = () => mockStream(events);
    const wrapper = createToolCallParserWrapper(mockStreamFn as never, undefined);
    const model = { id: "test", api: "openai-completions", provider: "test" } as never;
    const context = { messages: [] } as never;
    const result = wrapper!(model, context);
    const collected = await collectEvents(result as AsyncIterable<unknown>);

    const doneEvent = collected[0] as {
      message: {
        content: Array<{ type: string; name?: string }>;
      };
    };
    const toolCalls = doneEvent.message.content.filter((b) => b.type === "toolCall");
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe("read_file");
    expect(toolCalls[1].name).toBe("write_file");
  });

  it("does not transform when native tool calls already present", async () => {
    const events = [
      {
        type: "done",
        reason: "toolUse",
        message: {
          content: [
            { type: "text", text: '<tool_call>{"name": "fake", "arguments": {}}</tool_call>' },
            { type: "toolCall", id: "real_1", name: "real_tool", arguments: {} },
          ],
          stopReason: "toolUse",
        },
      },
    ];

    const mockStreamFn = () => mockStream(events);
    const wrapper = createToolCallParserWrapper(mockStreamFn as never, undefined);
    const model = { id: "test", api: "openai-completions", provider: "test" } as never;
    const context = { messages: [] } as never;
    const result = wrapper!(model, context);
    const collected = await collectEvents(result as AsyncIterable<unknown>);

    const doneEvent = collected[0] as {
      reason: string;
      message: {
        content: Array<{ type: string; name?: string }>;
      };
    };
    // Should NOT have added the fake tool call - native one already present
    expect(doneEvent.message.content).toHaveLength(2);
    expect(doneEvent.reason).toBe("toolUse");
  });

  it("supports legacy { tool, ...args } format", async () => {
    const textWithLegacy = '<tool_call>{"tool": "bash", "command": "ls -la"}</tool_call>';

    const events = [
      {
        type: "done",
        reason: "stop",
        message: {
          content: [{ type: "text", text: textWithLegacy }],
          stopReason: "stop",
        },
      },
    ];

    const mockStreamFn = () => mockStream(events);
    const wrapper = createToolCallParserWrapper(mockStreamFn as never, undefined);
    const model = { id: "test", api: "openai-completions", provider: "test" } as never;
    const context = { messages: [] } as never;
    const result = wrapper!(model, context);
    const collected = await collectEvents(result as AsyncIterable<unknown>);

    const doneEvent = collected[0] as {
      message: {
        content: Array<{ type: string; name?: string; arguments?: Record<string, unknown> }>;
      };
    };
    const toolCall = doneEvent.message.content.find((b) => b.type === "toolCall");
    expect(toolCall?.name).toBe("bash");
    expect(toolCall?.arguments).toEqual({ command: "ls -la" });
  });

  it("uses custom patterns from compat config", async () => {
    const text = '<my_tool>{"name": "custom", "arguments": {"x": 1}}</my_tool>';

    const events = [
      {
        type: "done",
        reason: "stop",
        message: {
          content: [{ type: "text", text }],
          stopReason: "stop",
        },
      },
    ];

    const mockStreamFn = () => mockStream(events);
    const wrapper = createToolCallParserWrapper(mockStreamFn as never, {
      toolCallPatterns: [{ tag: "my_tool" }],
    });
    const model = { id: "test", api: "openai-completions", provider: "test" } as never;
    const context = { messages: [] } as never;
    const result = wrapper!(model, context);
    const collected = await collectEvents(result as AsyncIterable<unknown>);

    const doneEvent = collected[0] as {
      message: {
        content: Array<{ type: string; name?: string }>;
      };
    };
    const toolCall = doneEvent.message.content.find((b) => b.type === "toolCall");
    expect(toolCall?.name).toBe("custom");
  });
});
