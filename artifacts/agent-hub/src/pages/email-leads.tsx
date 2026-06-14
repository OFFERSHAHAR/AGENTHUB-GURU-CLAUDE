import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Flame, Thermometer, Snowflake, BarChart3, RefreshCw, Trash2, ChevronDown, ChevronUp, Upload, CheckCircle2, XCircle } from "lucide-react";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

interface EmailLead {
  id: number;
  sourceFile: string;
  fromAddress: string | null;
  fromName: string | null;
  subject: string | null;
  category: string;
  categorySlug: string;
  leadScore: "HOT" | "WARM" | "COLD";
  confidence: number;
  summaryHe: string | null;
  recommendedPackage: string | null;
  keySignals: string[];
  nextAction: string | null;
  telegramSent: number;
  processedAt: string;
}

interface Stats {
  total: number;
  byCategory: { category: string; categorySlug: string; cnt: number }[];
  byScore: { leadScore: string; cnt: number }[];
}

function ScoreBadge({ score }: { score: string }) {
  if (score === "HOT") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
      <Flame className="w-3 h-3" /> חם
    </span>
  );
  if (score === "WARM") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.2)" }}>
      <Thermometer className="w-3 h-3" /> פושר
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}>
      <Snowflake className="w-3 h-3" /> קר
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 55 ? "#f59e0b" : "#94a3b8";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

function LeadRow({ lead, onDelete }: { lead: EmailLead; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border overflow-hidden transition-all"
      style={{ background: "white", borderColor: "rgba(0,0,0,0.07)" }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Score */}
        <div className="shrink-0"><ScoreBadge score={lead.leadScore} /></div>

        {/* From */}
        <div className="min-w-0 w-40 shrink-0">
          <p className="text-[13px] font-semibold text-foreground truncate">{lead.fromName || lead.fromAddress || "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{lead.fromAddress || ""}</p>
        </div>

        {/* Subject */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">{lead.subject || "—"}</p>
        </div>

        {/* Category */}
        <div className="shrink-0 w-44 hidden md:block">
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold"
            style={{ background: "rgba(99,102,241,0.07)", color: "#4f46e5" }}>
            {lead.category}
          </span>
        </div>

        {/* Confidence */}
        <div className="shrink-0 hidden lg:block"><ConfidenceBar value={lead.confidence} /></div>

        {/* Telegram */}
        <div className="shrink-0">
          {lead.telegramSent ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" title="נשלח ל-Telegram" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-300" title="לא נשלח" />
          )}
        </div>

        {/* Date */}
        <div className="shrink-0 text-[11px] text-muted-foreground w-20 text-right hidden xl:block">
          {new Date(lead.processedAt).toLocaleDateString("he-IL")}
        </div>

        {/* Expand */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1 border-t" style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(248,250,252,0.8)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">תמצית</p>
                  <p className="text-[13px] text-foreground leading-relaxed">{lead.summaryHe || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">הצעד הבא</p>
                  <p className="text-[13px] text-foreground">{lead.nextAction || "—"}</p>

                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 mt-3">חבילה מומלצת</p>
                  <p className="text-[13px] font-semibold" style={{ color: "#7c3aed" }}>{lead.recommendedPackage || "—"}</p>

                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 mt-3">אותות מפתח</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(lead.keySignals || []).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-lg text-[11px] font-medium"
                        style={{ background: "rgba(99,102,241,0.08)", color: "#4f46e5" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 justify-end">
                <span className="text-[11px] text-muted-foreground">קובץ: {lead.sourceFile}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors hover:bg-red-50 hover:text-red-600 text-muted-foreground"
                >
                  <Trash2 className="w-3 h-3" /> מחק
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EmailLeadsPage() {
  const [leads, setLeads] = useState<EmailLead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterScore, setFilterScore] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [testResult, setTestResult] = useState<string>("");
  const [testLoading, setTestLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterScore) params.set("score", filterScore);
      if (filterCategory) params.set("category", filterCategory);
      const [leadsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/email-classifier/results?${params}`, { credentials: "include" }),
        fetch(`${API_BASE}/email-classifier/stats`, { credentials: "include" }),
      ]);
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`${API_BASE}/email-classifier/results/${id}`, { method: "DELETE", credentials: "include" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  async function runTestClassify() {
    setTestLoading(true);
    setTestResult("");
    try {
      const res = await fetch(`${API_BASE}/email-classifier/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceFile: "test_lead.eml",
          fromAddress: "david@company.co.il",
          fromName: "דוד כהן",
          subject: "רוצה לשלב AI בעסק שלי",
          bodyText: "שלום, אני מנהל עסק עם 20 עובדים ורוצה לאוטמט תהליכי CRM ומכירות. כבר שמעתי על Make ו-n8n. מעניין אותי גם בניית סוכן AI שיסנן לידים. מה עושים?",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult("✅ " + data.lead.category + " · " + data.lead.leadScore);
        loadData();
      } else {
        setTestResult("❌ " + JSON.stringify(data.error));
      }
    } catch (e: unknown) {
      setTestResult("❌ שגיאת רשת");
    } finally {
      setTestLoading(false);
    }
  }

  const hotCount = stats?.byScore.find((s) => s.leadScore === "HOT")?.cnt ?? 0;
  const warmCount = stats?.byScore.find((s) => s.leadScore === "WARM")?.cnt ?? 0;
  const coldCount = stats?.byScore.find((s) => s.leadScore === "COLD")?.cnt ?? 0;

  return (
    <div className="space-y-6 page-enter" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Email Lead Classifier</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            סוכן AI שמסווג מיילים לפי סוג ליד — שולח JSON לתיקיה + התראת Telegram
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-[13px] text-white transition-all"
          style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loaded ? "רענן" : "טען לידים"}
        </button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "סה״כ לידים", value: stats.total, color: "#7c3aed", icon: Mail },
            { label: "🔥 חמים", value: hotCount, color: "#ef4444", icon: Flame },
            { label: "🟡 פושרים", value: warmCount, color: "#d97706", icon: Thermometer },
            { label: "🧊 קרים", value: coldCount, color: "#6366f1", icon: Snowflake },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 card-shadow"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className="text-[28px] font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {stats && stats.byCategory.length > 0 && (
        <div className="rounded-xl p-4 card-shadow" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-[13px] font-semibold text-foreground">פילוח לפי קטגוריה</p>
          </div>
          <div className="space-y-2">
            {stats.byCategory.map((c) => {
              const pct = stats.total > 0 ? Math.round((Number(c.cnt) / stats.total) * 100) : 0;
              return (
                <div key={c.categorySlug} className="flex items-center gap-3">
                  <span className="text-[12px] text-foreground w-44 truncate shrink-0">{c.category}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed,#60a5fa)" }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground w-8 text-left">{c.cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterScore}
          onChange={(e) => setFilterScore(e.target.value)}
          className="px-3 py-2 rounded-xl border text-[13px] font-medium text-foreground outline-none focus:ring-2"
          style={{ borderColor: "rgba(0,0,0,0.1)", background: "white" }}
        >
          <option value="">כל הציונים</option>
          <option value="HOT">🔥 חמים</option>
          <option value="WARM">🟡 פושרים</option>
          <option value="COLD">🧊 קרים</option>
        </select>

        {stats && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border text-[13px] font-medium text-foreground outline-none focus:ring-2"
            style={{ borderColor: "rgba(0,0,0,0.1)", background: "white" }}
          >
            <option value="">כל הקטגוריות</option>
            {stats.byCategory.map((c) => (
              <option key={c.categorySlug} value={c.categorySlug}>{c.category}</option>
            ))}
          </select>
        )}

        {(filterScore || filterCategory) && (
          <button
            onClick={() => { setFilterScore(""); setFilterCategory(""); }}
            className="px-3 py-2 rounded-xl border text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            style={{ borderColor: "rgba(0,0,0,0.1)", background: "white" }}
          >
            נקה סינון
          </button>
        )}
      </div>

      {/* Leads list */}
      {loaded && (
        <div className="space-y-2">
          {leads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">אין לידים עדיין</p>
              <p className="text-[12px] mt-1">הרץ את הסקריפט המקומי כדי לסווג מיילים</p>
            </div>
          ) : (
            leads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} onDelete={handleDelete} />
            ))
          )}
        </div>
      )}

      {/* Test + Setup section */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "white", border: "1px solid rgba(99,102,241,0.15)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Upload className="w-4 h-4 text-primary" />
          <p className="text-[14px] font-bold text-foreground">בדיקה מהירה + הוראות הגדרה</p>
        </div>

        {/* Test button */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={runTestClassify}
            disabled={testLoading}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", opacity: testLoading ? 0.7 : 1 }}
          >
            {testLoading ? "מסווג..." : "🧪 הרץ מייל לדוגמה"}
          </button>
          {testResult && (
            <span className="text-[13px] font-semibold" style={{ color: testResult.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
              {testResult}
            </span>
          )}
        </div>

        {/* Setup instructions */}
        <div className="rounded-xl p-4 space-y-3 text-[12.5px]" style={{ background: "rgba(248,250,252,1)", border: "1px solid rgba(0,0,0,0.06)" }} dir="rtl">
          <p className="font-bold text-foreground text-[13px]">📥 הגדרת הסקריפט המקומי (Python)</p>

          <div>
            <p className="font-semibold text-muted-foreground mb-1">1. הורד את הסקריפט — פתח בדפדפן:</p>
            <a
              href={`${window.location.origin}/api/email-classifier/agent-script`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}
            >
              ⬇️ הורד email_agent.py
            </a>
            <p className="mt-1.5 text-[11px] text-muted-foreground">שמור את הקובץ לתיקיה נוחה, למשל <code className="font-mono">C:\email-agent\</code></p>
          </div>

          <div>
            <p className="font-semibold text-muted-foreground mb-1">2. התקן dependencies (CMD / PowerShell):</p>
            <code className="block bg-slate-900 text-emerald-400 rounded-lg px-3 py-2 text-[11px] font-mono" dir="ltr">
              pip install watchdog requests pdfplumber
            </code>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">pdfplumber</span> — לקריאת קבצי PDF (אופציונלי אך מומלץ)
            </p>
          </div>

          <div>
            <p className="font-semibold text-muted-foreground mb-1">3. הרץ (Windows CMD — הכל בשורה אחת):</p>
            <code className="block bg-slate-900 text-emerald-400 rounded-lg px-3 py-2 text-[11px] font-mono leading-relaxed" dir="ltr">
              {`python email_agent.py --inbox C:\\email-inbox --output C:\\classified-leads --server ${window.location.origin}`}
            </code>
          </div>

          <div className="pt-1">
            <p className="font-semibold text-muted-foreground">📂 תיקיות (Windows):</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>• <span className="font-mono text-foreground">C:\email-inbox\</span> — גרור לכאן קבצי .eml / .txt</li>
              <li>• <span className="font-mono text-foreground">C:\classified-leads\</span> — JSON מסווג מופיע כאן</li>
              <li>• <span className="font-mono text-foreground">C:\email-inbox\processed\</span> — מיילים שעובדו</li>
            </ul>
            <p className="mt-2 text-[11px]" style={{ color: "#7c3aed" }}>
              💡 אפשר לשנות את הנתיבים לכל תיקיה שתרצה — הסקריפט יצור אותן אוטומטית
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
