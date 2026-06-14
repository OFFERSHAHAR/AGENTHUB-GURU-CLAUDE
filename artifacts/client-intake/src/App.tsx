import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, CheckCircle, Download, ArrowLeft, BookOpen, ChevronDown, ChevronUp, Lightbulb, HelpCircle, X } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

interface IntakeData {
  firstName: string;
  companyName: string;
  industry: string;
  role: string;
  email: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Coach content per step ──────────────────────────────────────────────────
const COACH_CONTENT: Record<string, { title: string; emoji: string; main: string; tips: string[] }> = {
  welcome: {
    title: "מה זה בכלל AgentHub?",
    emoji: "🤔",
    main: "AgentHub בונה לך **עובד דיגיטלי** — סוכן AI — שעובד בשבילך **24 שעות ביממה, 7 ימים בשבוע**, בלי שכר, בלי חופשות, בלי טעויות.\n\nכמו אילו היה לך מנהל שיווק, נציג תמיכה, ומאמן מכירות — הכל אוטומטי, בזמן שאתה עסוק בדברים חשובים.",
    tips: [
      "🏃 תהליך האפיון לוקח כ-10 דקות",
      "💬 הסוכן ידבר איתך בשיחה טבעית — אין טפסים מסובכים",
      "✅ בסוף תקבל מסמך מוכן שצוות AgentHub יבנה לפיו את הסוכן שלך",
    ],
  },
  intake_default: {
    title: "למה צריך את הפרטים האלה?",
    emoji: "📋",
    main: "הפרטים האלו עוזרים לסוכן שלנו **להבין את ההקשר העסקי שלך** — כמו שרופא שואל 'כמה שנים?' לפני שהוא מאבחן.\n\nהסוכן שיבנה לך ידבר את **שפת התעשייה שלך** וידע מה חשוב לך.",
    tips: [],
  },
  intake_firstName: {
    title: "למה שם פרטי?",
    emoji: "👋",
    main: "הסוכן ידבר **אליך** — לא לאנונימי. כשהוא יוצר מסמכים, יתייחס אליך בשמך. יוצר חוויה אנושית ואישית.",
    tips: ["✨ \"שלום עופר\" שונה מ-\"שלום לקוח\" — הסוכן שלך ידע את זה"],
  },
  intake_companyName: {
    title: "למה שם החברה?",
    emoji: "🏢",
    main: "הסוכן שתקבל **יציג את עצמו כנציג החברה שלך** — לא כ-AI גנרי. כשלקוח שלך ידבר איתו, הוא ישמע 'אני נציג של [החברה שלך]'.",
    tips: ["📌 זה חשוב במיוחד אם הסוכן יענה ללקוחות שלך"],
  },
  intake_industry: {
    title: "למה תחום עסקי?",
    emoji: "🎯",
    main: "סוכן AI שמבין **נדל\"ן** ידבר אחרת מסוכן שמבין **פיננסים** או **אוכל**.\n\nהתחום קובע: את השפה, את השאלות שיישאל, ואת הצרות שיידע לפתור.",
    tips: [
      "🏠 נדל\"ן: ידע על מחירים, שכונות, משכנתאות",
      "💰 פיננסים: ידע על תשואות, סיכונים, רגולציה",
      "🛍️ קמעונאות: ידע על מלאי, מבצעים, שימור לקוחות",
    ],
  },
  intake_role: {
    title: "למה תפקיד?",
    emoji: "👔",
    main: "**מנכ\"ל** מקבל דוחות על נתונים גבוהים.\n**מנהל שיווק** מקבל פרטים על קמפיינים.\n**נציג מכירות** מקבל מידע על לידים.\n\nהסוכן מתאים את השפה והפרטים לתפקיד שלך.",
    tips: ["🎯 אין תשובה 'נכונה' — מה שמגדיר אותך הכי טוב"],
  },
  intake_email: {
    title: "למה אימייל?",
    emoji: "📧",
    main: "לכאן יישלחו:\n• **מסמך האפיון** שנבנה עכשיו\n• **עדכונים על הסוכן** שלך בבנייה\n• **הצעת המחיר** מהצוות\n\nלא נשלח ספאם. נשלח רק מה שרלוונטי לפרויקט שלך.",
    tips: ["🔒 המידע שלך מוגן ולא נמכר לצד שלישי"],
  },
  chat: {
    title: "מה קורה עכשיו בשיחה?",
    emoji: "💬",
    main: "הסוכן שואל אותך **שאלות ממוקדות** כדי להבין:\n• מה הכאב הגדול בעסק שלך\n• מה אתה רוצה לאוטומט\n• מה הלקוחות שלך צריכים\n\n**אין תשובות נכונות או שגויות.** פשוט דבר כמו שאתה מדבר.",
    tips: [
      "💡 ככל שתפרט יותר — הסוכן שתקבל יהיה מדויק יותר",
      "🗣️ אפשר לכתוב בעברית, אנגלית, מערבבים — מה שנוח",
      "⏱️ ממוצע השיחה: 5-8 הודעות",
    ],
  },
  completion: {
    title: "מה קיבלת עכשיו?",
    emoji: "🎉",
    main: "**מסמך האפיון** שנוצר הוא 'ספר ההוראות' שצוות AgentHub ישתמש בו לבנות את הסוכן שלך.\n\nהוא כולל:\n• תיאור הצרכים שלך\n• הגדרת הסוכן\n• תוכנית הפעולה",
    tips: [
      "📬 תוך 24-48 שעות תקבל מייל עם הצעה מהצוות",
      "📥 הורד את המסמך ושמור אותו — תזדקק לו",
      "🤝 יש שאלות? השב למייל שתקבל",
    ],
  },
};

// ── Coaching Panel ──────────────────────────────────────────────────────────
function CoachPanel({
  step,
  focusedField,
}: {
  step: string;
  focusedField?: string;
}) {
  const [open, setOpen] = useState(true);

  const key =
    step === "intake" && focusedField ? `intake_${focusedField}` : step === "intake" ? "intake_default" : step;
  const content = COACH_CONTENT[key] ?? COACH_CONTENT["welcome"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        position: "fixed",
        top: 80,
        right: 16,
        width: 280,
        zIndex: 100,
        fontFamily: "inherit",
      }}
      className="hidden xl:block"
    >
      <div
        style={{
          background: "linear-gradient(135deg,rgba(30,20,60,0.95),rgba(15,10,35,0.98))",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1)",
        }}
      >
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            background: "rgba(124,58,237,0.12)",
            border: "none",
            borderBottom: open ? "1px solid rgba(124,58,237,0.2)" : "none",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 22 }}>🧑‍🏫</span>
          <span
            style={{
              flex: 1,
              color: "#c4b5fd",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "right",
              direction: "rtl",
            }}
          >
            ספר הליווי שלי
          </span>
          {open ? (
            <ChevronUp style={{ width: 16, height: 16, color: "#7c3aed" }} />
          ) : (
            <ChevronDown style={{ width: 16, height: 16, color: "#7c3aed" }} />
          )}
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ padding: "16px" }}
            >
              {/* Title */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  direction: "rtl",
                }}
              >
                <span style={{ fontSize: 20 }}>{content.emoji}</span>
                <span
                  style={{
                    color: "#e2e8f0",
                    fontSize: 13,
                    fontWeight: 800,
                    direction: "rtl",
                  }}
                >
                  {content.title}
                </span>
              </div>

              {/* Main text */}
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: content.tips.length ? 12 : 0,
                  direction: "rtl",
                  textAlign: "right",
                }}
              >
                {content.main.split("\n").map((line, i) => {
                  // Bold support: **text**
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  return (
                    <p
                      key={i}
                      style={{
                        color: line === "" ? undefined : "#cbd5e1",
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        margin: "0 0 4px",
                      }}
                    >
                      {parts.map((p, j) =>
                        j % 2 === 1 ? (
                          <strong key={j} style={{ color: "#a78bfa", fontWeight: 700 }}>
                            {p}
                          </strong>
                        ) : (
                          p
                        )
                      )}
                    </p>
                  );
                })}
              </div>

              {/* Tips */}
              {content.tips.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {content.tips.map((tip, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(124,58,237,0.08)",
                        border: "1px solid rgba(124,58,237,0.15)",
                        borderRadius: 10,
                        padding: "8px 12px",
                        color: "#9ca3af",
                        fontSize: 11.5,
                        direction: "rtl",
                        textAlign: "right",
                        lineHeight: 1.5,
                      }}
                    >
                      {tip}
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  textAlign: "center",
                }}
              >
                <span
                  style={{ color: "#4b5563", fontSize: 10, letterSpacing: 0.3 }}
                >
                  🧑‍🏫 המאמן העסקי שלך
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Mobile coach banner (below content) ────────────────────────────────────
function MobileCoachBanner({
  step,
  focusedField,
}: {
  step: string;
  focusedField?: string;
}) {
  const [open, setOpen] = useState(false);

  const key =
    step === "intake" && focusedField ? `intake_${focusedField}` : step === "intake" ? "intake_default" : step;
  const content = COACH_CONTENT[key] ?? COACH_CONTENT["welcome"];

  return (
    <div className="xl:hidden" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              background: "linear-gradient(135deg,rgba(20,12,50,0.98),rgba(10,5,25,0.99))",
              borderTop: "1px solid rgba(124,58,237,0.4)",
              padding: "20px 20px 100px",
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 14,
                left: 16,
                background: "none",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
            <div style={{ direction: "rtl", textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{content.emoji}</span>
                <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 800 }}>
                  {content.title}
                </span>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 12,
                }}
              >
                {content.main.split("\n").map((line, i) => {
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  return (
                    <p key={i} style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, margin: "0 0 4px" }}>
                      {parts.map((p, j) =>
                        j % 2 === 1 ? (
                          <strong key={j} style={{ color: "#a78bfa", fontWeight: 700 }}>{p}</strong>
                        ) : p
                      )}
                    </p>
                  );
                })}
              </div>
              {content.tips.map((tip, i) => (
                <div key={i} style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.15)",
                  borderRadius: 10, padding: "8px 12px",
                  color: "#9ca3af", fontSize: 12, marginBottom: 6, lineHeight: 1.5,
                }}>
                  {tip}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle fab */}
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "absolute",
          bottom: open ? "auto" : 20,
          top: open ? 0 : "auto",
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#7c3aed,#4c1d95)",
          border: "2px solid rgba(196,181,253,0.3)",
          boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          zIndex: 201,
        }}
        title="ספר הליווי"
      >
        {open ? <X style={{ width: 20, height: 20, color: "#c4b5fd" }} /> : "🧑‍🏫"}
      </motion.button>
    </div>
  );
}

// ── Main app ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-[100dvh] w-full bg-background text-foreground font-sans overflow-hidden">
          <ClientIntakeFlow />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

function ClientIntakeFlow() {
  // Read URL params — ?name=...&company=...&industry=...&role=...&email=...
  // If any param is present, skip the welcome screen and go straight to the form.
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const prefill: IntakeData = {
    firstName:   params.get("name")     ?? "",
    companyName: params.get("company")  ?? "",
    industry:    params.get("industry") ?? "",
    role:        params.get("role")     ?? "",
    email:       params.get("email")    ?? "",
  };
  const hasPrefill = Object.values(prefill).some(Boolean);

  const [step, setStep] = useState<"welcome" | "intake" | "chat" | "completion">(
    hasPrefill ? "intake" : "welcome"
  );
  const [formData, setFormData] = useState<IntakeData>(prefill);
  const [specText, setSpecText] = useState("");
  const [focusedField, setFocusedField] = useState<string | undefined>();

  const handleStart = () => setStep("intake");
  const handleFormSubmit = (data: IntakeData) => { setFormData(data); setStep("chat"); };
  const handleSpecComplete = async (spec: string) => {
    setSpecText(spec);
    setStep("completion");
    // Save to AgentHub DB + trigger Telegram notification (best-effort)
    try {
      await fetch("/api/spec-agent/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          companyName: formData.companyName,
          industry: formData.industry,
          role: formData.role,
          email: formData.email,
          specText: spec,
        }),
      });
    } catch {
      // silent — user still gets the download
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.05),transparent_40%)]" />
      </div>

      {/* Coach Panel — desktop */}
      <CoachPanel step={step} focusedField={focusedField} />

      {/* Coach Panel — mobile */}
      <MobileCoachBanner step={step} focusedField={focusedField} />

      <div className="relative z-10 flex-1 w-full flex flex-col h-full">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <WelcomeScreen key="welcome" onStart={handleStart} />
          )}
          {step === "intake" && (
            <IntakeFormScreen
              key="intake"
              initialData={formData}
              onSubmit={handleFormSubmit}
              onFocus={setFocusedField}
            />
          )}
          {step === "chat" && (
            <ChatScreen key="chat" formData={formData} onComplete={handleSpecComplete} />
          )}
          {step === "completion" && (
            <CompletionScreen key="completion" specText={specText} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Screen 1: Welcome ────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full"
    >
      <div className="mb-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-primary/20 shadow-[0_0_40px_rgba(124,58,237,0.2)]"
        >
          <Bot className="w-10 h-10 text-primary" />
        </motion.div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
          העסק שלך,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">חכם יותר.</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
          ברוכים הבאים ל-AgentHub. בואו נאפיין יחד את סוכן ה-AI שייקח את העסק שלכם לשלב הבא. תהליך האפיון מנוהל בשיחה טבעית ופשוטה.
        </p>
      </div>

      {/* Inline coach tip for welcome — visible always on mobile */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="xl:hidden w-full max-w-md mb-8 text-right"
        style={{
          background: "linear-gradient(135deg,rgba(124,58,237,0.12),rgba(76,29,149,0.08))",
          border: "1px solid rgba(124,58,237,0.25)",
          borderRadius: 16, padding: "16px 18px",
          direction: "rtl",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>🧑‍🏫</span>
          <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 700 }}>ספר הליווי שלי</span>
        </div>
        <p style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          AgentHub בונה לך <strong style={{ color: "#a78bfa" }}>עובד דיגיטלי</strong> שעובד 24/7 בלי שכר ובלי חופשות.
          התהליך לוקח ~10 דקות. בסוף — יש לך תוכנית מוכנה. 🚀
        </p>
      </motion.div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-primary rounded-full overflow-hidden transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background shadow-[0_0_30px_rgba(124,58,237,0.3)]"
      >
        <span className="relative flex items-center gap-2">
          התחל תהליך אפיון
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
        </span>
      </motion.button>
    </motion.div>
  );
}

// ── Screen 2: Intake Form ────────────────────────────────────────────────────
function IntakeFormScreen({
  initialData, onSubmit, onFocus,
}: {
  initialData: IntakeData;
  onSubmit: (data: IntakeData) => void;
  onFocus?: (field: string | undefined) => void;
}) {
  const [data, setData] = useState<IntakeData>(initialData);
  const [localFocus, setLocalFocus] = useState<string | undefined>();

  const handleFocus = (field: string) => { setLocalFocus(field); onFocus?.(field); };
  const handleBlur = () => { setLocalFocus(undefined); onFocus?.(undefined); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.firstName && data.companyName && data.email) onSubmit(data);
  };

  // Inline coach hint for mobile (updates per field)
  const mobileKey = localFocus ? `intake_${localFocus}` : "intake_default";
  const mobileCoach = COACH_CONTENT[mobileKey] ?? COACH_CONTENT["intake_default"];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto"
    >
      <div className="w-full bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

        <h2 className="text-3xl font-bold text-white mb-2 relative z-10">קצת עליך</h2>
        <p className="text-muted-foreground mb-8 relative z-10">
          הפרטים האלו יעזרו לסוכן שלנו להבין את ההקשר העסקי שלך.
        </p>

        {/* Mobile inline coach hint */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mobileKey}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="xl:hidden mb-6 relative z-10"
            style={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 12, padding: "10px 14px",
              direction: "rtl", textAlign: "right",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>{mobileCoach.emoji}</span>
              <span style={{ color: "#c4b5fd", fontSize: 11.5, fontWeight: 700 }}>{mobileCoach.title}</span>
            </div>
            <p style={{ color: "#9ca3af", fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
              {mobileCoach.main.replace(/\*\*/g, "").split("\n")[0]}
            </p>
          </motion.div>
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FieldWrapper label="שם פרטי" hint="הסוכן יפנה אליך בשמך">
              <input
                required type="text" value={data.firstName}
                onChange={e => setData({ ...data, firstName: e.target.value })}
                onFocus={() => handleFocus("firstName")} onBlur={handleBlur}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="ישראל"
              />
            </FieldWrapper>
            <FieldWrapper label="אימייל" hint="לשם ישלחו כל הסיכומים">
              <input
                required type="email" value={data.email}
                onChange={e => setData({ ...data, email: e.target.value })}
                onFocus={() => handleFocus("email")} onBlur={handleBlur}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-left"
                dir="ltr" placeholder="israel@company.co.il"
              />
            </FieldWrapper>
          </div>

          <FieldWrapper label="שם החברה" hint="הסוכן ייצג את החברה הזו">
            <input
              required type="text" value={data.companyName}
              onChange={e => setData({ ...data, companyName: e.target.value })}
              onFocus={() => handleFocus("companyName")} onBlur={handleBlur}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="חברת הייטק בע״מ"
            />
          </FieldWrapper>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FieldWrapper label="תחום עסקי" hint="קובע את 'שפת' הסוכן">
              <input
                type="text" value={data.industry}
                onChange={e => setData({ ...data, industry: e.target.value })}
                onFocus={() => handleFocus("industry")} onBlur={handleBlur}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="פיננסים, שיווק, נדל״ן..."
              />
            </FieldWrapper>
            <FieldWrapper label="תפקיד" hint="מתאים את הסוכן לרמתך">
              <input
                type="text" value={data.role}
                onChange={e => setData({ ...data, role: e.target.value })}
                onFocus={() => handleFocus("role")} onBlur={handleBlur}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="מנכ״ל, מנהל שיווק..."
              />
            </FieldWrapper>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-4 text-base font-medium text-white bg-primary rounded-xl transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!data.firstName || !data.companyName || !data.email}
            >
              המשך לאפיון
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

// Helper: field with hint
function FieldWrapper({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground/60 hidden sm:block">{hint}</span>
        <label className="text-sm font-medium text-gray-300">{label}</label>
      </div>
      {children}
    </div>
  );
}

// ── Screen 3: Chat ───────────────────────────────────────────────────────────
function ChatScreen({ formData, onComplete }: { formData: IntakeData; onComplete: (spec: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const startChat = async () => {
      setIsLoading(true);
      const initialContextMsg: ChatMessage = {
        role: "user",
        content: `לקוח חדש מתחיל תהליך אפיון. פרטים: שם: ${formData.firstName}, חברה: ${formData.companyName}, תחום: ${formData.industry}, תפקיד: ${formData.role}`,
      };
      const newMessages = [initialContextMsg];
      setMessages(newMessages);

      try {
        const res = await fetch("/api/spec-agent/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      } catch {
        setMessages([...newMessages, { role: "assistant", content: "שלום! אני סוכן האפיון של AgentHub. נראה שיש כרגע תקלה זמנית. אנא נסה שוב מאוחר יותר." }]);
      } finally {
        setIsLoading(false);
      }
    };
    startChat();
  }, [formData]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/spec-agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const reply = data.reply;

      // Detect spec completion — LLMs sometimes emit only END (without START)
      const hasStart = reply.includes("<<<SPEC_OUTPUT_START>>>");
      const hasEnd   = reply.includes("<<<SPEC_OUTPUT_END>>>");
      if (hasStart || hasEnd) {
        // Human-readable part: everything before the marker / JSON block
        const humanText = stripSpecBlock(reply);
        setMessages([...newMessages, { role: "assistant", content: humanText }]);
        setTimeout(() => onComplete(reply), 1500); // full reply; CompletionScreen strips it
      } else {
        setMessages([...newMessages, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "אירעה שגיאה. אנא נסה שוב." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleMessages = messages.filter((m, i) => !(i === 0 && m.role === "user"));
  const userMsgCount = messages.filter(m => m.role === "user").length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col h-[100dvh] max-w-4xl mx-auto w-full bg-background border-x border-border shadow-2xl"
    >
      {/* Header */}
      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white">סוכן אפיון - AgentHub</h2>
          <p className="text-xs text-primary">מחובר ומאזין</p>
        </div>
        {/* Progress hint */}
        {userMsgCount > 0 && (
          <div style={{
            background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)",
            borderRadius: 20, padding: "4px 12px", fontSize: 11, color: "#a78bfa",
          }}>
            הודעה {userMsgCount} מתוך ~6
          </div>
        )}
      </header>

      {/* Coach inline tip above chat */}
      {userMsgCount === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            margin: "12px 16px 0",
            background: "rgba(124,58,237,0.07)",
            border: "1px solid rgba(124,58,237,0.18)",
            borderRadius: 14, padding: "12px 16px",
            direction: "rtl", textAlign: "right",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🧑‍🏫</span>
            <span style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>מה קורה עכשיו?</span>
          </div>
          <p style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            הסוכן שואל אותך שאלות כדי להבין את הצרכים שלך.{" "}
            <strong style={{ color: "#a78bfa" }}>אין תשובות נכונות — דבר חופשי.</strong>{" "}
            ככל שתפרט יותר, הסוכן שתקבל יהיה מדויק יותר.
          </p>
        </motion.div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-tr-sm"
                  : "bg-card border border-border text-gray-200 rounded-tl-sm shadow-md"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4 shadow-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t border-border">
        <form
          onSubmit={handleSend}
          className="relative flex items-end gap-2 bg-card border border-border rounded-3xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="הקלד כאן..."
            className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none text-white px-4 py-3 placeholder:text-muted-foreground"
            rows={1} dir="auto"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-12 h-12 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-0.5 ml-0.5"
          >
            <Send className="w-5 h-5 rtl:scale-x-[-1]" />
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-3">
          הסוכן עשוי לייצר תוכן שגוי. אנו ממליצים לאמת את המידע.
        </p>
      </div>
    </motion.div>
  );
}

// ── Screen 4: Completion ─────────────────────────────────────────────────────
/** Strip internal JSON/marker block so clients only see human-readable text */
function stripSpecBlock(text: string): string {
  if (!text) return text;
  const si = text.indexOf("<<<SPEC_OUTPUT_START>>>");
  if (si !== -1) return text.slice(0, si).trim();
  const ei = text.indexOf("<<<SPEC_OUTPUT_END>>>");
  if (ei !== -1) {
    const before = text.slice(0, ei);
    const lj = before.lastIndexOf("\n{");
    return (lj !== -1 ? before.slice(0, lj) : before).trim();
  }
  return text.trim();
}

function CompletionScreen({ specText }: { specText: string }) {
  const cleanSpec = stripSpecBlock(specText);
  const handleDownload = () => {
    const blob = new Blob([cleanSpec], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "AgentHub_Spec.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto w-full"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.2)]"
      >
        <CheckCircle className="w-12 h-12 text-green-500" />
      </motion.div>

      <h2 className="text-4xl font-bold text-white mb-4">האפיון הושלם בהצלחה!</h2>
      <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
        הצוות שלנו קיבל את האפיון ויתחיל לעבוד על הסוכן שלך בהקדם.<br />
        אנחנו ניצור איתך קשר בקרוב עם הצעדים הבאים.
      </p>

      {/* Coach tip on completion */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          width: "100%",
          background: "rgba(124,58,237,0.08)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 16, padding: "16px 20px",
          marginBottom: 24, direction: "rtl", textAlign: "right",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>🧑‍🏫</span>
          <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 800 }}>מה קיבלת עכשיו?</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { emoji: "📄", title: "מסמך אפיון", desc: "ספר הוראות לבניית הסוכן שלך" },
            { emoji: "📬", title: "24-48 שעות", desc: "תקבל מייל עם הצעה מהצוות" },
            { emoji: "🤖", title: "סוכן AI", desc: "שיעבוד בשבילך אוטומטית" },
          ].map(item => (
            <div key={item.title} style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 12,
              padding: "10px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{item.emoji}</div>
              <div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{item.title}</div>
              <div style={{ color: "#6b7280", fontSize: 10, lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="w-full bg-card border border-border rounded-2xl p-6 mb-8 text-right max-h-64 overflow-y-auto">
        <h3 className="text-sm font-semibold text-primary mb-3">תקציר האפיון (תצוגה מקדימה)</h3>
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed opacity-80">
          {cleanSpec.slice(0, 500)}{cleanSpec.length > 500 ? "..." : ""}
        </p>
      </div>

      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-8 py-4 text-base font-medium text-white bg-card border border-border rounded-full transition-all hover:bg-card/80 hover:border-primary focus:outline-none"
      >
        <Download className="w-5 h-5" />
        הורד את מסמך האפיון המלא
      </button>
    </motion.div>
  );
}
