import Anthropic from "@anthropic-ai/sdk";
import type { CopyGenerationInput, DecisionInput, ClaudeGenerateOptions } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 1024;

export interface ClaudeClientOptions {
  apiKey?: string;
  /** Default model (optional) */
  model?: string;
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return key.trim();
}

/**
 * Create a Claude API client. Uses ANTHROPIC_API_KEY from env if apiKey not passed.
 */
export function createClaudeClient(options: ClaudeClientOptions = {}) {
  const apiKey = options.apiKey ?? getApiKey();
  const client = new Anthropic({ apiKey });
  const defaultModel = options.model ?? DEFAULT_MODEL;

  /**
   * Raw message completion. Use for custom prompts.
   */
  async function complete(
    userMessage: string,
    opts: ClaudeGenerateOptions = {}
  ): Promise<string> {
    const model = opts.model ?? defaultModel;
    const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
    const system = opts.system;
    const temperature = opts.temperature ?? 0.7;

    const createParams: Parameters<typeof client.messages.create>[0] = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: userMessage }],
      temperature,
    };
    if (system) createParams.system = system;

    const response = await client.messages.create(createParams as Parameters<typeof client.messages.create>[0]);
    if (!("content" in response) || !Array.isArray(response.content)) {
      return "";
    }
    const block = response.content.find((b: { type: string }) => b.type === "text");
    if (!block || block.type !== "text" || !("text" in block)) {
      return "";
    }
    return (block as { text: string }).text;
  }

  /**
   * Generate or refine ad copy using Claude.
   */
  async function generateCopy(
    input: CopyGenerationInput,
    opts: ClaudeGenerateOptions = {}
  ): Promise<string> {
    const system = `You are an expert ad copywriter for paid social (Meta and TikTok). Output only the requested copy, no preamble or explanation.`;
    const parts: string[] = [
      "Context:",
      input.context,
    ];
    if (input.currentCopy) {
      parts.push("Current copy to refine:", input.currentCopy);
    }
    if (input.tone) {
      parts.push("Tone/constraints:", input.tone);
    }
    parts.push("Generate the ad copy below (only the copy):");
    const userMessage = parts.join("\n");
    return complete(userMessage, { ...opts, system, temperature: 0.7 });
  }

  /**
   * Ask Claude for a structured decision based on performance and thresholds.
   * Returns a short text answer (e.g. "Yes, pause" or "No, keep running").
   */
  async function suggestDecision(
    input: DecisionInput,
    opts: ClaudeGenerateOptions = {}
  ): Promise<string> {
    const system = `You are an ad optimization assistant. Given performance data and thresholds, answer the question concisely. Reply with a short, actionable answer (e.g. "Yes, pause" or "No, keep running").`;
    const userMessage = [
      "Performance summary:",
      input.performanceSummary,
      "",
      "Thresholds:",
      input.thresholds,
      "",
      "Question:",
      input.question,
    ].join("\n");
    return complete(userMessage, { ...opts, system, temperature: 0.2 });
  }

  return {
    complete,
    generateCopy,
    suggestDecision,
  };
}

export type ClaudeClient = ReturnType<typeof createClaudeClient>;
