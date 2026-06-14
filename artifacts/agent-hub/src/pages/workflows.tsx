import { useState } from "react";
import { Link } from "wouter";
import {
  useListWorkflows, useCreateWorkflow, useDeleteWorkflow,
  getListWorkflowsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, GitBranch, ChevronRight, Zap, Clock,
  Send, SlidersHorizontal, Search, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_META: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  draft:    { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", dot: "#9ca3af", label: "Draft" },
  active:   { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#10b981", label: "Active" },
  archived: { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", dot: "#d1d5db", label: "Archived" },
};

const CAT_META: Record<string, { bg: string; text: string; border: string }> = {
  Sales:      { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  Support:    { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  Analytics:  { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  Content:    { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  Finance:    { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
  Operations: { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  Marketing:  { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  Contact:    { bg: "#ecfeff", text: "#155e75", border: "#a5f3fc" },
};

const NODE_TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  triggerNode:   { icon: <Zap className="w-3 h-3" />,              color: "#6366f1", label: "Trigger" },
  agentNode:     { icon: <span className="text-[10px]">🤖</span>,  color: "#3b82f6", label: "Agent" },
  conditionNode: { icon: <GitBranch className="w-3 h-3" />,        color: "#f59e0b", label: "Condition" },
  delayNode:     { icon: <Clock className="w-3 h-3" />,            color: "#8b5cf6", label: "Delay" },
  outputNode:    { icon: <Send className="w-3 h-3" />,             color: "#10b981", label: "Output" },
};

const STRIP_COLORS: Record<string, string> = {
  Sales:      "from-indigo-500 to-violet-500",
  Support:    "from-sky-500 to-blue-500",
  Analytics:  "from-emerald-500 to-teal-500",
  Content:    "from-amber-400 to-orange-500",
  Finance:    "from-pink-500 to-rose-500",
  Operations: "from-violet-500 to-purple-600",
  Marketing:  "from-red-500 to-rose-500",
  Contact:    "from-cyan-500 to-teal-500",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `לפני ${days}ד'`;
  if (hrs > 0) return `לפני ${hrs}ש'`;
  if (mins > 0) return `לפני ${mins}ד'`;
  return "עכשיו";
}

interface ParsedNode { type: string; data: { category?: string; [k: string]: unknown } }

function parseNodes(nodesJson: string): ParsedNode[] {
  try { return JSON.parse(nodesJson); } catch { return []; }
}

function extractCategories(nodes: ParsedNode[]): string[] {
  const cats = new Set<string>();
  nodes.forEach((n) => { if (n.data?.category) cats.add(n.data.category as string); });
  return Array.from(cats).slice(0, 3);
}

function extractPrimaryCategory(nodes: ParsedNode[]): string {
  const cats = extractCategories(nodes);
  return cats[0] || "Operations";
}

function countByType(nodes: ParsedNode[]) {
  const counts: Record<string, number> = {};
  nodes.forEach((n) => { counts[n.type] = (counts[n.type] || 0) + 1; });
  return counts;
}

const TEMPLATE_IDS = [2, 3, 4, 5, 6, 7, 8];

function WorkflowCard({ wf, i, onDelete }: {
  wf: { id: number; name: string; description?: string | null; status: string; nodes: string; edges: string; createdAt: string; updatedAt?: string | null };
  i: number;
  onDelete: (id: number, name: string, e: React.MouseEvent) => void;
}) {
  const sm = STATUS_META[wf.status] || STATUS_META.draft;
  const nodes = parseNodes(wf.nodes);
  const cats = extractCategories(nodes);
  const primaryCat = extractPrimaryCategory(nodes);
  const typeCounts = countByType(nodes);
  const stripGradient = STRIP_COLORS[primaryCat] || "from-primary/80 to-primary/40";
  const isTemplate = TEMPLATE_IDS.includes(wf.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: i * 0.04 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="group"
    >
      <Link href={`/workflows/${wf.id}`}
        className="block bg-white rounded-xl border border-border hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(99,102,241,0.12)] transition-all duration-200 overflow-hidden">

        {/* Top colored strip */}
        <div className={`h-1.5 bg-gradient-to-r ${stripGradient}`} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-2.5">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-0.5">
                {isTemplate && (
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="w-2.5 h-2.5" />Template
                  </span>
                )}
              </div>
              <div className="font-semibold text-[14px] text-foreground leading-snug">{wf.name}</div>
              {wf.description && (
                <div className="text-[11.5px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{wf.description}</div>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => onDelete(wf.id, wf.name, e)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          {/* Category chips */}
          {cats.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {cats.map((cat) => {
                const cm = CAT_META[cat] || CAT_META.Operations;
                return (
                  <span key={cat} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{ background: cm.bg, color: cm.text, borderColor: cm.border }}>
                    {cat}
                  </span>
                );
              })}
            </div>
          )}

          {/* Node type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {Object.entries(typeCounts).map(([type, count]) => {
                const tm = NODE_TYPE_META[type];
                if (!tm) return null;
                return (
                  <div key={type} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
                    style={{ color: tm.color }}>
                    <span className="flex items-center justify-center w-4 h-4 rounded bg-current/10">
                      <span style={{ color: tm.color }}>{tm.icon}</span>
                    </span>
                    {count} {tm.label}{count > 1 ? "s" : ""}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ background: sm.bg, color: sm.text, borderColor: sm.border }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
                {sm.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{nodes.length} nodes</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
              <span>{timeAgo(wf.updatedAt ?? wf.createdAt)}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: workflows, isLoading } = useListWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createWorkflow.mutate(
      { data: { name: newName.trim(), status: "draft", nodes: "[]", edges: "[]" } },
      {
        onSuccess: (wf) => {
          queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
          toast({ title: "Workflow created" });
          setNewName(""); setCreating(false);
          window.location.href = `/workflows/${wf.id}`;
        },
      }
    );
  };

  const handleDelete = (id: number, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    deleteWorkflow.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
        toast({ title: `"${name}" נמחק` });
      },
    });
  };

  const filtered = (workflows ?? []).filter((wf) =>
    !search || wf.name.toLowerCase().includes(search.toLowerCase()) ||
    (wf.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const templates = filtered.filter((wf) => TEMPLATE_IDS.includes(wf.id));
  const custom    = filtered.filter((wf) => !TEMPLATE_IDS.includes(wf.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground text-sm mt-1">
            אוטומציות עסקיות מבוססות AI — pipeline חזותי בסגנון N8N עם agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש..."
              className="h-9 pl-8 pr-3 rounded-lg w-44 text-sm"
            />
          </div>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button onClick={() => setCreating(true)} className="gap-2 h-9 rounded-lg font-medium shadow-sm">
              <Plus className="w-4 h-4" />New Workflow
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Create dialog */}
      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-xl border border-primary/30 shadow-[0_2px_12px_rgba(99,102,241,0.1)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">New Workflow</div>
            <div className="flex gap-3">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="e.g. Lead Nurturing Pipeline"
                className="h-10 rounded-lg flex-1"
              />
              <Button onClick={handleCreate} disabled={!newName.trim() || createWorkflow.isPending} className="h-10 rounded-lg px-5">
                Create & Open
              </Button>
              <Button variant="outline" onClick={() => { setCreating(false); setNewName(""); }} className="h-10 rounded-lg">
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[200px] rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
          <GitBranch className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
          <div className="font-semibold text-foreground">אין workflows</div>
          <div className="text-sm text-muted-foreground mt-1">צור את ה-pipeline הראשון שלך.</div>
          <Button className="mt-5 gap-2 rounded-lg" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />New Workflow
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Templates section */}
          {templates.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-[13px] font-bold uppercase tracking-widest text-foreground">Business Templates</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground font-medium">{templates.length} automations</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {templates.map((wf, i) => (
                    <WorkflowCard key={wf.id} wf={wf} i={i} onDelete={handleDelete} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Custom workflows */}
          {custom.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-[13px] font-bold uppercase tracking-widest text-foreground">My Workflows</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground font-medium">{custom.length} workflows</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {custom.map((wf, i) => (
                    <WorkflowCard key={wf.id} wf={wf} i={i} onDelete={handleDelete} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
