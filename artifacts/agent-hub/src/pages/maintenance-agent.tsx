import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Play, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Clock, Send, Database, Bot, Zap, Server, MessageCircle, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
  duration: number;
}

interface RunLog {
  id: string;
  startedAt: string;
  finishedAt: string;
  checks: CheckResult[];
  passed: number;
  failed: number;
  warnings: number;
  reportSent: boolean;
}

interface MaintenanceStatus {
  lastRun: RunLog | null;
  nextRunAt: string;
  msUntilNext: number;
}

const CHECK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "DB Connectivity": Database,
  "Clients Table": Database,
  "Agents Table": Bot,
  "n8n Webhook Health": Zap,
  "Telegram Bot": MessageCircle,
  "System Version": Server,
};

function StatusBadge({ status }: { status: "ok" | "warn" | "error" }) {
  if (status === "ok") return (
    <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 text-xs font-semibold">
      <CheckCircle2 className="w-3 h-3" /> עבר
    </span>
  );
  if (status === "warn") return (
    <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-xs font-semibold">
      <AlertTriangle className="w-3 h-3" /> אזהרה
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
      <XCircle className="w-3 h-3" /> נכשל
    </span>
  );
}

function Countdown({ msUntilNext }: { msUntilNext: number }) {
  const [ms, setMs] = useState(msUntilNext);

  useEffect(() => {
    const id = setInterval(() => setMs(prev => Math.max(0, prev - 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => setMs(msUntilNext), [msUntilNext]);

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-1 font-mono text-3xl font-bold text-indigo-600">
      {pad(h)}<span className="text-slate-300 animate-pulse">:</span>{pad(m)}<span className="text-slate-300 animate-pulse">:</span>{pad(s)}
    </div>
  );
}

function RunCard({ run, isLatest }: { run: RunLog; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);
  const date = new Date(run.startedAt);
  const dateStr = date.toLocaleDateString("he-IL");
  const timeStr = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const overall = run.failed > 0 ? "error" : run.warnings > 0 ? "warn" : "ok";

  return (
    <motion.div
      layout
      className="border border-border rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-right"
      >
        <div className="flex items-center gap-2">
          {overall === "ok" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {overall === "warn" && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {overall === "error" && <XCircle className="w-5 h-5 text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-foreground">{dateStr} — {timeStr}</span>
            {isLatest && <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">אחרון</span>}
            {run.reportSent && <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">דוח נשלח</span>}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-emerald-600">✅ {run.passed} עברו</span>
            {run.warnings > 0 && <span className="text-xs text-amber-600">⚠️ {run.warnings} אזהרות</span>}
            {run.failed > 0 && <span className="text-xs text-red-600">❌ {run.failed} נכשלו</span>}
          </div>
        </div>
        <span className="text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-5 bg-slate-50 flex flex-col gap-2">
              {run.checks.map((c, i) => {
                const Icon = CHECK_ICONS[c.name] ?? Shield;
                return (
                  <div key={i} className="flex items-center gap-3 bg-white border border-border rounded-lg px-4 py-3">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[13px] font-medium text-foreground flex-1">{c.name}</span>
                    <span className="text-[12px] text-muted-foreground flex-1">{c.message}</span>
                    <span className="text-[11px] font-mono text-slate-400 w-12 text-right">{c.duration}ms</span>
                    <StatusBadge status={c.status} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MaintenanceAgentPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [running, setRunning] = useState(false);
  const [sendReport, setSendReport] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        fetch(`${API}/api/maintenance/status`).then(r => r.json()),
        fetch(`${API}/api/maintenance/logs`).then(r => r.json()),
      ]);
      if (s.ok) setStatus(s);
      if (l.ok) setLogs(l.logs);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/maintenance/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendReport }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "בדיקות הושלמו", description: `✅ ${data.run.passed} | ⚠️ ${data.run.warnings} | ❌ ${data.run.failed}` });
        await fetchStatus();
      } else {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "שגיאת רשת", description: String(err), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const lastRun = status?.lastRun ?? null;
  const overall = lastRun
    ? lastRun.failed > 0 ? "error" : lastRun.warnings > 0 ? "warn" : "ok"
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maintenance Agent</h1>
          <p className="text-muted-foreground text-sm mt-1">בדיקת תקינות יומית אוטומטית — 05:00 בכל בוקר</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendReport}
              onChange={e => setSendReport(e.target.checked)}
              className="rounded"
            />
            <Send className="w-3.5 h-3.5" />
            שלח דוח Telegram
          </label>
          <Button onClick={runNow} disabled={running} className="gap-2">
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "מריץ בדיקות..." : "הרץ עכשיו"}
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-5">
        {/* Countdown */}
        <div className="border border-border rounded-xl bg-white p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-4">
            <Clock className="w-3.5 h-3.5" /> הרצה הבאה
          </div>
          {status ? (
            <Countdown msUntilNext={status.msUntilNext} />
          ) : (
            <div className="h-10 bg-slate-100 animate-pulse rounded" />
          )}
          <div className="text-xs text-muted-foreground mt-2">כל יום 05:00</div>
        </div>

        {/* Last run */}
        <div className="border border-border rounded-xl bg-white p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-4">
            <Shield className="w-3.5 h-3.5" /> הרצה אחרונה
          </div>
          {lastRun ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                {overall === "ok" && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                {overall === "warn" && <AlertTriangle className="w-6 h-6 text-amber-500" />}
                {overall === "error" && <XCircle className="w-6 h-6 text-red-500" />}
                <span className="text-lg font-bold">
                  {overall === "ok" ? "תקין" : overall === "warn" ? "אזהרות" : "כשל"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(lastRun.startedAt).toLocaleString("he-IL")}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">טרם הורץ</div>
          )}
        </div>

        {/* Score */}
        <div className="border border-border rounded-xl bg-white p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" /> ציון בדיקות
          </div>
          {lastRun ? (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground">{lastRun.passed}/{lastRun.passed + lastRun.warnings + lastRun.failed}</span>
              <span className="text-sm text-muted-foreground mb-1">בדיקות עברו</span>
            </div>
          ) : (
            <div className="h-10 bg-slate-100 animate-pulse rounded" />
          )}
          {lastRun && lastRun.failed === 0 && lastRun.warnings === 0 && (
            <div className="text-xs text-emerald-600 mt-2">✨ המערכת תקינה לחלוטין</div>
          )}
        </div>
      </div>

      {/* Check overview (last run) */}
      {lastRun && (
        <div className="border border-border rounded-xl bg-white p-6">
          <div className="text-sm font-semibold text-foreground mb-4">פירוט בדיקות — הרצה אחרונה</div>
          <div className="grid grid-cols-2 gap-3">
            {lastRun.checks.map((c, i) => {
              const Icon = CHECK_ICONS[c.name] ?? Shield;
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.message}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <div className="text-sm font-semibold text-foreground mb-3">היסטוריית הרצות ({logs.length})</div>
        {logs.length === 0 ? (
          <div className="border border-border rounded-xl bg-white p-10 text-center text-muted-foreground text-sm">
            טרם בוצעו הרצות. לחץ "הרץ עכשיו" לבדיקה ראשונה.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log, i) => (
              <RunCard key={log.id} run={log} isLatest={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
