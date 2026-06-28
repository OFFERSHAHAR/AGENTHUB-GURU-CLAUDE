import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateAgent, getListAgentsQueryKey, getListAgentCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["Sales", "Support", "Analytics", "Content", "Finance", "Operations", "Marketing", "Contact"];
const EMOJI_OPTIONS = ["🤖", "🧠", "📊", "💬", "💰", "⚡", "🎯", "🔍", "📝", "🚀", "🛡️", "✍️", "🔗", "📡", "🎓", "🏷️"];
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

const CATEGORY_META: Record<string, { bg: string; text: string; border: string }> = {
  Sales: { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  Support: { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  Analytics: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  Content: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  Finance: { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
  Operations: { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  Marketing: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  Contact: { bg: "#ecfeff", text: "#155e75", border: "#a5f3fc" },
};

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

export default function AgentNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createAgent = useCreateAgent();

  // Profile
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Sales");
  const [iconEmoji, setIconEmoji] = useState("🤖");
  const [status, setStatus] = useState("active");
  const [capInput, setCapInput] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);

  // Model
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [responseFormat, setResponseFormat] = useState("text");

  // Behavior
  const [memoryType, setMemoryType] = useState("none");
  const [timeout, setTimeout2] = useState(60);
  const [retryCount, setRetryCount] = useState(2);
  const [triggerType, setTriggerType] = useState("manual");

  // Schema
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [inputSchema, setInputSchema] = useState("");
  const [outputSchema, setOutputSchema] = useState("");

  const addCapability = () => {
    const t = capInput.trim();
    if (t && !capabilities.includes(t)) { setCapabilities([...capabilities, t]); setCapInput(""); }
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category || !description) return;
    createAgent.mutate(
      {
        data: {
          name, description, category, iconEmoji, capabilities, status,
          model, temperature, maxTokens: maxTokens || undefined,
          systemPrompt: systemPrompt || undefined,
          responseFormat, memoryType, timeout, retryCount, triggerType,
          tags, inputSchema: inputSchema || undefined, outputSchema: outputSchema || undefined,
        },
      },
      {
        onSuccess: (agent) => {
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAgentCategoriesQueryKey() });
          toast({ title: "Agent created", description: `"${agent.name}" is live in your repository.` });
          setLocation(`/agents/${agent.id}`);
        },
        onError: () => toast({ title: "Failed to create agent", variant: "destructive" }),
      }
    );
  };

  const categoryMeta = CATEGORY_META[category];
  const canSubmit = name && category && description && !createAgent.isPending;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/agents">
          <motion.button whileTap={{ scale: 0.94 }} className="w-8 h-8 rounded-lg border border-border bg-white card-shadow flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">New Agent</h1>
          <p className="text-muted-foreground text-sm">Configure every parameter of your AI agent.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="profile" className="space-y-5">
          <TabsList className="w-full h-10 p-1 bg-muted rounded-xl">
            <TabsTrigger value="profile" className="flex-1 rounded-lg text-[12.5px]">Profile</TabsTrigger>
            <TabsTrigger value="model" className="flex-1 rounded-lg text-[12.5px]">Model</TabsTrigger>
            <TabsTrigger value="behavior" className="flex-1 rounded-lg text-[12.5px]">Behavior</TabsTrigger>
            <TabsTrigger value="schema" className="flex-1 rounded-lg text-[12.5px]">Schema</TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-4">
            {/* Preview */}
            {name && category && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl border"
                style={{ background: categoryMeta?.bg || "#eef2ff", borderColor: categoryMeta?.border || "#c7d2fe" }}>
                <div className="text-3xl">{iconEmoji}</div>
                <div>
                  <div className="font-bold text-sm" style={{ color: categoryMeta?.text || "#4338ca" }}>{name}</div>
                  <div className="text-[11px] font-medium mt-0.5" style={{ color: categoryMeta?.text || "#4338ca", opacity: 0.7 }}>{category} · {model}</div>
                </div>
              </motion.div>
            )}

            <div className="bg-white rounded-xl border border-border card-shadow p-5 space-y-4">
              {/* Emoji */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Icon</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <motion.button key={emoji} type="button" whileTap={{ scale: 0.88 }} onClick={() => setIconEmoji(emoji)}
                      className={["w-9 h-9 rounded-xl text-lg transition-all", iconEmoji === emoji ? "bg-primary/10 ring-2 ring-primary ring-offset-1" : "bg-muted hover:bg-muted-foreground/10"].join(" ")}>
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Agent Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lead Qualifier Pro" className="h-10 rounded-lg" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_META[cat]?.text || "#6366f1" }} />{cat}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!category && <p className="text-[11px] text-destructive mt-1">בחר קטגוריה כדי ליצור סוכן.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Description *</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" rows={3} className="rounded-lg resize-none" required />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Capabilities</Label>
                <div className="flex gap-2">
                  <Input value={capInput} onChange={(e) => setCapInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCapability(); } }}
                    placeholder="Type a capability and press Enter" className="h-10 rounded-lg" />
                  <Button type="button" variant="outline" size="icon" onClick={addCapability} className="h-10 w-10 rounded-lg shrink-0"><Plus className="w-4 h-4" /></Button>
                </div>
                <AnimatePresence>
                  {capabilities.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-1.5 pt-1">
                      {capabilities.map((cap) => (
                        <motion.span key={cap} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1 text-[11.5px] font-medium bg-primary/8 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                          {cap}<button type="button" onClick={() => setCapabilities(capabilities.filter((c) => c !== cap))}><X className="w-3 h-3 hover:text-destructive" /></button>
                        </motion.span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabsContent>

          {/* MODEL TAB */}
          <TabsContent value="model">
            <div className="bg-white rounded-xl border border-border card-shadow p-5">
              <ParamRow label="AI Model" hint="The language model that powers this agent">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center justify-between gap-8 w-full">
                          <span className="font-medium">{m.label}</span>
                          <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">{m.provider}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ParamRow>

              <ParamRow label="Temperature" hint="Higher = more creative, lower = more focused">
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={0} max={2} step={0.1} className="flex-1" />
                    <div className="w-12 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold text-primary">
                      {temperature.toFixed(1)}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                    <span>Precise (0)</span><span>Balanced (1)</span><span>Creative (2)</span>
                  </div>
                </div>
              </ParamRow>

              <ParamRow label="Max Tokens" hint="Maximum output length (100 – 128,000)">
                <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}
                  min={100} max={128000} step={100} className="h-9 rounded-lg text-sm" />
              </ParamRow>

              <ParamRow label="Response Format" hint="How the agent formats its output">
                <Select value={responseFormat} onValueChange={setResponseFormat}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Plain Text</SelectItem>
                    <SelectItem value="json_object">JSON Object</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </ParamRow>

              <ParamRow label="System Prompt" hint="Core instructions that define the agent's persona and rules">
                <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={"You are a specialized AI agent that...\n\nYour primary responsibilities:\n1. ...\n2. ..."}
                  rows={8} className="rounded-lg resize-none font-mono text-[12px] leading-relaxed" />
              </ParamRow>
            </div>
          </TabsContent>

          {/* BEHAVIOR TAB */}
          <TabsContent value="behavior">
            <div className="bg-white rounded-xl border border-border card-shadow p-5">
              <ParamRow label="Trigger Type" hint="How this agent is activated">
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual — triggered on demand</SelectItem>
                    <SelectItem value="webhook">Webhook — HTTP POST trigger</SelectItem>
                    <SelectItem value="scheduled">Scheduled — runs on a cron</SelectItem>
                    <SelectItem value="event">Event — reacts to system events</SelectItem>
                    <SelectItem value="chain">Chained — called by another agent</SelectItem>
                  </SelectContent>
                </Select>
              </ParamRow>

              <ParamRow label="Memory Type" hint="How the agent retains context between runs">
                <Select value={memoryType} onValueChange={setMemoryType}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — stateless, no memory</SelectItem>
                    <SelectItem value="session">Session — within a conversation</SelectItem>
                    <SelectItem value="persistent">Persistent — stored long-term</SelectItem>
                    <SelectItem value="vector">Vector — semantic search memory</SelectItem>
                  </SelectContent>
                </Select>
              </ParamRow>

              <ParamRow label="Timeout (seconds)" hint="Max time before the agent is cancelled (10–300)">
                <div className="flex items-center gap-3">
                  <Slider value={[timeout]} onValueChange={([v]) => setTimeout2(v)} min={10} max={300} step={5} className="flex-1" />
                  <div className="w-16 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold text-foreground">
                    {timeout}s
                  </div>
                </div>
              </ParamRow>

              <ParamRow label="Retry Count" hint="How many times to retry on failure (0–5)">
                <div className="flex items-center gap-3">
                  <Slider value={[retryCount]} onValueChange={([v]) => setRetryCount(v)} min={0} max={5} step={1} className="flex-1" />
                  <div className="w-12 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold text-foreground">
                    ×{retryCount}
                  </div>
                </div>
              </ParamRow>
            </div>
          </TabsContent>

          {/* SCHEMA TAB */}
          <TabsContent value="schema">
            <div className="bg-white rounded-xl border border-border card-shadow p-5">
              <ParamRow label="Tags" hint="Labels for organizing and filtering agents">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Add tag and press Enter" className="h-9 rounded-lg text-sm" />
                    <Button type="button" variant="outline" size="icon" onClick={addTag} className="h-9 w-9 rounded-lg shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        #{tag}<button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </ParamRow>

              <ParamRow label="Input Schema" hint="Expected input structure (JSON Schema or plain description)">
                <Textarea value={inputSchema} onChange={(e) => setInputSchema(e.target.value)}
                  placeholder={'{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  }\n}'}
                  rows={6} className="rounded-lg resize-none font-mono text-[12px]" />
              </ParamRow>

              <ParamRow label="Output Schema" hint="Expected output structure (JSON Schema or plain description)">
                <Textarea value={outputSchema} onChange={(e) => setOutputSchema(e.target.value)}
                  placeholder={'{\n  "type": "object",\n  "properties": {\n    "result": { "type": "string" },\n    "confidence": { "type": "number" }\n  }\n}'}
                  rows={6} className="rounded-lg resize-none font-mono text-[12px]" />
              </ParamRow>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button type="submit" disabled={!canSubmit} title={!category ? "בחר קטגוריה" : undefined} className="w-full h-10 rounded-lg font-semibold gap-2">
              {createAgent.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : "Create Agent"}
            </Button>
          </motion.div>
          <Link href="/agents"><Button type="button" variant="outline" className="h-10 rounded-lg">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
