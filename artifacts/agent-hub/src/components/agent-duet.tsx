import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Download, Zap, Clock, BarChart2, ChevronRight } from "lucide-react";
import { useCreateWorkflow } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Speaker = "jarvis" | "gabar";
type Phase = "idle" | "thinking" | "talking" | "proposing" | "done";

interface Message {
  id: number;
  speaker: Speaker;
  text: string;
  isTyping?: boolean;
}

interface Proposal {
  title: string;
  summary: string;
  type: "workflow" | "action" | "report";
  badge: string;
  items: string[];
  n8nJson?: object;
  approvedBy?: "ofer" | "or";
}

// ─── Conversation templates ───────────────────────────────────────────────────
function buildConversation(topic: string): { turns: Array<{ speaker: Speaker; text: string }>; proposal: Proposal } {
  const t = topic.toLowerCase();

  // Lead / sales / clients
  if (t.includes("ליד") || t.includes("lead") || t.includes("מכירות") || t.includes("לקוח") || t.includes("קליינט")) {
    return {
      turns: [
        { speaker: "jarvis", text: `ניתחתי את הנושא: "${topic}". נקודת הכשל העיקרית היא זמן תגובה — ממוצע 4.2 שעות. הנורמה בשוק: 5 דקות.` },
        { speaker: "gabar", text: "זה נפסד. ראיתי את הלוגים — 34% מהלידים מתקררים תוך שעה ראשונה. ג'ארוויס, מה הפתרון שלך?" },
        { speaker: "jarvis", text: "Workflow 'Lead Fast-Track': Webhook → Lead Scorer → IF score≥7 → שלח התראה מיידית לסייל → ELSE → Nurture Sequence אוטומטי." },
        { speaker: "gabar", text: "אני אוסיף — אימייל מותאם אישית תוך 90 שניות + עדכון CRM אוטומטי. יש לנו את כל הכלים. זה לא מסובך." },
        { speaker: "jarvis", text: "מוסיף שכבת ניתוח: A/B test על נוסח ההודעה. שני וריאנטים יפעלו במקביל. נמדוד המרה לאחר 30 יום." },
        { speaker: "gabar", text: "מסכים. ג'ארוויס, אני גם מציע לחבר את זה ל-Open Source Hub — להשתמש ב-CrewAI כ-orchestrator. יותר חכם." },
        { speaker: "jarvis", text: "הסכמנו. מכין הצעה סופית ל-Workflow 'Lead Fast-Track' עם 8 nodes. מחכה לאישור עופר או אור." },
      ],
      proposal: {
        title: "Workflow: Lead Fast-Track",
        summary: "זיהוי ליד → ניקוד אוטומטי → תגובה תוך 90 שניות → עדכון CRM → A/B test",
        type: "workflow",
        badge: "🚀 קריטי לעסק",
        items: [
          "⚡ Webhook — קליטת ליד נכנס",
          "🧮 Lead Scorer — ניקוד 1-10 בOllama",
          "🔀 IF score ≥ 7 → Sales Alert (Telegram)",
          "📧 אימייל מותאם תוך 90 שניות",
          "💾 CRM Update — שמירה אוטומטית",
          "🔬 A/B Test — 2 וריאנטי הודעה",
          "📊 Analytics — מדידת המרה יומית",
          "♻️ Nurture Sequence ← לידים שלא קנו",
        ],
        n8nJson: {
          name: "Lead Fast-Track — AgentDuet",
          nodes: [
            { name: "Lead Webhook", type: "n8n-nodes-base.webhook", parameters: { path: "lead-intake", httpMethod: "POST", responseMode: "responseNode" }, position: [240, 300] },
            { name: "Score Lead (Ollama)", type: "@n8n/n8n-nodes-langchain.lmOllama", parameters: { model: "llama3.2", baseUrl: "http://localhost:11434" }, position: [460, 300] },
            { name: "Qualified?", type: "n8n-nodes-base.if", parameters: { conditions: { number: [{ value1: "={{$json.score}}", operation: "largerEqual", value2: 7 }] } }, position: [680, 300] },
            { name: "Sales Alert", type: "n8n-nodes-base.telegram", parameters: { text: "🔥 ליד חם! Score: {{$json.score}}" }, position: [900, 180] },
            { name: "Auto Email", type: "n8n-nodes-base.emailSend", parameters: { subject: "שלום {{$json.name}}!", text: "ראינו שאתם מחפשים..." }, position: [900, 420] },
            { name: "CRM Update", type: "n8n-nodes-base.httpRequest", parameters: { url: "https://your-crm.com/api/leads", method: "POST" }, position: [1120, 300] },
          ],
          connections: {},
          active: false,
          settings: { executionOrder: "v1" },
        },
      },
    };
  }

  // Workflow / automation / process
  if (t.includes("workflow") || t.includes("אוטומציה") || t.includes("תהליך") || t.includes("automation")) {
    return {
      turns: [
        { speaker: "jarvis", text: `ניתוח נושא "${topic}": זיהיתי 3 צווארי בקבוק עיקריים — כניסת נתונים ידנית (40% מהזמן), מעקב לא אחיד (25%), ודיווח ידני (35%).` },
        { speaker: "gabar", text: "מוסיף נקודה — ראיתי בלוגים שיש 7 tasks ידניים שחוזרים כל יום. אפשר לבטל את כולם. ג'ארוויס, בוא נבנה משהו אמיתי." },
        { speaker: "jarvis", text: "מוצע: Workflow מרכזי עם 3 branches — Branch A לפעולות שגרתיות, Branch B להתרעות, Branch C לדוחות. Cron trigger כל בוקר בשעה 8." },
        { speaker: "gabar", text: "אני רוצה להוסיף n8n + Ollama לניתוח אינטליגנטי של הנתונים לפני ההחלטה. לא רק אוטומציה — גם חשיבה." },
        { speaker: "jarvis", text: "מסכים. ה-Ollama node יקבל context, ינתח, ויחליט איזה branch להפעיל. זה חוסך לנו logic ידני." },
        { speaker: "gabar", text: "מעולה. ג'ארוויס, אתה בונה את הJSON, אני מוסיף את ה-system prompt ל-Ollama. חמש דקות." },
        { speaker: "jarvis", text: "גמור. Workflow 'Smart Daily Ops' מוכן לאישור. 6 nodes, Ollama-powered, דיווח אוטומטי בטלגרם." },
      ],
      proposal: {
        title: "Workflow: Smart Daily Ops",
        summary: "Cron יומי → Ollama מנתח → 3 branches חכמות → דיווח אוטומטי",
        type: "workflow",
        badge: "⚙️ אוטומציה מלאה",
        items: [
          "⏰ Cron Trigger — כל בוקר 08:00",
          "📥 קריאת נתונים מכל המקורות",
          "🧠 Ollama — ניתוח + קבלת החלטה",
          "🔀 Branch A — פעולות שגרה יומית",
          "🔀 Branch B — התרעות וחריגים",
          "🔀 Branch C — דוח יומי אוטומטי",
          "📱 Telegram — סיכום לעופר + אור",
        ],
      },
    };
  }

  // Agents / AI / models
  if (t.includes("סוכן") || t.includes("agent") || t.includes("ai") || t.includes("model") || t.includes("מודל")) {
    return {
      turns: [
        { speaker: "jarvis", text: `בנושא "${topic}" — ביצעתי סריקה. יש לנו 23 סוכנים. 10 מהם open-source. רק 5 מחוברים לworkflow פעיל. בזבוז משאבים.` },
        { speaker: "gabar", text: "ג'ארוויס, נכון. הסוכנים שלא מחוברים — AutoGPT, MetaGPT, SuperAGI — יכולים לייצר ערך אמיתי. בוא נבנה Orchestra." },
        { speaker: "jarvis", text: "הצעתי: CrewAI כ-orchestrator ראשי. הוא מנהל צוות של 3 סוכנים מתמחים — אחד לניתוח, אחד לביצוע, אחד לבדיקה." },
        { speaker: "gabar", text: "מוסיף — LangGraph כ-state machine לניהול מצב השיחה. זה מונע כפילויות ושומר context בין הסוכנים." },
        { speaker: "jarvis", text: "מסכים. Phidata לזיכרון ארוך טווח. כל הסוכנים קוראים מאותו knowledge base מרכזי." },
        { speaker: "gabar", text: "זה ה-dream team: CrewAI → LangGraph → Phidata + OpenHands לביצוע קוד. ג'ארוויס, הגענו למשהו טוב כאן." },
        { speaker: "jarvis", text: "מוכן. מציג הצעת 'Multi-Agent Orchestra' — 4 סוכנים, ניהול מרכזי, זיכרון שיתופי. ממתין לאישור." },
      ],
      proposal: {
        title: "Multi-Agent Orchestra",
        summary: "CrewAI → LangGraph → Phidata + OpenHands — 4 סוכנים עם זיכרון שיתופי",
        type: "action",
        badge: "🤖 AI מתקדם",
        items: [
          "👥 CrewAI — Orchestrator ראשי",
          "🕸️ LangGraph — State machine ו-context",
          "📚 Phidata — זיכרון ארוך טווח",
          "🛠️ OpenHands — ביצוע קוד בפועל",
          "🔗 Knowledge Base מרכזי משותף",
          "📊 Dashboard ניטור בזמן אמת",
        ],
      },
    };
  }

  // Report / analytics / data
  if (t.includes("דוח") || t.includes("ניתוח") || t.includes("נתון") || t.includes("report") || t.includes("analytics")) {
    return {
      turns: [
        { speaker: "jarvis", text: `לנושא "${topic}": אני מציע מבנה דוח ב-3 שכבות — Executive Summary (2 עמודים), Operational Detail (5 עמודים), Raw Data (Appendix).` },
        { speaker: "gabar", text: "ג'ארוויס, זה טוב אבל אחד-ממוצע-ביצוע. הוסף visualizations — charts אינטרקטיביים שעופר ואור יוכלו לקרוא ב-10 שניות." },
        { speaker: "jarvis", text: "מסכים. אוסיף: Recharts לgraphs, Sparklines לtrends, Color-coded KPIs. הכל נשלח אוטומטית בטלגרם כל שני." },
        { speaker: "gabar", text: "מוסיף insight אוטומטי — Ollama מנתח הנתונים ומייצר 3 insights + 1 המלצה פעולה. לא סתם מספרים — משמעות." },
        { speaker: "jarvis", text: "מצוין. ואם יש אנומליה — התראה מיידית ב-Telegram לפני שהדוח השבועי יוצא." },
        { speaker: "gabar", text: "זה בדיוק מה שצריך. ג'ארוויס, נבנה את זה ביחד — אתה על הdata pipeline, אני על ה-insights prompt." },
        { speaker: "jarvis", text: "הגענו להסכמה. 'Smart Report Suite' — Cron שבועי, Ollama insights, Recharts dashboard, Telegram delivery. הצעה סופית מוכנה." },
      ],
      proposal: {
        title: "Smart Report Suite",
        summary: "דוח שבועי אוטומטי: Ollama insights + Recharts + Telegram delivery",
        type: "report",
        badge: "📊 דוחות חכמים",
        items: [
          "⏰ Cron שבועי — כל יום ב' 09:00",
          "📥 Pipeline נתונים מכל המקורות",
          "🧠 Ollama — 3 insights + המלצת פעולה",
          "📈 Recharts — 5 visualizations אוטומטיים",
          "🚨 התראה מיידית על אנומליות",
          "📱 Telegram — שליחה לעופר + אור",
          "🗄️ ארכיב אוטומטי לDrive",
        ],
      },
    };
  }

  // General / default
  return {
    turns: [
      { speaker: "jarvis", text: `קיבלתי את הנושא: "${topic}". מבצע ניתוח ראשוני — סורק את המערכת לנקודות רלוונטיות.` },
      { speaker: "gabar", text: `אני מכין גם — לפני שג'ארוויס יסיים לנתח, יש לי כבר 3 רעיונות. ג'ארוויס, מה מצאת?` },
      { speaker: "jarvis", text: "זיהיתי 2 תחומים לשיפור: אוטומציה של פעולות חוזרות (חיסכון 3 שעות/שבוע) ויצירת workflow מרכזי לניהול." },
      { speaker: "gabar", text: "מסכים עם ג'ארוויס. אני מוסיף — Ollama + n8n יכולים לבנות את זה מהיר. אני אתן לג'ארוויס לסכם." },
      { speaker: "jarvis", text: "מציע תוכנית 3 שלבים: 1) Workflow בסיסי תוך 24 שעות, 2) Ollama integration תוך שבוע, 3) Full automation תוך חודש." },
      { speaker: "gabar", text: "ג'ארוויס תמיד עם הגאנט שלו... אבל הפעם הוא צודק. בוא נציג לעופר ואור ונקבל אישור." },
      { speaker: "jarvis", text: "הצעה מוכנה. תוכנית פעולה ל: " + topic + " — 3 שלבים, 7 tasks מוגדרים, timeline ברור." },
    ],
    proposal: {
      title: `תוכנית פעולה: ${topic}`,
      summary: "3 שלבים · 7 tasks · timeline מוגדר · Ollama + n8n",
      type: "action",
      badge: "📋 תוכנית מסודרת",
      items: [
        "🏃 שלב 1: Setup בסיסי (24 שעות)",
        "🔧 שלב 2: Workflow ראשי (שבוע)",
        "🤖 שלב 3: AI + אוטומציה מלאה (חודש)",
        "📊 KPIs למדידה מוגדרים",
        "📱 דיווח שבועי אוטומטי",
        "✅ נקודות בקרה לאישור בכל שלב",
      ],
    },
  };
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MsgBubble({ msg, isNew }: { msg: Message; isNew: boolean }) {
  const isJ = msg.speaker === "jarvis";
  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: isJ ? -20 : 20, y: 8 } : false}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{
        display: "flex", gap: 10, alignItems: "flex-end",
        flexDirection: isJ ? "row" : "row-reverse",
        marginBottom: 12,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: isJ ? "linear-gradient(135deg,#0f172a,#1e3a5f)" : "linear-gradient(135deg,#2d1b4e,#4c1d95)",
        border: `2px solid ${isJ ? "#0ea5e9" : "#7c3aed"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, flexShrink: 0,
        boxShadow: `0 0 8px ${isJ ? "#0ea5e944" : "#7c3aed44"}`,
      }}>
        {isJ ? "J" : "G"}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "75%" }}>
        <div style={{
          fontSize: 9, color: isJ ? "#38bdf8" : "#a78bfa",
          marginBottom: 3, textAlign: isJ ? "left" : "right",
          fontWeight: 700, letterSpacing: 0.4,
        }}>
          {isJ ? "JARVIS" : "GABAR"}
        </div>
        {msg.isTyping ? (
          <div style={{
            background: isJ ? "rgba(14,165,233,0.1)" : "rgba(124,58,237,0.1)",
            border: `1px solid ${isJ ? "#0ea5e933" : "#7c3aed33"}`,
            borderRadius: isJ ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
            padding: "10px 14px", display: "flex", gap: 4, alignItems: "center",
          }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: isJ ? "#38bdf8" : "#a78bfa" }}
              />
            ))}
          </div>
        ) : (
          <div style={{
            background: isJ ? "rgba(14,165,233,0.08)" : "rgba(124,58,237,0.08)",
            border: `1px solid ${isJ ? "#0ea5e933" : "#7c3aed33"}`,
            borderRadius: isJ ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
            padding: "10px 14px",
            color: "#e2e8f0", fontSize: 13, lineHeight: 1.55,
            direction: "rtl", textAlign: "right",
          }}>
            {msg.text}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Proposal Card ────────────────────────────────────────────────────────────
function ProposalCard({
  proposal, onApprove, onReject,
}: {
  proposal: Proposal;
  onApprove: (by: "ofer" | "or") => void;
  onReject: () => void;
}) {
  const approved = proposal.approvedBy;
  const { toast } = useToast();
  const createWorkflow = useCreateWorkflow();

  const handleApprove = (by: "ofer" | "or") => {
    if (proposal.n8nJson) {
      createWorkflow.mutate(
        { data: { name: proposal.title, status: "draft", nodes: "[]", edges: "[]" } },
        { onSuccess: () => toast({ title: `✅ Workflow נוצר: ${proposal.title}` }) }
      );
    }
    onApprove(by);
    toast({ title: `✅ אושר על ידי ${by === "ofer" ? "עופר" : "אור"}`, description: proposal.title });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: "0 16px 16px",
        borderRadius: 16,
        overflow: "hidden",
        border: approved ? "2px solid #22c55e" : "2px solid #f59e0b",
        background: approved
          ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.04))"
          : "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(234,179,8,0.04))",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        background: approved ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
        borderBottom: `1px solid ${approved ? "#22c55e33" : "#f59e0b33"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: approved ? "#22c55e" : "#f59e0b",
          letterSpacing: 0.5,
        }}>
          {approved ? `✅ אושר — ${approved === "ofer" ? "עופר" : "אור"}` : "🏁 הצעה סופית — ממתינה לאישור"}
        </span>
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 20,
          background: approved ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)",
          color: approved ? "#86efac" : "#fcd34d", fontWeight: 700,
        }}>
          {proposal.badge}
        </span>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Title */}
        <h3 style={{ margin: "0 0 4px", color: "#f1f5f9", fontSize: 15, fontWeight: 800, direction: "rtl", textAlign: "right" }}>
          {proposal.title}
        </h3>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 12, direction: "rtl", textAlign: "right", lineHeight: 1.5 }}>
          {proposal.summary}
        </p>

        {/* Items */}
        <div style={{
          background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px",
          marginBottom: 14, border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {proposal.items.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
              borderBottom: i < proposal.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <ChevronRight style={{ width: 12, height: 12, color: "#4b5563", flexShrink: 0 }} />
              <span style={{ color: "#cbd5e1", fontSize: 12, direction: "rtl", textAlign: "right" }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {!approved && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleApprove("ofer")}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                border: "1px solid rgba(124,58,237,0.5)",
                background: "rgba(124,58,237,0.15)",
                color: "#c4b5fd", fontSize: 12, fontWeight: 700, display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.3)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(124,58,237,0.15)")}
            >
              <CheckCircle2 style={{ width: 14, height: 14 }} />
              אשר — עופר 👨‍💻
            </button>
            <button onClick={() => handleApprove("or")}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                border: "1px solid rgba(14,165,233,0.5)",
                background: "rgba(14,165,233,0.15)",
                color: "#7dd3fc", fontSize: 12, fontWeight: 700, display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(14,165,233,0.3)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(14,165,233,0.15)")}
            >
              <CheckCircle2 style={{ width: 14, height: 14 }} />
              אשר — אור 🤝
            </button>
            <button onClick={onReject}
              style={{
                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.1)",
                color: "#fca5a5", fontSize: 12, fontWeight: 700, transition: "all 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
            >
              <XCircle style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {/* Download n8n JSON */}
        {proposal.n8nJson && (
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(proposal.n8nJson, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url;
              a.download = `${proposal.title.replace(/\s+/g, "_")}_n8n.json`;
              a.click(); URL.revokeObjectURL(url);
            }}
            style={{
              width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
              color: "#6b7280", fontSize: 11, display: "flex",
              alignItems: "center", justifyContent: "center", gap: 6, transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
          >
            <Download style={{ width: 12, height: 12 }} />
            הורד n8n JSON
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────
function StatsRow({ phase, turns, elapsed }: { phase: Phase; turns: number; elapsed: number }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "8px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      background: "rgba(255,255,255,0.01)",
    }}>
      {[
        { icon: <BarChart2 style={{ width: 11, height: 11 }} />, label: "תורים", value: turns },
        { icon: <Clock style={{ width: 11, height: 11 }} />, label: "זמן", value: `${elapsed}s` },
        { icon: <Zap style={{ width: 11, height: 11 }} />, label: "פאזה", value: { idle: "–", thinking: "ניתוח", talking: "שיח", proposing: "מציע", done: "הושלם" }[phase] },
      ].map(s => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: "#4b5563" }}>{s.icon}</span>
          <span style={{ color: "#6b7280", fontSize: 10 }}>{s.label}:</span>
          <span style={{ color: "#9ca3af", fontSize: 10, fontWeight: 700 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface AgentDuetProps {
  open: boolean;
  topic: string;
  onClose: () => void;
}

export default function AgentDuet({ open, topic, onClose }: AgentDuetProps) {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [phase, setPhase]         = useState<Phase>("idle");
  const [proposal, setProposal]   = useState<Proposal | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const msgIdRef  = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const nextId = () => ++msgIdRef.current;

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Elapsed timer
  useEffect(() => {
    if (!open || phase === "idle" || phase === "done") return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [open, phase]);

  // Run conversation
  const runConversation = useCallback(async () => {
    if (!topic.trim()) return;
    setMessages([]);
    setProposal(null);
    setDismissed(false);
    setElapsed(0);
    setPhase("thinking");
    msgIdRef.current = 0;

    const { turns, proposal: prop } = buildConversation(topic);
    const TURN_DELAY = 2400; // ms between turns
    const TYPING_DURATION = 1600;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const typingId = nextId();

      // Show typing indicator
      setPhase("talking");
      setMessages(prev => [...prev, { id: typingId, speaker: turn.speaker, text: "", isTyping: true }]);
      await new Promise(r => setTimeout(r, TYPING_DURATION));

      // Replace typing with real message
      setMessages(prev => prev.map(m => m.id === typingId ? { ...m, text: turn.text, isTyping: false } : m));

      if (i < turns.length - 1) {
        await new Promise(r => setTimeout(r, TURN_DELAY));
      }
    }

    // Show proposal
    setPhase("proposing");
    await new Promise(r => setTimeout(r, 1000));
    setProposal(prop);
    setPhase("done");
  }, [topic]);

  useEffect(() => {
    if (open && topic) {
      const t = setTimeout(runConversation, 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, topic, runConversation]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        style={{
          width: "min(680px, 96vw)",
          maxHeight: "min(760px, 92vh)",
          borderRadius: 22,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(160deg, #060612 0%, #0d0d1e 60%, #0f0a1e 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* JARVIS dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <motion.div
                animate={phase === "talking" ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                transition={{ duration: 0.7, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", boxShadow: "0 0 6px #0ea5e9" }}
              />
              <span style={{ color: "#38bdf8", fontSize: 11, fontWeight: 800 }}>J</span>
            </div>
            <span style={{ color: "#4b5563", fontSize: 13 }}>×</span>
            {/* GABAR dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 800 }}>G</span>
              <motion.div
                animate={phase === "talking" ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
                transition={{ duration: 0.7, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 6px #7c3aed" }}
              />
            </div>
            <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 6 }}>סשן עבודה משותף</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Topic pill */}
            <div style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: "rgba(255,255,255,0.06)", color: "#9ca3af",
              maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              direction: "rtl",
            }}>
              📌 {topic}
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "#6b7280",
              cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 4px",
            }}>✕</button>
          </div>
        </div>

        {/* Stats */}
        <StatsRow phase={phase} turns={messages.filter(m => !m.isTyping).length} elapsed={elapsed} />

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <MsgBubble key={msg.id} msg={msg} isNew={i === messages.length - 1} />
            ))}
          </AnimatePresence>

          {/* Proposal */}
          <AnimatePresence>
            {proposal && !dismissed && (
              <ProposalCard
                proposal={proposal}
                onApprove={by => setProposal(p => p ? { ...p, approvedBy: by } : p)}
                onReject={() => setDismissed(true)}
              />
            )}
          </AnimatePresence>

          {dismissed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", color: "#6b7280", fontSize: 12, padding: "12px 0" }}>
              ❌ ההצעה נדחתה. ג'ארוויס וגבר ינסו גישה אחרת...
            </motion.div>
          )}

          {phase === "thinking" && messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #1e293b", borderTopColor: "#0ea5e9", margin: "0 auto 12px" }} />
              <p style={{ color: "#4b5563", fontSize: 12 }}>JARVIS ו-GABAR מתחילים לנתח...</p>
            </div>
          )}
        </div>

        {/* Navigate to workflows shortcut */}
        {proposal?.approvedBy && (
          <div style={{
            padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex", gap: 8, flexShrink: 0,
          }}>
            <button onClick={() => { navigate("/workflows"); onClose(); }}
              style={{
                flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer",
                border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)",
                color: "#86efac", fontSize: 12, fontWeight: 700, display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              <Zap style={{ width: 13, height: 13 }} />
              פתח Workflow Canvas
            </button>
            <button onClick={onClose}
              style={{
                padding: "9px 14px", borderRadius: 10, cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                color: "#9ca3af", fontSize: 12,
              }}>
              סגור
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
