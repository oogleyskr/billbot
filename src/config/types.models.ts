export type ModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "github-copilot"
  | "bedrock-converse-stream";

export type ModelCompatConfig = {
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  /** Whether the provider supports the `strict` field on tool function definitions. */
  supportsStrictMode?: boolean;
  /** Whether the provider supports `stream_options: { include_usage: true }`. */
  supportsUsageInStreaming?: boolean;
  /** Whether tool results require the `name` field (e.g. Mistral). */
  requiresToolResultName?: boolean;
  /** Whether a synthetic assistant message is needed after tool results (e.g. Mistral). */
  requiresAssistantAfterToolResult?: boolean;
  /** Whether thinking blocks should be converted to plain text. */
  requiresThinkingAsText?: boolean;
  /** Whether tool IDs must be normalized to Mistral's 9-char alphanumeric format. */
  requiresMistralToolIds?: boolean;
  /** Thinking format: "openai" (default), "zai", or "qwen". */
  thinkingFormat?: "openai" | "zai" | "qwen";
  /**
   * Configurable patterns for parsing non-standard tool call formats from model output.
   * Each pattern has a `tag` (XML tag name) and optional `format` hint.
   * Example: [{ "tag": "tool_call" }, { "tag": "tools" }]
   */
  toolCallPatterns?: Array<{ tag: string; format?: "json" | "name-arguments" }>;
};

export type ModelProviderAuthMode = "api-key" | "aws-sdk" | "oauth" | "token";

export type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  compat?: ModelCompatConfig;
};

export type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  auth?: ModelProviderAuthMode;
  api?: ModelApi;
  headers?: Record<string, string>;
  authHeader?: boolean;
  models: ModelDefinitionConfig[];
  /** Health check configuration for the provider endpoint. */
  healthCheck?: {
    enabled?: boolean;
    /** Endpoint path to check (default: "/health"). */
    endpoint?: string;
    /** Interval in seconds between checks. */
    intervalSeconds?: number;
  };
  /** Retry configuration for failed requests to this provider. */
  retry?: {
    /** Maximum number of retry attempts. */
    attempts?: number;
    /** Minimum delay between retries in milliseconds. */
    minDelayMs?: number;
    /** Maximum delay between retries in milliseconds. */
    maxDelayMs?: number;
  };
};

export type BedrockDiscoveryConfig = {
  enabled?: boolean;
  region?: string;
  providerFilter?: string[];
  refreshInterval?: number;
  defaultContextWindow?: number;
  defaultMaxTokens?: number;
};

export type ModelsConfig = {
  mode?: "merge" | "replace";
  providers?: Record<string, ModelProviderConfig>;
  bedrockDiscovery?: BedrockDiscoveryConfig;
};
