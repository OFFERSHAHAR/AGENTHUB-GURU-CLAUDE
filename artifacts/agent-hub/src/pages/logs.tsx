import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useTriggerStream } from "@/hooks/use-trigger-stream";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  Sparkles,
  Loader2,
  Clock,
  Cpu,
  Zap,
  BarChart3,
  ChevronRight,
  X,
  Building2,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: number;
  name: string;
  industry: string | null;
  status: string;
}

interface AgentLog {
  id: number;
  timestamp: string;
  source: string;
  agentId: number | null;
  agentName: string | null;
  clientId: number | null;
  conversationId: number | null;
  eventType: string;
  status: string;
  inputSummary: string | null;
  outputSummary: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

interface FailurePoint {
  source: string;
  description: string;
  recommendation: string;
}

interface ActiveAgent {
  agentName: string;
  eventCount: number;
  successRate: number;
}

interface LogSummary {
  id: number;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  totalEvents: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  summaryText: string;
  failurePoints: FailurePoint[];
  activeAgents: ActiveAgent[];
  recommendations: string[];
  rawStats: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SOURCE_LABELS: Record<string, string> = {
  "spec-agent": "Spec Agent",
  "lang-agent": "Lang Agent",
  "conversation": "Conversation",
  "orchestrator": "Orchestrator",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  request: "בקשה",
  response: "תגובה",
  ai_call: "AI Call",
  ai_success: "AI הצלחה",
  ai_fallback: "AI Fallback",
  ai_error: "AI שגיאה",
  chain_pass: "Chain Pass",
  error: "שגיאה",
  success: "הצלחה",
  warning: "אזהרה",
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  success: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", icon: CheckCircle2, label: "הצלחה" },
  error:   { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", icon: AlertCircle, label: "שגיאה" },
  warning: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", icon: AlertTriangle, label: "אזהרה" },
  info:    { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe", icon: Info, label: "מידע" },
};

const SOURCE_COLORS: Record<string, string> = {
  "spec-agent":   "#7c3aed",
  "lang-agent":   "#0369a1",
  "conversation": "#065f46",
  "orchestrator": "#92400e",
};

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchLogs(params: { source?: string; status?: string; clientId?: string; limit?: number; since?: string }): Promise<AgentLog[]> {
  const q = new URLSearchParams();
  if (params.source && params.source !== "all") q.set("source", params.source);
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.clientId && params.clientId !== "all") q.set("clientId", params.clientId);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.since) q.set("since", params.since);
  const res = await fetch(`${BASE_URL}/api/logs?${q}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json() as Promise<AgentLog[]>;
}

async function fetchClients(): Promise<Client[]> {
  const res = await fetch(`${BASE_URL}/api/clients`);
  if (!res.ok) return [];
  return res.json() as Promise<Client[]>;
}

async function fetchSummary(): Promise<LogSummary | null> {
  const res = await fetch(`${BASE_URL}/api/logs/summary`);
  if (!res.ok) return null;
  return res.json() as Promise<LogSummary | null>;
}

async function triggerAnalysis(windowMinutes = 60): Promise<void> {
  await fetch(`${BASE_URL}/api/logs/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ windowMinutes }),
  });
}

// ─── Log Row ──────────────────────────────────────────────────────────────────

function LogRow({ log, onClick, clientName }: { log: AgentLog; onClick: () => void; clientName?: string }) {
  const sc = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.info;
  const StatusIcon = sc.icon;
  const sourceColor = SOURCE_COLORS[log.source] ?? "#374151";
  const ts = new Date(log.timestamp);

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors text-left group"
    >
      {/* Status icon */}
      <StatusIcon
        className="w-4 h-4 mt-0.5 shrink-0"
        style={{ color: sc.text }}
      />

      {/* Source badge */}
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 uppercase tracking-wide"
        style={{ background: `${sourceColor}18`, color: sourceColor, border: `1px solid ${sourceColor}30` }}
      >
        {SOURCE_LABELS[log.source] ?? log.source}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-foreground">
            {EVENT_TYPE_LABELS[log.eventType] ?? log.eventType}
          </span>
          {log.agentName && (
            <span className="text-[11px] text-muted-foreground">— {log.agentName}</span>
          )}
          {clientName && (
            <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" />
              {clientName}
            </span>
          )}
          {log.provider && (
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {log.provider}/{log.model}
            </span>
          )}
        </div>
        {log.inputSummary && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[420px]" dir="auto">
            {log.inputSummary}
          </p>
        )}
        {log.errorMessage && (
          <p className="text-[11px] text-red-600 mt-0.5 truncate max-w-[420px]">⚠ {log.errorMessage}</p>
        )}
      </div>

      {/* Right side stats */}
      <div className="flex items-center gap-3 shrink-0 text-[10.5px] text-muted-foreground">
        {log.durationMs != null && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        {log.outputTokens != null && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {log.outputTokens}t
          </span>
        )}
        <span className="text-[10px]">
          {ts.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.button>
  );
}

// ─── Log Detail Drawer ────────────────────────────────────────────────────────

function LogDetail({ log, onClose, clientName }: { log: AgentLog; onClose: () => void; clientName?: string }) {
  const sc = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.info;
  const StatusIcon = sc.icon;

  const rows = [
    { label: "מקור", value: SOURCE_LABELS[log.source] ?? log.source },
    { label: "סוג אירוע", value: EVENT_TYPE_LABELS[log.eventType] ?? log.eventType },
    { label: "סטטוס", value: sc.label },
    { label: "סוכן", value: log.agentName },
    { label: "לקוח", value: clientName ?? (log.clientId ? `ID ${log.clientId}` : null) },
    { label: "שיחה", value: log.conversationId ? `ID ${log.conversationId}` : null },
    { label: "ספק", value: log.provider },
    { label: "מודל", value: log.model },
    { label: "טוקנים (קלט)", value: log.inputTokens != null ? String(log.inputTokens) : null },
    { label: "טוקנים (פלט)", value: log.outputTokens != null ? String(log.outputTokens) : null },
    { label: "עלות", value: log.estimatedCostUsd != null ? `$${log.estimatedCostUsd.toFixed(6)}` : null },
    { label: "זמן תגובה", value: log.durationMs != null ? (log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(2)}s`) : null },
    { label: "חותמת זמן", value: new Date(log.timestamp).toLocaleString("he-IL") },
  ].filter((r) => r.value != null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="w-[360px] shrink-0 bg-white border-l border-border flex flex-col h-full overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4" style={{ color: sc.text }} />
          <span className="text-[12.5px] font-semibold">פרטי אירוע #{log.id}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Metadata table */}
        <div className="space-y-1.5">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start gap-3 text-[12px]">
              <span className="text-muted-foreground shrink-0 w-24 text-right">{label}:</span>
              <span className="font-medium text-foreground break-all">{value}</span>
            </div>
          ))}
        </div>

        {/* Input */}
        {log.inputSummary && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              קלט (תקציר)
            </div>
            <pre
              className="text-[11.5px] font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-foreground"
              dir="auto"
            >
              {log.inputSummary}
            </pre>
          </div>
        )}

        {/* Output */}
        {log.outputSummary && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              פלט (תקציר)
            </div>
            <pre
              className="text-[11.5px] font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-foreground"
              dir="auto"
            >
              {log.outputSummary}
            </pre>
          </div>
        )}

        {/* Error */}
        {log.errorMessage && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1.5">
              הודעת שגיאה
            </div>
            <pre className="text-[11.5px] font-mono bg-red-50 border border-red-100 rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-red-800">
              {log.errorMessage}
            </pre>
          </div>
        )}

        {/* Metadata JSON */}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Metadata
            </div>
            <pre className="text-[11px] font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-foreground">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

function SummaryPanel({ summary, isAnalyzing, onAnalyze }: {
  summary: LogSummary | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            ניתוח AI — עדכון כל 30 דקות
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="h-7 text-[11.5px] gap-1.5 rounded-lg"
        >
          {isAnalyzing ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />מנתח…</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" />נתח עכשיו</>
          )}
        </Button>
      </div>

      {summary ? (
        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "סה״כ אירועים", value: summary.totalEvents, color: "#374151", icon: Activity },
              { label: "הצלחות", value: summary.successCount, color: "#065f46", icon: CheckCircle2 },
              { label: "שגיאות", value: summary.errorCount, color: "#991b1b", icon: AlertCircle },
              { label: "אזהרות", value: summary.warningCount, color: "#92400e", icon: AlertTriangle },
            ].map((s) => (
              <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Summary text */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-1.5">סיכום</div>
            <p className="text-[12.5px] text-violet-900 leading-relaxed" dir="rtl">{summary.summaryText}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Active agents */}
            {summary.activeAgents.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  סוכנים פעילים
                </div>
                <div className="space-y-1.5">
                  {summary.activeAgents.slice(0, 5).map((a) => (
                    <div key={a.agentName} className="flex items-center gap-2">
                      <span className="text-[11.5px] font-medium text-foreground flex-1 truncate">{a.agentName}</span>
                      <span className="text-[10.5px] text-muted-foreground">{a.eventCount} אירועים</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: a.successRate >= 0.9 ? "#ecfdf5" : a.successRate >= 0.7 ? "#fffbeb" : "#fef2f2",
                          color: a.successRate >= 0.9 ? "#065f46" : a.successRate >= 0.7 ? "#92400e" : "#991b1b",
                        }}
                      >
                        {Math.round(a.successRate * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failure points */}
            {summary.failurePoints.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-2">
                  נקודות כשל
                </div>
                <div className="space-y-2">
                  {summary.failurePoints.slice(0, 3).map((f, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-2">
                      <div className="text-[11px] font-semibold text-red-800">{f.source}</div>
                      <div className="text-[10.5px] text-red-700 mt-0.5" dir="rtl">{f.description}</div>
                      <div className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        {f.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {summary.recommendations.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                המלצות לפעולה
              </div>
              <div className="space-y-1.5">
                {summary.recommendations.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11.5px] text-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                    <span dir="rtl">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground text-right">
            עודכן: {new Date(summary.createdAt).toLocaleString("he-IL")} · חלון:{" "}
            {new Date(summary.windowStart).toLocaleTimeString("he-IL")} – {new Date(summary.windowEnd).toLocaleTimeString("he-IL")}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-muted-foreground">אין ניתוח עדיין</p>
          <p className="text-[11.5px] text-muted-foreground/70 mt-1">
            לחץ "נתח עכשיו" להפעלת הסוכן המנתח
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [selectedLog, setSelectedLog] = useState<AgentLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Build a lookup: clientId → client name
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchLogs({ source: filterSource, status: filterStatus, clientId: filterClient, limit: 150 });
      setLogs(data);
      setLastRefresh(new Date());
    } catch {
      // silent
    }
  }, [filterSource, filterStatus, filterClient]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchSummary();
      setSummary(s);
    } catch {
      // silent
    }
  }, []);

  // Load clients once on mount
  useEffect(() => {
    fetchClients().then(setClients).catch(() => {});
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadLogs(), loadSummary()]).finally(() => setIsLoading(false));
  }, [loadLogs, loadSummary]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      loadLogs().catch(() => {});
      loadSummary().catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, loadLogs, loadSummary]);

  // Live updates: reload logs the moment any trigger fires anywhere in the app.
  // Polling above stays as the graceful fallback when the stream can't connect.
  useTriggerStream(() => {
    loadLogs().catch(() => {});
  });

  const handleManualRefresh = async () => {
    setIsLoading(true);
    await Promise.all([loadLogs(), loadSummary()]);
    setIsLoading(false);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await triggerAnalysis(60);
    toast({ title: "ניתוח הופעל — יסתיים תוך כמה שניות" });
    // Poll for new summary
    setTimeout(async () => {
      await loadSummary();
      setIsAnalyzing(false);
    }, 8000);
  };

  const errorCount = logs.filter((l) => l.status === "error").length;
  const warningCount = logs.filter((l) => l.status === "warning").length;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">מרכז הלוגים</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            ניטור זמן-אמת של כל פעולות הסוכנים · ניתוח AI כל 30 דקות
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10.5px] text-muted-foreground">
              עודכן: {lastRefresh.toLocaleTimeString("he-IL")}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={[
              "flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-lg border transition-colors",
              autoRefresh
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-muted text-muted-foreground border-border",
            ].join(" ")}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"}`} />
            {autoRefresh ? "Live" : "עצור"}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="h-8 text-[12px] gap-1.5 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] font-semibold text-foreground">{logs.length}</span>
          <span className="text-[11px] text-muted-foreground">אירועים</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[12px] font-semibold text-red-700">{errorCount}</span>
            <span className="text-[11px] text-red-600">שגיאות</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[12px] font-semibold text-amber-700">{warningCount}</span>
            <span className="text-[11px] text-amber-600">אזהרות</span>
          </div>
        )}

        {/* Filters */}
        <div className="ml-auto flex items-center gap-2">
          {/* Client filter */}
          <Select value={filterClient} onValueChange={(v) => { setFilterClient(v); setSelectedLog(null); }}>
            <SelectTrigger className="w-[160px] h-8 text-[12px] border-blue-200 data-[state=open]:border-blue-400">
              <Building2 className="w-3 h-3 text-blue-500 shrink-0" />
              <SelectValue placeholder="כל הלקוחות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הלקוחות</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[150px] h-8 text-[12px]">
              <SelectValue placeholder="כל המקורות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המקורות</SelectItem>
              <SelectItem value="spec-agent">Spec Agent</SelectItem>
              <SelectItem value="lang-agent">Lang Agent</SelectItem>
              <SelectItem value="conversation">Conversation</SelectItem>
              <SelectItem value="orchestrator">Orchestrator</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-8 text-[12px]">
              <SelectValue placeholder="כל הסטטוסים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="success">הצלחה</SelectItem>
              <SelectItem value="error">שגיאה</SelectItem>
              <SelectItem value="warning">אזהרה</SelectItem>
              <SelectItem value="info">מידע</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 gap-5">
        {/* Left: Summary + Log Feed */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          {/* Summary */}
          <SummaryPanel
            summary={summary}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
          />

          {/* Log Feed */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 shrink-0">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                לוג פעולות בזמן-אמת
              </span>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Activity className="w-8 h-8 text-muted-foreground/30" />
                  <div>
                    <p className="text-[13px] font-medium text-muted-foreground">אין לוגים עדיין</p>
                    <p className="text-[11.5px] text-muted-foreground/60 mt-0.5">
                      שגר בקשה מכל סוכן — היא תופיע כאן תוך שניות
                    </p>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <LogRow
                      key={log.id}
                      log={log}
                      clientName={log.clientId != null ? clientMap[log.clientId] : undefined}
                      onClick={() => setSelectedLog((prev) => (prev?.id === log.id ? null : log))}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail drawer */}
        <AnimatePresence>
          {selectedLog && (
            <LogDetail
              key={selectedLog.id}
              log={selectedLog}
              clientName={selectedLog.clientId != null ? clientMap[selectedLog.clientId] : undefined}
              onClose={() => setSelectedLog(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
