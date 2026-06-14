import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetClient,
  useGetOrchestrator,
  useUpsertOrchestrator,
  useListClientAssignments,
  getGetOrchestratorQueryKey,
  getGetClientQueryKey,
  getListClientAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_RULES = JSON.stringify({
  strategy: "category-based",
  fallback: "Support",
  rules: [
    { trigger: "sales inquiry", assignTo: "Sales" },
    { trigger: "technical issue", assignTo: "Support" },
    { trigger: "data request", assignTo: "Analytics" },
  ],
}, null, 2);

const CATEGORY_META: Record<string, { color: string; bg: string; border: string; text: string }> = {
  Sales: { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  Support: { color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1" },
  Analytics: { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  Content: { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  Finance: { color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8", text: "#9d174d" },
  Operations: { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" },
};

function FlowNode({
  label, sub, color, bg, border, text, isInput, isFallback,
}: {
  label: string; sub?: string; color?: string; bg?: string; border?: string; text?: string;
  isInput?: boolean; isFallback?: boolean;
}) {
  return (
    <div
      className="px-4 py-2.5 rounded-xl text-center text-sm font-semibold border shadow-sm"
      style={color ? { background: bg, borderColor: border, color: text } : {}}
    >
      <div className={isInput ? "text-primary font-bold" : isFallback ? "text-muted-foreground" : ""}>
        {label}
      </div>
      {sub && <div className="text-[10px] font-normal mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center my-1">
      <div className="w-px h-4 bg-border" />
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
        <path d="M5 6L0 0h10L5 6z" fill="hsl(220 13% 88%)" />
      </svg>
    </div>
  );
}

export default function OrchestratorPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: client } = useGetClient(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) },
  });
  const { data: orchestrator, isLoading } = useGetOrchestrator(clientId, {
    query: { enabled: !!clientId, queryKey: getGetOrchestratorQueryKey(clientId) },
  });
  const { data: assignments } = useListClientAssignments(clientId, {
    query: { enabled: !!clientId, queryKey: getListClientAssignmentsQueryKey(clientId) },
  });

  const upsert = useUpsertOrchestrator();
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (orchestrator?.routingRules) {
      try {
        setRules(JSON.stringify(JSON.parse(orchestrator.routingRules), null, 2));
      } catch {
        setRules(orchestrator.routingRules);
      }
    }
  }, [orchestrator]);

  const validateJson = (val: string) => {
    try { JSON.parse(val); setJsonError(null); } catch (e: any) { setJsonError(e.message); }
  };

  const handleSave = () => {
    if (jsonError) return;
    upsert.mutate(
      { id: clientId, data: { routingRules: rules } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrchestratorQueryKey(clientId) });
          toast({ title: "Orchestrator config saved" });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  let parsedRules: any = null;
  try { parsedRules = JSON.parse(rules); } catch {}

  const agentsByCategory: Record<string, any[]> = {};
  assignments?.forEach((a) => {
    if (!a.agent) return;
    const cat = a.agent.category;
    if (!agentsByCategory[cat]) agentsByCategory[cat] = [];
    agentsByCategory[cat].push(a.agent);
  });
  const categories = Object.keys(agentsByCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}`}>
          <motion.button
            whileTap={{ scale: 0.94 }}
            className="w-8 h-8 rounded-lg border border-border bg-white card-shadow flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Orchestrator</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {client?.name} · Task routing configuration
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* JSON Editor */}
        <div className="bg-white rounded-xl border border-border card-shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Routing Rules
            </div>
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              JSON
            </span>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <>
              <div className="relative">
                <Textarea
                  value={rules}
                  onChange={(e) => { setRules(e.target.value); validateJson(e.target.value); }}
                  rows={16}
                  className={[
                    "font-mono text-[12px] resize-none rounded-lg leading-relaxed",
                    jsonError ? "border-destructive focus-visible:ring-destructive" : "",
                  ].join(" ")}
                  spellCheck={false}
                />
              </div>

              <AnimatePresence>
                {jsonError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[11.5px] font-mono text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2"
                  >
                    ⚠ {jsonError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={handleSave}
                  disabled={!!jsonError || upsert.isPending}
                  className="w-full h-10 rounded-lg font-semibold gap-2"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {upsert.isPending ? (
                      <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />Saving…
                      </motion.span>
                    ) : saved ? (
                      <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />Saved!
                      </motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <Save className="w-4 h-4" />Save Config
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </>
          )}
        </div>

        {/* Visual Flow */}
        <div className="bg-white rounded-xl border border-border card-shadow p-5 space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Flow Preview
          </div>

          <div className="flex flex-col items-center py-4">
            {/* Input */}
            <div className="w-full max-w-[220px]">
              <div className="px-4 py-2.5 rounded-xl text-center border border-primary/25 bg-primary/5 text-primary font-semibold text-sm">
                Incoming Task
              </div>
            </div>

            <Arrow />

            {/* Orchestrator */}
            <div className="w-full max-w-[220px]">
              <div className="px-4 py-2.5 rounded-xl text-center border border-border bg-muted/50 font-semibold text-sm">
                <div className="text-foreground">Orchestrator</div>
                {parsedRules?.strategy && (
                  <div className="text-[10px] font-normal text-muted-foreground mt-0.5 capitalize">
                    {parsedRules.strategy}
                  </div>
                )}
              </div>
            </div>

            {categories.length > 0 && (
              <>
                <Arrow />
                {/* Routing rules */}
                {parsedRules?.rules?.length > 0 && (
                  <div className="w-full max-w-[280px] mb-3">
                    <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground text-center mb-2">
                      Routing
                    </div>
                    <div className="space-y-1.5">
                      {parsedRules.rules.map((rule: any, i: number) => {
                        const m = CATEGORY_META[rule.assignTo];
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11px] rounded-lg px-3 py-1.5 border" style={m ? { background: m.bg, borderColor: m.border } : { background: "#f9fafb", borderColor: "#e5e7eb" }}>
                            <span className="text-muted-foreground flex-1 truncate italic">"{rule.trigger}"</span>
                            <span className="shrink-0 font-semibold" style={{ color: m?.text || "#4338ca" }}>→ {rule.assignTo}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Agent nodes */}
                <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground text-center mb-2">
                  Agent Pools
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {categories.map((cat) => {
                    const m = CATEGORY_META[cat];
                    return (
                      <div
                        key={cat}
                        className="rounded-xl p-3 border"
                        style={m ? { background: m.bg, borderColor: m.border } : { background: "#f9fafb", borderColor: "#e5e7eb" }}
                      >
                        <div className="text-[10px] font-semibold mb-1.5" style={{ color: m?.text || "#4338ca" }}>
                          {cat}
                        </div>
                        {agentsByCategory[cat].map((a) => (
                          <div key={a.id} className="flex items-center gap-1.5 text-[11px] py-0.5">
                            <span>{a.iconEmoji || "🤖"}</span>
                            <span className="truncate font-medium" style={{ color: m?.text || "#4338ca" }}>{a.name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {categories.length === 0 && (
              <div className="mt-4 text-center text-[12px] text-muted-foreground">
                <div className="text-2xl mb-2">🔗</div>
                Assign agents to this client to visualize the routing flow.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
