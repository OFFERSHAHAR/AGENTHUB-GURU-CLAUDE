import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, Zap, Bot,
  ArrowLeft, RefreshCw, Clock, TrendingUp, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const POLL_MS = 5000;

interface Client {
  id: number;
  name: string;
  status: string;
  industry: string | null;
  email: string | null;
}

interface Agent {
  id: number;
  name: string;
  category: string;
}

interface Assignment {
  id: number;
  agentId: number;
  status: string;
  createdAt: string;
}

interface AutomationLog {
  id: number;
  type: string;
  status: string;
  message: string | null;
  createdAt: string;
}

interface LiveEvent {
  id: string;
  time: Date;
  type: "success" | "warn" | "error" | "info";
  text: string;
  agent?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  support: "#6366F1",
  sales: "#10B981",
  analytics: "#F59E0B",
  operations: "#EF4444",
  finance: "#8B5CF6",
  content: "#14B8A6",
};

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "#6366F1" }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="border border-border rounded-xl bg-white p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        {label}
      </div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function EventRow({ event }: { event: LiveEvent }) {
  const colors = { success: "#10B981", warn: "#F59E0B", error: "#EF4444", info: "#6366F1" };
  const icons = { success: CheckCircle2, warn: AlertTriangle, error: XCircle, info: Activity };
  const Icon = icons[event.type];
  const color = colors[event.type];

  const timeStr = event.time.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border bg-white"
      style={{ borderRight: `3px solid ${color}` }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <span className="font-mono text-[11px] text-muted-foreground w-20 shrink-0">{timeStr}</span>
      <span className="text-[13px] text-foreground flex-1">{event.text}</span>
      {event.agent && <span className="text-[11px] text-muted-foreground bg-slate-50 border border-border rounded px-2 py-0.5">{event.agent}</span>}
    </motion.div>
  );
}

function logsToEvents(logs: AutomationLog[], agents: Agent[]): LiveEvent[] {
  return logs.slice(0, 30).map(log => {
    const agent = agents.find(a => log.message?.includes(a.name));
    const type: LiveEvent["type"] =
      log.status === "success" ? "success" :
      log.status === "error" ? "error" :
      log.type === "warning" ? "warn" : "info";
    return {
      id: String(log.id),
      time: new Date(log.createdAt),
      type,
      text: log.message ?? log.type,
      agent: agent?.name,
    };
  });
}

export default function ClientLivePage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [clientRes, assignRes, agentsRes, logsRes] = await Promise.all([
        fetch(`${API}/api/clients/${id}`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/clients/${id}/assignments`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/agents`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/clients/${id}/automation-logs`, { credentials: "include" }).then(r => r.json()).catch(() => ({ logs: [] })),
      ]);
      setClient(clientRes?.client ?? clientRes ?? null);
      setAssignments(Array.isArray(assignRes?.assignments) ? assignRes.assignments : Array.isArray(assignRes) ? assignRes : []);
      const fetchedAgents: Agent[] = Array.isArray(agentsRes?.agents) ? agentsRes.agents : Array.isArray(agentsRes) ? agentsRes : [];
      setAgents(fetchedAgents);
      const fetchedLogs: AutomationLog[] = Array.isArray(logsRes?.logs) ? logsRes.logs : Array.isArray(logsRes) ? logsRes : [];
      setLogs(fetchedLogs);
      setEvents(logsToEvents(fetchedLogs, fetchedAgents));
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>טוען נתוני לקוח...</span>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <div className="text-muted-foreground">{error ?? "לקוח לא נמצא"}</div>
        <Link href="/clients"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" /> חזרה ללקוחות</Button></Link>
      </div>
    );
  }

  const activeAssignments = assignments.filter(a => a.status === "active");
  const successLogs = logs.filter(l => l.status === "success").length;
  const errorLogs = logs.filter(l => l.status === "error").length;
  const successRate = logs.length > 0 ? Math.round((successLogs / logs.length) * 100) : 100;

  const assignedAgents = assignments.map(asgn => agents.find(a => a.id === asgn.agentId)).filter(Boolean) as Agent[];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clients/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
            <PulseDot color="#10B981" />
            <span className="text-xs text-emerald-600 font-semibold">LIVE</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            עדכון כל {POLL_MS / 1000} שניות
            {lastUpdated && ` — עדכן לאחרונה ${lastUpdated.toLocaleTimeString("he-IL")}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          רענן
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          icon={Bot}
          label="סוכנים פעילים"
          value={`${activeAssignments.length}/${assignments.length}`}
          sub={assignments.length === 0 ? "אין סוכנים" : "מ-הסוכנים הפרוסים"}
          color="#6366F1"
        />
        <MetricCard
          icon={Activity}
          label="פעולות היום"
          value={logs.length}
          sub="סה״כ אירועים מתועדים"
          color="#14B8A6"
        />
        <MetricCard
          icon={TrendingUp}
          label="שיעור הצלחה"
          value={`${successRate}%`}
          sub={`${successLogs} הצלחות / ${errorLogs} שגיאות`}
          color={successRate >= 90 ? "#10B981" : successRate >= 70 ? "#F59E0B" : "#EF4444"}
        />
        <MetricCard
          icon={Clock}
          label="סטטוס לקוח"
          value={client.status === "active" ? "פעיל" : client.status === "trial" ? "ניסיון" : "לא פעיל"}
          sub={client.industry ?? "ללא תעשייה"}
          color={client.status === "active" ? "#10B981" : "#F59E0B"}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Active agents */}
        <div className="border border-border rounded-xl bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-foreground">סוכנים פרוסים</div>
            <span className="text-xs text-muted-foreground">{activeAssignments.length} פעילים</span>
          </div>
          {assignedAgents.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">אין סוכנים פרוסים</div>
          ) : (
            <div className="flex flex-col gap-2">
              {assignedAgents.map((agent, i) => {
                const asgn = assignments[i];
                const color = CATEGORY_COLORS[agent.category?.toLowerCase()] ?? "#64748B";
                return (
                  <div key={agent.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border">
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{agent.name}</div>
                      <div className="text-[11px] text-muted-foreground">{agent.category}</div>
                    </div>
                    <span className={[
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      asgn?.status === "active"
                        ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                        : "text-slate-500 bg-slate-50 border-slate-200",
                    ].join(" ")}>
                      {asgn?.status === "active" ? "פעיל" : "לא פעיל"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live event feed */}
        <div className="border border-border rounded-xl bg-slate-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="w-4 h-4 text-indigo-500" />
              אירועים חיים
            </div>
            <div className="flex items-center gap-1.5">
              <PulseDot color="#10B981" />
              <span className="text-[11px] text-emerald-600 font-medium">עדכון שוטף</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
            <AnimatePresence>
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">אין אירועים מתועדים</div>
              ) : (
                events.map(e => <EventRow key={e.id} event={e} />)
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Self-healing notice */}
      {errorLogs > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <Zap className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">סוכן תיקון פעיל</div>
            <div className="text-xs text-amber-600">זוהו {errorLogs} שגיאות — המערכת מנסה לתקן אוטומטית. הלקוח לא מושפע.</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
