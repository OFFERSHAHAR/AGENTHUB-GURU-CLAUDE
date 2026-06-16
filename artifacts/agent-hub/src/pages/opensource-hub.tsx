import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListAgents, useUpdateAgent, getListAgentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink, Zap, Brain, Code2, Database, Users, GitBranch,
  ChevronDown, ChevronUp, Settings2, ArrowRight, Star, Cpu, Thermometer,
  MemoryStick, Timer, RefreshCw, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Open-source agent metadata ───────────────────────────────────────────────
const OS_META: Record<string, {
  type: string; typeColor: string; typeBg: string;
  stars: string; github: string;
  origin: string; originColor: string;
  architecture: string; archColor: string;
  year: number;
}> = {
  "AutoGPT": {
    type: "Autonomous", typeColor: "#6366f1", typeBg: "#eef2ff",
    stars: "170k", github: "https://github.com/Significant-Gravitas/AutoGPT",
    origin: "Significant Gravitas", originColor: "#4f46e5",
    architecture: "Goal-Loop", archColor: "#818cf8",
    year: 2023,
  },
  "BabyAGI": {
    type: "Autonomous", typeColor: "#8b5cf6", typeBg: "#f5f3ff",
    stars: "20k", github: "https://github.com/yoheinakajima/babyagi",
    origin: "Yohei Nakajima", originColor: "#7c3aed",
    architecture: "Task Queue", archColor: "#a78bfa",
    year: 2023,
  },
  "CrewAI Orchestrator": {
    type: "Multi-Agent", typeColor: "#0ea5e9", typeBg: "#f0f9ff",
    stars: "30k", github: "https://github.com/joaomdmoura/crewAI",
    origin: "João Moura", originColor: "#0369a1",
    architecture: "Role-Based Crew", archColor: "#38bdf8",
    year: 2023,
  },
  "MetaGPT": {
    type: "Multi-Agent", typeColor: "#ec4899", typeBg: "#fdf2f8",
    stars: "45k", github: "https://github.com/geekan/MetaGPT",
    origin: "DeepWisdom", originColor: "#be185d",
    architecture: "Software Company", archColor: "#f472b6",
    year: 2023,
  },
  "Microsoft AutoGen": {
    type: "Multi-Agent", typeColor: "#0284c7", typeBg: "#e0f2fe",
    stars: "35k", github: "https://github.com/microsoft/autogen",
    origin: "Microsoft Research", originColor: "#0369a1",
    architecture: "Group Chat", archColor: "#38bdf8",
    year: 2023,
  },
  "LangGraph Agent": {
    type: "Research", typeColor: "#10b981", typeBg: "#ecfdf5",
    stars: "8k", github: "https://github.com/langchain-ai/langgraph",
    origin: "LangChain AI", originColor: "#065f46",
    architecture: "State Machine", archColor: "#34d399",
    year: 2024,
  },
  "SuperAGI": {
    type: "Autonomous", typeColor: "#f59e0b", typeBg: "#fffbeb",
    stars: "15k", github: "https://github.com/TransformerOptimus/SuperAGI",
    origin: "TransformerOptimus", originColor: "#b45309",
    architecture: "Tool Infrastructure", archColor: "#fbbf24",
    year: 2023,
  },
  "OpenHands": {
    type: "Code", typeColor: "#ef4444", typeBg: "#fef2f2",
    stars: "40k", github: "https://github.com/All-Hands-AI/OpenHands",
    origin: "All Hands AI", originColor: "#991b1b",
    architecture: "SWE Agent", archColor: "#f87171",
    year: 2024,
  },
  "Phidata Agent": {
    type: "Knowledge", typeColor: "#7c3aed", typeBg: "#f5f3ff",
    stars: "18k", github: "https://github.com/phidatahq/phidata",
    origin: "Phidata HQ", originColor: "#5b21b6",
    architecture: "RAG + Memory", archColor: "#a78bfa",
    year: 2023,
  },
  "Sweep GitHub Agent": {
    type: "Code", typeColor: "#059669", typeBg: "#ecfdf5",
    stars: "8k", github: "https://github.com/sweepai/sweep",
    origin: "Sweep AI", originColor: "#065f46",
    architecture: "Issue → PR", archColor: "#34d399",
    year: 2023,
  },
};

const FILTER_TYPES = ["All", "Autonomous", "Multi-Agent", "Code", "Research", "Knowledge"];
const TYPE_ICONS: Record<string, React.ReactNode> = {
  "Autonomous": <Zap className="w-3 h-3" />,
  "Multi-Agent": <Users className="w-3 h-3" />,
  "Code": <Code2 className="w-3 h-3" />,
  "Research": <Brain className="w-3 h-3" />,
  "Knowledge": <Database className="w-3 h-3" />,
};

const MODELS = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "claude-3-haiku", "gemini-2.0-flash", "llama-3.3-70b"];
const MEMORY_OPTS = ["none", "session", "persistent"];
const OS_AGENT_NAMES = Object.keys(OS_META);

// ─── Live GitHub stars (fetched once, shared across cards) ─────────────────────
const repoOf = (github: string) => github.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}
let _starsCache: Record<string, number> | null = null;
let _starsPromise: Promise<Record<string, number>> | null = null;
function loadGithubStars(): Promise<Record<string, number>> {
  if (_starsCache) return Promise.resolve(_starsCache);
  if (_starsPromise) return _starsPromise;
  const repos = Object.values(OS_META).map((m) => repoOf(m.github)).join(",");
  _starsPromise = fetch(`/api/opensource/stars?repos=${encodeURIComponent(repos)}`)
    .then((r) => r.json())
    .then((d) => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(d?.stars ?? {})) if (typeof v === "number") out[k] = v;
      _starsCache = out;
      return out;
    })
    .catch(() => ({} as Record<string, number>));
  return _starsPromise;
}

// ─── Capability chip ──────────────────────────────────────────────────────────
function CapChip({ cap }: { cap: string }) {
  return (
    <span className="text-[9.5px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap">
      {cap.replace(/-/g, " ")}
    </span>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: ReturnType<typeof useListAgents>["data"] extends (infer T)[] | undefined ? T : never }) {
  const [expanded, setExpanded] = useState(false);
  const [localTemp, setLocalTemp] = useState<number>(agent.temperature ?? 0.7);
  const [localModel, setLocalModel] = useState<string>(agent.model ?? "gpt-4o");
  const [localMemory, setLocalMemory] = useState<string>(agent.memoryType ?? "none");
  const [localTimeout, setLocalTimeout] = useState<number>(agent.timeout ?? 60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const updateAgent = useUpdateAgent();
  const { toast } = useToast();

  const meta = OS_META[agent.name] ?? OS_META["AutoGPT"];
  const [liveStars, setLiveStars] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const repo = repoOf(meta.github);
    loadGithubStars().then((map) => {
      if (alive && typeof map[repo] === "number") setLiveStars(formatStars(map[repo]));
    });
    return () => { alive = false; };
  }, [meta.github]);
  const caps: string[] = (() => { try { return JSON.parse(agent.capabilities || "[]"); } catch { return []; } })();
  const isDirty = localTemp !== (agent.temperature ?? 0.7) || localModel !== (agent.model ?? "gpt-4o") || localMemory !== (agent.memoryType ?? "none") || localTimeout !== (agent.timeout ?? 60);

  const handleSave = () => {
    setSaving(true);
    updateAgent.mutate({ id: agent.id, data: { model: localModel, temperature: localTemp, memoryType: localMemory, timeout: localTimeout } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        setSaving(false); setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        toast({ title: `✅ ${agent.name} updated` });
      },
      onError: () => { setSaving(false); toast({ title: "Error saving", variant: "destructive" }); },
    });
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Header strip */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.typeColor}, ${meta.archColor})` }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-slate-100"
            style={{ background: meta.typeBg }}>
            {agent.iconEmoji || "🤖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[14.5px] text-foreground">{agent.name}</h3>
              <span className="flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full border"
                style={{ color: meta.typeColor, background: meta.typeBg, borderColor: `${meta.typeColor}33` }}>
                {TYPE_ICONS[meta.type]}{meta.type}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">{meta.origin}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
                <Star className="w-2.5 h-2.5 fill-amber-400 stroke-amber-400" />{liveStars ?? meta.stars}
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{meta.architecture}</span>
            </div>
          </div>
          <a href={meta.github} target="_blank" rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Description */}
        <p className="text-[12.5px] text-muted-foreground leading-relaxed" dir="rtl">{agent.description}</p>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1.5">
          {caps.slice(0, 5).map(c => <CapChip key={c} cap={c} />)}
          {caps.length > 5 && <span className="text-[9.5px] text-muted-foreground self-center">+{caps.length - 5}</span>}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: <Cpu className="w-3 h-3" />, label: "Model", value: agent.model?.replace("gpt-4o", "GPT-4o").replace("claude-", "Cl-") ?? "GPT-4o" },
            { icon: <Thermometer className="w-3 h-3" />, label: "Temp", value: (agent.temperature ?? 0.7).toFixed(1) },
            { icon: <MemoryStick className="w-3 h-3" />, label: "Memory", value: agent.memoryType ?? "none" },
            { icon: <Timer className="w-3 h-3" />, label: "Timeout", value: `${agent.timeout ?? 60}s` },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-lg px-2 py-1.5 text-center border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">{s.icon}
                <span className="text-[8.5px] font-semibold uppercase tracking-wide">{s.label}</span>
              </div>
              <div className="text-[10.5px] font-bold text-foreground truncate">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Control panel toggle */}
        <button onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors">
          <Settings2 className="w-3.5 h-3.5" />
          {expanded ? "הסתר בקרות" : "שליטה מלאה על כל פרמטר"}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
        </button>

        {/* Expanded control panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="border-t border-border pt-4 space-y-4">
                {/* Model */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="w-3 h-3" />Model
                  </label>
                  <Select value={localModel} onValueChange={setLocalModel}>
                    <SelectTrigger className="h-8 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Thermometer className="w-3 h-3" />Temperature
                    </label>
                    <span className="text-xs font-mono font-bold text-primary">{localTemp.toFixed(2)}</span>
                  </div>
                  <Slider value={[localTemp]} onValueChange={([v]) => setLocalTemp(v)} min={0} max={2} step={0.05} />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>0 — Deterministic</span><span>1 — Creative</span><span>2 — Random</span>
                  </div>
                </div>

                {/* Memory type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <MemoryStick className="w-3 h-3" />Memory Type
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MEMORY_OPTS.map(m => (
                      <button key={m} onClick={() => setLocalMemory(m)}
                        className="py-1.5 rounded-lg border text-[11px] font-medium transition-all"
                        style={{ borderColor: localMemory === m ? "#6366f1" : undefined, background: localMemory === m ? "#eef2ff" : undefined, color: localMemory === m ? "#4338ca" : undefined }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeout */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Timer className="w-3 h-3" />Timeout
                    </label>
                    <span className="text-xs font-mono font-bold text-primary">{localTimeout}s</span>
                  </div>
                  <Slider value={[localTimeout]} onValueChange={([v]) => setLocalTimeout(v)} min={15} max={300} step={15} />
                </div>

                {/* Retry count (static display) */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10.5px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" />Auto-Retry Count
                  </span>
                  <span className="text-[11px] font-bold text-foreground">{agent.retryCount ?? 2}×</span>
                </div>

                {/* System prompt preview */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">System Prompt Preview</label>
                  <div className="bg-slate-900 rounded-lg p-3 max-h-24 overflow-y-auto">
                    <pre className="text-[10px] text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {(agent.systemPrompt || "").slice(0, 300)}...
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={!isDirty || saving} size="sm"
                    className="flex-1 h-8 rounded-lg text-xs gap-1.5">
                    {saving ? <><RefreshCw className="w-3 h-3 animate-spin" />Saving…</>
                      : saved ? <><Check className="w-3 h-3" />Saved</>
                      : <><Settings2 className="w-3 h-3" />Apply Changes</>}
                  </Button>
                  <Link href={`/agents/${agent.id}`}>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 px-3">
                      <ArrowRight className="w-3 h-3" />Full Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: meta.typeColor, background: meta.typeBg, borderColor: `${meta.typeColor}33` }}>
            {meta.architecture}
          </span>
          <span className="text-[9.5px] text-muted-foreground">{meta.year}</span>
        </div>
        <Link href={`/agents/${agent.id}`}>
          <button className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors">
            Launch Agent <ArrowRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OpenSourceHub() {
  const { data: allAgents = [], isLoading } = useListAgents();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const osAgents = allAgents.filter(a => OS_AGENT_NAMES.includes(a.name));

  const filtered = osAgents.filter(a => {
    const meta = OS_META[a.name];
    if (!meta) return false;
    if (filter !== "All" && meta.type !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #a78bfa 0%, transparent 50%)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-indigo-300" />
            <span className="text-indigo-300 text-[11px] font-semibold uppercase tracking-widest">Open Source Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">סוכני על — Open Source Hub</h1>
          <p className="text-slate-300 text-[13px] max-w-2xl leading-relaxed">
            10 מסגרות הסוכנים המובילות בעולם — AutoGPT, CrewAI, MetaGPT, AutoGen ועוד — משולבות ישירות בAgentHub עם שליטה מלאה על כל פרמטר.
            בנה, כוונן ופרוס ישר מכאן.
          </p>
          <div className="flex gap-4 mt-5">
            {[
              { label: "סוכנים זמינים", value: osAgents.length },
              { label: "כוכבי GitHub", value: "189k+" },
              { label: "ארכיטקטורות", value: "7" },
              { label: "מסגרות", value: "10" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter + Search bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl border border-border">
          {FILTER_TYPES.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all ${filter === f ? "bg-white shadow-sm text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}>
              {f !== "All" && <span className="mr-1">{TYPE_ICONS[f]}</span>}
              {f}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חפש סוכן..."
          className="h-9 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48" />
        <div className="ml-auto text-[11px] text-muted-foreground">{filtered.length} סוכנים</div>
      </div>

      {/* Agent grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין סוכנים תואמים לסינון הנוכחי</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Architecture legend */}
      <div className="border border-border rounded-2xl bg-white p-6">
        <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-4">מפת ארכיטקטורות</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { type: "Autonomous", icon: <Zap className="w-4 h-4" />, color: "#6366f1", desc: "לולאה עצמאית — מטרה → תכנון → ביצוע → רפלקציה" },
            { type: "Multi-Agent", icon: <Users className="w-4 h-4" />, color: "#0ea5e9", desc: "שיתוף פעולה בין סוכנים עם תפקידים מוגדרים" },
            { type: "Code", icon: <Code2 className="w-4 h-4" />, color: "#ef4444", desc: "מיוחד לפיתוח תוכנה, קוד ו-PRs" },
            { type: "Research", icon: <Brain className="w-4 h-4" />, color: "#10b981", desc: "ניתוח נתונים, state machine, ניהול states" },
            { type: "Knowledge", icon: <Database className="w-4 h-4" />, color: "#7c3aed", desc: "RAG + זיכרון לטווח ארוך + knowledge base" },
          ].map(a => (
            <div key={a.type} className="p-3 rounded-xl border border-border space-y-2">
              <div className="flex items-center gap-2" style={{ color: a.color }}>
                {a.icon}
                <span className="font-bold text-[11px]">{a.type}</span>
              </div>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed" dir="rtl">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
