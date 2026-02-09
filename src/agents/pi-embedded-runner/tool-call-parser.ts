import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ModelCompatConfig } from "../../config/types.models.js";
import { log } from "./logger.js";

/**
 * Default tool call patterns covering common non-standard model output formats.
 * Used when `compat.toolCallPatterns` is not explicitly configured.
 */
const DEFAULT_TOOL_CALL_PATTERNS: Array<{ tag: string; format?: "json" | "name-arguments" }> = [
  { tag: "tool_call", format: "name-arguments" },
  { tag: "tools", format: "name-arguments" },
];

interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Parse a JSON string that may contain a tool call in { name, arguments } format
 * or older { tool/action, ...args } format.
 */
function parseToolCallJson(jsonStr: string): ParsedToolCall | null {
  try {
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") {
      return null;
    }

    // Standard { name, arguments } format (e.g., Qwen3)
    if (typeof obj.name === "string" && obj.arguments !== undefined) {
      return {
        name: obj.name,
        arguments: typeof obj.arguments === "object" ? obj.arguments : {},
      };
    }

    // Legacy { tool/action, ...rest } format
    const toolName = obj.tool ?? obj.action;
    if (typeof toolName === "string") {
      const args = { ...obj };
      delete args.tool;
      delete args.action;
      delete args.name;
      return { name: toolName, arguments: args };
    }

    return null;
  } catch {
    return null;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract tool calls from text content that contains XML-tagged tool calls.
 * Handles patterns like: <tool_call>{"name": "foo", "arguments": {...}}</tool_call>
 */
function extractToolCallsFromText(
  text: string,
  patterns: Array<{ tag: string; format?: "json" | "name-arguments" }>,
): { toolCalls: ParsedToolCall[]; remainingText: string } {
  const toolCalls: ParsedToolCall[] = [];
  let remaining = text;

  for (const pattern of patterns) {
    const regex = new RegExp(
      `<${escapeRegex(pattern.tag)}>([\\s\\S]*?)</${escapeRegex(pattern.tag)}>`,
      "g",
    );

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const jsonContent = match[1].trim();
      const parsed = parseToolCallJson(jsonContent);
      if (parsed) {
        toolCalls.push(parsed);
        log.debug(`parsed tool call from <${pattern.tag}>: ${parsed.name}`);
      } else {
        log.warn(`failed to parse tool call JSON from <${pattern.tag}> tag`);
      }
    }

    // Remove matched tags from remaining text
    if (toolCalls.length > 0) {
      remaining = remaining.replace(regex, "").trim();
    }
  }

  return { toolCalls, remainingText: remaining };
}

/**
 * Check if text content likely contains tool call tags.
 */
function hasToolCallTags(text: string, patterns: Array<{ tag: string }>): boolean {
  return patterns.some((p) => text.includes(`<${p.tag}>`));
}

/**
 * Generate a unique tool call ID from name and index.
 */
function generateToolCallId(name: string, index: number): string {
  let hash = 0;
  const str = `${name}_${index}_${Date.now()}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `call_${Math.abs(hash) % 1000000}_${index}`;
}

type ContentBlock = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
};

type StreamMessage = {
  content: ContentBlock[];
  stopReason?: string;
  [key: string]: unknown;
};

type StreamEvent = {
  type: string;
  reason?: string;
  message?: StreamMessage;
  [key: string]: unknown;
};

/**
 * Try to inject tool calls parsed from text content into a "done" event's message.
 * Returns true if the message was modified.
 */
function transformDoneMessage(
  message: StreamMessage,
  patterns: typeof DEFAULT_TOOL_CALL_PATTERNS,
): boolean {
  if (!message?.content || !Array.isArray(message.content)) {
    return false;
  }

  // Only transform if there are no native tool calls already
  const hasNativeToolCalls = message.content.some((b) => b.type === "toolCall");
  if (hasNativeToolCalls) {
    return false;
  }

  // Check text blocks for tool call tags
  const textBlocks = message.content.filter((b) => b.type === "text");
  let modified = false;

  for (const block of textBlocks) {
    const text = block.text ?? "";
    if (!hasToolCallTags(text, patterns)) {
      continue;
    }

    const { toolCalls, remainingText } = extractToolCallsFromText(text, patterns);
    if (toolCalls.length === 0) {
      continue;
    }

    log.info(`transformed ${toolCalls.length} tool call(s) from text content`);

    // Replace text with remaining content
    block.text = remainingText;

    // Add parsed tool calls as toolCall content blocks
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      message.content.push({
        type: "toolCall",
        id: generateToolCallId(tc.name, i),
        name: tc.name,
        arguments: tc.arguments,
      });
    }

    message.stopReason = "toolUse";
    modified = true;
  }

  // Remove empty text blocks
  if (modified) {
    message.content = message.content.filter(
      (b) => !(b.type === "text" && (!b.text || b.text.trim() === "")),
    );
  }

  return modified;
}

/**
 * Create a streamFn wrapper that intercepts model responses and parses
 * non-standard tool call formats (like XML-tagged tool calls from Qwen, etc.)
 * into the standard format that the pi-agent-core agent loop expects.
 *
 * This replaces the external proxy's response transformation logic.
 *
 * The wrapper only modifies the "done" event's message object. Intermediate
 * streaming events (text_delta, etc.) pass through unchanged. This means
 * the user may briefly see raw tool call tags in streamed text, but tool
 * execution will work correctly.
 */
export function createToolCallParserWrapper(
  baseStreamFn: StreamFn | undefined,
  compat: ModelCompatConfig | undefined,
): StreamFn | undefined {
  const patterns = compat?.toolCallPatterns;
  // If no patterns configured, use defaults. To explicitly disable, set to empty array.
  const effectivePatterns = patterns === undefined ? DEFAULT_TOOL_CALL_PATTERNS : patterns;
  if (effectivePatterns.length === 0) {
    return undefined;
  }

  const underlying = baseStreamFn ?? streamSimple;

  function wrapStream(stream: AsyncIterable<unknown>): AsyncIterable<unknown> {
    const originalIterator = stream[Symbol.asyncIterator]();

    const wrappedIterator = {
      async next(): Promise<IteratorResult<unknown>> {
        const result = await originalIterator.next();
        if (result.done) {
          return result;
        }

        const event = result.value as StreamEvent;

        // Only intercept "done" events to transform tool calls in the final message
        if (event.type === "done" && event.message) {
          const modified = transformDoneMessage(event.message, effectivePatterns);
          if (modified) {
            event.reason = "toolUse";
          }
        }

        return { value: event, done: false };
      },
      async return(value?: unknown): Promise<IteratorResult<unknown>> {
        if (originalIterator.return) {
          return originalIterator.return(value);
        }
        return { value: undefined, done: true };
      },
      async throw(error?: unknown): Promise<IteratorResult<unknown>> {
        if (originalIterator.throw) {
          return originalIterator.throw(error);
        }
        throw error;
      },
    };

    // Preserve any additional methods on the original stream (push, end, etc.)
    const wrappedStream = Object.create(stream);
    wrappedStream[Symbol.asyncIterator] = () => wrappedIterator;
    return wrappedStream;
  }

  const wrappedStreamFn: StreamFn = (model, context, options) => {
    const result = underlying(model, context, options);

    // StreamFn can return either a stream or a Promise<stream>
    if (result && typeof (result as Promise<AsyncIterable<unknown>>).then === "function") {
      return (result as Promise<AsyncIterable<unknown>>).then((stream) =>
        wrapStream(stream),
      ) as ReturnType<StreamFn>;
    }

    return wrapStream(result as AsyncIterable<unknown>) as ReturnType<StreamFn>;
  };

  return wrappedStreamFn;
}
