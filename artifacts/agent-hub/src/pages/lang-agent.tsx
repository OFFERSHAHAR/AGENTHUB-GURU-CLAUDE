import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Languages,
  Loader2,
  Copy,
  Download,
  Sparkles,
  FileText,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "Hebrew", label: "עברית", flag: "🇮🇱" },
  { code: "English", label: "English", flag: "🇬🇧" },
  { code: "Arabic", label: "العربية", flag: "🇸🇦" },
  { code: "Spanish", label: "Español", flag: "🇪🇸" },
  { code: "French", label: "Français", flag: "🇫🇷" },
  { code: "German", label: "Deutsch", flag: "🇩🇪" },
  { code: "Russian", label: "Русский", flag: "🇷🇺" },
  { code: "Chinese (Simplified)", label: "中文（简体）", flag: "🇨🇳" },
  { code: "Portuguese", label: "Português", flag: "🇧🇷" },
  { code: "Japanese", label: "日本語", flag: "🇯🇵" },
  { code: "Italian", label: "Italiano", flag: "🇮🇹" },
  { code: "Dutch", label: "Nederlands", flag: "🇳🇱" },
  { code: "Turkish", label: "Türkçe", flag: "🇹🇷" },
];

const DOMAIN_META: Record<
  string,
  { icon: string; label: string; color: string; bg: string; border: string; description: string }
> = {
  economic: {
    icon: "📈",
    label: "כלכלי / פיננסי",
    color: "#065f46",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    description: "שפה פיננסית מקצועית עם מינוח כלכלי מדויק",
  },
  legal: {
    icon: "⚖️",
    label: "משפטי",
    color: "#1e3a5f",
    bg: "#eff6ff",
    border: "#bfdbfe",
    description: "ניסוח משפטי מדויק ובלתי-משתמע",
  },
  technical: {
    icon: "⚙️",
    label: "טכני / הנדסי",
    color: "#5b21b6",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    description: "מינוח הנדסי מקצועי עם שמירה על קוד וסינטקס",
  },
  medical: {
    icon: "🏥",
    label: "רפואי / בריאות",
    color: "#9d174d",
    bg: "#fdf2f8",
    border: "#fbcfe8",
    description: "טרמינולוגיה קלינית ורפואית מדויקת",
  },
  marketing: {
    icon: "📣",
    label: "שיווקי",
    color: "#92400e",
    bg: "#fffbeb",
    border: "#fde68a",
    description: "שפה שיווקית משכנעת ממוקדת ערך",
  },
  hr: {
    icon: "👥",
    label: "משאבי אנוש",
    color: "#7c2d12",
    bg: "#fff7ed",
    border: "#fed7aa",
    description: "שפה ארגונית מכילה וממוקדת פעולה",
  },
  operations: {
    icon: "🔄",
    label: "תפעולי / לוגיסטי",
    color: "#164e63",
    bg: "#ecfeff",
    border: "#a5f3fc",
    description: "בהירות תהליכית ומדידות KPI תפעוליות",
  },
  academic: {
    icon: "🎓",
    label: "אקדמי / מחקרי",
    color: "#312e81",
    bg: "#eef2ff",
    border: "#c7d2fe",
    description: "רגיסטר אקדמי פורמלי מבוסס ראיות",
  },
  general: {
    icon: "📄",
    label: "כללי",
    color: "#374151",
    bg: "#f9fafb",
    border: "#e5e7eb",
    description: "שפה כללית ומקצועית",
  },
};

const EXAMPLE_DOCS = [
  {
    label: "חוזה שכירות",
    icon: "⚖️",
    text: `LEASE AGREEMENT

This Lease Agreement ("Agreement") is entered into as of January 1, 2025, by and between ABC Properties LLC ("Landlord") and John Doe ("Tenant").

1. PREMISES: Landlord hereby leases to Tenant the property located at 123 Main Street, Tel Aviv, Israel (the "Premises").

2. TERM: The lease term shall commence on February 1, 2025 and shall terminate on January 31, 2026, unless sooner terminated pursuant to any provision hereof.

3. RENT: Tenant shall pay to Landlord the sum of $2,500 per month as rent for the Premises. Rent shall be due and payable in advance on the first day of each calendar month.

4. INDEMNIFICATION: Tenant shall indemnify, defend and hold harmless Landlord from any claims arising from Tenant's use of the Premises.`,
  },
  {
    label: "דוח פיננסי",
    icon: "📈",
    text: `Q3 2025 Financial Summary

Revenue for the third quarter reached $4.2M, representing a 23% year-over-year increase. Gross margin improved to 68%, driven by operational efficiencies and favorable pricing. EBITDA stood at $1.1M, an improvement of 340 basis points compared to the prior year period.

Operating expenses increased 8% to $2.8M, primarily due to headcount expansion in sales and R&D. Net income was $480K, with earnings per share of $0.42.

Cash flow from operations remained strong at $1.3M. The company maintains $6.2M in cash and equivalents with no outstanding debt obligations. Current ratio stands at 2.8, reflecting healthy short-term liquidity.`,
  },
  {
    label: "מפרט טכני",
    icon: "⚙️",
    text: `API Rate Limiting Specification

The authentication service implements token bucket rate limiting with the following parameters:
- Burst capacity: 100 requests
- Refill rate: 10 requests/second
- Window size: 60 seconds

When the rate limit is exceeded, the server returns HTTP 429 Too Many Requests with the Retry-After header indicating the wait time in seconds.

Implementation uses Redis for distributed state management. The token bucket state is stored per API key using atomic INCRBY and EXPIRE operations to ensure consistency across multiple service instances.

Monitoring: Prometheus metrics expose rate_limit_hits_total and rate_limit_remaining counters per endpoint.`,
  },
];

// ─── API Call ─────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface TranslateResult {
  translatedContent: string;
  detectedDomain: string;
  targetLanguage: string;
  domainLabel: string;
}

async function callLangAgent(
  content: string,
  targetLanguage: string,
  documentType?: string
): Promise<TranslateResult> {
  const res = await fetch(`${BASE_URL}/api/lang-agent/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, targetLanguage, documentType }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<TranslateResult>;
}

// ─── Domain Badge ─────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: string }) {
  const meta = DOMAIN_META[domain] ?? DOMAIN_META.general;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full border"
      style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LangAgentPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Hebrew");
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = input.trim().length;
  const canTranslate = charCount > 0 && !isLoading;

  const handleTranslate = async () => {
    if (!canTranslate) return;
    setIsLoading(true);
    setResult(null);
    try {
      const r = await callLangAgent(input, targetLanguage);
      setResult(r);
    } catch {
      toast({ title: "שגיאה בתרגום", description: "נסה שנית", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInput((ev.target?.result as string) ?? "");
      setResult(null);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const copyOutput = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.translatedContent).then(() => {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    });
  };

  const downloadOutput = () => {
    if (!result) return;
    const blob = new Blob([result.translatedContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const langSlug = result.targetLanguage.toLowerCase().replace(/\s+/g, "-");
    a.download = `translated-${langSlug}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadExample = (text: string) => {
    setInput(text);
    setResult(null);
  };

  const selectedLang = LANGUAGES.find((l) => l.code === targetLanguage);
  const domainMeta = result ? (DOMAIN_META[result.detectedDomain] ?? DOMAIN_META.general) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">סוכן השפות</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            תרגום ועיבוד מסמכים ברמה מקצועית מותאמת-תחום — כלכלי, משפטי, טכני ועוד
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[12px] text-muted-foreground font-medium">שפת יעד:</span>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="w-[180px] h-9 text-[13px]">
              <SelectValue>
                {selectedLang && (
                  <span className="flex items-center gap-2">
                    <span>{selectedLang.flag}</span>
                    <span>{selectedLang.label}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Example chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest shrink-0">
          דוגמאות:
        </span>
        {EXAMPLE_DOCS.map((ex) => (
          <button
            key={ex.label}
            onClick={() => loadExample(ex.text)}
            className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary bg-primary/6 hover:bg-primary/10 border border-primary/15 px-2.5 py-1 rounded-lg transition-colors"
          >
            <span>{ex.icon}</span>
            {ex.label}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-5">
        {/* ── Input panel ── */}
        <div className="flex flex-col bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                מסמך מקור
              </span>
            </div>
            <div className="flex items-center gap-2">
              {charCount > 0 && (
                <span className="text-[10.5px] text-muted-foreground">
                  {charCount.toLocaleString()} תווים
                </span>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                טען קובץ
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.csv,.log"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
          <Textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
            }}
            placeholder={`הדבק כאן טקסט, מסמך, JSON, קוד עם תיעוד, דוח, חוזה…\n\nהסוכן יזהה אוטומטית את תחום המסמך ויתאים את השפה לרמה המקצועית הנכונה.`}
            className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 text-[13px] leading-relaxed p-4 font-mono min-h-[420px]"
            dir="auto"
          />
          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <Button
              onClick={handleTranslate}
              disabled={!canTranslate}
              className="w-full h-9 rounded-lg font-semibold text-[13px] gap-2"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    מתרגם ומעבד…
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    תרגם עם הסוכן
                    <ChevronRight className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>

        {/* ── Output panel ── */}
        <div className="flex flex-col bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                תוצאה מותאמת-תחום
              </span>
            </div>
            {result && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setInput(result.translatedContent);
                    setResult(null);
                  }}
                  title="השתמש בפלט כקלט לתרגום נוסף"
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  תרגם שוב
                </button>
                <button
                  onClick={copyOutput}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                >
                  {copiedOutput ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedOutput ? "הועתק!" : "העתק"}
                </button>
                <button
                  onClick={downloadOutput}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 bg-primary/8 hover:bg-primary/12 px-2 py-1 rounded-lg transition-colors border border-primary/15"
                >
                  <Download className="w-3.5 h-3.5" />
                  הורדה
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[420px] relative">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                      <Languages className="w-6 h-6 text-violet-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border-2 border-violet-100 flex items-center justify-center">
                      <Loader2 className="w-3 h-3 text-violet-500 animate-spin" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-foreground">הסוכן מנתח ומתרגם…</p>
                    <p className="text-[11.5px] text-muted-foreground mt-1">
                      זיהוי תחום · התאמת מינוח · תרגום מקצועי
                    </p>
                  </div>
                  <div className="flex gap-3 mt-2">
                    {["זיהוי תחום", "התאמת מינוח", "תרגום"].map((step, i) => (
                      <div key={step} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                        <Loader2
                          className="w-3 h-3 animate-spin text-violet-400"
                          style={{ animationDelay: `${i * 200}ms` }}
                        />
                        {step}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col"
                >
                  {domainMeta && (
                    <div
                      className="px-4 py-2.5 border-b flex items-center gap-3"
                      style={{ background: domainMeta.bg, borderColor: domainMeta.border }}
                    >
                      <DomainBadge domain={result.detectedDomain} />
                      <span className="text-[11.5px]" style={{ color: domainMeta.color }}>
                        {domainMeta.description}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 overflow-auto p-4">
                    <pre
                      className="text-[12.5px] font-mono leading-relaxed whitespace-pre-wrap text-foreground"
                      dir="auto"
                    >
                      {result.translatedContent}
                    </pre>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <Languages className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-muted-foreground">
                      תוצאת התרגום תופיע כאן
                    </p>
                    <p className="text-[11.5px] text-muted-foreground/70 mt-1 leading-relaxed">
                      הסוכן יזהה את תחום המסמך
                      <br />
                      ויתאים את השפה לרמה המקצועית הנכונה
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 w-full max-w-sm">
                    {Object.entries(DOMAIN_META)
                      .filter(([k]) => k !== "general")
                      .slice(0, 6)
                      .map(([key, meta]) => (
                        <div
                          key={key}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-medium"
                          style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
                        >
                          <span>{meta.icon}</span>
                          <span className="truncate">{meta.label}</span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-4 text-[10.5px] text-muted-foreground"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>תרגום הושלם</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">שפת יעד:</span>
                <span>
                  {selectedLang?.flag} {result.targetLanguage}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">תווים:</span>
                <span>{result.translatedContent.length.toLocaleString()}</span>
              </div>
              <div className="mr-auto flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>בדוק תמיד תרגום AI לפני שימוש רשמי</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            איך זה עובד
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              step: "01",
              icon: "🔍",
              title: "ניתוח מסמך",
              desc: "הסוכן קורא את המסמך ומזהה את תחומו — כלכלי, משפטי, טכני ועוד",
            },
            {
              step: "02",
              icon: "🎯",
              title: "זיהוי תחום",
              desc: "בחירת רגיסטר מקצועי: EBITDA לכלכלה, force majeure למשפט, API לטכנולוגיה",
            },
            {
              step: "03",
              icon: "🌐",
              title: "תרגום מותאם",
              desc: "תרגום לשפת היעד תוך שמירה על מבנה ושימוש בטרמינולוגיה הנכונה לתחום",
            },
            {
              step: "04",
              icon: "📤",
              title: "ייצוא גמיש",
              desc: "העתקה, הורדה כקובץ, או הזנה חוזרת לתרגום שפה נוספת — בלחיצה אחת",
            },
          ].map((item) => (
            <div key={item.step} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  {item.step}
                </span>
              </div>
              <div className="font-semibold text-[13px] text-foreground">{item.title}</div>
              <div className="text-[11.5px] text-muted-foreground leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
