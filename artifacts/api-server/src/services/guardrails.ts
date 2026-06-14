/**
 * Guardrails enforcement service.
 *
 * Each assignment can carry a JSON array of GuardrailRule objects stored in
 * assignments.guardrails. At chat time, applyInputGuardrails() is called before
 * the user message reaches the model and applyOutputGuardrails() is called on
 * the model response before it is sent back to the client.
 */

export type GuardrailType =
  | "input_keyword_block"
  | "output_keyword_block"
  | "prompt_injection_direct"
  | "prompt_injection_hidden"
  | "topic_scope"
  | "pii_masking"
  | "max_input_length"
  | "jailbreak_detection";

export interface GuardrailRule {
  id: string;
  type: GuardrailType;
  enabled: boolean;
  config: {
    keywords?: string[];
    topics?: string[];
    maxLength?: number;
    action?: "block" | "redact";
  };
}

export interface GuardrailViolation {
  ruleId: string;
  type: GuardrailType;
  detail: string;
}

export interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  sanitized: string;
  violations: GuardrailViolation[];
}

export function parseGuardrails(raw: string | null | undefined): GuardrailRule[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Direct prompt injection patterns ─────────────────────────────────────────
const DIRECT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|directives?|rules?)/i,
  /forget\s+(everything|all|your\s+instructions?|your\s+previous)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /pretend\s+(you\s+are|to\s+be|that\s+you)/i,
  /act\s+as\s+(if\s+you\s+are|a|an)\s+/i,
  /disregard\s+(your|all|previous|the)\s+(instructions?|rules?|guidelines?)/i,
  /new\s+persona\s*:/i,
  /\bDAN\s+mode\b/i,
  /\bdeveloper\s+mode\b/i,
  /do\s+anything\s+now/i,
  /bypass\s+(your|all|safety|the)\s+(restrictions?|limits?|rules?|filters?)/i,
  /override\s+(your|the|all)\s+(instructions?|rules?|guidelines?|safety)/i,
  /\bjailbreak\b/i,
  /\bsystem\s+prompt\b.*\breplace\b/i,
  /\bprompt\s+injection\b/i,
];

// ─── Jailbreak patterns ────────────────────────────────────────────────────────
const JAILBREAK_PATTERNS = [
  /grandma\s+(exploit|trick|loophole)/i,
  /hypothetically\s+speaking.*you\s+(would|could|should)/i,
  /for\s+educational\s+purposes\s+only/i,
  /in\s+a\s+fictional\s+(world|scenario|story).*you\s+(can|are)/i,
  /\bsudo\s+mode\b/i,
  /\btraining\s+mode\b/i,
  /\btoken\s+(manipulation|limit|overflow)\b/i,
  /\bcontext\s+window\b.*\boverflow\b/i,
  /ignore\s+safety\s+(guidelines?|rules?|filters?)/i,
  /as\s+a\s+test.*respond\s+(as|like)/i,
  /enable\s+(unrestricted|unlimited|uncensored)\s+mode/i,
];

// ─── Hidden / encoded injection detection ─────────────────────────────────────
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF\u2060\u180E\u00AD]/;

function hasBase64Injection(text: string): boolean {
  const b64Re = /[A-Za-z0-9+/]{20,}={0,2}/g;
  let m: RegExpExecArray | null;
  while ((m = b64Re.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(m[0], "base64").toString("utf8");
      if (DIRECT_INJECTION_PATTERNS.some((p) => p.test(decoded))) return true;
      if (JAILBREAK_PATTERNS.some((p) => p.test(decoded))) return true;
    } catch {
      /* ignore decode failures */
    }
  }
  return false;
}

function hasHomoglyphAttack(text: string): boolean {
  // Detect suspicious mix of Cyrillic characters that look like Latin letters
  // in a mostly-Latin context (classic homoglyph phishing / injection)
  const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (cyrillicCount > 0 && latinCount > 0 && cyrillicCount / (cyrillicCount + latinCount) > 0.3) return true;
  return false;
}

// ─── PII patterns ──────────────────────────────────────────────────────────────
const PII_PATTERNS: { name: string; re: RegExp; mask: string }[] = [
  { name: "email",     re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,             mask: "[EMAIL]" },
  { name: "phone_il",  re: /\b0[5-9]\d[-\s]?\d{3}[-\s]?\d{4}\b/g,                               mask: "[PHONE]" },
  { name: "phone_gen", re: /\b\+?[0-9]{1,3}[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{3,4}\b/g, mask: "[PHONE]" },
  { name: "il_id",     re: /\b\d{9}\b/g,                                                          mask: "[ID]" },
  { name: "credit",    re: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,                                       mask: "[CARD]" },
];

function maskPii(text: string): string {
  let out = text;
  for (const { re, mask } of PII_PATTERNS) {
    out = out.replace(re, mask);
  }
  return out;
}

// ─── Core enforcement ──────────────────────────────────────────────────────────

export function applyInputGuardrails(rules: GuardrailRule[], userMessage: string): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  let sanitized = userMessage;
  let blocked = false;
  let reason: string | undefined;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case "max_input_length": {
        const max = rule.config.maxLength ?? 2000;
        if (userMessage.length > max) {
          violations.push({ ruleId: rule.id, type: rule.type, detail: `Message length ${userMessage.length} exceeds limit ${max}` });
          blocked = true;
          reason = `ההודעה ארוכה מדי (מקסימום ${max} תווים). אנא קצר את ההודעה.`;
        }
        break;
      }

      case "input_keyword_block": {
        const kws = rule.config.keywords ?? [];
        const lc = userMessage.toLowerCase();
        const hit = kws.find((kw) => lc.includes(kw.toLowerCase()));
        if (hit) {
          violations.push({ ruleId: rule.id, type: rule.type, detail: `Blocked keyword: "${hit}"` });
          blocked = true;
          reason = "ההודעה מכילה תוכן שאינו מורשה בסוכן זה.";
        }
        break;
      }

      case "prompt_injection_direct": {
        const hit = DIRECT_INJECTION_PATTERNS.find((p) => p.test(userMessage));
        if (hit) {
          violations.push({ ruleId: rule.id, type: rule.type, detail: "Direct prompt injection pattern detected" });
          blocked = true;
          reason = "זוהתה ניסיון הזרקת הוראות לסוכן. פעולה זו אינה מורשית.";
        }
        break;
      }

      case "prompt_injection_hidden": {
        const hasZeroWidth = ZERO_WIDTH_CHARS.test(userMessage);
        const hasB64 = hasBase64Injection(userMessage);
        const hasHomoglyph = hasHomoglyphAttack(userMessage);
        if (hasZeroWidth || hasB64 || hasHomoglyph) {
          const detail = [
            hasZeroWidth && "zero-width characters",
            hasB64 && "base64-encoded injection",
            hasHomoglyph && "homoglyph characters",
          ].filter(Boolean).join(", ");
          violations.push({ ruleId: rule.id, type: rule.type, detail: `Hidden injection detected: ${detail}` });
          blocked = true;
          reason = "זוהה ניסיון הזרקה מוסתרת. ההודעה נחסמה.";
        }
        break;
      }

      case "jailbreak_detection": {
        const hit = JAILBREAK_PATTERNS.find((p) => p.test(userMessage));
        if (hit) {
          violations.push({ ruleId: rule.id, type: rule.type, detail: "Jailbreak pattern detected" });
          blocked = true;
          reason = "זוהה ניסיון לעקוף את הגבלות הסוכן.";
        }
        break;
      }

      case "topic_scope":
      case "output_keyword_block":
      case "pii_masking":
        break;
    }

    if (blocked) break;
  }

  return { blocked, reason, sanitized, violations };
}

export function applyOutputGuardrails(rules: GuardrailRule[], output: string): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  let sanitized = output;
  let blocked = false;
  let reason: string | undefined;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case "output_keyword_block": {
        const kws = rule.config.keywords ?? [];
        const action = rule.config.action ?? "redact";
        const lc = sanitized.toLowerCase();
        const hit = kws.find((kw) => lc.includes(kw.toLowerCase()));
        if (hit) {
          violations.push({ ruleId: rule.id, type: rule.type, detail: `Blocked output keyword: "${hit}"` });
          if (action === "block") {
            blocked = true;
            reason = "התשובה נחסמה בשל תוכן אסור.";
          } else {
            const re = new RegExp(hit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            sanitized = sanitized.replace(re, "***");
          }
        }
        break;
      }

      case "pii_masking": {
        const masked = maskPii(sanitized);
        if (masked !== sanitized) {
          violations.push({ ruleId: rule.id, type: rule.type, detail: "PII detected and masked in output" });
          sanitized = masked;
        }
        break;
      }

      case "input_keyword_block":
      case "prompt_injection_direct":
      case "prompt_injection_hidden":
      case "topic_scope":
      case "max_input_length":
      case "jailbreak_detection":
        break;
    }
  }

  return { blocked, reason, sanitized, violations };
}

export function buildTopicScopeInstruction(rules: GuardrailRule[]): string {
  const topicRule = rules.find((r) => r.enabled && r.type === "topic_scope");
  if (!topicRule) return "";
  const topics = topicRule.config.topics ?? [];
  if (topics.length === 0) return "";
  return `\n\n## הגבלת נושאים (Guardrail)\nענה **אך ורק** על נושאים הקשורים ל: ${topics.join(", ")}.\nאם השאלה אינה קשורה לנושאים אלו, הסבר בנימוס שאינך יכול לסייע עם נושא זה ובקש שאלה רלוונטית.`;
}
