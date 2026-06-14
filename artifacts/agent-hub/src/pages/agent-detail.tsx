import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetAgent, useUpdateAgent, useDeleteAgent,
  getGetAgentQueryKey, getListAgentsQueryKey,
  type Agent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, X, Pencil, Check, Loader2, Trash2, Save } from "lucide-react";
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
};
const DEFAULT_META = { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" };

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "OpenAI" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku", provider: "Anthropic" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google" },
  { value: "llama-3.3-70b", label: "Llama 3.3 70B", provider: "Meta" },
  { value: "custom", label: "Custom", provider: "Custom" },
];

function ParamRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_1.6fr] gap-4 items-start py-3 border-b border-border last:border-0">
      <div>
        <div className="text-[12.5px] font-semibold text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function initFromAgent(agent: Agent) {
  return {
    name: agent.name,
    description: agent.description,
    category: agent.category,
    capabilities: agent.capabilities ?? [],
    model: agent.model ?? "gpt-4o",
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.maxTokens ?? 2048,
    systemPrompt: agent.systemPrompt ?? "",
    responseFormat: agent.responseFormat ?? "text",
    memoryType: agent.memoryType ?? "none",
    timeout: agent.timeout ?? 60,
    retryCount: agent.retryCount ?? 2,
    triggerType: agent.triggerType ?? "manual",
    tags: agent.tags ?? [],
    inputSchema: agent.inputSchema ?? "",
    outputSchema: agent.outputSchema ?? "",
  };
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const agentId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agent, isLoading } = useGetAgent(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentQueryKey(agentId) },
  });
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof initFromAgent> | null>(null);
  const [capInput, setCapInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (agent && !editing) setForm(initFromAgent(agent));
  }, [agent, editing]);

  const set = <K extends keyof NonNullable<typeof form>>(key: K, value: NonNullable<typeof form>[K]) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const startEdit = () => {
    if (agent) { setForm(initFromAgent(agent)); setEditing(true); }
  };

  const saveEdit = () => {
    if (!form) return;
    const { capabilities, tags, ...rest } = form;
    updateAgent.mutate(
      { id: agentId, data: { ...rest, capabilities, tags } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          toast({ title: "Agent saved" });
          setEditing(false);
        },
      }
    );
  };

  const toggleStatus = () => {
    if (!agent) return;
    updateAgent.mutate(
      { id: agentId, data: { status: agent.status === "active" ? "inactive" : "active" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) }) }
    );
  };

  const handleDelete = () => {
    deleteAgent.mutate({ id: agentId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        toast({ title: "Agent deleted" });
        setLocation("/agents");
      },
    });
  };

  if (isLoading) return (
    <div className="max-w-2xl space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[60px] w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-[300px] w-full rounded-xl" />
    </div>
  );

  if (!agent) return (
    <div className="text-center py-20">
      <div className="text-4xl mb-3">🤖</div>
      <div className="font-semibold">Agent not found</div>
      <Link href="/agents"><Button className="mt-4 rounded-lg">Back to Repository</Button></Link>
    </div>
  );

  const meta = CATEGORY_META[agent.category] || DEFAULT_META;
  const f = form ?? initFromAgent(agent);

  const addCapability = () => {
    const t = capInput.trim();
    if (t && !f.capabilities.includes(t)) { set("capabilities", [...f.capabilities, t]); setCapInput(""); }
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !f.tags.includes(t)) { set("tags", [...f.tags, t]); setTagInput(""); }
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/agents">
          <motion.button whileTap={{ scale: 0.94 }} className="w-8 h-8 rounded-lg border border-border bg-white card-shadow flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: meta.bg }}>
              {agent.iconEmoji || "🤖"}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{agent.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}>
                  {agent.category}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">{agent.deployedCount} deployments</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={agent.status === "active"} onCheckedChange={toggleStatus} className="data-[state=checked]:bg-emerald-500" />
          <Label className="text-[11px] font-medium text-muted-foreground capitalize">{agent.status}</Label>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="h-9 p-1 bg-muted rounded-xl">
            <TabsTrigger value="profile" className="rounded-lg text-[12px] px-3">Profile</TabsTrigger>
            <TabsTrigger value="model" className="rounded-lg text-[12px] px-3">Model</TabsTrigger>
            <TabsTrigger value="behavior" className="rounded-lg text-[12px] px-3">Behavior</TabsTrigger>
            <TabsTrigger value="schema" className="rounded-lg text-[12px] px-3">Schema</TabsTrigger>
          </TabsList>
          {!editing ? (
            <Button variant="outline" onClick={startEdit} className="gap-2 rounded-lg h-8 text-xs"><Pencil className="w-3.5 h-3.5" />Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={updateAgent.isPending} className="gap-1.5 rounded-lg h-8 text-xs">
                {updateAgent.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="rounded-lg h-8 text-xs">Cancel</Button>
            </div>
          )}
        </div>

        {/* PROFILE */}
        <TabsContent value="profile">
          <div className="bg-white rounded-xl border border-border card-shadow p-5 space-y-4" style={{ borderTop: `2.5px solid ${meta.color}` }}>
            <div className="space-y-1.5">
              <Label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Name</Label>
              {editing ? <Input value={f.name} onChange={(e) => set("name", e.target.value)} className="h-9 rounded-lg" /> :
                <p className="text-[14px] font-semibold">{agent.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Description</Label>
              {editing ? <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className="rounded-lg resize-none" /> :
                <p className="text-[13px] text-muted-foreground leading-relaxed">{agent.description}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Capabilities</Label>
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={capInput} onChange={(e) => setCapInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCapability(); } }}
                      placeholder="Add capability" className="h-9 rounded-lg text-sm" />
                    <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={addCapability}><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.capabilities.map((cap) => (
                      <span key={cap} className="flex items-center gap-1 text-[11.5px] font-medium bg-primary/8 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                        {cap}<button onClick={() => set("capabilities", f.capabilities.filter((c) => c !== cap))}><X className="w-3 h-3 hover:text-destructive" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities?.length ? agent.capabilities.map((cap) => (
                    <span key={cap} className="text-[11.5px] font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{cap}</span>
                  )) : <span className="text-[12px] text-muted-foreground italic">No capabilities defined.</span>}
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-border text-[11px] text-muted-foreground font-medium">
              Created {new Date(agent.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </TabsContent>

        {/* MODEL */}
        <TabsContent value="model">
          <div className="bg-white rounded-xl border border-border card-shadow p-5">
            <ParamRow label="AI Model" hint="The language model powering this agent">
              {editing ? (
                <Select value={f.model} onValueChange={(v) => set("model", v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2"><span className="font-medium">{m.label}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{m.provider}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">{agent.model || "gpt-4o"}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{MODELS.find(m => m.value === agent.model)?.provider || "OpenAI"}</span>
              </div>}
            </ParamRow>

            <ParamRow label="Temperature" hint="Creativity level">
              {editing ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <Slider value={[f.temperature]} onValueChange={([v]) => set("temperature", v)} min={0} max={2} step={0.1} className="flex-1" />
                    <div className="w-12 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold text-primary">{f.temperature.toFixed(1)}</div>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>Precise (0)</span><span>Creative (2)</span></div>
                </div>
              ) : <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-muted flex-1 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${((agent.temperature ?? 0.7) / 2) * 100}%` }} />
                </div>
                <span className="font-mono text-sm font-semibold text-primary w-8 text-right">{(agent.temperature ?? 0.7).toFixed(1)}</span>
              </div>}
            </ParamRow>

            <ParamRow label="Max Tokens" hint="Maximum response length">
              {editing ? <Input type="number" value={f.maxTokens} onChange={(e) => set("maxTokens", Number(e.target.value))} min={100} max={128000} step={100} className="h-9 rounded-lg text-sm" /> :
                <span className="font-mono text-sm font-semibold text-foreground">{(agent.maxTokens ?? 2048).toLocaleString()}</span>}
            </ParamRow>

            <ParamRow label="Response Format" hint="Output format">
              {editing ? (
                <Select value={f.responseFormat} onValueChange={(v) => set("responseFormat", v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Plain Text</SelectItem>
                    <SelectItem value="json_object">JSON Object</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="font-mono text-[12px] bg-muted px-2 py-1 rounded font-medium">{agent.responseFormat || "text"}</span>}
            </ParamRow>

            <ParamRow label="System Prompt" hint="Core persona and instructions">
              {editing ? <Textarea value={f.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)}
                placeholder="You are a specialized AI agent..." rows={8} className="rounded-lg resize-none font-mono text-[12px]" /> :
                agent.systemPrompt ? <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap font-mono bg-muted rounded-lg p-3 max-h-40 overflow-auto">{agent.systemPrompt}</pre> :
                  <span className="text-[12px] text-muted-foreground italic">No system prompt set.</span>}
            </ParamRow>
          </div>
        </TabsContent>

        {/* BEHAVIOR */}
        <TabsContent value="behavior">
          <div className="bg-white rounded-xl border border-border card-shadow p-5">
            <ParamRow label="Trigger Type" hint="How this agent activates">
              {editing ? (
                <Select value={f.triggerType} onValueChange={(v) => set("triggerType", v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="chain">Chained</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="font-mono text-[12px] bg-muted px-2 py-1 rounded font-medium capitalize">{agent.triggerType || "manual"}</span>}
            </ParamRow>

            <ParamRow label="Memory Type" hint="Context retention between runs">
              {editing ? (
                <Select value={f.memoryType} onValueChange={(v) => set("memoryType", v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — stateless</SelectItem>
                    <SelectItem value="session">Session</SelectItem>
                    <SelectItem value="persistent">Persistent</SelectItem>
                    <SelectItem value="vector">Vector</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="font-mono text-[12px] bg-muted px-2 py-1 rounded font-medium capitalize">{agent.memoryType || "none"}</span>}
            </ParamRow>

            <ParamRow label="Timeout" hint="Max execution time">
              {editing ? (
                <div className="flex items-center gap-3">
                  <Slider value={[f.timeout]} onValueChange={([v]) => set("timeout", v)} min={10} max={300} step={5} className="flex-1" />
                  <div className="w-16 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold">{f.timeout}s</div>
                </div>
              ) : <span className="font-mono text-sm font-semibold">{agent.timeout ?? 60}s</span>}
            </ParamRow>

            <ParamRow label="Retry Count" hint="Retries on failure">
              {editing ? (
                <div className="flex items-center gap-3">
                  <Slider value={[f.retryCount]} onValueChange={([v]) => set("retryCount", v)} min={0} max={5} step={1} className="flex-1" />
                  <div className="w-12 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold">×{f.retryCount}</div>
                </div>
              ) : <span className="font-mono text-sm font-semibold">×{agent.retryCount ?? 2}</span>}
            </ParamRow>
          </div>
        </TabsContent>

        {/* SCHEMA */}
        <TabsContent value="schema">
          <div className="bg-white rounded-xl border border-border card-shadow p-5">
            <ParamRow label="Tags" hint="Organizational labels">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Add tag" className="h-9 rounded-lg text-sm" />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={addTag}><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        #{tag}<button onClick={() => set("tags", f.tags.filter((t) => t !== tag))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(agent.tags ?? []).length ? (agent.tags ?? []).map((t) => (
                    <span key={t} className="text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">#{t}</span>
                  )) : <span className="text-[12px] text-muted-foreground italic">No tags.</span>}
                </div>
              )}
            </ParamRow>

            <ParamRow label="Input Schema" hint="Expected input structure">
              {editing ? <Textarea value={f.inputSchema} onChange={(e) => set("inputSchema", e.target.value)}
                placeholder={'{ "type": "object", ... }'} rows={5} className="rounded-lg resize-none font-mono text-[12px]" /> :
                agent.inputSchema ? <pre className="text-[12px] font-mono bg-muted rounded-lg p-3 overflow-auto max-h-32">{agent.inputSchema}</pre> :
                  <span className="text-[12px] text-muted-foreground italic">No input schema defined.</span>}
            </ParamRow>

            <ParamRow label="Output Schema" hint="Expected output structure">
              {editing ? <Textarea value={f.outputSchema} onChange={(e) => set("outputSchema", e.target.value)}
                placeholder={'{ "type": "object", ... }'} rows={5} className="rounded-lg resize-none font-mono text-[12px]" /> :
                agent.outputSchema ? <pre className="text-[12px] font-mono bg-muted rounded-lg p-3 overflow-auto max-h-32">{agent.outputSchema}</pre> :
                  <span className="text-[12px] text-muted-foreground italic">No output schema defined.</span>}
            </ParamRow>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete */}
      <div className="flex justify-end pt-2">
        <Button variant="destructive" onClick={handleDelete} disabled={deleteAgent.isPending} className="gap-2 rounded-lg h-8 text-xs">
          <Trash2 className="w-3.5 h-3.5" />{deleteAgent.isPending ? "Deleting…" : "Delete Agent"}
        </Button>
      </div>
    </div>
  );
}
