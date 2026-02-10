/**
 * Lightweight inference speed tracker.
 *
 * The agent pipeline calls `recordInference()` after each model completion
 * with the output token count and wall-clock duration. The infrastructure
 * monitor reads the latest speed via `getInferenceSpeed()` for the
 * Hardware tab.
 */

export type InferenceSpeedSnapshot = {
  /** Tokens per second from the most recent completion. */
  tokensPerSecond: number;
  /** Rolling average tok/s over recent completions. */
  averageTokPerSec: number;
  /** Total completions recorded. */
  completionCount: number;
  /** Timestamp of last measurement. */
  lastMeasuredAt: number;
};

// Keep last N measurements for rolling average
const MAX_HISTORY = 10;
const history: { tokPerSec: number; at: number }[] = [];
let completionCount = 0;

/**
 * Record a completed inference. Called by the agent pipeline after
 * each model response.
 */
export function recordInference(outputTokens: number, durationMs: number): void {
  if (outputTokens <= 0 || durationMs <= 0) {
    return;
  }
  const tokPerSec = Math.round((outputTokens / (durationMs / 1000)) * 10) / 10;
  history.push({ tokPerSec, at: Date.now() });
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
  completionCount++;
}

/**
 * Get the current inference speed snapshot, or null if no
 * completions have been recorded yet.
 */
export function getInferenceSpeed(): InferenceSpeedSnapshot | null {
  if (history.length === 0) {
    return null;
  }

  const latest = history[history.length - 1];
  const avg =
    Math.round((history.reduce((sum, h) => sum + h.tokPerSec, 0) / history.length) * 10) / 10;

  return {
    tokensPerSecond: latest.tokPerSec,
    averageTokPerSec: avg,
    completionCount,
    lastMeasuredAt: latest.at,
  };
}
