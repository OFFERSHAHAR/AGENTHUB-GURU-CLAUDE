/**
 * Analysis Service — Business Analysis Pre-filter
 *
 * Generates a structured Hebrew business analysis document from a raw spec.
 * Uses the Model Router to pick the right AI provider per tier.
 * Falls back to template-based extraction when no AI is available.
 */

import { runModel, getPricingComparison, type ModelTier } from "./model-router.js";
import { db, clientsTable, tokenUsageTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SYSTEM_PROMPT = `אתה סוכן ניתוח עסקי אישי — Business Analysis Pre-filter.

קבל הודעה קצרה עם פרטי לקוח ובעיה, וייצר מסמך ניתוח מובנה בפורמט הבא בדיוק:

# 🔍 ניתוח עסקי — [שם הארגון]

## 1. 📋 סיכום (30 שניות)
[פסקה אחת: מה הבעיה, למה היא כואבת, מה קטגוריית הפתרון]

## 2. 🧩 הבעיה העסקית
- **מדווח:** [מה אמרו]
- **אמיתי:** [מה מסתתר מאחורי]
- **תהליך מושפע:** [השלב הכואב]
- **מדדי כאב:** [זמן / כסף / שגיאות — הערכה]
- **הגדרת הצלחה:** [מה ייראה כהצלחה]

## 3. 🔌 מערכות ואינטגרציות
| מערכת | סוג | שיטה מומלצת | קושי |
|-------|-----|-------------|------|
| ... | REST/SOAP/DB/File | API Wrapper / MCP / ETL | 🟢/🟡/🔴 |

## 4. 💡 פתרונות אפשריים
1. **[שם פתרון]** — [תיאור קצר] | עלות יישום: נמוכה/בינונית/גבוהה
2. **[שם פתרון]** — [תיאור קצר] | עלות יישום: נמוכה/בינונית/גבוהה
3. **[שם פתרון]** — [תיאור קצר] | עלות יישום: נמוכה/בינונית/גבוהה

## 5. 📝 Brief לסוכן האפיון
**בעיה:** [משפט אחד]
**מערכות:** [רשימה]
**קלט:** [תיאור]
**פלט:** [תיאור]
**אילוצים:** [רשימה]

## 6. ❓ שאלות לבירור
1. ...
2. ...
3. ...

## 7. ⚠️ סיכונים
- ...

כללים: היה ספציפי, אל תנחש — ציין חוסר מידע בסעיף 6. שפת פלט: עברית.`;

function extractClientInfo(rawSpec: string): { name: string; industry: string; email: string } {
  // Try to extract name
  const namePatterns = [
    /(?:לקוח|ארגון|חברה|חברת|company|client)[:\s]+([^\n,]+)/i,
    /^([A-Z][a-zA-Z\s]{2,30}(?:Ltd|Inc|Corp|בע"מ)?)/m,
    /שם[:\s]+([^\n]+)/i,
  ];
  let name = "ארגון חדש";
  for (const p of namePatterns) {
    const m = rawSpec.match(p);
    if (m?.[1]?.trim()) { name = m[1].trim().substring(0, 50); break; }
  }

  // Try to extract industry
  const industryKeywords: Record<string, string[]> = {
    "ייצור": ["ייצור", "מפעל", "manufacturing", "factory", "production"],
    "היי-טק": ["היי-טק", "תוכנה", "software", "tech", "startup", "saas"],
    "פיננסים": ["בנק", "ביטוח", "פיננסי", "finance", "banking", "insurance"],
    "בריאות": ["בית חולים", "קליניקה", "רפואה", "health", "medical", "hospital"],
    "קמעונאות": ["חנות", "retail", "e-commerce", "קמעונאי", "shop"],
    "לוגיסטיקה": ["שילוח", "לוגיסטיקה", "logistics", "shipping", "transport"],
    "נדל\"ן": ["נדל\"ן", "real estate", "דירות", "property"],
    "חינוך": ["אוניברסיטה", "בית ספר", "education", "school", "learning"],
  };
  let industry = "טכנולוגיה";
  const lc = rawSpec.toLowerCase();
  for (const [ind, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(k => lc.includes(k.toLowerCase()))) { industry = ind; break; }
  }

  // Try to extract email
  const emailMatch = rawSpec.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  const email = emailMatch?.[0] || `contact@${name.toLowerCase().replace(/\s+/g, "")}.com`.substring(0, 60);

  return { name, industry, email };
}

function buildTemplateAnalysis(rawSpec: string, clientName: string): string {
  const now = new Date().toLocaleDateString("he-IL");
  const lines = rawSpec.split("\n").filter(l => l.trim());

  // Extract potential pain points (sentences with problem keywords)
  const painKeywords = ["בעיה", "איטי", "שגיאה", "ידני", "לא עובד", "קשה", "זמן רב", "עלות"];
  const painPoints = lines.filter(l => painKeywords.some(k => l.includes(k))).slice(0, 3);

  // Extract potential systems (common system names)
  const systemKeywords = ["ERP", "CRM", "SAP", "Salesforce", "Excel", "מערכת", "API", "בסיס נתונים", "אתר"];
  const systems = systemKeywords.filter(s => rawSpec.toLowerCase().includes(s.toLowerCase()));

  return `# 🔍 ניתוח עסקי — ${clientName}
> נוצר אוטומטית מהודעת טלגרם | ${now}

---

## 1. 📋 סיכום (30 שניות)
${clientName} מחפשים פתרון לאוטומציה / אינטגרציה. הבעיה העיקרית נראית כרוכה בתהליך ידני שגוזל זמן ומשאבים. פתרון אגנטי יכול לחסוך עלויות תפעוליות ולשפר דיוק.

> ⚠️ **ניתוח זה נוצר ללא AI** — Ollama אינו פעיל כרגע. הגדר OLLAMA_BASE_URL או GROQ_API_KEY לניתוח מלא.

---

## 2. 🧩 הבעיה העסקית
- **מדווח:** ${rawSpec.substring(0, 200)}${rawSpec.length > 200 ? "..." : ""}
- **אמיתי:** יש לנתח עמוק — נדרשת שיחת גילוי
- **תהליך מושפע:** ${painPoints[0] || "לא ניתן להסיק מהטקסט"}
- **מדדי כאב:** נדרש בירור — ראה שאלות בסעיף 6
- **הגדרת הצלחה:** חיסכון בזמן תפעולי + צמצום שגיאות ידניות

---

## 3. 🔌 מערכות ואינטגרציות
| מערכת | סוג | שיטה מומלצת | קושי |
|-------|-----|-------------|------|
${systems.length > 0 ? systems.map(s => `| ${s} | לא ידוע | בירור נדרש | 🟡 |`).join("\n") : "| לא זוהו מערכות ספציפיות | — | בירור נדרש | 🟡 |"}

---

## 4. 💡 פתרונות אפשריים
1. **אוטומציה מבוססת סוכן AI** — סוכן מותאם שמטפל בתהליך הידני | עלות יישום: בינונית
2. **אינטגרציה API בין מערכות** — חיבור ישיר בין הכלים הקיימים | עלות יישום: נמוכה–בינונית
3. **MCP Server למערכות ישנות** — שכבת ממשק לאפשר חיבור מודרני | עלות יישום: בינונית–גבוהה

---

## 5. 📝 Brief לסוכן האפיון
**בעיה:** תהליך ידני / אינטגרציה חסרה בין מערכות
**מערכות:** ${systems.join(", ") || "לא זוהו — נדרש בירור"}
**קלט:** נתונים מהמשתמש / מהמערכת הקיימת
**פלט:** תוצאה אוטומטית / דוח / פעולה מוגדרת
**אילוצים:** מערכות קיימות, אבטחה, SLA

---

## 6. ❓ שאלות לבירור
1. אילו מערכות ספציפיות קיימות בארגון?
2. כמה אנשים מבצעים את התהליך כיום?
3. כמה זמן גוזל התהליך מדי יום/שבוע?
4. האם יש API קיים למערכות אלו?
5. מה התקציב המשוער?

---

## 7. ⚠️ סיכונים
- מידע חסר — נדרש קיום שיחת גילוי לפני אפיון
- ייתכן שמערכות קיימות חסרות API — נדרש בדיקה טכנית

---
*🤖 הפעל Ollama מקומית או הגדר GROQ_API_KEY לניתוח AI מלא*`;
}

export async function runAnalysis(clientId: number, rawSpec: string, tier: ModelTier = "free"): Promise<void> {
  // Mark as analyzing
  await db.update(clientsTable)
    .set({ analysisStatus: "analyzing" })
    .where(eq(clientsTable.id, clientId));

  try {
    const { name: clientName } = extractClientInfo(rawSpec);

    let result;
    try {
      result = await runModel(tier, SYSTEM_PROMPT, `אפיון מהלקוח:\n\n${rawSpec}`);
    } catch (err) {
      console.error("[analysis] model failed:", err);
      result = { content: "__TEMPLATE__", provider: "template", model: "none", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
    }

    const analysisDoc = result.content === "__TEMPLATE__"
      ? buildTemplateAnalysis(rawSpec, clientName)
      : result.content;

    // Append cost comparison table
    const pricing = getPricingComparison(result.inputTokens || 500, result.outputTokens || 1500);
    const costTable = `\n\n---\n\n## 💰 עלות טוקנים — השוואת מודלים\n| מודל | שכבה | עלות לניתוח זה | הערה |\n|------|------|---------------|------|\n${pricing.map(p => `| ${p.label} | ${p.tier} | $${p.cost.toFixed(5)} | ${p.note} |`).join("\n")}\n\n*טוקנים בשימוש: ~${result.inputTokens} קלט + ~${result.outputTokens} פלט*\n*בסקייל × 1,000 ניתוחים/חודש: $${(pricing[2].cost * 1000).toFixed(2)} (GPT-4o) לעומת $0 (Ollama)*`;

    const finalDoc = analysisDoc + costTable;

    // Save result
    await db.update(clientsTable)
      .set({ analysisStatus: "ready", analysisDoc: finalDoc })
      .where(eq(clientsTable.id, clientId));

    // Record token usage
    if (result.inputTokens > 0 || result.outputTokens > 0) {
      await db.insert(tokenUsageTable).values({
        clientId,
        model: result.model,
        provider: result.provider,
        tier,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        purpose: "business_analysis",
      });
    }
  } catch (err) {
    console.error("[analysis] failed for client", clientId, err);
    await db.update(clientsTable)
      .set({ analysisStatus: "error" })
      .where(eq(clientsTable.id, clientId));
  }
}

export { extractClientInfo };
