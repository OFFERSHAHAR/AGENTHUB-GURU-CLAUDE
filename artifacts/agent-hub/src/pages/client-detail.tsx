import { useParams, Link, useSearch, useLocation } from "wouter";
import {
  useGetClient,
  useListClientAssignments,
  useListAgents,
  useCreateAssignment,
  useRemoveAssignment,
  useUpdateClient,
  useGetAssignmentTrigger,
  useCreateAssignmentTrigger,
  useFireWebhookTrigger,
  useListAssignmentTriggerEvents,
  useListClientTriggerEvents,
  useToggleAutomation,
  useDisableAllAutomations,
  useListAutomationLogs,
  useGetClientTriggerStats,
  useGetDedupWarnThreshold,
  useGetDedupWarnThresholdHistory,
  useGetClientReport,
  getGetClientReportQueryKey,
  getGetClientQueryKey,
  getListClientAssignmentsQueryKey,
  getListClientsQueryKey,
  getGetAssignmentTriggerQueryKey,
  getListAssignmentTriggerEventsQueryKey,
  getListClientTriggerEventsQueryKey,
  getListAutomationLogsQueryKey,
  getGetClientTriggerStatsQueryKey,
  getGetDedupWarnThresholdQueryKey,
  getGetDedupWarnThresholdHistoryQueryKey,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Bot, Plus, Trash2, Network, ExternalLink, Building2, Send, Sparkles, RefreshCw, AlertCircle, MessageSquare, Zap, Copy, Check, RefreshCcw, UserPlus, ShieldOff, Power, PowerOff, ChevronDown, SkipForward, Clock, AlertTriangle, Activity, Filter, Settings2, Download, History, ArrowRight, Link2 as LinkIcon, X, Star, CheckCircle2, Shield, ShieldAlert, ShieldCheck, ChevronRight, Save, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { formatWindowShort, formatWindowLong } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Switch } from "@/components/ui/switch";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const CATEGORY_META: Record<string, { color: string; bg: string; border: string; text: string }> = {
  Sales: { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  Support: { color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1" },
  Analytics: { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  Content: { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  Finance: { color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8", text: "#9d174d" },
  Operations: { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" },
  Marketing: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  Contact: { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", text: "#155e75" },
};
const DEFAULT_META = { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" };

function AgentIcon({ agent, size = "lg" }: { agent: { iconEmoji?: string | null; category: string }; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-7 h-7 text-sm", md: "w-10 h-10 text-xl", lg: "w-12 h-12 text-2xl" };
  const meta = CATEGORY_META[agent.category] || DEFAULT_META;
  if (agent.category === "Contact") {
    return (
      <div className={`${sizeMap[size]} rounded-xl flex items-center justify-center shrink-0`} style={{ background: meta.bg }}>
        <UserPlus className="w-[45%] h-[45%]" style={{ color: meta.text }} />
      </div>
    );
  }
  return (
    <div className={`${sizeMap[size]} rounded-xl flex items-center justify-center shrink-0`} style={{ background: meta.bg }}>
      <span className="leading-none">{agent.iconEmoji || "🤖"}</span>
    </div>
  );
}

const STATUS_META: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#10b981" },
  trial: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b" },
  inactive: { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", dot: "#9ca3af" },
};

const TRIGGER_STATUS_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  idle:         { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8", label: "Waiting" },
  triggered:    { bg: "#fff7ed", text: "#c2410c", dot: "#f97316", label: "Triggered" },
  running:      { bg: "#ecfdf5", text: "#065f46", dot: "#10b981", label: "Running" },
  deduplicated: { bg: "#f8fafc", text: "#94a3b8", dot: "#cbd5e1", label: "Duplicate" },
};

// ─── helpers for EventRow ─────────────────────────────────────────────────────

/** Turn a raw payload object into a short Hebrew-readable summary string. */
function summarisePayload(payload: any): string | null {
  if (!payload) return null;
  const records: any[] =
    payload.records ?? payload.bookings ?? payload.items ?? null;
  if (Array.isArray(records) && records.length > 0) {
    const names = records
      .slice(0, 3)
      .map((r: any) => r.guestName ?? r.name ?? r.guest ?? null)
      .filter(Boolean)
      .join(", ");
    const more = records.length > 3 ? ` ועוד ${records.length - 3}` : "";
    return `${records.length} רשומות: ${names}${more}`;
  }
  if (payload.event === "test_trigger") return "טריגר בדיקה (test)";
  if (payload.source) return `מקור: ${payload.source}`;
  const keys = Object.keys(payload).slice(0, 3).join(", ");
  return keys || null;
}

/** Extract the compatibility check block from agent output as structured lines. */
function parseCompatibility(output: string): { label: string; value: string }[] | null {
  const block = output.match(/בדיקת התאמה[:\s]*([\s\S]*?)(?:\n\n|\n(?=[א-ת](?![\s\S]*[:+*]))|בקשת|$)/);
  if (!block) return null;
  const lines = block[1].split("\n").map((l) => l.replace(/^[\s*+\-•]+/, "").trim()).filter(Boolean);
  return lines.map((l) => {
    const colonIdx = l.indexOf(":");
    if (colonIdx > 0) return { label: l.slice(0, colonIdx).trim(), value: l.slice(colonIdx + 1).trim() };
    return { label: l, value: "" };
  });
}

/** True when the output contains an unanswered approval request. */
function hasPendingApproval(output: string): boolean {
  return /בקשת אישור|האם לעדכן|האם לבצע|אני מבקש אישור/i.test(output);
}

// ─── EventRow — single trigger event item ────────────────────────────────────
function EventRow({ ev, evMeta }: { ev: any; evMeta: { bg: string; text: string; dot: string; label: string } }) {
  const [outputOpen, setOutputOpen] = useState(false);
  const output: string | null = ev.agentOutput ?? null;
  const payloadSummary = summarisePayload(ev.payload);
  const compatRows = output ? parseCompatibility(output) : null;
  const needsApproval = output ? hasPendingApproval(output) : false;

  // Strip the compatibility block + approval boilerplate from the "rest" of the output
  const restOutput = output
    ? output
        .replace(/בדיקת התאמה[:\s]*([\s\S]*?)(?=\n\n[א-ת]|בקשת אישור|$)/, "")
        .replace(/בקשת אישור:\s*\n?לפני ביצוע שינויים ביומן, אני מבקש אישור אנושי\.?/gi, "")
        .replace(/לפני ביצוע שינויים ביומן, אני מבקש אישור אנושי\.?/gi, "")
        .trim()
    : null;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 ${
        needsApproval
          ? "border-amber-300 bg-amber-50/60"
          : "border-border bg-muted/20"
      }`}
    >
      {/* Header row: status badge + time + payload summary */}
      <div className="flex items-start gap-2.5">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5"
          style={{ background: evMeta.bg, color: evMeta.text, borderColor: evMeta.dot + "44" }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: evMeta.dot }} />
          {evMeta.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground" dir="rtl">
            {new Date(ev.firedAt).toLocaleString("he-IL", {
              timeZone: "Asia/Jerusalem",
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </div>
          {payloadSummary && (
            <div className="text-[11px] text-foreground/70 mt-0.5" dir="rtl">
              📥 {payloadSummary}
            </div>
          )}
        </div>
      </div>

      {/* Pending approval — always visible, cannot be missed */}
      {needsApproval && (
        <div className="flex items-start gap-2 rounded-md border border-amber-400 bg-amber-100 px-2.5 py-2" dir="rtl">
          <span className="text-amber-600 text-sm shrink-0 mt-0.5">⏳</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-amber-800">ממתין לאישורך</p>
            <p className="text-[11px] text-amber-700 leading-snug mt-0.5">
              הסוכן עצר ומחכה לאישור שלך לפני ביצוע שינויים ביומן.
              הסוכן <strong>אינו</strong> מורשה לשנות נתונים ללא אישורך.
            </p>
          </div>
        </div>
      )}

      {/* Compatibility check — structured table */}
      {compatRows && compatRows.length > 0 && (
        <div className="rounded-md border border-border bg-background px-2.5 py-2" dir="rtl">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">📊 בדיקת התאמה — גיליון ↔ מאגר</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {compatRows.map((row, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full agent response (collapsible, opens by default if approval needed) */}
      {output && (
        <div>
          <button
            onClick={() => setOutputOpen((o) => !o)}
            className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            תגובת הסוכן המלאה
            <motion.span animate={{ rotate: outputOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown className="w-3 h-3" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {outputOpen && (
              <motion.div
                key="output"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p
                  className="mt-1.5 text-[11px] text-foreground/75 leading-relaxed bg-violet-50 border border-violet-100 rounded-md px-2.5 py-2 whitespace-pre-wrap"
                  dir="rtl"
                >
                  {output}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── DedupSparkline — mini bar chart for dedup counts per bucket ──────────────
// `breakdownUnit` decides bucket labels: hourly buckets (sub-day windows) carry
// full ISO-hour keys, daily buckets carry calendar dates.
function DedupSparkline({ days, breakdownUnit = "day" }: { days: { date: string; count: number }[]; breakdownUnit?: "hour" | "day" }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const title = breakdownUnit === "hour"
    ? "Hourly dedup counts (oldest → newest)"
    : "Daily dedup counts (oldest → newest)";
  return (
    <div className="flex items-end gap-[2px] h-5" title={title}>
      {days.map((d) => {
        const pct = d.count / max;
        const heightPx = Math.max(Math.round(pct * 16), d.count > 0 ? 3 : 1);
        const bucketDate = breakdownUnit === "hour"
          ? new Date(d.date)
          : new Date(d.date + "T12:00:00Z");
        const bucketLabel = breakdownUnit === "hour"
          ? bucketDate.toLocaleString("en-US", { weekday: "short", hour: "numeric" })
          : bucketDate.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
        return (
          <div
            key={d.date}
            title={`${bucketLabel}: ${d.count} suppressed`}
            className="w-[5px] rounded-[1px] transition-opacity hover:opacity-70"
            style={{
              height: heightPx,
              background: d.count > 0 ? "#94a3b8" : "#e2e8f0",
              alignSelf: "flex-end",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── useDocumentVisible — tracks whether the browser tab is visible ──────────
function useDocumentVisible() {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

// ─── useClientTriggerStream — SSE push channel for instant trigger updates ───
// Subscribes to the API server's per-client SSE stream while mounted and calls
// `onEvent` whenever a trigger fires or changes status — even for fires that
// originate outside AgentHub (e.g. an external n8n call). Falls back silently to
// the existing on-demand refetch if the browser/connection can't keep a stream.
const TRIGGER_STREAM_API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type TriggerStreamEvent = {
  clientId: number;
  assignmentId: number;
  triggerId: number;
  agentStatus: string;
  firedAt: string;
};

// "connecting" before the first open, "live" while the stream is healthy, and
// "reconnecting" after a drop while EventSource auto-retries. Returned so the
// dashboard can show a trustworthy live/reconnecting indicator to ops.
type TriggerStreamStatus = "connecting" | "live" | "reconnecting";

function useClientTriggerStream(
  clientId: number,
  onEvent: (event: TriggerStreamEvent) => void,
): TriggerStreamStatus {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;
  const [status, setStatus] = useState<TriggerStreamStatus>("connecting");

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    if (!clientId || isNaN(clientId)) return;

    setStatus("connecting");

    const url = `${TRIGGER_STREAM_API}/api/clients/${clientId}/trigger/stream`;
    const source = new EventSource(url);
    source.onopen = () => setStatus("live");
    source.onerror = () => {
      // EventSource auto-reconnects (resending Last-Event-ID) unless CLOSED.
      // Either way the live push isn't current, so surface "reconnecting".
      setStatus("reconnecting");
    };
    source.addEventListener("trigger", (e) => {
      try {
        callbackRef.current(JSON.parse((e as MessageEvent).data));
      } catch {
        // Malformed frame — ignore; the on-demand refetch still covers us.
      }
    });

    return () => source.close();
  }, [clientId]);

  return status;
}

// ─── TriggerRow — per-assignment trigger config panel ────────────────────────
function TriggerRow({ assignment, dedupCount, highDedupRate, dedupDailyBreakdown, dedupBreakdownUnit = "day", windowHours = 168, windowUnit = "days" }: { assignment: any; dedupCount?: number; highDedupRate?: boolean; dedupDailyBreakdown?: { date: string; count: number }[]; dedupBreakdownUnit?: "hour" | "day"; windowHours?: number; windowUnit?: "hours" | "days" }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const {
    exportFrom,
    exportTo,
    activePreset,
    refresh: refreshExportRange,
    setRange: setExportRange,
    setFrom: setExportFrom,
    setTo: setExportTo,
    clear: clearExportRange,
  } = usePersistentExportRange();
  const {
    savedPresets,
    refreshSavedPresets,
    saveExportPreset,
    removeExportPreset,
  } = useSavedExportPresets();
  const agent = assignment.agent;
  const tabVisible = useDocumentVisible();

  const { data: trigger, isLoading, isError } = useGetAssignmentTrigger(assignment.id, {
    query: {
      queryKey: getGetAssignmentTriggerQueryKey(assignment.id),
      retry: false,
      refetchInterval: (q) => {
        if (!tabVisible) return false;
        const status = (q.state.data as any)?.status;
        if (status === "triggered" || status === "running") return 5000;
        return false;
      },
      refetchIntervalInBackground: false,
    },
  });

  const { data: triggerEvents } = useListAssignmentTriggerEvents(assignment.id, {
    query: {
      queryKey: getListAssignmentTriggerEventsQueryKey(assignment.id),
      enabled: historyOpen && tabVisible,
      retry: false,
      refetchInterval: () => {
        if (trigger?.status === "triggered" || trigger?.status === "running") return 4000;
        return false;
      },
    },
  });

  const createTrigger = useCreateAssignmentTrigger();
  const fireTrigger = useFireWebhookTrigger();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetAssignmentTriggerQueryKey(assignment.id) });
    queryClient.invalidateQueries({ queryKey: getListAssignmentTriggerEventsQueryKey(assignment.id) });
  };

  const handleCreate = () => {
    createTrigger.mutate({ id: assignment.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Webhook trigger נוצר" }); },
    });
  };

  const handleRegenerate = () => {
    createTrigger.mutate({ id: assignment.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Trigger URL חודש" }); },
    });
  };

  const handleCopy = () => {
    if (trigger?.webhookUrl) {
      navigator.clipboard.writeText(trigger.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTest = () => {
    if (!trigger?.webhookUrl) return;
    const secret = trigger.webhookUrl.split("/webhooks/trigger/").pop() ?? "";
    fireTrigger.mutate(
      { secret, data: { event: "test_trigger", source: "AgentHub", timestamp: new Date().toISOString() } },
      {
        onSuccess: () => { invalidate(); toast({ title: "Test webhook fired!", description: "אירוע התקבל בהצלחה." }); },
        onError: (err: unknown) => {
          invalidate();
          if ((err as { status?: number })?.status === 409) {
            toast({
              title: "הסוכן כבר פועל",
              description: "ריצה קודמת עדיין רצה — נסה שוב בעוד רגע.",
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "הפעלת ה-webhook נכשלה",
            description: "אירעה שגיאה. נסה שוב.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const meta = CATEGORY_META[agent?.category] || DEFAULT_META;
  const sm = TRIGGER_STATUS_META[trigger?.status ?? "idle"];
  const isRunning = trigger?.status === "triggered" || trigger?.status === "running";

  return (
    <motion.div
      id={`trigger-row-${assignment.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-border card-shadow overflow-hidden transition-shadow"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <AgentIcon agent={agent} size="sm" />
        <div className="flex-1 min-w-0">
          <span className="text-[12.5px] font-semibold text-foreground">{agent?.name}</span>
          <span className="text-[11px] text-muted-foreground ml-2">· {agent?.category}</span>
        </div>
        {/* Status badge */}
        {trigger && (
          <span
            className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
            style={{ background: sm.bg, color: sm.text, borderColor: sm.dot + "44" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
            {sm.label}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {isLoading && <div className="text-[12px] text-muted-foreground">טוען...</div>}

        {(isError || !trigger) && !isLoading && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">אין trigger מוגדר לסוכן זה</span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-[11px] rounded-lg"
              onClick={handleCreate}
              disabled={createTrigger.isPending}
              data-testid={`button-create-trigger-${assignment.id}`}
            >
              <Zap className="w-3 h-3" />
              צור Trigger
            </Button>
          </div>
        )}

        {trigger && (
          <>
            {/* Webhook URL */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Webhook URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10.5px] bg-muted px-2.5 py-1.5 rounded-lg text-foreground font-mono truncate border border-border">
                  {trigger.webhookUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="w-7 h-7 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  data-testid={`button-copy-trigger-${assignment.id}`}
                  title="העתק URL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Dedup stat + warning + sparkline */}
            {dedupCount !== undefined && (
              <div className={`flex items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 border ${highDedupRate ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                <Filter className={`w-3 h-3 shrink-0 ${highDedupRate ? "text-amber-400" : "text-slate-400"}`} />
                <div className="flex-1 min-w-0">
                  {dedupCount === 0
                    ? <span>No duplicates suppressed in last {formatWindowLong(windowHours, windowUnit)}</span>
                    : <span><span className={`font-semibold ${highDedupRate ? "text-amber-800" : "text-slate-700"}`}>{dedupCount}</span> duplicate{dedupCount !== 1 ? "s" : ""} suppressed · {formatWindowShort(windowHours, windowUnit)}</span>
                  }
                </div>
                {highDedupRate && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full shrink-0">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    High rate
                  </span>
                )}
                {dedupDailyBreakdown && dedupDailyBreakdown.length > 0 && (
                  <DedupSparkline days={dedupDailyBreakdown} breakdownUnit={dedupBreakdownUnit} />
                )}
              </div>
            )}

            {/* Trigger fire history — collapsible */}
            {trigger.recentEvents && trigger.recentEvents.length > 0 && (
              <div className="space-y-1.5">
                {/* Toggle header */}
                <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left group"
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1 flex items-center gap-1.5 flex-wrap">
                    {(() => {
                      const realCount = trigger.recentEvents.filter((e: any) => e.agentStatus !== "deduplicated").length;
                      const dupCount = trigger.recentEvents.filter((e: any) => e.agentStatus === "deduplicated").length;
                      return (
                        <>
                          <span>היסטוריית אירועים ({realCount > 5 ? "5+" : realCount})</span>
                          {dupCount > 0 && (
                            <span className="text-[9px] font-semibold text-amber-500/80 normal-case tracking-normal">
                              ({dupCount} כפולים)
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <motion.span
                    animate={{ rotate: historyOpen ? 180 : 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-muted-foreground"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.span>
                </button>

                {/* Export CSV — single agent's history */}
                {(() => {
                  const exportEvents =
                    triggerEvents && triggerEvents.length > 0
                      ? triggerEvents
                      : trigger.recentEvents;
                  if (!exportEvents || exportEvents.length === 0) return null;
                  const agentSlug = (agent?.name ?? "agent")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "") || "agent";
                  return (
                    <Popover open={exportOpen} onOpenChange={(o) => { if (o) { refreshExportRange(); refreshSavedPresets(); } setExportOpen(o); }}>
                      <PopoverTrigger asChild>
                        <button
                          title="Export CSV"
                          data-testid={`button-export-csv-${assignment.id}`}
                          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 transition-colors shrink-0"
                        >
                          <Download className="w-2.5 h-2.5" />
                          Export CSV
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64">
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-semibold text-foreground">Export trigger events</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Pick a preset or date range, or leave blank to export all.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {EXPORT_DATE_PRESETS.map((preset) => {
                              const isActive = activePreset === preset.testId;
                              return (
                                <button
                                  key={preset.label}
                                  type="button"
                                  data-testid={`export-preset-${preset.testId}-${assignment.id}`}
                                  aria-pressed={isActive}
                                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                                    isActive
                                      ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-700"
                                      : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                                  }`}
                                  onClick={() => {
                                    const { from, to } = preset.getRange();
                                    setExportRange(from, to, preset.testId);
                                  }}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                          <SavedExportPresetControls
                            savedPresets={savedPresets}
                            activePreset={activePreset}
                            currentFrom={exportFrom}
                            currentTo={exportTo}
                            onSelect={(from, to, key) => setExportRange(from, to, key)}
                            onRemove={removeExportPreset}
                            onSave={(name) => saveExportPreset(name, exportFrom, exportTo)}
                            testIdSuffix={`${assignment.id}`}
                          />
                          <div className="space-y-2">
                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                From
                              </span>
                              <Input
                                type="date"
                                value={exportFrom}
                                max={exportTo || undefined}
                                onChange={(e) => setExportFrom(e.target.value)}
                                className="h-8 text-xs mt-1"
                                data-testid={`export-from-date-${assignment.id}`}
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                To
                              </span>
                              <Input
                                type="date"
                                value={exportTo}
                                min={exportFrom || undefined}
                                onChange={(e) => setExportTo(e.target.value)}
                                className="h-8 text-xs mt-1"
                                data-testid={`export-to-date-${assignment.id}`}
                              />
                            </label>
                          </div>
                          {activePreset && (exportFrom || exportTo) && (
                            <div
                              className="text-[11px] text-muted-foreground"
                              data-testid={`export-resolved-range-${assignment.id}`}
                            >
                              Exporting{" "}
                              <span className="font-semibold text-foreground">
                                {formatResolvedRange(exportFrom, exportTo)}
                              </span>
                            </div>
                          )}
                          <div
                            className="text-[11px] text-muted-foreground"
                            data-testid={`export-range-count-${assignment.id}`}
                          >
                            {(() => {
                              const count = countEventsInRange(exportEvents, exportFrom, exportTo);
                              const noun = count === 1 ? "event" : "events";
                              return exportFrom || exportTo ? (
                                <span>
                                  <span className="font-semibold text-foreground">{count}</span> {noun} in this range
                                </span>
                              ) : (
                                <span>
                                  All <span className="font-semibold text-foreground">{count}</span> {noun} will be exported
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              data-testid={`export-csv-confirm-${assignment.id}`}
                              onClick={() => {
                                exportEventsToCsv(exportEvents, {
                                  from: exportFrom,
                                  to: exportTo,
                                  includeAgentName: false,
                                  filename: `trigger-events-${agentSlug}-${new Date().toISOString().slice(0, 10)}.csv`,
                                });
                                setExportOpen(false);
                              }}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                            {(exportFrom || exportTo) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                data-testid={`export-clear-range-${assignment.id}`}
                                onClick={() => {
                                  clearExportRange();
                                }}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
                </div>

                {/* Collapsed: show last 5 events from recentEvents */}
                <AnimatePresence initial={false}>
                  {!historyOpen && (
                    <motion.div
                      key="collapsed"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden space-y-1"
                    >
                      {trigger.recentEvents.slice(0, 5).map((ev: any) => {
                        const evMeta = TRIGGER_STATUS_META[ev.agentStatus] ?? TRIGGER_STATUS_META.idle;
                        return (
                          <EventRow key={ev.id} ev={ev} evMeta={evMeta} />
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Expanded: full history from dedicated endpoint */}
                  {historyOpen && (() => {
                    const fullHistory: any[] =
                      triggerEvents && triggerEvents.length > 0
                        ? triggerEvents
                        : trigger.recentEvents;
                    const kw = historyKeyword.trim().toLowerCase();
                    const filteredHistory = kw
                      ? fullHistory.filter((ev: any) =>
                          ev.payload
                            ? JSON.stringify(ev.payload).toLowerCase().includes(kw)
                            : false,
                        )
                      : fullHistory;
                    return (
                      <motion.div
                        key="expanded"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <Input
                          type="text"
                          value={historyKeyword}
                          onChange={(e) => setHistoryKeyword(e.target.value)}
                          placeholder="Search payloads…"
                          className="h-7 text-[11px] rounded-lg w-full border-border mb-1.5"
                          data-testid={`history-keyword-input-${assignment.id}`}
                        />
                        <div className="space-y-1 max-h-[280px] overflow-y-auto pr-0.5">
                          {filteredHistory.length > 0 ? (
                            filteredHistory.map((ev: any) => {
                              const evMeta = TRIGGER_STATUS_META[ev.agentStatus] ?? TRIGGER_STATUS_META.idle;
                              return <EventRow key={ev.id} ev={ev} evMeta={evMeta} />;
                            })
                          ) : (
                            <div className="text-[11px] text-muted-foreground text-center py-3">
                              {kw ? "אין אירועים תואמים לחיפוש" : "אין אירועים"}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="gap-1.5 h-7 text-[11px] rounded-lg"
                onClick={handleTest}
                disabled={fireTrigger.isPending || isRunning}
                title={isRunning ? "הסוכן כבר פועל" : undefined}
                data-testid={`button-test-trigger-${assignment.id}`}
              >
                <Zap className="w-3 h-3" />
                {isRunning ? "פועל..." : "Test Trigger"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-[11px] rounded-lg"
                onClick={handleRegenerate}
                disabled={createTrigger.isPending}
                data-testid={`button-regen-trigger-${assignment.id}`}
              >
                <RefreshCcw className="w-3 h-3" />
                Regenerate URL
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── CSV export helper ────────────────────────────────────────────────────────
function exportEventsToCsv(
  events: any[],
  opts: { from?: string; to?: string; includeAgentName?: boolean; filename?: string } = {},
) {
  const { from, to, includeAgentName = true, filename } = opts;
  const escape = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const header = includeAgentName
    ? ["Event ID", "Agent Name", "Status", "Fired At", "Payload Preview"]
    : ["Event ID", "Status", "Fired At", "Payload Preview"];

  // Optionally scope events to the chosen [from, to] date range (inclusive).
  const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toTs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
  const scoped = events.filter((ev) => {
    const ts = new Date(ev.firedAt).getTime();
    if (fromTs !== null && ts < fromTs) return false;
    if (toTs !== null && ts > toTs) return false;
    return true;
  });

  const rows = scoped.map((ev) => {
    const payloadPreview = ev.payload ? JSON.stringify(ev.payload).slice(0, 120) : "";
    const firedAt = new Date(ev.firedAt).toISOString();
    const status = TRIGGER_STATUS_META[ev.agentStatus]?.label ?? ev.agentStatus ?? "";
    const cells = includeAgentName
      ? [ev.id, ev.agentName, status, firedAt, payloadPreview]
      : [ev.id, status, firedAt, payloadPreview];
    return cells.map(escape).join(",");
  });
  const csv = [header.map(escape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `trigger-events-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Count how many events fall within the chosen [from, to] date range (inclusive).
// Mirrors the scoping logic used by exportEventsToCsv so the live count matches the export.
function countEventsInRange(events: any[] | undefined, from?: string, to?: string): number {
  if (!events) return 0;
  const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toTs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
  return events.filter((ev) => {
    const ts = new Date(ev.firedAt).getTime();
    if (fromTs !== null && ts < fromTs) return false;
    if (toTs !== null && ts > toTs) return false;
    return true;
  }).length;
}

// ─── Quick date presets for the export popover ──────────────────────────────
const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Format a YYYY-MM-DD value into a short, human-readable label (e.g. "May 30").
const formatExportDate = (value: string) => {
  if (!value) return "";
  const d = new Date(value + "T12:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Build the concrete range label a preset/range resolves to (e.g. "May 30 – Jun 5").
const formatResolvedRange = (from: string, to: string) => {
  const fromLabel = formatExportDate(from);
  const toLabel = formatExportDate(to);
  if (fromLabel && toLabel) return `${fromLabel} – ${toLabel}`;
  if (fromLabel) return `From ${fromLabel}`;
  if (toLabel) return `Through ${toLabel}`;
  return "";
};

const EXPORT_DATE_PRESETS: {
  label: string;
  testId: string;
  getRange: () => { from: string; to: string };
}[] = [
  {
    label: "Last 7 days",
    testId: "last-7-days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: toDateInput(from), to: toDateInput(to) };
    },
  },
  {
    label: "Last 30 days",
    testId: "last-30-days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: toDateInput(from), to: toDateInput(to) };
    },
  },
  {
    label: "This month",
    testId: "this-month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateInput(from), to: toDateInput(now) };
    },
  },
  {
    label: "Last month",
    testId: "last-month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateInput(from), to: toDateInput(to) };
    },
  },
];

// Render a payload preview snippet, highlighting the matched keyword (case-insensitive).
// If the match falls outside the leading window, the snippet shifts so the match stays visible.
function renderPayloadSnippet(payloadStr: string, keyword: string, maxLen = 90) {
  const trimmed = keyword.trim();
  const total = payloadStr.length;

  if (trimmed === "") {
    return (
      <>
        {payloadStr.slice(0, maxLen)}
        {total > maxLen ? "…" : ""}
      </>
    );
  }

  const matchIndex = payloadStr.toLowerCase().indexOf(trimmed.toLowerCase());
  if (matchIndex === -1) {
    return (
      <>
        {payloadStr.slice(0, maxLen)}
        {total > maxLen ? "…" : ""}
      </>
    );
  }

  const matchEnd = matchIndex + trimmed.length;
  let start = 0;
  // Shift the window so the match is visible when it sits past the leading snippet.
  if (matchEnd > maxLen) {
    const pad = Math.max(0, Math.floor((maxLen - trimmed.length) / 2));
    start = Math.max(0, matchIndex - pad);
  }
  let end = Math.min(total, start + maxLen);
  // Guarantee the full match fits inside the window.
  if (end < matchEnd) {
    end = Math.min(total, matchEnd);
    start = Math.max(0, end - maxLen);
  }

  const before = payloadStr.slice(start, matchIndex);
  const matched = payloadStr.slice(matchIndex, matchEnd);
  const after = payloadStr.slice(matchEnd, end);

  return (
    <>
      {start > 0 ? "…" : ""}
      {before}
      <mark className="bg-yellow-200 text-foreground rounded-sm px-0.5">{matched}</mark>
      {after}
      {end < total ? "…" : ""}
    </>
  );
}

// Build a short human-readable label for an active export date range. Returns
// null when no range is set. Relative presets keep their friendly label.
function describeDateRange(from: string, to: string, preset: string | null): string | null {
  if (preset) {
    const matched = EXPORT_DATE_PRESETS.find((p) => p.testId === preset);
    if (matched) return matched.label;
  }
  if (!from && !to) return null;
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  return `Until ${to}`;
}

// ─── Persisted export date range — shared across client-level & per-agent CSV ──
const EXPORT_RANGE_STORAGE_KEY = "agenthub.exportDateRange.v1";

type ExportRangeState = { from: string; to: string; preset: string | null };

function readStoredExportRange(): ExportRangeState {
  if (typeof window === "undefined") return { from: "", to: "", preset: null };
  try {
    const raw = window.localStorage.getItem(EXPORT_RANGE_STORAGE_KEY);
    if (!raw) return { from: "", to: "", preset: null };
    const parsed = JSON.parse(raw);
    const preset = typeof parsed?.preset === "string" ? parsed.preset : null;
    // Relative presets ("Last 7 days", etc.) are rolling windows: recompute the
    // dates from today so a stored selection never freezes on the day it was picked.
    // Custom ranges (preset === null) keep their fixed absolute dates.
    const matchedPreset = preset
      ? EXPORT_DATE_PRESETS.find((p) => p.testId === preset)
      : undefined;
    if (matchedPreset) {
      const { from, to } = matchedPreset.getRange();
      return { from, to, preset };
    }
    return {
      from: typeof parsed?.from === "string" ? parsed.from : "",
      to: typeof parsed?.to === "string" ? parsed.to : "",
      preset,
    };
  } catch {
    return { from: "", to: "", preset: null };
  }
}

function usePersistentExportRange() {
  const [state, setState] = useState<ExportRangeState>(readStoredExportRange);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPORT_RANGE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore write failures (e.g. private mode) */
    }
  }, [state]);

  // Sync when another tab/window changes the range.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === EXPORT_RANGE_STORAGE_KEY) setState(readStoredExportRange());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    exportFrom: state.from,
    exportTo: state.to,
    activePreset: state.preset,
    // Re-read from storage so a popover reflects changes made elsewhere in the same page.
    refresh: () => setState(readStoredExportRange()),
    setRange: (from: string, to: string, preset: string | null) =>
      setState({ from, to, preset }),
    setFrom: (from: string) => setState((s) => ({ ...s, from, preset: null })),
    setTo: (to: string) => setState((s) => ({ ...s, to, preset: null })),
    clear: () => setState({ from: "", to: "", preset: null }),
  };
}

// ─── Saved (named) export ranges — ops can name a From/To range and reuse it ──
// These are absolute ranges (fixed dates), unlike the rolling relative presets,
// and persist across sessions in localStorage like the active range above.
const SAVED_EXPORT_PRESETS_STORAGE_KEY = "agenthub.savedExportPresets.v1";

type SavedExportPreset = { id: string; name: string; from: string; to: string };

// The key stored in ExportRangeState.preset when a saved preset is active.
const savedPresetKey = (id: string) => `saved:${id}`;

function readSavedExportPresets(): SavedExportPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_EXPORT_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        id: typeof p?.id === "string" ? p.id : "",
        name: typeof p?.name === "string" ? p.name : "",
        from: typeof p?.from === "string" ? p.from : "",
        to: typeof p?.to === "string" ? p.to : "",
      }))
      .filter((p) => p.id && p.name && (p.from || p.to));
  } catch {
    return [];
  }
}

function useSavedExportPresets() {
  const [presets, setPresets] = useState<SavedExportPreset[]>(readSavedExportPresets);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_EXPORT_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      /* ignore write failures (e.g. private mode) */
    }
  }, [presets]);

  // Sync when another tab/window — or another popover on the same page — changes the list.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SAVED_EXPORT_PRESETS_STORAGE_KEY) setPresets(readSavedExportPresets());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    savedPresets: presets,
    // Re-read so a popover reflects saves made by the other popover in the same page.
    refreshSavedPresets: () => setPresets(readSavedExportPresets()),
    saveExportPreset: (name: string, from: string, to: string): SavedExportPreset | null => {
      const trimmed = name.trim();
      if (!trimmed || (!from && !to)) return null;
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const preset: SavedExportPreset = { id, name: trimmed, from, to };
      setPresets((prev) => [...prev, preset]);
      return preset;
    },
    removeExportPreset: (id: string) =>
      setPresets((prev) => prev.filter((p) => p.id !== id)),
  };
}

// Saved-presets row + "name this range" control, shared by both export popovers.
function SavedExportPresetControls({
  savedPresets,
  activePreset,
  currentFrom,
  currentTo,
  onSelect,
  onRemove,
  onSave,
  testIdSuffix = "",
}: {
  savedPresets: SavedExportPreset[];
  activePreset: string | null;
  currentFrom: string;
  currentTo: string;
  onSelect: (from: string, to: string, key: string) => void;
  onRemove: (id: string) => void;
  onSave: (name: string) => void;
  testIdSuffix?: string;
}) {
  const [name, setName] = useState("");
  const suffix = testIdSuffix ? `-${testIdSuffix}` : "";
  const hasRange = Boolean(currentFrom || currentTo);
  const canSave = hasRange && name.trim().length > 0;

  if (savedPresets.length === 0 && !hasRange) return null;

  const commitSave = () => {
    if (!canSave) return;
    onSave(name.trim());
    setName("");
  };

  return (
    <div className="space-y-2 border-t border-border pt-2">
      {savedPresets.length > 0 && (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Saved ranges
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid={`saved-presets${suffix}`}>
            {savedPresets.map((p) => {
              const key = savedPresetKey(p.id);
              const isActive = activePreset === key;
              return (
                <span
                  key={p.id}
                  className={`group inline-flex items-center gap-1 text-[10px] font-semibold pl-2 pr-1 py-1 rounded-full border transition-colors ${
                    isActive
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-violet-200 bg-white text-violet-700"
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`saved-preset-${p.id}${suffix}`}
                    aria-pressed={isActive}
                    title={formatResolvedRange(p.from, p.to) || p.name}
                    className={isActive ? "hover:text-white" : "hover:text-violet-900"}
                    onClick={() => onSelect(p.from, p.to, key)}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    data-testid={`saved-preset-remove-${p.id}${suffix}`}
                    title="Remove saved range"
                    aria-label={`Remove ${p.name}`}
                    className={`rounded-full p-0.5 ${
                      isActive ? "hover:bg-violet-500" : "hover:bg-violet-100"
                    }`}
                    onClick={() => onRemove(p.id)}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </>
      )}
      {hasRange && (
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this range"
            data-testid={`save-preset-name${suffix}`}
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSave();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canSave}
            data-testid={`save-preset-confirm${suffix}`}
            className="h-7 text-[10px] px-2 shrink-0"
            onClick={commitSave}
          >
            <Star className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ClientTriggerEventsDashboard — cross-agent event view for ops ───────────
function ClientTriggerEventsDashboard({ clientId, streamStatus = "connecting" }: { clientId: number; streamStatus?: TriggerStreamStatus }) {
  const tabVisible = useDocumentVisible();
  const { toast } = useToast();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const search = useSearch();
  const [location, setLocation] = useLocation();
  const [filterAgent, setFilterAgent] = useState<string>(
    () => new URLSearchParams(search).get("filterAgent") || "all"
  );
  const [filterStatus, setFilterStatus] = useState<string>(
    () => new URLSearchParams(search).get("filterStatus") || "all"
  );
  const [filterKeyword, setFilterKeyword] = useState<string>(
    () => new URLSearchParams(search).get("filterKeyword") || ""
  );
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scopeBannerDismissed, setScopeBannerDismissed] = useState(false);
  const queryClient = useQueryClient();

  const [exportOpen, setExportOpen] = useState(false);
  const {
    exportFrom,
    exportTo,
    activePreset,
    refresh: refreshExportRange,
    setRange: setExportRange,
    setFrom: setExportFrom,
    setTo: setExportTo,
    clear: clearExportRange,
  } = usePersistentExportRange();
  const {
    savedPresets,
    refreshSavedPresets,
    saveExportPreset,
    removeExportPreset,
  } = useSavedExportPresets();

  // Snapshot the scope the dashboard *opened* with so a recipient of a shared,
  // filtered link sees a one-time summary banner. Captured once at mount so it
  // reflects the handoff, not later in-session filter tweaks.
  const initialScopeRef = useRef<{
    agent: string;
    status: string;
    keyword: string;
    dateRange: string | null;
  } | null>(null);
  if (initialScopeRef.current === null) {
    const sp = new URLSearchParams(search);
    // Date range is part of the shared scope only when present in the URL — never
    // sourced from the recipient's own localStorage export state.
    const urlDateFrom = sp.get("dateFrom") || "";
    const urlDateTo = sp.get("dateTo") || "";
    const urlDatePreset = sp.get("datePreset");
    initialScopeRef.current = {
      agent: sp.get("filterAgent") || "all",
      status: sp.get("filterStatus") || "all",
      keyword: (sp.get("filterKeyword") || "").trim(),
      dateRange: describeDateRange(urlDateFrom, urlDateTo, urlDatePreset),
    };
  }

  // When a shared link carries a date range, apply it to the (localStorage-backed)
  // export range once on mount so the opened view is genuinely date-scoped.
  const appliedUrlRangeRef = useRef(false);
  useEffect(() => {
    if (appliedUrlRangeRef.current) return;
    appliedUrlRangeRef.current = true;
    const sp = new URLSearchParams(search);
    const urlDateFrom = sp.get("dateFrom") || "";
    const urlDateTo = sp.get("dateTo") || "";
    const urlDatePreset = sp.get("datePreset");
    const matchedPreset = urlDatePreset
      ? EXPORT_DATE_PRESETS.find((p) => p.testId === urlDatePreset)
      : undefined;
    if (matchedPreset) {
      // Recompute the preset's rolling window so the export is actually scoped.
      const { from, to } = matchedPreset.getRange();
      setExportRange(from, to, matchedPreset.testId);
    } else if (urlDateFrom || urlDateTo) {
      setExportRange(urlDateFrom, urlDateTo, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filter selections in the URL so they survive navigation and can be shared.
  useEffect(() => {
    const sp = new URLSearchParams(search);
    if (filterAgent !== "all") sp.set("filterAgent", filterAgent);
    else sp.delete("filterAgent");
    if (filterStatus !== "all") sp.set("filterStatus", filterStatus);
    else sp.delete("filterStatus");
    if (filterKeyword.trim() !== "") sp.set("filterKeyword", filterKeyword);
    else sp.delete("filterKeyword");
    const nextSearch = sp.toString();
    const target = location + (nextSearch ? `?${nextSearch}` : "");
    const current = location + (search ? `?${search}` : "");
    if (target !== current) setLocation(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgent, filterStatus, filterKeyword]);

  const { data: events, isLoading, dataUpdatedAt, refetch } = useListClientTriggerEvents(clientId, {
    query: {
      queryKey: getListClientTriggerEventsQueryKey(clientId),
      refetchInterval: (query) => {
        if (!tabVisible) return false;
        const evs = query.state.data as any[] | undefined;
        if (evs?.some((e) => e.agentStatus === "triggered" || e.agentStatus === "running")) {
          return 4000;
        }
        return false;
      },
      refetchIntervalInBackground: false,
      retry: false,
    },
  });

  const isLive = events?.some((e) => e.agentStatus === "triggered" || e.agentStatus === "running") ?? false;

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const tick = () => setSecondsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        // Also refresh the per-assignment trigger panels (their keys are paths containing "trigger").
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey?.[0];
            return typeof key === "string" && key.includes("/trigger");
          },
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyViewLink = async () => {
    // Encode the active export date range into the shared link so the recipient's
    // view is genuinely date-scoped (filters are already kept in the URL).
    const sp = new URLSearchParams(window.location.search);
    sp.delete("dateFrom");
    sp.delete("dateTo");
    sp.delete("datePreset");
    // Only built-in (rolling) presets travel as a preset id the recipient can
    // resolve. Saved named ranges and custom ranges are absolute, so encode
    // their concrete dates — otherwise the recipient loses the date scope.
    const isBuiltInPreset =
      activePreset != null &&
      EXPORT_DATE_PRESETS.some((p) => p.testId === activePreset);
    if (isBuiltInPreset) {
      sp.set("datePreset", activePreset as string);
    } else {
      if (exportFrom) sp.set("dateFrom", exportFrom);
      if (exportTo) sp.set("dateTo", exportTo);
    }
    const qs = sp.toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        toast({ title: "Couldn't copy link", variant: "destructive" });
        document.body.removeChild(ta);
        return;
      }
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
    toast({
      title: "View link copied",
      description: "Paste it to share this filtered, date-scoped view.",
    });
  };

  const handleRowClick = (assignmentId: number) => {
    const el = document.getElementById(`trigger-row-${assignmentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(assignmentId);
      el.style.outline = "2px solid #6366f1";
      el.style.outlineOffset = "2px";
      setTimeout(() => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        setHighlightedId(null);
      }, 1800);
    }
  };

  const hasEvents = events && events.length > 0;

  const agentNames = hasEvents
    ? Array.from(new Set(events.map((ev) => ev.agentName).filter(Boolean)))
    : [];

  const keywordTrimmed = filterKeyword.trim().toLowerCase();
  const filteredEvents = hasEvents
    ? events.filter((ev) => {
        const agentMatch = filterAgent === "all" || ev.agentName === filterAgent;
        const statusMatch = filterStatus === "all" || ev.agentStatus === filterStatus;
        const keywordMatch =
          keywordTrimmed === "" ||
          (ev.payload ? JSON.stringify(ev.payload).toLowerCase().includes(keywordTrimmed) : false);
        return agentMatch && statusMatch && keywordMatch;
      })
    : [];

  const activeFilterCount =
    (filterAgent !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0) + (keywordTrimmed !== "" ? 1 : 0);

  // Summarize the scope the dashboard opened with, for the shared-link banner.
  const initialScope = initialScopeRef.current;
  const scopeBannerParts: { label: string; value: string }[] = [];
  if (initialScope) {
    if (initialScope.agent !== "all") scopeBannerParts.push({ label: "Agent", value: initialScope.agent });
    if (initialScope.status !== "all") {
      scopeBannerParts.push({
        label: "Status",
        value: TRIGGER_STATUS_META[initialScope.status]?.label ?? initialScope.status,
      });
    }
    if (initialScope.keyword !== "") scopeBannerParts.push({ label: "Keyword", value: `"${initialScope.keyword}"` });
    if (initialScope.dateRange) scopeBannerParts.push({ label: "Date range", value: initialScope.dateRange });
  }
  // Treat the view as "shared/scoped" when any filter OR date-range param was
  // present in the URL on load — a recipient's own persisted export range alone
  // (no URL params) shouldn't trigger it.
  const openedWithSharedScope =
    !!initialScope &&
    (initialScope.agent !== "all" ||
      initialScope.status !== "all" ||
      initialScope.keyword !== "" ||
      initialScope.dateRange !== null);
  const showScopeBanner = openedWithSharedScope && !scopeBannerDismissed && scopeBannerParts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-border card-shadow overflow-hidden"
    >
      {/* Section header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-muted/20">
        <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center shrink-0">
          <Activity className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            All Trigger Events
          </div>
        </div>
        {/* Stream connection indicator — tells ops whether real-time push is
            connected or temporarily relying on the slower polling fallback. */}
        {streamStatus === "live" ? (
          <span
            data-testid="stream-status"
            title="Real-time stream connected"
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200"
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-sky-500" />
            </span>
            Connected
          </span>
        ) : (
          <span
            data-testid="stream-status"
            title="Reconnecting — using polling fallback meanwhile"
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
          >
            <span className="animate-pulse relative inline-flex rounded-full w-1.5 h-1.5 bg-amber-500" />
            Reconnecting
          </span>
        )}
        {/* Live / last-updated indicator */}
        {isLive ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
            </span>
            Live
          </span>
        ) : dataUpdatedAt ? (
          <span className="text-[10px] text-muted-foreground">
            Updated {secondsAgo < 10 ? "just now" : `${secondsAgo}s ago`}
          </span>
        ) : null}
        {!isLive && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh now"
            data-testid="refresh-trigger-events"
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border bg-white text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing" : "Refresh now"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopyViewLink}
          title="Copy a shareable link to this filtered, date-scoped view"
          data-testid="copy-view-link"
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border bg-white text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          {linkCopied ? (
            <Check className="w-2.5 h-2.5 text-emerald-500" />
          ) : (
            <LinkIcon className="w-2.5 h-2.5" />
          )}
          {linkCopied ? "Copied" : "Copy link"}
        </button>
        {hasEvents && (
          <>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              {filteredEvents.length}{activeFilterCount > 0 ? ` / ${events.length}` : " recent"}
            </span>
            <Popover open={exportOpen} onOpenChange={(o) => { if (o) { refreshExportRange(); refreshSavedPresets(); } setExportOpen(o); }}>
              <PopoverTrigger asChild>
                <button
                  title="Export CSV"
                  data-testid="export-csv-trigger"
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 transition-colors"
                >
                  <Download className="w-2.5 h-2.5" />
                  Export CSV
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Export trigger events</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Pick a preset or date range, or leave blank to export all.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPORT_DATE_PRESETS.map((preset) => {
                      const isActive = activePreset === preset.testId;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          data-testid={`export-preset-${preset.testId}`}
                          aria-pressed={isActive}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                            isActive
                              ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-700"
                              : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                          }`}
                          onClick={() => {
                            const { from, to } = preset.getRange();
                            setExportRange(from, to, preset.testId);
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <SavedExportPresetControls
                    savedPresets={savedPresets}
                    activePreset={activePreset}
                    currentFrom={exportFrom}
                    currentTo={exportTo}
                    onSelect={(from, to, key) => setExportRange(from, to, key)}
                    onRemove={removeExportPreset}
                    onSave={(name) => saveExportPreset(name, exportFrom, exportTo)}
                  />
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        From
                      </span>
                      <Input
                        type="date"
                        value={exportFrom}
                        max={exportTo || undefined}
                        onChange={(e) => {
                          setExportFrom(e.target.value);
                        }}
                        className="h-8 text-xs mt-1"
                        data-testid="export-from-date"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        To
                      </span>
                      <Input
                        type="date"
                        value={exportTo}
                        min={exportFrom || undefined}
                        onChange={(e) => {
                          setExportTo(e.target.value);
                        }}
                        className="h-8 text-xs mt-1"
                        data-testid="export-to-date"
                      />
                    </label>
                  </div>
                  {activePreset && (exportFrom || exportTo) && (
                    <div className="text-[11px] text-muted-foreground" data-testid="export-resolved-range">
                      Exporting{" "}
                      <span className="font-semibold text-foreground">
                        {formatResolvedRange(exportFrom, exportTo)}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground" data-testid="export-range-count">
                    {(() => {
                      const count = countEventsInRange(events, exportFrom, exportTo);
                      const noun = count === 1 ? "event" : "events";
                      return exportFrom || exportTo ? (
                        <span>
                          <span className="font-semibold text-foreground">{count}</span> {noun} in this range
                        </span>
                      ) : (
                        <span>
                          All <span className="font-semibold text-foreground">{count}</span> {noun} will be exported
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      data-testid="export-csv-confirm"
                      onClick={() => {
                        exportEventsToCsv(events, { from: exportFrom, to: exportTo });
                        setExportOpen(false);
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    {(exportFrom || exportTo) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        data-testid="export-clear-range"
                        onClick={() => {
                          clearExportRange();
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* Shared-link scope banner — friendly heads-up that the view is scoped */}
      <AnimatePresence initial={false}>
        {showScopeBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            data-testid="scope-banner"
            className="overflow-hidden border-b border-violet-200 bg-violet-50"
          >
            <div className="flex items-start gap-2.5 px-5 py-2.5">
              <Filter className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-violet-900">
                  You're viewing a scoped, shared link
                </div>
                <div className="text-[11px] text-violet-700 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span>Filtered to</span>
                  {scopeBannerParts.map((part, i) => (
                    <span key={part.label} className="inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white border border-violet-200 px-1.5 py-0.5">
                        <span className="text-violet-500">{part.label}:</span>
                        <span className="font-medium text-violet-900">{part.value}</span>
                      </span>
                      {i < scopeBannerParts.length - 1 ? <span className="text-violet-400">·</span> : null}
                    </span>
                  ))}
                  <span className="text-violet-500">— counts reflect this scope.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScopeBannerDismissed(true)}
                title="Dismiss"
                data-testid="dismiss-scope-banner"
                className="shrink-0 rounded-md p-0.5 text-violet-500 hover:text-violet-800 hover:bg-violet-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter bar */}
      {hasEvents && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-muted/10 flex-wrap">
          <Input
            type="text"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            placeholder="Search payloads…"
            className="h-7 text-[11px] rounded-lg w-[180px] border-border"
            data-testid="filter-keyword-input"
          />

          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger
              className="h-7 text-[11px] rounded-lg max-w-[180px] border-border"
              data-testid="filter-agent-select"
            >
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agentNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger
              className="h-7 text-[11px] rounded-lg w-[130px] border-border"
              data-testid="filter-status-select"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(TRIGGER_STATUS_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: meta.dot }} />
                    {meta.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterAgent("all"); setFilterStatus("all"); setFilterKeyword(""); }}
              className="text-[11px] text-violet-600 hover:text-violet-700 font-medium transition-colors"
              data-testid="clear-filters-btn"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="px-5 py-3">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !hasEvents && (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Activity className="w-7 h-7 text-muted-foreground/30" />
            <div className="text-[12px] text-center">No trigger events yet.<br />Fire a test webhook to see activity here.</div>
          </div>
        )}

        {hasEvents && filteredEvents.length === 0 && (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Activity className="w-7 h-7 text-muted-foreground/30" />
            <div className="text-[12px] text-center">No events match the current filters.</div>
          </div>
        )}

        {hasEvents && filteredEvents.length > 0 && (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-0.5">
            {filteredEvents.map((ev) => {
              const evMeta = TRIGGER_STATUS_META[ev.agentStatus] ?? TRIGGER_STATUS_META.idle;
              const payloadStr = ev.payload ? JSON.stringify(ev.payload) : null;
              return (
                <button
                  key={ev.id}
                  data-testid={`client-trigger-event-${ev.id}`}
                  onClick={() => handleRowClick(ev.assignmentId)}
                  className="w-full text-left rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-start gap-2.5 hover:bg-violet-50 hover:border-violet-200 transition-colors group"
                >
                  {/* Status badge */}
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5"
                    style={{ background: evMeta.bg, color: evMeta.text, borderColor: evMeta.dot + "44" }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: evMeta.dot }} />
                    {evMeta.label}
                  </span>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold text-foreground truncate">{ev.agentName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        · {new Date(ev.firedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
                      </span>
                    </div>
                    {payloadStr && (
                      <code className="block text-[10px] font-mono text-foreground/50 truncate mt-0.5">
                        {renderPayloadSnippet(payloadStr, filterKeyword)}
                      </code>
                    )}
                  </div>
                  {/* Hint arrow */}
                  <span className="text-muted-foreground/40 group-hover:text-violet-400 transition-colors shrink-0 mt-0.5 text-[10px]">↗</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatThresholdHistoryDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── TriggersSection — client-level triggers area with dedup stats ────────────
function TriggersSection({ clientId, assignments }: { clientId: number; assignments: any[] }) {
  const { data: triggerStats } = useGetClientTriggerStats(clientId, {
    query: {
      queryKey: getGetClientTriggerStatsQueryKey(clientId),
      retry: false,
      staleTime: 60_000,
    },
  });

  const { data: thresholdData } = useGetDedupWarnThreshold({
    query: {
      queryKey: getGetDedupWarnThresholdQueryKey(),
      staleTime: 30_000,
    },
  });

  const { data: thresholdHistory } = useGetDedupWarnThresholdHistory({
    query: {
      queryKey: getGetDedupWarnThresholdHistoryQueryKey(),
      staleTime: 30_000,
    },
  });

  const [showHistory, setShowHistory] = useState(false);

  const currentThreshold = thresholdData?.threshold ?? triggerStats?.warnThreshold ?? 10;
  const windowHours = triggerStats?.windowHours ?? 168;
  const windowUnit = triggerStats?.windowUnit ?? "days";
  const breakdownUnit = triggerStats?.breakdownUnit ?? "day";

  const dedupByAssignment = new Map<number, number>(
    (triggerStats?.perAssignment ?? []).map((r) => [r.assignmentId, r.deduplicated]),
  );
  const highDedupByAssignment = new Map<number, boolean>(
    (triggerStats?.perAssignment ?? []).map((r) => [r.assignmentId, r.highDedupRate ?? false]),
  );

  const hasAnyHighDedupRate = triggerStats?.perAssignment?.some((r) => r.highDedupRate) ?? false;

  const dailyByAssignment = new Map<number, { date: string; count: number }[]>(
    (triggerStats?.perAssignment ?? []).map((r) => [r.assignmentId, r.dailyBreakdown ?? []]),
  );

  const globalDailyBreakdown = triggerStats?.dailyBreakdown ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
          Webhook Triggers
        </div>
          {hasAnyHighDedupRate && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700">
              <AlertTriangle className="w-2.5 h-2.5" />
              High duplicate rate detected
            </span>
          )}
          {triggerStats && triggerStats.totalDeduplicated > 0 && (
            <span className="flex items-center gap-2 text-[10.5px] font-semibold px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-500">
              <Filter className="w-2.5 h-2.5 shrink-0" />
              <span>{triggerStats.totalDeduplicated} duplicate{triggerStats.totalDeduplicated !== 1 ? "s" : ""} suppressed · {formatWindowShort(windowHours, windowUnit)}</span>
              {globalDailyBreakdown.length > 0 && (
                <DedupSparkline days={globalDailyBreakdown} breakdownUnit={breakdownUnit} />
              )}
            </span>
          )}
      </div>

      {/* ── Dedup warn-threshold (global setting — read-only context) ── */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <Settings2 className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground flex-1">
          Warn when duplicates ≥ <span className="font-semibold text-foreground">{currentThreshold} events / {formatWindowShort(windowHours, windowUnit)}</span>
          <span className="text-muted-foreground/70"> · applies to all clients</span>
        </span>
        <Link
          href="/settings"
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          title="Manage in Platform Settings"
        >
          <span>Manage in Settings</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      </div>

      {/* ── Threshold change history ── */}
      {(thresholdHistory?.history?.length ?? 0) > 0 && (
        <div className="mb-4 -mt-2">
          <button
            className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="w-3 h-3" />
            <span>
              {showHistory ? "Hide" : "Show"} change history ({thresholdHistory!.history.length})
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {showHistory && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden mt-2 space-y-1.5 pl-1"
              >
                {thresholdHistory!.history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      {h.oldValue !== null && h.oldValue !== undefined ? (
                        <>
                          <span>{h.oldValue}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                          <span>{h.newValue}</span>
                        </>
                      ) : (
                        <span>Set to {h.newValue}</span>
                      )}
                    </span>
                    <span className="flex-1" />
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatThresholdHistoryDate(h.changedAt)}
                    </span>
                    <span className="text-muted-foreground/70">· {h.changedBy}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((assignment) => (
          <TriggerRow
            key={assignment.id}
            assignment={assignment}
            dedupCount={dedupByAssignment.get(assignment.id) ?? 0}
            highDedupRate={highDedupByAssignment.get(assignment.id) ?? false}
            dedupDailyBreakdown={dailyByAssignment.get(assignment.id)}
            dedupBreakdownUnit={breakdownUnit}
            windowHours={windowHours}
            windowUnit={windowUnit}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Guardrails per-assignment panel ─────────────────────────────────────────
const GUARDRAIL_DEFS = [
  {
    type: "prompt_injection_direct",
    label: "הזרקת פרומט ישירה",
    desc: 'זיהוי ניסיונות לדרוס הוראות הסוכן: "ignore instructions", "you are now", "DAN mode" וכד׳.',
    icon: ShieldAlert,
    color: "text-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    hasConfig: false,
  },
  {
    type: "prompt_injection_hidden",
    label: "הזרקת פרומט מוסתרת",
    desc: "זיהוי הזרקה מוסתרת: base64 מקודד, תווי Unicode נסתרים (zero-width), ו-homoglyphs.",
    icon: EyeOff,
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    hasConfig: false,
  },
  {
    type: "jailbreak_detection",
    label: "זיהוי Jailbreak",
    desc: 'זיהוי דפוסי עקיפה: "hypothetically speaking", "sudo mode", "training mode" וכד׳.',
    icon: Shield,
    color: "text-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    hasConfig: false,
  },
  {
    type: "input_keyword_block",
    label: "חסימת מילות מפתח — קלט",
    desc: "חוסם הודעות משתמש המכילות מילות מפתח אסורות. הגדר רשימה מופרדת בפסיקים.",
    icon: X,
    color: "text-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
    hasConfig: true,
    configLabel: "מילות מפתח אסורות בקלט",
    configPlaceholder: "כסף, העברה, פריצה, ...",
    configKey: "keywords" as const,
  },
  {
    type: "output_keyword_block",
    label: "חסימת מילות מפתח — פלט",
    desc: "מסנן או חוסם תשובות הסוכן המכילות מילים אסורות. ניתן לבחור: חסום או הסתר.",
    icon: Filter,
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    hasConfig: true,
    configLabel: "מילות מפתח אסורות בפלט",
    configPlaceholder: "סיסמה, מפתח, ...",
    configKey: "keywords" as const,
  },
  {
    type: "topic_scope",
    label: "הגבלת נושאים",
    desc: "הסוכן יענה אך ורק על נושאים שתגדיר. כל שאלה מחוץ לתחום תיחסם בנימוס.",
    icon: ShieldCheck,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    hasConfig: true,
    configLabel: "נושאים מורשים (מופרדים בפסיקים)",
    configPlaceholder: "שכר, חופשה, תלושים, ...",
    configKey: "topics" as const,
  },
  {
    type: "pii_masking",
    label: "מיסוך מידע אישי (PII)",
    desc: "מסתיר אוטומטית מספרי ת.ז., טלפונים, אימיילים ומספרי כרטיסי אשראי בתשובות הסוכן.",
    icon: Eye,
    color: "text-teal-500",
    bg: "bg-teal-50",
    border: "border-teal-200",
    hasConfig: false,
  },
  {
    type: "max_input_length",
    label: "הגבלת אורך קלט",
    desc: "חוסם הודעות משתמש ארוכות מהגבול שתגדיר (תווים). מגן מפני prompt stuffing.",
    icon: Settings2,
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    hasConfig: true,
    configLabel: "מקסימום תווים",
    configPlaceholder: "2000",
    configKey: "maxLength" as const,
    isNumber: true,
  },
] as const;

type GuardrailType = (typeof GUARDRAIL_DEFS)[number]["type"];

interface GuardrailRule {
  id: string;
  type: GuardrailType;
  enabled: boolean;
  config: { keywords?: string[]; topics?: string[]; maxLength?: number; action?: "block" | "redact" };
}

function GuardrailsPanel({ assignment }: { assignment: any }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<GuardrailRule[]>([]);
  const [loaded, setLoaded] = useState(false);

  const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  async function load() {
    try {
      const r = await fetch(`${API}/api/assignments/${assignment.id}/guardrails`);
      if (r.ok) {
        const data = await r.json();
        setRules(data.rules ?? []);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }

  function toggleOpen() {
    if (!open && !loaded) load();
    setOpen((v) => !v);
  }

  function getRule(type: GuardrailType): GuardrailRule | undefined {
    return rules.find((r) => r.type === type);
  }

  function setEnabled(type: GuardrailType, enabled: boolean) {
    setRules((prev) => {
      const existing = prev.find((r) => r.type === type);
      if (existing) return prev.map((r) => r.type === type ? { ...r, enabled } : r);
      return [...prev, { id: `${type}-${Date.now()}`, type, enabled, config: {} }];
    });
  }

  function setConfigValue(type: GuardrailType, key: "keywords" | "topics", rawValue: string) {
    const arr = rawValue.split(",").map((s) => s.trim()).filter(Boolean);
    setRules((prev) => {
      const existing = prev.find((r) => r.type === type);
      if (existing) return prev.map((r) => r.type === type ? { ...r, config: { ...r.config, [key]: arr } } : r);
      return [...prev, { id: `${type}-${Date.now()}`, type, enabled: true, config: { [key]: arr } }];
    });
  }

  function setConfigNumber(type: GuardrailType, value: number) {
    setRules((prev) => {
      const existing = prev.find((r) => r.type === type);
      if (existing) return prev.map((r) => r.type === type ? { ...r, config: { ...r.config, maxLength: value } } : r);
      return [...prev, { id: `${type}-${Date.now()}`, type, enabled: true, config: { maxLength: value } }];
    });
  }

  function setAction(type: GuardrailType, action: "block" | "redact") {
    setRules((prev) => {
      const existing = prev.find((r) => r.type === type);
      if (existing) return prev.map((r) => r.type === type ? { ...r, config: { ...r.config, action } } : r);
      return [...prev, { id: `${type}-${Date.now()}`, type, enabled: true, config: { action } }];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const activeRules = rules.filter((r) => r.enabled || GUARDRAIL_DEFS.find((d) => d.type === r.type));
      const r = await fetch(`${API}/api/assignments/${assignment.id}/guardrails`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: activeRules }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Guardrails saved", description: `${activeRules.filter((r) => r.enabled).length} active rules on ${assignment.agent?.name}` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const activeCount = rules.filter((r) => r.enabled).length;
  const agentName = assignment.agent?.name ?? "Agent";

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
          <Shield className="w-3.5 h-3.5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">Guardrails</span>
            <span className="text-[10px] text-muted-foreground font-medium truncate">— {agentName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700">
              <ShieldCheck className="w-3 h-3" />
              {activeCount} active
            </span>
          )}
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
              {!loaded ? (
                <div className="text-[12px] text-muted-foreground py-4 text-center">טוען...</div>
              ) : (
                <>
                  {GUARDRAIL_DEFS.map((def) => {
                    const rule = getRule(def.type as GuardrailType);
                    const isEnabled = rule?.enabled ?? false;
                    const IconComp = def.icon;

                    return (
                      <div
                        key={def.type}
                        className={`rounded-lg border p-3 transition-colors ${isEnabled ? `${def.bg} ${def.border}` : "bg-muted/20 border-border"}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isEnabled ? def.bg : "bg-muted"}`}>
                            <IconComp className={`w-3 h-3 ${isEnabled ? def.color : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[12px] font-semibold ${isEnabled ? "text-foreground" : "text-muted-foreground"}`}>
                                {def.label}
                              </span>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(v) => setEnabled(def.type as GuardrailType, v)}
                                className="scale-75 shrink-0"
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{def.desc}</p>

                            {isEnabled && "hasConfig" in def && def.hasConfig && (
                              <div className="mt-2 space-y-1">
                                <label className="text-[11px] font-medium text-foreground">{def.configLabel}</label>
                                {"isNumber" in def && def.isNumber ? (
                                  <Input
                                    type="number"
                                    min={100}
                                    max={10000}
                                    value={rule?.config?.maxLength ?? 2000}
                                    onChange={(e) => setConfigNumber(def.type as GuardrailType, parseInt(e.target.value) || 2000)}
                                    className="h-7 text-[12px] rounded-md w-32"
                                  />
                                ) : (
                                  <textarea
                                    rows={2}
                                    placeholder={def.configPlaceholder}
                                    value={
                                      def.configKey === "topics"
                                        ? (rule?.config?.topics ?? []).join(", ")
                                        : (rule?.config?.keywords ?? []).join(", ")
                                    }
                                    onChange={(e) => setConfigValue(def.type as GuardrailType, def.configKey as "keywords" | "topics", e.target.value)}
                                    className="w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                )}
                                {def.type === "output_keyword_block" && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <label className="text-[11px] text-muted-foreground">פעולה:</label>
                                    <button
                                      onClick={() => setAction("output_keyword_block", "redact")}
                                      className={`text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${(rule?.config?.action ?? "redact") === "redact" ? "bg-blue-100 border-blue-300 text-blue-700 font-semibold" : "border-border text-muted-foreground"}`}
                                    >
                                      הסתר (***) 
                                    </button>
                                    <button
                                      onClick={() => setAction("output_keyword_block", "block")}
                                      className={`text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${rule?.config?.action === "block" ? "bg-red-100 border-red-300 text-red-700 font-semibold" : "border-border text-muted-foreground"}`}
                                    >
                                      חסום לחלוטין
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={save}
                      disabled={saving}
                      className="gap-1.5 text-xs rounded-lg h-8"
                    >
                      <Save className="w-3 h-3" />
                      {saving ? "שומר..." : "שמור Guardrails"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GuardrailsSection — all assignments' guardrail panels ───────────────────
function GuardrailsSection({ assignments }: { assignments: any[] }) {
  return (
    <div className="bg-white rounded-xl border border-border card-shadow p-5">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-purple-600" />
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
          Guardrails
        </div>
        <span className="text-[10.5px] text-muted-foreground">שכבות הגנה לכל שיוך</span>
      </div>
      <div className="space-y-2">
        {assignments.map((a) => (
          <GuardrailsPanel key={a.id} assignment={a} />
        ))}
      </div>
    </div>
  );
}

// ─── WhatsApp per-assignment config panel ────────────────────────────────────
function WhatsAppAssignmentConfig({ assignment }: { assignment: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen]               = useState(false);
  const [saving, setSaving]           = useState(false);
  const [sending, setSending]         = useState(false);

  // Parse existing customization
  const existing = (() => {
    try { return assignment.customization ? JSON.parse(assignment.customization) : {}; }
    catch { return {}; }
  })();

  const [toPhone, setToPhone]               = useState<string>(existing.toPhone ?? "");
  const [sheetUrl, setSheetUrl]             = useState<string>(existing.sheetUrl ?? "");
  const [sendHour, setSendHour]             = useState<number>(existing.sendHour ?? 8);
  const [guestMsgs, setGuestMsgs]           = useState<boolean>(existing.guestMessagesEnabled ?? false);
  const [enabled, setEnabled]               = useState<boolean>(existing.enabled !== false);

  async function save() {
    setSaving(true);
    try {
      const config = { toPhone: toPhone.replace(/\D/g, ""), sheetUrl, sendHour, guestMessagesEnabled: guestMsgs, enabled };
      const res = await fetch(`${API_BASE}/api/clients/${assignment.clientId}/assignments/${assignment.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customization: JSON.stringify(config) }),
      });
      if (res.ok) {
        toast({ title: "✅ הגדרות WhatsApp נשמרו" });
        queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(assignment.clientId) });
        setOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "שגיאה בשמירה", description: (err as any).error, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send-assignment/${assignment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json();
      if (d.ok) {
        const r = d.result;
        toast({
          title: "📱 הדוח נשלח!",
          description: `סיכום: ${r.ownerSummary ? "✅" : "❌"} · כניסות: ${r.arrivalsSent} · יציאות: ${r.departuresSent}`,
        });
      } else {
        toast({ title: "שגיאה בשליחה", description: d.error, variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  }

  const isConfigured = !!toPhone && !!sheetUrl;

  return (
    <div className="border-t border-border bg-green-50/40 px-4 py-2.5">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-[11.5px] font-semibold text-green-700 hover:text-green-800 transition-colors"
      >
        <span className="text-base">📱</span>
        <span>הגדרות WhatsApp יומי</span>
        {isConfigured
          ? <span className="ml-auto text-[10px] font-medium bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">מוגדר ✓</span>
          : <span className="ml-auto text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">דרושה הגדרה</span>
        }
        <ChevronDown className={`w-3.5 h-3.5 text-green-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div dir="rtl" className="pt-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-muted-foreground w-28 shrink-0">מספר הבעלים</span>
                <Input
                  type="tel" dir="ltr"
                  placeholder="972501234567"
                  value={toPhone}
                  onChange={e => setToPhone(e.target.value)}
                  className="h-7 flex-1 text-[12px] px-2 py-0 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-muted-foreground w-28 shrink-0">Google Sheet URL</span>
                <Input
                  type="url" dir="ltr"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  className="h-7 flex-1 text-[12px] px-2 py-0 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-muted-foreground w-28 shrink-0">שעת שליחה</span>
                <Input
                  type="number" min={0} max={23}
                  value={sendHour}
                  onChange={e => setSendHour(Number(e.target.value))}
                  className="h-7 w-16 text-[12px] px-2 py-0"
                />
                <span className="text-[11px] text-muted-foreground">שעון ישראל</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-muted-foreground w-28 shrink-0">פעיל</span>
                <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="הפעל שליחה" />
                <span className={`text-[11px] font-medium ${enabled ? "text-green-600" : "text-muted-foreground"}`}>{enabled ? "כן" : "לא"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-muted-foreground w-28 shrink-0">הודעות לאורחים</span>
                <Switch checked={guestMsgs} onCheckedChange={setGuestMsgs} aria-label="הודעות לאורחים" />
                <span className="text-[11px] text-amber-600 font-medium">{guestMsgs ? "פעיל" : "כבוי"}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1 h-7 px-3 text-[11.5px] font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60"
                >
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  שמור
                </button>
                <button
                  onClick={sendNow}
                  disabled={sending || !isConfigured}
                  title={!isConfigured ? "הגדר מספר טלפון ו-URL קודם" : "שלח דוח היום עכשיו"}
                  className="flex items-center gap-1 h-7 px-3 text-[11.5px] font-semibold bg-white border border-green-300 hover:bg-green-50 text-green-700 rounded-lg transition-colors disabled:opacity-40"
                >
                  {sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  שלח עכשיו
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentDeployCard({ assignment, onRemove, index, triggerStatus }: { assignment: any; onRemove: (agentId: number) => void; index: number; triggerStatus?: string }) {
  const agent = assignment.agent;
  if (!agent) return null;
  const meta = CATEGORY_META[agent.category] || DEFAULT_META;
  const ts = triggerStatus ? TRIGGER_STATUS_META[triggerStatus] : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, transition: { duration: 0.12 } }}
      className="group bg-white rounded-xl border border-border card-shadow overflow-hidden"
      style={{ borderTop: `2.5px solid ${meta.color}` }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <AgentIcon agent={agent} size="sm" />
            <div>
              <div className="font-semibold text-[13px] text-foreground">{agent.name}</div>
              <span
                className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full border inline-block mt-0.5"
                style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
              >
                {agent.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/clients/${assignment.clientId}/chat/${agent.id}`}>
              <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition-colors" title="פתח שיחה">
                <MessageSquare className="w-3 h-3" />
              </button>
            </Link>
            <Link href={`/agents/${agent.id}`}>
              <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ExternalLink className="w-3 h-3" />
              </button>
            </Link>
            <button
              onClick={() => onRemove(agent.id)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{agent.description}</p>

        {agent.capabilities?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 2).map((cap: string) => (
              <span key={cap} className="text-[10.5px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {cap}
              </span>
            ))}
            {agent.capabilities.length > 2 && (
              <span className="text-[10.5px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                +{agent.capabilities.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {ts ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: ts.dot }} />
              <span className="text-[11px] font-medium" style={{ color: ts.text }}>{ts.label}</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-medium text-muted-foreground">Deployed</span>
            </>
          )}
        </div>
        <Link href={`/clients/${assignment.clientId}/chat/${agent.id}`}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            שוחח
          </motion.button>
        </Link>
      </div>
      {(agent.tags as string[] | undefined)?.includes("whatsapp-daily") && (
        <WhatsAppAssignmentConfig assignment={assignment} />
      )}
    </motion.div>
  );
}

// Wrapper that polls trigger status and injects it into AgentDeployCard
function AgentDeployCardWithTrigger({ assignment, onRemove, index }: { assignment: any; onRemove: (agentId: number) => void; index: number }) {
  const tabVisible = useDocumentVisible();
  const { data: trigger } = useGetAssignmentTrigger(assignment.id, {
    query: {
      queryKey: getGetAssignmentTriggerQueryKey(assignment.id),
      retry: false,
      refetchInterval: (q) => {
        if (!tabVisible) return false;
        const status = (q.state.data as any)?.status;
        if (status === "triggered" || status === "running") return 5000;
        return false;
      },
      refetchIntervalInBackground: false,
    },
  });
  return <AgentDeployCard assignment={assignment} onRemove={onRemove} index={index} triggerStatus={trigger?.status} />;
}

function SpecDraftSection({ client }: { client: any }) {
  const [expanded, setExpanded] = useState(true);

  let spec: { n8nWorkflow?: { name?: string; nodes?: any[] }; recommendedAgentId?: number; reasoning?: string } | null = null;
  try { spec = client.rawSpec ? JSON.parse(client.rawSpec) : null; } catch {}

  const workflowName = spec?.n8nWorkflow?.name ?? client.name;
  const nodeCount    = spec?.n8nWorkflow?.nodes?.length ?? 0;
  const agentId      = spec?.recommendedAgentId;
  const reasoning    = spec?.reasoning;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-violet-300 card-shadow overflow-hidden"
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b border-violet-100"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-violet-200 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-violet-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-violet-900">איפיון מסוכן הטלגרם</div>
          <div className="text-[11px] text-violet-500 mt-0.5">ממתין לאישורך · טיוטה</div>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
          ממתין לאישור
        </span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="text-violet-400 ml-1">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="m18 15-6-6-6 6" />
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="divide-y divide-border"
          >
            {/* Workflow summary */}
            {workflowName && (
              <div className="px-5 py-4 flex gap-6">
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">שם הוורקפלו</div>
                  <div className="text-[13px] font-semibold text-foreground">{workflowName}</div>
                </div>
                {nodeCount > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">צמתים</div>
                    <div className="text-[13px] font-semibold text-foreground">{nodeCount}</div>
                  </div>
                )}
                {agentId && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">סוכן מומלץ</div>
                    <div className="text-[13px] font-semibold text-violet-700">#{agentId}</div>
                  </div>
                )}
              </div>
            )}

            {/* Reasoning */}
            {reasoning && (
              <div className="px-5 py-4 bg-violet-50/40">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">נימוק הסוכן</div>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">{reasoning}</p>
              </div>
            )}

            {/* Notes from DB */}
            {client.notes && (
              <div className="px-5 py-3 bg-muted/20">
                <p className="text-[11.5px] text-muted-foreground">{client.notes}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AnalysisSection({ client }: { client: any }) {
  const [expanded, setExpanded] = useState(true);

  if (!client.source || client.source === "manual") return null;
  if (client.source === "telegram-spec") return <SpecDraftSection client={client} />;
  if (!client.rawSpec && !client.analysisDoc) return null;

  const status = client.analysisStatus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-violet-200 card-shadow overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          {status === "analyzing" ? (
            <RefreshCw className="w-4 h-4 text-violet-600 animate-spin" />
          ) : status === "error" ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <Sparkles className="w-4 h-4 text-violet-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-violet-900">ניתוח עסקי AI</div>
          <div className="text-[11px] text-violet-600 mt-0.5 flex items-center gap-2">
            <Send className="w-3 h-3" />
            נוצר מהודעת טלגרם
            {status === "analyzing" && <span className="text-amber-600 font-medium">· מנתח...</span>}
            {status === "ready" && <span className="text-emerald-600 font-medium">· מוכן</span>}
            {status === "error" && <span className="text-red-600 font-medium">· שגיאה</span>}
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="text-violet-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="m18 15-6-6-6 6" />
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {/* Raw spec */}
            {client.rawSpec && (
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">הודעה מקורית מטלגרם</div>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
                  {(() => {
                    const t = client.rawSpec as string;
                    const si = t.indexOf("<<<SPEC_OUTPUT_START>>>");
                    if (si !== -1) return t.slice(0, si).trim();
                    const ei = t.indexOf("<<<SPEC_OUTPUT_END>>>");
                    if (ei !== -1) {
                      const before = t.slice(0, ei);
                      const lj = before.lastIndexOf("\n{");
                      return (lj !== -1 ? before.slice(0, lj) : before).trim();
                    }
                    return t;
                  })()}
                </p>
              </div>
            )}

            {/* Analysis doc */}
            {status === "analyzing" && (
              <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
                <div className="text-sm font-medium">מנתח את הבעיה העסקית...</div>
                <div className="text-xs text-muted-foreground/70">ינותח על ידי Ollama / Groq / GPT לפי תצורת המודל</div>
              </div>
            )}

            {status === "ready" && client.analysisDoc && (
              <div className="p-5">
                <div
                  className="prose prose-sm max-w-none text-foreground
                    prose-headings:font-bold prose-headings:text-foreground prose-headings:mt-5 prose-headings:mb-2
                    prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                    prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-muted-foreground
                    prose-li:text-[13px] prose-li:text-muted-foreground
                    prose-strong:text-foreground prose-strong:font-semibold
                    prose-code:text-[11px] prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                    prose-table:text-[12px] prose-table:border-collapse
                    prose-th:bg-muted prose-th:font-semibold prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:border prose-th:border-border
                    prose-td:px-3 prose-td:py-1.5 prose-td:border prose-td:border-border
                    prose-blockquote:border-l-violet-300 prose-blockquote:bg-violet-50/50 prose-blockquote:text-violet-800
                    prose-hr:border-border"
                  dir="rtl"
                >
                  <ReactMarkdown>{client.analysisDoc}</ReactMarkdown>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="p-6 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <div className="text-sm font-medium text-red-700">הניתוח נכשל</div>
                <div className="text-xs text-muted-foreground">
                  ודא ש-Ollama פועל מקומית (OLLAMA_BASE_URL) או הגדר GROQ_API_KEY
                </div>
              </div>
            )}

            {status === "pending" && (
              <div className="p-6 flex flex-col items-center gap-3 text-center">
                <RefreshCw className="w-6 h-6 text-amber-400" />
                <div className="text-sm font-medium text-amber-700">ממתין לניתוח</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Automation Control Panel ────────────────────────────────────────────────

function ReasonDialog({
  agentName,
  onConfirm,
  onCancel,
}: {
  agentName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <PowerOff className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">כיבוי אוטומציה</div>
            <div className="text-[11px] text-muted-foreground">{agentName}</div>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">
            סיבת הכיבוי (אופציונלי)
          </label>
          <textarea
            className="w-full text-[12.5px] border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-muted/20"
            rows={3}
            placeholder="לדוג׳: שגיאות חוזרות בשליחת מיילים, בקשת לקוח..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 rounded-lg h-8 text-xs" onClick={onCancel}>
            ביטול
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-lg h-8 text-xs bg-red-500 hover:bg-red-600 text-white border-0"
            onClick={() => onConfirm(reason)}
          >
            <PowerOff className="w-3 h-3 mr-1" />
            כבה אוטומציה
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function MasterKillDialog({
  clientName,
  count,
  onConfirm,
  onCancel,
}: {
  clientName: string;
  count: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-sm mx-4 p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <ShieldOff className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-red-700">Master Kill Switch</div>
            <div className="text-[11px] text-muted-foreground">{clientName} · {count} אוטומציות פעילות</div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-[12px] text-red-700">
          פעולה זו תכבה את <strong>כל</strong> האוטומציות ללקוח זה. ניתן להפעיל מחדש בנפרד.
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">
            סיבה (אופציונלי)
          </label>
          <textarea
            className="w-full text-[12.5px] border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 bg-muted/20"
            rows={2}
            placeholder="לדוג׳: דיווח על תקלה, בקשת לקוח..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 rounded-lg h-8 text-xs" onClick={onCancel}>
            ביטול
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-lg h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0 gap-1.5"
            onClick={() => onConfirm(reason)}
          >
            <ShieldOff className="w-3 h-3" />
            כבה הכל
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

const ACTION_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  enabled:      { label: "הופעל",       bg: "#ecfdf5", text: "#065f46", dot: "#10b981" },
  disabled:     { label: "כובה",        bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  disabled_all: { label: "Kill All",    bg: "#fef2f2", text: "#7f1d1d", dot: "#dc2626" },
};

function AutomationPanel({ clientId, assignments, clientName }: { clientId: number; assignments: any[]; clientName: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [disableTarget, setDisableTarget] = useState<{ id: number; name: string } | null>(null);
  const [masterKillOpen, setMasterKillOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  const toggleMutation = useToggleAutomation();
  const killAllMutation = useDisableAllAutomations();
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useListAutomationLogs(clientId, {
    query: { queryKey: getListAutomationLogsQueryKey(clientId), enabled: logsOpen },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(clientId) });
    queryClient.invalidateQueries({ queryKey: getListAutomationLogsQueryKey(clientId) });
  };

  const handleToggle = (assignment: any, forceEnable = false) => {
    if (!forceEnable && assignment.automationEnabled) {
      setDisableTarget({ id: assignment.id, name: assignment.agent?.name ?? "Agent" });
      return;
    }
    toggleMutation.mutate(
      { id: assignment.id, data: { enabled: true, disabledBy: "Ops Admin" } },
      {
        onSuccess: () => { invalidate(); toast({ title: `✅ אוטומציה הופעלה — ${assignment.agent?.name}` }); },
        onError: () => toast({ title: "שגיאה", variant: "destructive" }),
      }
    );
  };

  const confirmDisable = (reason: string) => {
    if (!disableTarget) return;
    toggleMutation.mutate(
      { id: disableTarget.id, data: { enabled: false, disabledBy: "Ops Admin", reason: reason || undefined } },
      {
        onSuccess: () => {
          invalidate();
          setDisableTarget(null);
          toast({ title: `🔴 אוטומציה כובתה — ${disableTarget.name}` });
        },
        onError: () => toast({ title: "שגיאה", variant: "destructive" }),
      }
    );
  };

  const confirmKillAll = (reason: string) => {
    killAllMutation.mutate(
      { id: clientId, data: { disabledBy: "Ops Admin", reason: reason || undefined } },
      {
        onSuccess: (data) => {
          invalidate();
          setMasterKillOpen(false);
          toast({ title: `🔴 Master Kill — ${(data as any).disabled} אוטומציות כובו` });
        },
        onError: () => toast({ title: "שגיאה", variant: "destructive" }),
      }
    );
  };

  const activeCount = assignments.filter((a) => a.automationEnabled).length;
  const totalCount = assignments.length;

  return (
    <>
      {disableTarget && (
        <ReasonDialog
          agentName={disableTarget.name}
          onConfirm={confirmDisable}
          onCancel={() => setDisableTarget(null)}
        />
      )}
      {masterKillOpen && (
        <MasterKillDialog
          clientName={clientName}
          count={activeCount}
          onConfirm={confirmKillAll}
          onCancel={() => setMasterKillOpen(false)}
        />
      )}

      <div className="bg-white rounded-xl border border-border card-shadow overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
          <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
            <Power className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Automation Control
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            activeCount === totalCount
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : activeCount === 0
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {activeCount}/{totalCount} פעיל
          </span>
          {activeCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-[11px] rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              onClick={() => setMasterKillOpen(true)}
              disabled={killAllMutation.isPending}
            >
              <ShieldOff className="w-3 h-3" />
              Kill All
            </Button>
          )}
        </div>

        {/* Per-assignment rows */}
        <div className="divide-y divide-border">
          {assignments.map((assignment) => {
            const agent = assignment.agent;
            const enabled = assignment.automationEnabled;
            const meta = CATEGORY_META[agent?.category] || DEFAULT_META;
            return (
              <div key={assignment.id} className="flex items-center gap-3 px-5 py-3">
                {/* Agent icon + name */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{ background: meta.bg }}
                >
                  <span className="leading-none">{agent?.iconEmoji || "🤖"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-foreground truncate">{agent?.name}</div>
                  <div className="text-[10.5px] text-muted-foreground">{agent?.category}</div>
                </div>

                {/* Bypass indicator */}
                {!enabled && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
                    <SkipForward className="w-2.5 h-2.5" />
                    Bypassed
                  </span>
                )}

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(assignment, !enabled)}
                  disabled={toggleMutation.isPending}
                  className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    enabled
                      ? "bg-emerald-500 focus:ring-emerald-300"
                      : "bg-muted-foreground/20 focus:ring-muted-foreground/30"
                  }`}
                  style={{ height: "22px", width: "40px" }}
                  title={enabled ? "כבה אוטומציה" : "הפעל אוטומציה"}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      enabled ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </button>

                <span className={`text-[10.5px] font-medium w-10 shrink-0 ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {enabled ? "On" : "Off"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Shutdown log accordion */}
        <button
          onClick={() => {
            setLogsOpen((v) => !v);
            if (!logsOpen) refetchLogs();
          }}
          className="w-full flex items-center gap-2 px-5 py-3 text-left border-t border-border hover:bg-muted/10 transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
            Shutdown Log
          </span>
          <motion.span animate={{ rotate: logsOpen ? 180 : 0 }}>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.span>
        </button>

        <AnimatePresence>
          {logsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {logsLoading ? (
                <div className="px-5 py-4 text-[12px] text-muted-foreground">טוען...</div>
              ) : !logs || logs.length === 0 ? (
                <div className="px-5 py-5 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  אין רשומות כיבוי עדיין.
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                  {logs.map((log: any) => {
                    const am = ACTION_META[log.action] ?? ACTION_META.disabled;
                    const lastErrors = log.lastErrors ? (() => { try { return JSON.parse(log.lastErrors); } catch { return null; } })() : null;
                    return (
                      <div key={log.id} className="px-5 py-3.5 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1"
                            style={{ background: am.bg, color: am.text, borderColor: am.dot + "55" }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: am.dot }} />
                            {am.label}
                          </span>
                          <span className="text-[11px] font-medium text-foreground">
                            {assignments.find((a) => a.id === log.assignmentId)?.agent?.name ?? `Agent #${log.agentId}`}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground ml-auto">
                            {new Date(log.createdAt).toLocaleString("he-IL")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>על ידי: <strong className="text-foreground">{log.disabledBy}</strong></span>
                          {log.reason && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span>{log.reason}</span>
                            </>
                          )}
                        </div>
                        {lastErrors && lastErrors.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              שגיאות אחרונות לפני כיבוי ({lastErrors.length})
                            </div>
                            <div className="space-y-1">
                              {lastErrors.map((err: any, i: number) => (
                                <div
                                  key={i}
                                  className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[10.5px] font-mono text-red-700"
                                >
                                  <span className="text-red-400 mr-1">[{err.eventType}]</span>
                                  {err.errorMessage || err.inputSummary || "Unknown error"}
                                  {err.timestamp && (
                                    <span className="text-red-300 ml-2">{new Date(err.timestamp).toLocaleTimeString("he-IL")}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function ClientOwnerCard({ client, clientId }: { client: any; clientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateClient = useUpdateClient();
  const [saving, setSaving] = useState(false);

  const current: string | null = client.ownerUser ?? null;

  const setOwner = (value: string) => {
    setSaving(true);
    updateClient.mutate(
      { id: clientId, data: { ownerUser: value === "none" ? null : value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: value === "none" ? "הבעלות נוקתה" : `הלקוח שוייך ל${value === "eli" ? "אלי" : "אור"}` });
          setSaving(false);
        },
        onError: () => { toast({ title: "שמירה נכשלה", variant: "destructive" }); setSaving(false); },
      }
    );
  };

  const OWNERS = [
    { value: "none", label: "ללא בעלים", color: "#94a3b8", bg: "#f1f5f9" },
    { value: "eli", label: "אלי", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
    { value: "aor", label: "אור", color: "#0ea5e9", bg: "rgba(14,165,233,0.08)" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-violet-200 card-shadow overflow-hidden"
      dir="rtl"
    >
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-[16px]">👤</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-violet-900">בעלות על הלקוח</div>
          <div className="text-[11px] text-violet-600 mt-0.5">שיוך הלקוח למנהל אחראי</div>
        </div>
        {current && (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{
              background: current === "eli" ? "rgba(124,58,237,0.1)" : "rgba(14,165,233,0.1)",
              color: current === "eli" ? "#7c3aed" : "#0ea5e9",
            }}
          >
            {current === "eli" ? "אלי" : "אור"}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {OWNERS.map(({ value, label, color, bg }) => {
            const active = (current ?? "none") === value;
            return (
              <button
                key={value}
                onClick={() => !active && !saving && setOwner(value)}
                disabled={saving}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 disabled:opacity-50"
                style={
                  active
                    ? { background: bg, color, borderColor: color + "55" }
                    : { background: "white", color: "#94a3b8", borderColor: "#e2e8f0" }
                }
              >
                {active && <Check className="w-3 h-3" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ClientTelegramCard({ client, clientId }: { client: any; clientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateClient = useUpdateClient();

  const current: string = client.telegramChatId ?? "";
  const [chatInput, setChatInput] = useState(current);
  useEffect(() => {
    setChatInput(client.telegramChatId ?? "");
  }, [client.telegramChatId]);

  const connected = !!current;
  const dirty = chatInput.trim() !== current;

  const save = () => {
    updateClient.mutate(
      { id: clientId, data: { telegramChatId: chatInput.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: chatInput.trim() ? "חיבור הטלגרם נשמר" : "חיבור הטלגרם נוקה" });
        },
        onError: () => toast({ title: "שמירת החיבור נכשלה", variant: "destructive" }),
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-sky-200 card-shadow overflow-hidden"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-sky-50 to-cyan-50 border-b border-sky-100">
        <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-sky-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-sky-900">חיבור טלגרם של הלקוח</div>
          <div className="text-[11px] text-sky-600 mt-0.5 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            יעד להודעות אישור והתראות
            {connected
              ? <span className="text-emerald-600 font-medium">· מחובר</span>
              : <span className="text-amber-600 font-medium">· לא מחובר</span>}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <label className="block text-[12px] font-medium text-gray-600">
          מזהה צ׳אט טלגרם (chat id)
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="לדוגמה: 123456789"
            dir="ltr"
            className="font-mono text-left max-w-xs h-9"
            data-testid="client-telegram-chatid"
          />
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              onClick={save}
              disabled={updateClient.isPending || !dirty}
              size="sm"
              className="gap-1.5 h-9 rounded-lg"
              data-testid="save-client-telegram"
            >
              {updateClient.isPending
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />}
              שמור
            </Button>
          </motion.div>
          {connected && !dirty && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Check className="w-3 h-3" /> מחובר
            </span>
          )}
        </div>

        {!connected && (
          <p className="text-[11.5px] text-amber-600 leading-relaxed">
            ללא מזהה צ׳אט — הודעות האישור וההתראות של הלקוח יישלחו לצ׳אט הטלגרם הראשי של המערכת.
          </p>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          כאן מגדירים לאן יישלחו הודעות האישור (למשל לפני עדכון תפוסה מאופטימה) וההתראות עבור הלקוח הזה. השינוי נכנס לתוקף מיד.
        </p>
        <p className="text-[10.5px] text-gray-400 leading-relaxed">
          איך משיגים את מזהה הצ׳אט? פתחו צ׳אט עם הבוט בטלגרם ושלחו הודעה, או השתמשו בבוט @userinfobot שמחזיר את המזהה שלכם.
        </p>
      </div>
    </motion.div>
  );
}

// ─── ReportsTab — per-client usage & performance report ──────────────────────
function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

function ReportsTab({ clientId, clientName }: { clientId: number; clientName: string }) {
  const { toast } = useToast();
  const { data: report, isLoading, isError, refetch, isFetching } = useGetClientReport(clientId, {
    query: { queryKey: getGetClientReportQueryKey(clientId) },
  });

  // Stacked-by-agent chart: one row per day, one numeric key per agent.
  const chartData = useMemo(() => {
    if (!report) return [];
    const dates = report.dailyTotals.map((d) => d.date);
    return dates.map((date, i) => {
      const row: Record<string, string | number> = {
        date,
        label: new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      };
      for (const agent of report.agents) {
        row[agent.agentName] = agent.dailyVolume[i]?.count ?? 0;
      }
      return row;
    });
  }, [report]);

  const handleExportCsv = () => {
    if (!report) return;
    const rows: string[][] = [];
    rows.push(["Agent", "Category", "Status", "Tasks handled", "Successful", "Failed", "Success rate", "Last active"]);
    for (const a of report.agents) {
      const outcomes = a.successCount + a.failureCount;
      rows.push([
        a.agentName,
        a.category,
        a.status,
        String(a.tasksHandled),
        String(a.successCount),
        String(a.failureCount),
        outcomes > 0 ? `${Math.round((a.successCount / outcomes) * 100)}%` : "—",
        a.lastActive ? new Date(a.lastActive).toISOString() : "",
      ]);
    }
    rows.push([]);
    rows.push(["Date", "Total tasks"]);
    for (const d of report.dailyTotals) {
      rows.push([d.date, String(d.count)]);
    }
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const slug = (clientName || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-usage-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported", description: "CSV downloaded." });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <div className="font-semibold text-sm text-foreground">Couldn't load report</div>
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 rounded-lg h-8 text-xs" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const activeAgents = report.agents.filter((a) => a.status === "active").length;
  const hasActivity = report.totalTasks > 0;
  const totalOutcomes = report.totalSuccess + report.totalFailure;
  const overallSuccessRate = totalOutcomes > 0 ? Math.round((report.totalSuccess / totalOutcomes) * 100) : null;

  return (
    <div className="space-y-5">
      {/* Header + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold tracking-tight">Usage & Performance</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Agent activity over the last {report.windowDays} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs font-medium rounded-lg h-8"
            data-testid="button-refresh-report"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={report.agents.length === 0}
            className="gap-1.5 text-xs font-medium rounded-lg h-8"
            data-testid="button-export-report-csv"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border card-shadow p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Activity className="w-3.5 h-3.5" /> Tasks handled
          </div>
          <div className="text-2xl font-bold mt-1.5" data-testid="report-total-tasks">{report.totalTasks.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">last {report.windowDays} days</div>
        </div>
        <div className="bg-white rounded-xl border border-border card-shadow p-4" data-testid="report-outcomes-card">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5" /> Success rate
          </div>
          <div className="text-2xl font-bold mt-1.5" data-testid="report-success-rate">
            {overallSuccessRate === null ? "—" : `${overallSuccessRate}%`}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="text-emerald-600 font-semibold" data-testid="report-total-success">{report.totalSuccess.toLocaleString()} ok</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-rose-600 font-semibold" data-testid="report-total-failure">{report.totalFailure.toLocaleString()} failed</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border card-shadow p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Bot className="w-3.5 h-3.5" /> Active agents
          </div>
          <div className="text-2xl font-bold mt-1.5">{activeAgents}<span className="text-base text-muted-foreground font-medium"> / {report.agents.length}</span></div>
          <div className="text-[11px] text-muted-foreground mt-0.5">deployed for this client</div>
        </div>
        <div className="bg-white rounded-xl border border-border card-shadow p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> Generated
          </div>
          <div className="text-sm font-semibold mt-2">
            {new Date(report.generatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
          </div>
        </div>
      </div>

      {/* Activity volume chart */}
      <div className="bg-white rounded-xl border border-border card-shadow p-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Task volume per agent
        </div>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} interval="preserveStartEnd" minTickGap={16} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "hsl(220 14% 97%)" }}
                contentStyle={{ borderRadius: 10, border: "1px solid hsl(220 13% 91%)", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {report.agents.map((agent) => {
                const meta = CATEGORY_META[agent.category] || DEFAULT_META;
                return (
                  <Bar key={agent.assignmentId} dataKey={agent.agentName} stackId="tasks" fill={meta.color} radius={[0, 0, 0, 0]} />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-[13px] text-muted-foreground">
            <Activity className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
            No agent activity recorded in the last {report.windowDays} days.
          </div>
        )}
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-border card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Agent breakdown
        </div>
        {report.agents.length === 0 ? (
          <div className="text-center py-10 text-[13px] text-muted-foreground">No agents deployed for this client.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Agent</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Tasks</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Success rate</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Last active</th>
                </tr>
              </thead>
              <tbody>
                {report.agents.map((agent) => {
                  const sm = STATUS_META[agent.status] || STATUS_META.inactive;
                  return (
                    <tr key={agent.assignmentId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors" data-testid={`report-row-${agent.assignmentId}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <AgentIcon agent={agent} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{agent.agentName}</div>
                            <div className="text-[11px] text-muted-foreground">{agent.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
                          style={{ background: sm.bg, color: sm.text, borderColor: sm.border }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{agent.tasksHandled.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums" data-testid={`report-success-rate-${agent.assignmentId}`}>
                        {(() => {
                          const outcomes = agent.successCount + agent.failureCount;
                          if (outcomes === 0) return <span className="text-muted-foreground">—</span>;
                          const rate = Math.round((agent.successCount / outcomes) * 100);
                          const tone = rate >= 90 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-rose-600";
                          return (
                            <div className="flex flex-col items-end leading-tight">
                              <span className={`font-semibold ${tone}`}>{rate}%</span>
                              <span className="text-[10.5px] text-muted-foreground">
                                {agent.successCount.toLocaleString()}/{outcomes.toLocaleString()} ok
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{formatLastActive(agent.lastActive)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tabVisible = useDocumentVisible();

  const { data: client, isLoading: clientLoading } = useGetClient(clientId, {
    query: {
      enabled: !!clientId,
      queryKey: getGetClientQueryKey(clientId),
      refetchInterval: (query) => {
        if (!tabVisible) return false;
        const data = query.state.data as any;
        return data?.analysisStatus === "analyzing" ? 3000 : false;
      },
      refetchIntervalInBackground: false,
    },
  });
  const { data: assignments, isLoading: assignmentsLoading } = useListClientAssignments(clientId, {
    query: { enabled: !!clientId, queryKey: getListClientAssignmentsQueryKey(clientId) },
  });
  const { data: allAgents } = useListAgents();

  // Instant push: the moment a webhook fires (even from outside AgentHub), the
  // server streams the event and we invalidate the affected queries — no polling.
  const streamStatus = useClientTriggerStream(clientId, (event) => {
    queryClient.invalidateQueries({ queryKey: getListClientTriggerEventsQueryKey(clientId) });
    if (event.assignmentId) {
      queryClient.invalidateQueries({ queryKey: getGetAssignmentTriggerQueryKey(event.assignmentId) });
      queryClient.invalidateQueries({ queryKey: getListAssignmentTriggerEventsQueryKey(event.assignmentId) });
    }
  });

  const createAssignment = useCreateAssignment();
  const removeAssignment = useRemoveAssignment();
  const updateClient = useUpdateClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);

  // Page-level refresh — refetches every client-scoped query at once so ops can
  // pull fresh data for the whole page (agents, assignments, automation logs,
  // trigger stats, dedup data) during a quiet period without a full reload.
  const handleRefreshPage = async () => {
    if (isRefreshingPage) return;
    setIsRefreshingPage(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListClientTriggerEventsQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getListAutomationLogsQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getGetClientTriggerStatsQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getGetDedupWarnThresholdQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDedupWarnThresholdHistoryQueryKey() }),
        // Per-assignment trigger config panels + their fire history. Their keys
        // are request paths containing "/trigger", so match by predicate to
        // cover every assignment without enumerating each one.
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey?.[0];
            return typeof key === "string" && key.includes("/trigger");
          },
        }),
      ]);
    } finally {
      setIsRefreshingPage(false);
    }
  };

  const assignedAgentIds = new Set(assignments?.map((a) => a.agentId));
  const availableAgents = allAgents?.filter((a) => !assignedAgentIds.has(a.id) && a.status === "active") ?? [];

  const handleAssign = () => {
    if (!selectedAgentId) return;
    createAssignment.mutate(
      { id: clientId, data: { agentId: parseInt(selectedAgentId, 10), status: "active" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(clientId) });
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setSelectedAgentId("");
          toast({ title: "Agent assigned successfully" });
        },
      }
    );
  };

  const handleRemove = (agentId: number) => {
    removeAssignment.mutate({ id: clientId, agentId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(clientId) });
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: "Agent removed" });
      },
    });
  };

  const toggleStatus = () => {
    if (!client) return;
    updateClient.mutate(
      { id: clientId, data: { status: client.status === "active" ? "inactive" : "active" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        },
      }
    );
  };

  if (clientLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-[100px] w-full rounded-xl" />
        <Skeleton className="h-[80px] w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[160px] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <div className="font-semibold">Client not found</div>
        <Link href="/clients"><Button className="mt-4 rounded-lg">Back to Clients</Button></Link>
      </div>
    );
  }

  const sm = STATUS_META[client.status] || STATUS_META.inactive;
  const initials = client.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      {/* Client header */}
      <div className="flex items-start gap-3">
        <Link href="/clients">
          <motion.button
            whileTap={{ scale: 0.94 }}
            className="w-8 h-8 rounded-lg border border-border bg-white card-shadow flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-border card-shadow p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight">{client.name}</h1>
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{ background: sm.bg, color: sm.text, borderColor: sm.border }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
                    {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                  </span>
                  {(client as any).source === "telegram" && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                      <Send className="w-2.5 h-2.5" />
                      Telegram
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-muted-foreground">
                  <span>{client.industry}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{client.contactEmail}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="flex items-center gap-1"><Bot className="w-3.5 h-3.5" />{assignments?.length ?? 0} agents</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshPage}
                  disabled={isRefreshingPage}
                  title="Refresh all data on this page"
                  data-testid="refresh-client-page"
                  className="gap-1.5 text-xs font-medium rounded-lg h-8"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPage ? "animate-spin" : ""}`} />
                  {isRefreshingPage ? "Refreshing" : "Refresh"}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleStatus} className="text-xs font-medium rounded-lg h-8">
                  {client.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Link href={`/clients/${clientId}/orchestrator`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium rounded-lg h-8">
                    <Network className="w-3.5 h-3.5" />
                    Orchestrator
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis from Telegram */}
      <AnalysisSection client={client} />

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Bot className="w-3.5 h-3.5 mr-1.5" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-6 mt-0">
      {/* Owner assignment */}
      <ClientOwnerCard client={client} clientId={clientId} />
      {/* Telegram connection (per-client message destination) */}
      <ClientTelegramCard client={client} clientId={clientId} />

      {/* Assign Agent */}
      <div className="bg-white rounded-xl border border-border card-shadow p-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Deploy Agent
        </div>
        <div className="flex gap-3">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="max-w-sm h-10 rounded-lg">
              <SelectValue
                placeholder={availableAgents.length ? "Select an agent to deploy…" : "All agents deployed"}
              />
            </SelectTrigger>
            <SelectContent>
              {availableAgents.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  <div className="flex items-center gap-2">
                    <span>{a.iconEmoji || "🤖"}</span>
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground text-xs">· {a.category}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              onClick={handleAssign}
              disabled={!selectedAgentId || createAssignment.isPending}
              className="gap-2 h-10 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Deploy
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Deployed agents */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Deployed Agents ({assignments?.length ?? 0})
        </div>

        {assignmentsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-xl" />
            ))}
          </div>
        ) : assignments?.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
            <Bot className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
            <div className="font-semibold text-sm text-foreground">No agents deployed</div>
            <div className="text-[12px] text-muted-foreground mt-1">
              Select an agent above to deploy it to this client.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {assignments?.map((assignment, i) => (
                <AgentDeployCardWithTrigger
                  key={assignment.id}
                  assignment={assignment}
                  onRemove={handleRemove}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Automation Control Panel */}
      {assignments && assignments.length > 0 && (
        <div>
          <AutomationPanel
            clientId={clientId}
            assignments={assignments}
            clientName={client.name}
          />
        </div>
      )}

      {/* Guardrails section */}
      {assignments && assignments.length > 0 && (
        <GuardrailsSection assignments={assignments} />
      )}

      {/* Triggers section */}
      {assignments && assignments.length > 0 && (
        <TriggersSection clientId={clientId} assignments={assignments} />
      )}

      {/* All Trigger Events dashboard */}
      {assignments && assignments.length > 0 && (
        <ClientTriggerEventsDashboard clientId={clientId} streamStatus={streamStatus} />
      )}
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ReportsTab clientId={clientId} clientName={client.name} />
        </TabsContent>
      </Tabs>

      {/* Notes */}
      {client.notes && (
        <div className="bg-white rounded-xl border border-border card-shadow p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Notes
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{client.notes}</p>
        </div>
      )}
    </div>
  );
}
