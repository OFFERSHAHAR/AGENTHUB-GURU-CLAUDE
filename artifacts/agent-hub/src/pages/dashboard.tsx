import { Link } from "wouter";
import { useGetStatsSummary, useListRecentActivity, useGetTelegramStatus, useGetTriggerStatsSummary, getListRecentActivityQueryKey, getGetStatsSummaryQueryKey, getGetTriggerStatsSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTriggerStream } from "@/hooks/use-trigger-stream";
import { formatWindowLong } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Building2, Zap, Layers, Send, ChevronRight, Sparkles, AlertTriangle, Mail, Clock, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

const CATEGORY_COLORS: Record<string, string> = {
  Sales: "#6366f1",
  Support: "#0ea5e9",
  Analytics: "#10b981",
  Content: "#f59e0b",
  Finance: "#ec4899",
};

const STAT_CONFIGS = [
  {
    key: "totalAgents",
    label: "Total Agents",
    subKey: "activeAgents",
    subSuffix: "active",
    icon: Bot,
    gradient: "from-indigo-50 to-white",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    valueColor: "text-indigo-700",
  },
  {
    key: "activeClients",
    label: "Active Clients",
    subKey: "totalClients",
    subSuffix: "total",
    icon: Building2,
    gradient: "from-sky-50 to-white",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    valueColor: "text-sky-700",
  },
  {
    key: "totalDeployments",
    label: "Deployments",
    sub: "active assignments",
    icon: Zap,
    gradient: "from-emerald-50 to-white",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    valueColor: "text-emerald-700",
  },
  {
    key: "categoryCount",
    label: "Agent Types",
    sub: "categories",
    icon: Layers,
    gradient: "from-amber-50 to-white",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    valueColor: "text-amber-700",
  },
];

function StatCard({
  config,
  stats,
  isLoading,
  index,
}: {
  config: typeof STAT_CONFIGS[0];
  stats: any;
  isLoading: boolean;
  index: number;
}) {
  const Icon = config.icon;
  let value: number | undefined;
  let sub = config.sub;

  if (config.key === "totalAgents") value = stats?.totalAgents;
  else if (config.key === "activeClients") value = stats?.activeClients;
  else if (config.key === "totalDeployments") value = stats?.totalDeployments;
  else if (config.key === "categoryCount") value = stats?.categoryCounts?.length;

  if (config.subKey === "activeAgents") sub = `${stats?.activeAgents ?? "—"} active`;
  else if (config.subKey === "totalClients") sub = `${stats?.totalClients ?? "—"} total`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: "easeOut" }}
      className={`bg-gradient-to-br ${config.gradient} border border-border rounded-xl p-5 card-shadow`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg ${config.iconBg} flex items-center justify-center`}>
          <Icon className={`w-[17px] h-[17px] ${config.iconColor}`} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
          {config.label}
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-9 w-16 mt-1" />
      ) : (
        <div className={`text-[2.25rem] font-bold leading-none tracking-tight ${config.valueColor}`}>
          {value ?? 0}
        </div>
      )}
      {sub && (
        <div className="text-xs text-muted-foreground mt-2 font-medium">{sub}</div>
      )}
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3.5 py-2.5 text-sm">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      <div className="text-muted-foreground">{payload[0].value} agent{payload[0].value !== 1 ? "s" : ""}</div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

const EVENT_ICONS: Record<string, string> = {
  agent_created: "🤖",
  client_created: "🏢",
  agent_assigned: "⚡",
  agent_removed: "🗑",
  default: "📋",
};

function HighDedupBanner() {
  const { data } = useGetTriggerStatsSummary({ query: { refetchInterval: 60_000 } });
  if (!data || data.highDedupCount === 0) return null;

  const firstClientId = data.affectedClients[0]?.clientId;
  const href = data.affectedClients.length === 1 && firstClientId
    ? `/clients/${firstClientId}`
    : "/clients";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-4"
    >
      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-amber-900 text-sm">
          {data.highDedupCount} integration{data.highDedupCount !== 1 ? "s" : ""} with high duplicate rate
        </div>
        <div className="text-xs text-amber-700 mt-0.5">
          {data.affectedClients.length === 1
            ? `${data.affectedClients[0].clientName} — ${data.highDedupCount} flagged integration${data.highDedupCount !== 1 ? "s" : ""} in the last ${formatWindowLong(data.windowHours, data.windowUnit)}`
            : `Across ${data.affectedClients.length} clients in the last ${formatWindowLong(data.windowHours, data.windowUnit)}`}
        </div>
      </div>
      <Link href={href}>
        <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 shrink-0 transition-colors">
          View {data.affectedClients.length !== 1 ? "clients" : "client"} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </Link>
    </motion.div>
  );
}

function TelegramBanner() {
  const { data: status } = useGetTelegramStatus();
  if (!status) return null;

  const hasPending = (status.pendingClients ?? 0) > 0;
  const isConfigured = status.configured;

  if (!isConfigured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-sky-200 bg-sky-50 p-4 flex items-center gap-4"
      >
        <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-sky-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sky-900 text-sm">חבר את בוט הטלגרם</div>
          <div className="text-xs text-sky-700 mt-0.5">
            הגדר TELEGRAM_BOT_TOKEN ב-Secrets כדי לקבל לקוחות ישירות מהטלגרם.
          </div>
        </div>
        <Link href="/clients">
          <button className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 shrink-0">
            לקוחות <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </motion.div>
    );
  }

  if (hasPending) {
    return (
      <AnimatePresence>
        <motion.div
          key="telegram-pending"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 p-4 flex items-center gap-4"
        >
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 relative">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
              {status.pendingClients}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-violet-900 text-sm">
              {status.pendingClients} לקוח{status.pendingClients !== 1 ? "ים" : ""} חדשים מטלגרם — עם ניתוח AI מוכן!
            </div>
            <div className="text-xs text-violet-700 mt-0.5">
              הניתוח העסקי מחכה לך עם הצעות פתרון, הערכת אינטגרציה ועלויות טוקן.
            </div>
          </div>
          <Link href="/clients">
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="text-xs font-semibold bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1.5 shrink-0"
            >
              צפה בלקוחות <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
          </Link>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}

type EmailLead = {
  id: number;
  name: string;
  contactEmail: string;
  industry: string;
  notes: string | null;
  createdAt: string;
  conversationId: number | null;
  conversationAgentId: number | null;
};

function timeAgoHe(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `לפני ${days} ימים`;
  if (hrs > 0) return `לפני ${hrs} שעות`;
  if (mins > 0) return `לפני ${mins} דקות`;
  return "עכשיו";
}

function EmailLeadsPanel() {
  const { data: leads, isLoading } = useQuery<EmailLead[]>({
    queryKey: ["email-leads"],
    queryFn: () =>
      fetch(`${API_BASE}/email/leads`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const count = leads?.length ?? 0;

  return (
    <div className="bg-white border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
            <Mail className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-none">לידים ממתינים לאיפיון</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">נכנסו דרך מייל</div>
          </div>
        </div>
        {count > 0 && (
          <span className="text-[11px] font-bold bg-rose-100 text-rose-700 rounded-full px-2.5 py-0.5">
            {count}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !leads?.length ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <Mail className="w-7 h-7 opacity-20" />
          <span className="text-sm">אין לידים עדיין</span>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead, i) => {
            const chatHref =
              lead.conversationId && lead.conversationAgentId
                ? `/clients/${lead.id}/chat/${lead.conversationAgentId}`
                : `/clients/${lead.id}`;
            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-semibold text-xs shrink-0">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-foreground leading-tight truncate">
                    {lead.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    {timeAgoHe(lead.createdAt)}
                    {lead.industry && lead.industry !== "לא ידוע" && (
                      <span className="text-muted-foreground/60">· {lead.industry}</span>
                    )}
                  </div>
                </div>
                <Link href={chatHref}>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 shrink-0">
                    פתח <ExternalLink className="w-3 h-3" />
                  </button>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetStatsSummary();
  const { data: activity, isLoading: activityLoading } = useListRecentActivity();

  // Live updates: refresh the activity feed and stats the moment any trigger fires.
  useTriggerStream(() => {
    queryClient.invalidateQueries({ queryKey: getListRecentActivityQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTriggerStatsSummaryQueryKey() });
  });

  const chartData =
    stats?.categoryCounts?.map((c) => ({
      name: c.category,
      count: c.count,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Command Center</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time overview of your AI agent fleet and client deployments.
        </p>
      </div>

      <HighDedupBanner />

      <TelegramBanner />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIGS.map((config, i) => (
          <StatCard key={config.key} config={config} stats={stats} isLoading={statsLoading} index={i} />
        ))}
      </div>

      <EmailLeadsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Chart */}
        <div className="lg:col-span-3 bg-white border border-border rounded-xl p-6 card-shadow">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            Agents by Category
          </div>
          {statsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Bot className="w-8 h-8 opacity-20" />
              <span className="text-sm">No agents yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={32} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="hsl(220 13% 93%)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(220 10% 52%)", fontFamily: "Inter" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(220 10% 52%)", fontFamily: "Inter" }}
                  axisLine={false}
                  tickLine={false}
                  width={20}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(220 14% 97%)", radius: 6 }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} name="Agents">
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl p-6 card-shadow flex flex-col">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Recent Activity
          </div>
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !activity?.length ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-8">
              <span className="text-3xl">📋</span>
              <span className="text-sm">No activity yet</span>
            </div>
          ) : (
            <div className="space-y-1 overflow-auto flex-1 -mx-1 px-1">
              {activity.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm shrink-0 mt-0.5">
                    {EVENT_ICONS[event.type] || EVENT_ICONS.default}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug text-foreground">{event.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                      {timeAgo(event.createdAt)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
