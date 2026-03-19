/**
 * Shared parsing for Claude ad copy: JSON { headline, primary_text }, markdown **Headline:** / **Primary Text:**, or plain text.
 * Used by Meta (title + message) and TikTok (ad_text).
 */

export interface ParsedAdCopy {
  headline: string;
  primaryText: string;
}

/** Short headline when only body exists. */
export function deriveHeadlineFromMessage(message: string): string {
  const line = message.split(/\n/)[0]?.trim() ?? message.trim();
  if (line.length <= 40) return line;
  return `${line.slice(0, 37).trimEnd()}…`;
}

export interface ParseStructuredAdCopyOptions {
  /** Used when input is empty or parsing yields no body (Meta default: "Watch now"). */
  defaultPrimary?: string;
}

/**
 * Split model output into headline + primary body without markdown section labels in the body.
 */
export function parseStructuredAdCopy(
  raw: string,
  options: ParseStructuredAdCopyOptions = {}
): ParsedAdCopy {
  const defaultPrimary = options.defaultPrimary ?? "Watch now";
  const s = raw.trim();
  if (!s) {
    return { headline: "", primaryText: defaultPrimary };
  }

  const jsonBlock = s.match(/\{[\s\S]*\}/);
  if (jsonBlock) {
    try {
      const obj = JSON.parse(jsonBlock[0]) as Record<string, unknown>;
      let headline = String(obj.headline ?? obj.title ?? "").trim();
      let primaryText = String(obj.primary_text ?? obj.body ?? obj.message ?? "").trim();
      headline = headline.replace(/\*\*Headline:\*\*\s*/gi, "").trim();
      primaryText = primaryText.replace(/\*\*Primary\s*Text:\*\*\s*/gi, "").trim();
      if (headline || primaryText) {
        if (!headline && primaryText) headline = deriveHeadlineFromMessage(primaryText);
        if (!primaryText && headline) primaryText = headline;
        return { headline, primaryText };
      }
    } catch {
      /* fall through */
    }
  }

  if (/\*\*Headline:\*\*/i.test(s) && /\*\*Primary\s*Text:\*\*/i.test(s)) {
    const tail = s.split(/\*\*Headline:\*\*/i)[1] ?? "";
    const parts = tail.split(/\*\*Primary\s*Text:\*\*/i);
    let headline = (parts[0] ?? "").replace(/\*\*/g, "").trim();
    let primaryText = (parts[1] ?? "").replace(/\*\*/g, "").trim();
    if (headline || primaryText) {
      if (!headline && primaryText) headline = deriveHeadlineFromMessage(primaryText);
      if (!primaryText && headline) primaryText = headline;
      return { headline, primaryText };
    }
  }

  const cleaned = s
    .replace(/\*\*Headline:\*\*\s*/gi, "")
    .replace(/\*\*Primary\s*Text:\*\*\s*/gi, "")
    .trim();

  if (!cleaned) {
    return { headline: "", primaryText: defaultPrimary };
  }

  return {
    headline: deriveHeadlineFromMessage(cleaned),
    primaryText: cleaned,
  };
}

/** TikTok `ad_text` — single field; combine hook + body, cap length (API commonly ~100 chars). */
export function formatTikTokAdText(headline: string, primaryText: string, maxLen: number): string {
  const h = headline.trim();
  const p = primaryText.trim();
  let out: string;
  if (h && p) {
    out = `${h} ${p}`.trim();
  } else {
    out = p || h;
  }
  out = out.trim();
  if (out.length <= maxLen) return out;
  if (p.length <= maxLen) return p;
  if (h.length <= maxLen) return h;
  return out.slice(0, maxLen);
}
