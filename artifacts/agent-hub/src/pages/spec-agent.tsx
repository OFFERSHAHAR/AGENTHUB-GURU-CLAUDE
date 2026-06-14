import { useState, useRef, useEffect } from "react";
import {
  useListClients,
  useListAgents,
  useCreateAssignment,
  useCreateWorkflow,
  getListClientAssignmentsQueryKey,
  getListWorkflowsQueryKey,
  type Agent,
  type Client,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Download,
  Bot,
  User,
  Loader2,
  Copy,
  FileJson,
  Building2,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SpecOutput {
  n8nWorkflow: object;
  recommendedAgentId: number;
  reasoning: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPEC_OUTPUT_START = "<<<SPEC_OUTPUT_START>>>";
const SPEC_OUTPUT_END = "<<<SPEC_OUTPUT_END>>>";

function parseSpecOutput(reply: string): { text: string; spec: SpecOutput | null } {
  const startIdx = reply.indexOf(SPEC_OUTPUT_START);
  const endIdx = reply.indexOf(SPEC_OUTPUT_END);
  if (startIdx === -1 || endIdx === -1) {
    return { text: reply, spec: null };
  }
  const text = reply.slice(0, startIdx).trim();
  const jsonStr = reply.slice(startIdx + SPEC_OUTPUT_START.length, endIdx).trim();
  try {
    const spec = JSON.parse(jsonStr) as SpecOutput;
    return { text, spec };
  } catch {
    return { text: reply, spec: null };
  }
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── N8N → React Flow conversion ───────────────────────────────────────────────
// The Workflows section (workflow-canvas / workflows pages) stores nodes/edges in
// React Flow's internal schema ({ id, type, position: {x,y}, data }). The Spec
// Agent emits raw N8N JSON ({ name, nodes:[{type:"n8n-nodes-base.*", position:[x,y]}],
// connections:{...} }). We translate it so a saved workflow renders correctly when
// opened on /workflows/:id, and the Workflows card shows proper node-type chips.

interface RFNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}
interface RFEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}
interface N8nNode {
  id?: string;
  name?: string;
  type?: string;
  position?: [number, number] | { x: number; y: number };
  parameters?: Record<string, unknown>;
}
interface N8nConnection {
  main?: Array<Array<{ node?: string }>>;
}

function mapN8nNodeType(rawType: string): { type: string; triggerType?: string; outputType?: string } {
  const base = (rawType || "").toLowerCase().split(".").pop() ?? "";
  if (base.includes("webhook") && base.includes("respond")) return { type: "outputNode", outputType: "webhook" };
  if (base.includes("trigger") || base === "webhook" || base.includes("cron") || base.includes("schedule")) {
    if (base.includes("webhook")) return { type: "triggerNode", triggerType: "webhook" };
    if (base.includes("schedule") || base.includes("cron")) return { type: "triggerNode", triggerType: "scheduled" };
    if (base.includes("manual")) return { type: "triggerNode", triggerType: "manual" };
    return { type: "triggerNode", triggerType: "event" };
  }
  if (base === "if" || base === "switch" || base === "filter") return { type: "conditionNode" };
  if (base === "wait") return { type: "delayNode" };
  if (base.includes("email") || base.includes("gmail")) return { type: "outputNode", outputType: "email" };
  if (base.includes("slack") || base.includes("telegram")) return { type: "outputNode", outputType: "notification" };
  if (base.includes("respond") || base === "noop" || base === "set") return { type: "outputNode", outputType: "webhook" };
  return { type: "agentNode" };
}

function toPosition(pos: N8nNode["position"], index: number): { x: number; y: number } {
  if (Array.isArray(pos) && pos.length >= 2) return { x: Number(pos[0]) || 0, y: Number(pos[1]) || 0 };
  if (pos && typeof pos === "object" && "x" in pos && "y" in pos) return { x: Number(pos.x) || 0, y: Number(pos.y) || 0 };
  return { x: 250 + index * 250, y: 300 };
}

function n8nToReactFlow(n8nWorkflow: unknown): { nodes: RFNode[]; edges: RFEdge[] } {
  const wf = (n8nWorkflow ?? {}) as { nodes?: N8nNode[]; connections?: Record<string, N8nConnection> };
  const rawNodes = Array.isArray(wf.nodes) ? wf.nodes : [];

  const nameToId: Record<string, string> = {};
  const nodes: RFNode[] = rawNodes.map((n, i) => {
    const id = n.id?.toString() || `node-${i + 1}`;
    if (n.name) nameToId[n.name] = id;
    const mapped = mapN8nNodeType(n.type ?? "");
    const label = n.name || `Node ${i + 1}`;
    const data: Record<string, unknown> = { label };
    if (mapped.triggerType) data.triggerType = mapped.triggerType;
    if (mapped.outputType) data.outputType = mapped.outputType;
    if (mapped.type === "delayNode") data.delay = 5;
    return { id, type: mapped.type, position: toPosition(n.position, i), data };
  });

  const edges: RFEdge[] = [];
  const connections = (wf.connections ?? {}) as Record<string, N8nConnection>;
  for (const [srcName, conn] of Object.entries(connections)) {
    const srcId = nameToId[srcName];
    if (!srcId || !Array.isArray(conn?.main)) continue;
    conn.main.forEach((group) => {
      if (!Array.isArray(group)) return;
      group.forEach((c) => {
        const tgtId = c?.node ? nameToId[c.node] : undefined;
        if (!tgtId) return;
        edges.push({
          id: `e-${srcId}-${tgtId}-${edges.length}`,
          source: srcId,
          target: tgtId,
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        });
      });
    });
  }

  return { nodes, edges };
}

function deriveWorkflowName(summary: string): string {
  const firstSentence = summary.split(/[.!?\n]/)[0]?.trim() ?? "";
  const base = (firstSentence || summary).trim();
  if (!base) return `סוכן האפיון — ${new Date().toLocaleDateString("he-IL")}`;
  return base.length > 80 ? `${base.slice(0, 77)}…` : base;
}

async function callSpecAgent(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/spec-agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error("API error");
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, index }: { msg: ChatMessage; index: number }) {
  const { toast } = useToast();
  const isUser = msg.role === "user";

  const copy = () => {
    navigator.clipboard.writeText(msg.content).then(() => toast({ title: "הועתק ✓" }));
  };

  // Strip spec output block before rendering assistant message
  const { text } = parseSpecOutput(msg.content);
  const displayContent = text || msg.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-primary text-white" : "bg-violet-100 text-violet-700"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
            isUser
              ? "bg-primary text-white rounded-tr-sm"
              : "bg-white border border-border text-foreground rounded-tl-sm shadow-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
              <ReactMarkdown>{displayContent}</ReactMarkdown>
            </div>
          )}
        </div>
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1"
        >
          <Copy className="w-3 h-3" />
          העתק
        </button>
      </div>
    </motion.div>
  );
}

// ─── Workflow Panel ───────────────────────────────────────────────────────────

function WorkflowPanel({
  spec,
  summary,
  agents,
  clients,
  onAssigned,
}: {
  spec: SpecOutput;
  summary: string;
  agents: Agent[];
  clients: Client[];
  onAssigned: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [saved, setSaved] = useState(false);
  const createAssignment = useCreateAssignment();
  const createWorkflow = useCreateWorkflow();

  // Reset the "saved" state whenever a new spec is produced in the same panel.
  useEffect(() => {
    setSaved(false);
  }, [spec]);

  const recommendedAgent = agents.find((a) => a.id === spec.recommendedAgentId);
  const workflowJson = JSON.stringify(spec.n8nWorkflow, null, 2);

  const saveToWorkflows = () => {
    const name = deriveWorkflowName(summary);
    const { nodes, edges } = n8nToReactFlow(spec.n8nWorkflow);

    createWorkflow.mutate(
      {
        data: {
          name,
          description: spec.reasoning,
          status: "draft",
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges),
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
          setSaved(true);
          toast({
            title: "✅ ה-workflow נשמר ב-Workflows",
            description: name,
            action: (
              <ToastAction
                altText="פתח את ה-workflow"
                onClick={() => {
                  window.location.href = `${BASE_URL}/workflows/${created.id}`;
                }}
              >
                פתח
              </ToastAction>
            ),
          });
        },
        onError: () => {
          toast({ title: "שגיאה בשמירת ה-workflow", variant: "destructive" });
        },
      }
    );
  };

  const downloadJson = () => {
    const blob = new Blob([workflowJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `n8n-workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(workflowJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAssign = () => {
    if (!selectedClientId || !recommendedAgent) return;
    const clientId = parseInt(selectedClientId, 10);
    createAssignment.mutate(
      { id: clientId, data: { agentId: recommendedAgent.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(clientId) });
          toast({ title: `✅ ${recommendedAgent.name} הוקצה ללקוח בהצלחה` });
          setAssigned(true);
          onAssigned();
        },
        onError: () => {
          toast({ title: "שגיאה בהקצאה", description: "ייתכן שהסוכן כבר מוקצה ללקוח זה", variant: "destructive" });
        },
      }
    );
  };

  const CATEGORY_META: Record<string, { bg: string; text: string; border: string }> = {
    Sales: { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
    Support: { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
    Analytics: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
    Content: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    Finance: { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
    Operations: { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
    Marketing: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  };
  const meta = recommendedAgent ? (CATEGORY_META[recommendedAgent.category] ?? CATEGORY_META.Sales) : CATEGORY_META.Sales;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4"
    >
      {/* Agent Recommendation */}
      {recommendedAgent && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              סוכן מומלץ
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: meta.bg }}
              >
                {recommendedAgent.iconEmoji || "🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13.5px] text-foreground truncate">
                  {recommendedAgent.name}
                </div>
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                >
                  {recommendedAgent.category}
                </span>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
              {recommendedAgent.description.slice(0, 120)}…
            </p>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
              <div className="text-[9.5px] font-bold uppercase tracking-widest text-violet-600 mb-1">
                נימוק הבחירה
              </div>
              <p className="text-[11.5px] text-violet-900 leading-relaxed" dir="rtl">
                {spec.reasoning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow JSON */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileJson className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              N8N Workflow JSON
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={copyJson}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "הועתק!" : "העתק"}
            </button>
            <button
              onClick={downloadJson}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              הורדה
            </button>
            <button
              onClick={saveToWorkflows}
              disabled={createWorkflow.isPending || saved}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 bg-primary/8 hover:bg-primary/12 px-2 py-1 rounded-lg transition-colors border border-primary/15 disabled:opacity-60 disabled:cursor-default"
            >
              {createWorkflow.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saved ? "נשמר" : "שמור ל-Workflows"}
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-auto">
          <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed p-4 whitespace-pre">
            {workflowJson}
          </pre>
        </div>
      </div>

      {/* Assignment */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            הקצאה ללקוח
          </span>
        </div>
        <div className="p-4 space-y-3">
          <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={assigned}>
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue placeholder="בחר לקוח..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full h-9 rounded-lg font-semibold text-[13px] gap-2"
            disabled={!selectedClientId || createAssignment.isPending || assigned || !recommendedAgent}
            onClick={handleAssign}
          >
            <AnimatePresence mode="wait" initial={false}>
              {createAssignment.isPending ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />מקצה…
                </motion.span>
              ) : assigned ? (
                <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />הוקצה בהצלחה!
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />הקצה סוכן ללקוח
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
          {!recommendedAgent && (
            <p className="text-[11px] text-muted-foreground text-center">
              לא נמצא סוכן מומלץ (ID {spec.recommendedAgentId})
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpecAgentPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [specOutput, setSpecOutput] = useState<SpecOutput | null>(null);
  const [specSummary, setSpecSummary] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: agents = [] } = useListAgents({});
  const { data: clients = [] } = useListClients();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await callSpecAgent(newMessages);
      const { text, spec } = parseSpecOutput(reply);
      if (spec) {
        setSpecOutput(spec);
        const firstUserMsg = newMessages.find((m) => m.role === "user")?.content ?? "";
        setSpecSummary(text?.trim() || firstUserMsg);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      toast({ title: "שגיאה בתקשורת עם הסוכן", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setSpecOutput(null);
    setSpecSummary("");
    setInput("");
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)] min-h-0">
      {/* ── Chat Column ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">סוכן האפיון</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              תאר בעיה ארגונית — הסוכן ישאל שאלות מבהירות ויפיק מפרט אוטומציה מלא
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={resetConversation} className="text-[12px] h-8 rounded-lg">
              שיחה חדשה
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-border shadow-sm p-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">ברוך הבא לסוכן האפיון</h3>
                <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed">
                  תאר בעיה ארגונית או תהליך שאתה רוצה לאוטומט. הסוכן ישאל שאלות מבהירות ויפיק: מפרט N8N workflow, המלצת סוכן, והקצאה ללקוח בלחיצה אחת.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {[
                  "אנחנו צריכים מערכת תמיכה שמסווגת פניות לפי דחיפות",
                  "רוצה לאוטומט את תהליך אישור החשבוניות",
                  "צריך לנטר בריאות לקוחות ולהתריע על סיכוני נטישה",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setInput(example)}
                    className="text-[11.5px] text-primary bg-primary/6 hover:bg-primary/10 border border-primary/15 px-3 py-1.5 rounded-lg transition-colors text-right"
                    dir="rtl"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} index={i} />
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-3 shrink-0">
          <div className="bg-white rounded-xl border border-border shadow-sm p-3 flex gap-2.5 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="תאר בעיה ארגונית או תהליך לאוטומציה…"
              rows={2}
              className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 text-[13.5px] leading-relaxed p-0 min-h-[44px]"
              dir="rtl"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 p-0 rounded-lg shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10.5px] text-muted-foreground text-center mt-1.5">
            Enter לשליחה · Shift+Enter לשורה חדשה
          </p>
        </div>
      </div>

      {/* ── Spec Output Panel ── */}
      <div className="w-[340px] shrink-0 flex flex-col overflow-y-auto">
        <AnimatePresence>
          {specOutput ? (
            <WorkflowPanel
              key="spec"
              spec={specOutput}
              summary={specSummary}
              agents={agents}
              clients={clients}
              onAssigned={() => {}}
            />
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-3 bg-white/50 rounded-xl border border-dashed border-border p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <FileJson className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">
                  תוצאת האפיון תופיע כאן
                </p>
                <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">
                  לאחר 3–6 סבבי שאלות, הסוכן<br />
                  יפיק workflow וימליץ על סוכן
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
