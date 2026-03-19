export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeGenerateOptions {
  /** Max tokens to generate */
  maxTokens?: number;
  /** Model name (default: claude-sonnet or latest) */
  model?: string;
  /** System prompt (optional) */
  system?: string;
  /** Temperature 0-1 (default: 0.7) */
  temperature?: number;
}

export interface CopyGenerationInput {
  /** Brief description of the product/campaign */
  context: string;
  /** Current or previous copy to refine (optional) */
  currentCopy?: string;
  /** Tone or constraints (e.g. "short", "CTA-focused") */
  tone?: string;
  /**
   * Extra output rules (e.g. "Return only JSON: {\"headline\":\"...\",\"primary_text\":\"...\"}").
   * When this mentions JSON, the model is instructed to avoid markdown fences and labels.
   */
  formatInstructions?: string;
}

export interface DecisionInput {
  /** Summary of performance (e.g. ROAS, CPA, spend) */
  performanceSummary: string;
  /** Client thresholds (e.g. min ROAS 2, max CPA 50) */
  thresholds: string;
  /** What to decide (e.g. "Should we pause this ad set?") */
  question: string;
}
