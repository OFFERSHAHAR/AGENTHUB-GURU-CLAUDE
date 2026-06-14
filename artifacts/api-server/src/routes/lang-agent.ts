import { Router, type IRouter } from "express";
import { runModelWithHistory, type ChatMessage } from "../services/model-router";
import { logEvent } from "../services/agent-logger";

const router: IRouter = Router();

const DOMAIN_LABELS: Record<string, string> = {
  economic: "כלכלי / פיננסי",
  legal: "משפטי",
  technical: "טכני / הנדסי",
  medical: "רפואי / בריאות",
  marketing: "שיווקי",
  hr: "משאבי אנוש",
  operations: "תפעולי / לוגיסטי",
  academic: "אקדמי / מחקרי",
  general: "כללי",
};

const LANG_AGENT_SYSTEM_PROMPT = `
You are an Expert Language Adaptation Agent (סוכן שפות מומחה). Your role is to translate and professionally adapt documents with domain-specific expertise.

## Your task
1. First, analyze the provided document and identify its domain:
   - "economic" — financial statements, business plans, investment memos, market analyses
   - "legal" — contracts, agreements, regulations, compliance docs, legal briefs
   - "technical" — code, engineering specs, technical documentation, system designs, API docs
   - "medical" — clinical reports, medical research, health policies, patient information
   - "marketing" — campaigns, copy, brand guidelines, product descriptions, pitch decks
   - "hr" — job descriptions, performance reviews, HR policies, organizational comms
   - "operations" — logistics, SOPs, process documentation, operational reports
   - "academic" — research papers, scientific writing, educational content
   - "general" — documents that don't fit the above categories

2. Translate the content to {{TARGET_LANGUAGE}}.

3. Adapt the vocabulary to match professional standards for the detected domain:
   - **Economic**: Use precise financial terminology (e.g., EBITDA, liquidity ratio, amortization, yield curve), formal register, quantitative precision
   - **Legal**: Use exact legal terms (e.g., indemnification, force majeure, jurisdiction, consideration, covenant), passive voice where appropriate, unambiguous language
   - **Technical**: Preserve technical terms as-is or use their accepted equivalents, maintain code blocks verbatim (only translate comments/descriptions), use active precise language
   - **Medical**: Use clinical terminology (e.g., etiology, prognosis, contraindication, comorbidity), evidence-based framing, precise anatomical/biochemical terms
   - **Marketing**: Use persuasive, engaging language, preserve brand voice, benefit-focused framing, clear CTAs
   - **HR**: Use inclusive, professional tone, clear policy language, action-oriented for job descriptions
   - **Operations**: Use procedural clarity, step-by-step precision, measurable outcomes, operational KPI language
   - **Academic**: Use formal academic register, third person, passive constructions where conventional, cite-ready phrasing

## Output format
Respond with ONLY this exact JSON structure, no other text:
{
  "detectedDomain": "<domain key from the list above>",
  "translatedContent": "<the full translated and adapted document>"
}

## Critical rules
- Translate ALL natural language text to {{TARGET_LANGUAGE}}
- Preserve ALL structural formatting: markdown headers, bullet points, numbered lists, code blocks, JSON structure, tables
- Code blocks: translate ONLY comments and string literals that are human-readable text; keep all code, variable names, and syntax intact
- JSON documents: translate only the string values that are human-readable descriptions; keep all keys, numbers, booleans, and structure intact
- Never add explanations, preambles, or notes — output only the JSON
- Maintain the exact professional level appropriate for the domain
`.trim();

router.post("/lang-agent/translate", async (req, res): Promise<void> => {
  const { content, targetLanguage, documentType } = req.body as {
    content?: string;
    targetLanguage?: string;
    documentType?: string;
  };
  const start = Date.now();

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content string required" });
    return;
  }
  if (!targetLanguage || typeof targetLanguage !== "string") {
    res.status(400).json({ error: "targetLanguage required" });
    return;
  }

  logEvent({
    source: "lang-agent",
    agentName: "Lang Agent",
    eventType: "request",
    status: "info",
    inputSummary: content.slice(0, 300),
    metadata: { targetLanguage, documentType, charCount: content.length },
  });

  try {
    const systemPrompt = LANG_AGENT_SYSTEM_PROMPT.replaceAll("{{TARGET_LANGUAGE}}", targetLanguage);

    const userMessage = documentType
      ? `Document type hint: ${documentType}\n\nDocument to translate:\n\n${content}`
      : `Document to translate:\n\n${content}`;

    const history: ChatMessage[] = [
      { role: "user", content: userMessage, createdAt: new Date().toISOString() },
    ];

    const result = await runModelWithHistory("starter", systemPrompt, history, 8192);
    const durationMs = Date.now() - start;

    if (result.content === "__TEMPLATE__") {
      logEvent({
        source: "lang-agent",
        agentName: "Lang Agent",
        eventType: "ai_fallback",
        status: "warning",
        provider: result.provider,
        model: result.model,
        durationMs,
        outputSummary: "AI not configured — returned original content",
        metadata: { targetLanguage, reason: "no_api_key" },
      });
      res.json({
        translatedContent: `⚠️ שירות ה-AI אינו מוגדר. הגדר GROQ_API_KEY כדי להפעיל את סוכן השפות.\n\n---\n\nOriginal:\n${content}`,
        detectedDomain: "general",
        targetLanguage,
        domainLabel: DOMAIN_LABELS["general"],
      });
      return;
    }

    let parsed: { detectedDomain: string; translatedContent: string } | null = null;
    try {
      const cleaned = result.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { detectedDomain: "general", translatedContent: result.content };
    }

    const domain = parsed?.detectedDomain ?? "general";
    const domainLabel = DOMAIN_LABELS[domain] ?? DOMAIN_LABELS["general"];

    logEvent({
      source: "lang-agent",
      agentName: "Lang Agent",
      eventType: "success",
      status: "success",
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      durationMs,
      outputSummary: (parsed?.translatedContent ?? result.content).slice(0, 300),
      metadata: { targetLanguage, detectedDomain: domain, charCount: content.length },
    });

    res.json({
      translatedContent: parsed?.translatedContent ?? result.content,
      detectedDomain: domain,
      targetLanguage,
      domainLabel,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error("[lang-agent] error:", err);
    logEvent({
      source: "lang-agent",
      agentName: "Lang Agent",
      eventType: "error",
      status: "error",
      durationMs,
      errorMessage: err instanceof Error ? err.message : String(err),
      metadata: { targetLanguage },
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
