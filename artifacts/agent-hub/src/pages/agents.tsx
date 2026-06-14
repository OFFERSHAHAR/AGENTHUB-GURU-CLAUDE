import { useState } from "react";
import { Link } from "wouter";
import {
  useListAgents,
  useListAgentCategories,
  useDeleteAgent,
  getListAgentsQueryKey,
  getListAgentCategoriesQueryKey,
  type Agent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, ArrowUpRight, SlidersHorizontal, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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
  const sizeMap = { sm: "w-8 h-8 text-lg", md: "w-10 h-10 text-xl", lg: "w-12 h-12 text-2xl" };
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

// ─── Hebrew translations ──────────────────────────────────────────────────────
const HE_CATEGORY: Record<string, string> = {
  Sales: "מכירות",
  Support: "תמיכה",
  Analytics: "אנליטיקה",
  Content: "תוכן",
  Finance: "פיננסים",
  Operations: "תפעול",
  Marketing: "שיווק",
  Contact: "יצירת קשר",
};

const HE_STATUS: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  draft: "טיוטה",
};

const HE_MEMORY: Record<string, string> = {
  none: "ללא זיכרון — כל הרצה עצמאית",
  session: "זיכרון שיחה — שומר הקשר בתוך שיחה אחת",
  persistent: "זיכרון מתמיד — שומר מידע לאורך זמן",
  vector: "זיכרון וקטורי — חיפוש סמנטי בזיכרון",
};

const HE_TRIGGER: Record<string, string> = {
  manual: "הפעלה ידנית",
  webhook: "קריאת Webhook",
  scheduled: "הרצה מתוזמנת (Cron)",
  event: "הפעלה על-פי אירוע",
  chain: "שרשרת סוכנים",
};

const HE_FORMAT: Record<string, string> = {
  text: "טקסט חופשי",
  json_object: "אובייקט JSON",
  markdown: "מסמך Markdown",
};

function tempLabel(t: number) {
  if (t <= 0.3) return "מדויק ועקבי מאוד";
  if (t <= 0.6) return "מאוזן — יצירתי במידה";
  if (t <= 1.0) return "יצירתי ומגוון";
  if (t <= 1.5) return "חופשי ומפתיע";
  return "מקסימלי — תגובות חופשיות מאוד";
}

// ─── Hebrew Explanation Dialog ────────────────────────────────────────────────
function HebrewDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const meta = CATEGORY_META[agent.category] || DEFAULT_META;
  const temp = agent.temperature ?? 0.7;
  const maxTok = agent.maxTokens ?? 2048;
  const tags: string[] = agent.tags ?? [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="max-w-xl max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl border-0 shadow-xl"
        style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}
      >
        {/* Header strip */}
        <div
          className="rounded-t-2xl px-6 pt-6 pb-5"
          style={{ background: `linear-gradient(135deg, ${meta.bg} 0%, white 100%)`, borderBottom: `2px solid ${meta.border}` }}
        >
          <DialogHeader className="text-right gap-0">
            <div className="flex items-center gap-3 justify-end mb-3">
              <div>
                <DialogTitle className="text-xl font-bold text-right leading-tight" style={{ color: meta.text }}>
                  {agent.name}
                </DialogTitle>
                <div className="text-[12px] font-medium mt-1" style={{ color: meta.text, opacity: 0.75 }}>
                  {HE_CATEGORY[agent.category] || agent.category} ·{" "}
                  <span className={agent.status === "active" ? "text-emerald-600" : "text-muted-foreground"}>
                    {HE_STATUS[agent.status] || agent.status}
                  </span>
                  {" "}· פורס ל-{agent.deployedCount} לקוחות
                </div>
              </div>
              <AgentIcon agent={agent} size="lg" />
            </div>
          </DialogHeader>

          {/* Description */}
          <div className="bg-white/70 rounded-xl px-4 py-3 border" style={{ borderColor: meta.border }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: meta.text }}>תיאור</div>
            <p className="text-[13.5px] text-foreground leading-relaxed">{agent.description}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Technical params */}
          <section>
            <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span>פרמטרים טכניים</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "מודל בינה מלאכותית", value: agent.model || "gpt-4o" },
                { label: "רמת יצירתיות", value: `${temp.toFixed(1)} — ${tempLabel(temp)}` },
                { label: "מגבלת אסימונים", value: maxTok.toLocaleString("he-IL") + " אסימונים" },
                { label: "פורמט תגובה", value: HE_FORMAT[agent.responseFormat || "text"] || agent.responseFormat || "טקסט" },
                { label: "סוג הפעלה", value: HE_TRIGGER[agent.triggerType || "manual"] || agent.triggerType || "ידני" },
                { label: "זיכרון", value: HE_MEMORY[agent.memoryType || "none"] || "ללא זיכרון" },
                { label: "זמן מקסימלי", value: `${agent.timeout ?? 60} שניות` },
                { label: "ניסיונות חוזרים", value: `${agent.retryCount ?? 2} ניסיונות במקרה כשל` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/60 rounded-xl px-3 py-2.5 border border-border">
                  <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
                  <div className="text-[12.5px] font-semibold text-foreground leading-snug">{value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Capabilities */}
          {(agent.capabilities?.length ?? 0) > 0 && (
            <section>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <span>יכולות הסוכן</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {agent.capabilities!.map((cap) => (
                  <span
                    key={cap}
                    className="text-[12px] font-medium px-3 py-1 rounded-full border"
                    style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* System prompt */}
          {agent.systemPrompt && (
            <section>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <span>הנחיות מערכת (System Prompt)</span>
              </div>
              <pre
                className="text-[11.5px] font-mono text-muted-foreground leading-relaxed bg-muted rounded-xl p-4 whitespace-pre-wrap overflow-auto max-h-36 text-right border border-border"
                dir="ltr"
              >
                {agent.systemPrompt}
              </pre>
            </section>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <section>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <span>תגיות</span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {tags.map((tag) => (
                  <span key={tag} className="text-[11px] font-medium bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full border border-border">
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Schema hint */}
          {(agent.inputSchema || agent.outputSchema) && (
            <section>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <span>סכמת נתונים</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {agent.inputSchema && (
                  <div className="bg-muted/60 rounded-xl px-3 py-2.5 border border-border">
                    <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">קלט (Input)</div>
                    <div className="text-[10.5px] font-mono text-muted-foreground truncate">{agent.inputSchema.slice(0, 60)}…</div>
                  </div>
                )}
                {agent.outputSchema && (
                  <div className="bg-muted/60 rounded-xl px-3 py-2.5 border border-border">
                    <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">פלט (Output)</div>
                    <div className="text-[10.5px] font-mono text-muted-foreground truncate">{agent.outputSchema.slice(0, 60)}…</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Footer note */}
          <div className="text-center text-[11px] text-muted-foreground pt-1">
            סוכן AI מסוג <strong>{HE_CATEGORY[agent.category] || agent.category}</strong> · מופעל על-ידי AgentHub
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({
  agent, onDelete, onExplain, index,
}: {
  agent: Agent;
  onDelete: (id: number) => void;
  onExplain: (agent: Agent) => void;
  index: number;
}) {
  const meta = CATEGORY_META[agent.category] || DEFAULT_META;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="group bg-white rounded-xl border border-border card-shadow hover:card-shadow-hover transition-shadow duration-200 flex flex-col overflow-hidden"
      style={{ borderTop: `2.5px solid ${meta.color}` }}
    >
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <AgentIcon agent={agent} size="md" />
            <div>
              <div className="font-semibold text-[13.5px] text-foreground leading-tight">
                {agent.name}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {agent.deployedCount} deployment{agent.deployedCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <span
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full border shrink-0"
            style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
          >
            {agent.category}
          </span>
        </div>

        {/* Description */}
        <p className="text-[12.5px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {agent.description}
        </p>

        {/* Capabilities */}
        {agent.capabilities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.slice(0, 3).map((cap: string) => (
              <span
                key={cap}
                className="text-[10.5px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
              >
                {cap}
              </span>
            ))}
            {agent.capabilities.length > 3 && (
              <span className="text-[10.5px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                +{agent.capabilities.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${agent.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          <span className="text-[11px] text-muted-foreground font-medium capitalize">
            {agent.status}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Hebrew explain button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={(e) => { e.stopPropagation(); onExplain(agent); }}
            className="h-7 px-2 rounded-lg flex items-center gap-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors text-[11px] font-bold"
            title="הסבר בעברית"
          >
            <span>עב</span>
          </motion.button>
          <Link href={`/agents/${agent.id}`}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </motion.button>
          </Link>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-border card-shadow overflow-hidden">
      <div className="h-[2.5px] bg-muted" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="px-5 py-3 border-t border-border">
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [explainAgent, setExplainAgent] = useState<Agent | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agents, isLoading } = useListAgents(
    categoryFilter ? { category: categoryFilter } : {},
    { query: { queryKey: getListAgentsQueryKey(categoryFilter ? { category: categoryFilter } : {}) } }
  );
  const { data: categories } = useListAgentCategories();
  const deleteAgent = useDeleteAgent();

  const handleDelete = (id: number) => {
    deleteAgent.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAgentCategoriesQueryKey() });
        toast({ title: "Agent removed from repository" });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Hebrew dialog */}
      <AnimatePresence>
        {explainAgent && (
          <HebrewDialog agent={explainAgent} onClose={() => setExplainAgent(null)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Repository</h1>
          <p className="text-muted-foreground text-sm mt-1">Your deployable AI agent fleet.</p>
        </div>
        <Link href="/agents/new">
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button className="gap-2 h-9 px-4 rounded-lg text-sm font-medium shadow-sm">
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </motion.div>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <button
          onClick={() => setCategoryFilter(null)}
          className={[
            "text-[12px] font-medium px-3 py-1 rounded-full border transition-all duration-150",
            !categoryFilter
              ? "bg-primary text-white border-primary shadow-sm"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-white",
          ].join(" ")}
        >
          All {categories && `(${categories.reduce((s, c) => s + c.count, 0)})`}
        </button>
        {categories?.map((cat) => {
          const meta = CATEGORY_META[cat.category] || DEFAULT_META;
          const active = categoryFilter === cat.category;
          return (
            <button
              key={cat.category}
              onClick={() => setCategoryFilter(active ? null : cat.category)}
              className={[
                "text-[12px] font-medium px-3 py-1 rounded-full border transition-all duration-150",
                active
                  ? "shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-white",
              ].join(" ")}
              style={active ? { background: meta.bg, color: meta.text, borderColor: meta.border } : {}}
            >
              {cat.category} ({cat.count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)}
        </div>
      ) : agents?.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <div className="text-5xl mb-4">🤖</div>
          <div className="font-semibold text-foreground">No agents found</div>
          <div className="text-sm text-muted-foreground mt-1">
            {categoryFilter ? `No agents in "${categoryFilter}"` : "Create your first agent to get started."}
          </div>
          {!categoryFilter && (
            <Link href="/agents/new">
              <Button className="mt-5 gap-2 rounded-lg">
                <Plus className="w-4 h-4" />New Agent
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" layout>
          <AnimatePresence>
            {agents?.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={handleDelete}
                onExplain={setExplainAgent}
                index={i}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
