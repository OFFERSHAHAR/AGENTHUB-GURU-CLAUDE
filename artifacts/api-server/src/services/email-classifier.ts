import { runModel } from "./model-router";

export const CATEGORIES = [
  { slug: "ai-consulting",      label: "אפיון וייעוץ AI",              score: "HOT" },
  { slug: "ai-agents",          label: "פיתוח סוכני AI",               score: "HOT" },
  { slug: "automations",        label: "אוטומציות ואינטגרציות",        score: "HOT" },
  { slug: "knowledge-bots",     label: "מאגרי ידע וצ'אטבוטים",        score: "WARM" },
  { slug: "marketing-ai",       label: "תוכן, שיווק ומכירות AI",       score: "WARM" },
  { slug: "ops-knowledge",      label: "תפעול וניהול ידע",             score: "WARM" },
  { slug: "security-ai",        label: "אבטחת מידע AI",                score: "WARM" },
  { slug: "spam",               label: "ספאם / לא רלוונטי",            score: "COLD" },
] as const;

export type CategorySlug = typeof CATEGORIES[number]["slug"];
export type LeadScore = "HOT" | "WARM" | "COLD";

export interface ClassificationResult {
  category: string;
  categorySlug: CategorySlug;
  leadScore: LeadScore;
  confidence: number;
  summaryHe: string;
  recommendedPackage: string;
  keySignals: string[];
  nextAction: string;
}

const CATEGORY_LIST = CATEGORIES.map((c) => `${c.slug}: ${c.label}`).join("\n");

const PACKAGES = `חבילת בסיס (אבחון ראשוני), חבילת צמיחה (סוכן + אוטומציות), חבילת פרימיום (מערכת AI עסקית מלאה)`;

export async function classifyEmail(
  subject: string,
  body: string,
  fromAddress: string,
): Promise<ClassificationResult> {
  const prompt = `You are an expert lead classifier for an Israeli AI consulting company. Classify the following email lead.

CATEGORIES (choose one slug):
${CATEGORY_LIST}

PACKAGES: ${PACKAGES}

EMAIL:
From: ${fromAddress}
Subject: ${subject}
Body:
${body.slice(0, 3000)}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "categorySlug": "<slug from list>",
  "confidence": <0.0-1.0>,
  "summaryHe": "<2-3 sentence Hebrew summary of what the lead wants>",
  "recommendedPackage": "<one package name>",
  "keySignals": ["<signal1>", "<signal2>", "<signal3>"],
  "nextAction": "<short Hebrew next action for sales team>"
}`;

  try {
    const result = await runModel(
      "fallback",
      "You classify email leads. Output only valid JSON.",
      prompt,
    );
    const raw = result.text;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const cat = CATEGORIES.find((c) => c.slug === parsed.categorySlug) ?? CATEGORIES[CATEGORIES.length - 1];

    return {
      category: cat.label,
      categorySlug: cat.slug as CategorySlug,
      leadScore: cat.score as LeadScore,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      summaryHe: parsed.summaryHe ?? "",
      recommendedPackage: parsed.recommendedPackage ?? "",
      keySignals: Array.isArray(parsed.keySignals) ? parsed.keySignals.slice(0, 6) : [],
      nextAction: parsed.nextAction ?? "",
    };
  } catch (err) {
    console.error("[email-classifier] LLM failed, using heuristic fallback:", err);
    return heuristicClassify(subject, body);
  }
}

function heuristicClassify(subject: string, body: string): ClassificationResult {
  const text = `${subject} ${body}`.toLowerCase();

  const rules: Array<[string[], CategorySlug]> = [
    [["אבטחה", "siem", "firewall", "edr", "iso 27001", "soc 2", "gdpr", "compliance"], "security-ai"],
    [["סוכן", "agent", "chatbot", "בוט", "rag", "llm", "gpt", "claude", "openai"], "ai-agents"],
    [["אוטומציה", "automation", "n8n", "make", "zapier", "crm", "webhook", "api", "integration"], "automations"],
    [["תוכן", "שיווק", "מכירות", "פוסט", "מודעה", "follow-up", "marketing", "content"], "marketing-ai"],
    [["מאגר ידע", "knowledge", "faq", "מסמך", "נוהל", "document", "wiki"], "knowledge-bots"],
    [["תפעול", "דוח", "פגישה", "ניהול", "ops", "report", "meeting", "summary"], "ops-knowledge"],
    [["אפיון", "ייעוץ", "consulting", "workshop", "מיפוי", "תהליך", "process"], "ai-consulting"],
  ];

  for (const [keywords, slug] of rules) {
    if (keywords.some((kw) => text.includes(kw))) {
      const cat = CATEGORIES.find((c) => c.slug === slug)!;
      return {
        category: cat.label,
        categorySlug: slug,
        leadScore: cat.score as LeadScore,
        confidence: 0.55,
        summaryHe: "סיווג אוטומטי על בסיס מילות מפתח.",
        recommendedPackage: "חבילת צמיחה",
        keySignals: keywords.filter((kw) => text.includes(kw)).slice(0, 3),
        nextAction: "לבדוק את הפנייה ולחזור ללקוח",
      };
    }
  }

  const spamCat = CATEGORIES.find((c) => c.slug === "spam")!;
  return {
    category: spamCat.label,
    categorySlug: "spam",
    leadScore: "COLD",
    confidence: 0.4,
    summaryHe: "לא זוהתה פנייה עסקית רלוונטית.",
    recommendedPackage: "",
    keySignals: [],
    nextAction: "לסגור / להתעלם",
  };
}
