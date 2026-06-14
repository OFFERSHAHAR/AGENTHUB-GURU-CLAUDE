import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Cpu, Database, Zap, Bot, Building2, Clock, ChevronRight,
  RefreshCw, AlertTriangle, CheckCircle2, Circle, TrendingUp, Users, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

type ControlRoomStats = {
  serverTime: string;
  uptime: number;
  clients: Array<{
    id: number; name: string; status: string; industry: string; ownerUser: string | null;
    lastFiredAt: string | null; recentEventCount: number; createdAt: string;
  }>;
  agents: Array<{
    id: number; name: string; category: string; status: string; iconEmoji: string | null;
    tags: string; clientCount: number; recentEventCount: number; lastFiredAt: string | null;
  }>;
  recentEvents: Array<{
    id: number; firedAt: string; agentStatus: string; clientId: number; clientName: string;
    agentId: number; agentName: string; agentOutput: string | null;
  }>;
  recentActivity: Array<{ id: number; type: string; message: string; createdAt: string }>;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}ש'`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}ד'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ש"`;
  return `${Math.floor(h / 24)}י'`;
}

function uptimeStr(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        background: active ? "#22c55e" : "#94a3b8",
        boxShadow: active ? "0 0 6px rgba(34,197,94,0.6)" : undefined,
      }}
    />
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  triggered: { bg: "#dbeafe", text: "#1d4ed8" },
  running: { bg: "#fef9c3", text: "#a16207" },
  idle: { bg: "#f0fdf4", text: "#166534" },
  deduplicated: { bg: "#fce7f3", text: "#9d174d" },
};

// ─── Module: System Health ──────────────────────────────────────────────────
function SystemHealthModule({ stats, loading }: { stats: ControlRoomStats | null; loading: boolean }) {
  const uptime = stats ? uptimeStr(stats.uptime) : "—";
  const items = [
    { label: "API Server", icon: Cpu, ok: !!stats, value: uptime },
    { label: "Database", icon: Database, ok: !!stats, value: stats ? "Connected" : "—" },
    { label: "Agents", icon: Bot, ok: !!stats, value: stats ? `${stats.agents.length} total` : "—" },
    { label: "Clients", icon: Building2, ok: !!stats, value: stats ? `${stats.clients.length} total` : "—" },
    { label: "Events (7d)", icon: Activity, ok: !!stats, value: stats ? `${stats.recentEvents.length}` : "—" },
    { label: "Server Time", icon: Clock, ok: !!stats, value: stats ? new Date(stats.serverTime).toLocaleTimeString("he-IL") : "—" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-gradient-to-r from-slate-50 to-white">
        <Cpu className="w-4 h-4 text-violet-600" />
        <span className="text-[13px] font-bold text-slate-800">בריאות המערכת</span>
        {stats && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Operational
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border">
        {items.map(({ label, icon: Icon, ok, value }) => (
          <div key={label} className="flex flex-col gap-1 p-4">
            {loading ? (
              <>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <StatusDot active={ok} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                </div>
                <span className="text-[13px] font-bold text-foreground">{value}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module: Live Activity Feed ──────────────────────────────────────────────
function LiveActivityModule({ events, loading }: { events: ControlRoomStats["recentEvents"] | null; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-gradient-to-r from-blue-50 to-white shrink-0">
        <Activity className="w-4 h-4 text-blue-600" />
        <span className="text-[13px] font-bold text-slate-800">פעילות חיה</span>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.8)", animation: "pulse 2s infinite" }}
        />
        {events && (
          <span className="ml-auto text-[11px] text-muted-foreground">{events.length} events</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-[360px]">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : !events?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Circle className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[13px]">אין פעילות עדכנית</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {events.map((ev) => {
                const sc = STATUS_COLORS[ev.agentStatus] ?? STATUS_COLORS.idle;
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] font-semibold text-foreground truncate">{ev.clientName}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground truncate">{ev.agentName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {ev.agentStatus}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(ev.firedAt)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Module: Client Grid ──────────────────────────────────────────────────────
function ClientGridModule({
  clients, loading, selectedClientId, onSelect,
}: {
  clients: ControlRoomStats["clients"] | null;
  loading: boolean;
  selectedClientId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-gradient-to-r from-emerald-50 to-white shrink-0">
        <Building2 className="w-4 h-4 text-emerald-600" />
        <span className="text-[13px] font-bold text-slate-800">לקוחות פעילים</span>
        {clients && (
          <span className="ml-auto text-[11px] text-muted-foreground">{clients.filter(c => c.status === "active").length} active</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-[360px]">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !clients?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[13px]">אין לקוחות</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {clients.map((c) => {
              const selected = c.id === selectedClientId;
              const isActive = c.status === "active";
              const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-emerald-50/50"
                  style={selected ? { background: "rgba(16,185,129,0.08)" } : undefined}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatusDot active={isActive} />
                      <span className="text-[12px] font-semibold text-foreground truncate">{c.name}</span>
                      {c.ownerUser && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: c.ownerUser === "eli" ? "rgba(124,58,237,0.1)" : "rgba(14,165,233,0.1)",
                            color: c.ownerUser === "eli" ? "#7c3aed" : "#0ea5e9",
                          }}
                        >
                          {c.ownerUser === "eli" ? "אלי" : "אור"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{c.industry}</span>
                      {c.recentEventCount > 0 && (
                        <span className="text-[10px] text-blue-600 font-semibold">{c.recentEventCount} triggers</span>
                      )}
                      {c.lastFiredAt && (
                        <span className="text-[10px] text-muted-foreground">· {timeAgo(c.lastFiredAt)}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" style={selected ? { color: "#10b981" } : undefined} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Module: Agent Health ─────────────────────────────────────────────────────
function AgentHealthModule({ agents, loading }: { agents: ControlRoomStats["agents"] | null; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-gradient-to-r from-violet-50 to-white shrink-0">
        <Bot className="w-4 h-4 text-violet-600" />
        <span className="text-[13px] font-bold text-slate-800">גיל הסוכנים</span>
        {agents && (
          <span className="ml-auto text-[11px] text-muted-foreground">{agents.filter(a => a.clientCount > 0).length} deployed</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-[360px]">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : !agents?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bot className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[13px]">אין סוכנים</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {agents.filter(a => a.status === "active").map((a) => {
              const deployed = a.clientCount > 0;
              const hasActivity = a.recentEventCount > 0;
              return (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-lg shrink-0">
                    {a.iconEmoji ?? "🤖"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatusDot active={deployed} />
                      <span className="text-[12px] font-semibold text-foreground truncate">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{a.category}</span>
                      <span className="text-[10px] text-violet-600">{a.clientCount} clients</span>
                      {hasActivity && (
                        <span className="text-[10px] text-blue-600 font-semibold">{a.recentEventCount} events</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">{timeAgo(a.lastFiredAt)}</div>
                    {hasActivity && (
                      <div className="flex justify-end mt-0.5">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Module: Client Detail Panel ──────────────────────────────────────────────
function ClientDetailPanel({ client, events }: {
  client: ControlRoomStats["clients"][0] | null;
  events: ControlRoomStats["recentEvents"];
}) {
  if (!client) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-slate-50/50 flex flex-col items-center justify-center py-16">
        <Eye className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <span className="text-[13px] text-muted-foreground">בחר לקוח לצפייה</span>
        <span className="text-[11px] text-muted-foreground/60 mt-1">לחץ על לקוח ברשימה</span>
      </div>
    );
  }

  const clientEvents = events.filter((e) => e.clientId === client.id);
  const initials = client.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <motion.div
      key={client.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-foreground">{client.name}</h3>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: client.status === "active" ? "#dcfce7" : "#f1f5f9",
                  color: client.status === "active" ? "#166534" : "#64748b",
                }}
              >
                {client.status}
              </span>
              {client.ownerUser && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: client.ownerUser === "eli" ? "rgba(124,58,237,0.1)" : "rgba(14,165,233,0.1)",
                    color: client.ownerUser === "eli" ? "#7c3aed" : "#0ea5e9",
                  }}
                >
                  {client.ownerUser === "eli" ? "אלי" : "אור"}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{client.industry}</div>
          </div>
          <Link href={`/clients/${client.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-7 rounded-lg">
              <ChevronRight className="w-3 h-3" /> פתח
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { label: "Triggers (7d)", value: clientEvents.length },
          { label: "Last trigger", value: timeAgo(client.lastFiredAt) },
          { label: "Status", value: client.status },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
            <div className="text-[14px] font-bold text-foreground mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Events for this client */}
      <div className="px-5 py-3 border-b border-border">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Trigger Events</span>
      </div>
      <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
        {clientEvents.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] text-muted-foreground">אין אירועים עדכניים</div>
        ) : (
          clientEvents.slice(0, 10).map((ev) => {
            const sc = STATUS_COLORS[ev.agentStatus] ?? STATUS_COLORS.idle;
            return (
              <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground truncate">{ev.agentName}</span>
                </div>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: sc.bg, color: sc.text }}
                >
                  {ev.agentStatus}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(ev.firedAt)}</span>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Control Room Page ───────────────────────────────────────────────────
export default function ControlRoomPage() {
  const [stats, setStats] = useState<ControlRoomStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/control-room/stats`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setStats(data);
        setLastRefresh(new Date());
        if (!selectedClientId && data.clients?.length > 0) {
          setSelectedClientId(data.clients[0].id);
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const selectedClient = stats?.clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">חדר בקרה</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ניטור פעילות מלאה בזמן אמת · מתרענן כל 30 שניות
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[11px] text-muted-foreground">
              עודכן {lastRefresh.toLocaleTimeString("he-IL")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-[12px] rounded-lg"
            onClick={() => { setLoading(true); fetchStats(); }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            רענן
          </Button>
        </div>
      </div>

      {/* Module 1: System Health */}
      <SystemHealthModule stats={stats} loading={loading} />

      {/* Row 2: Live Activity + Client Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <LiveActivityModule events={stats?.recentEvents ?? null} loading={loading} />
        <ClientGridModule
          clients={stats?.clients ?? null}
          loading={loading}
          selectedClientId={selectedClientId}
          onSelect={setSelectedClientId}
        />
      </div>

      {/* Row 3: Agent Health + Client Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AgentHealthModule agents={stats?.agents ?? null} loading={loading} />
        <ClientDetailPanel client={selectedClient} events={stats?.recentEvents ?? []} />
      </div>
    </div>
  );
}
