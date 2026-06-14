import { useCallback, useRef, useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  ReactFlow, Background, Controls, MiniMap, BackgroundVariant,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  type Node, type Edge, type NodeProps, type OnConnect,
  ReactFlowProvider, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useGetWorkflow, useUpdateWorkflow, useListAgents,
  getGetWorkflowQueryKey,
  type Agent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Save, CheckCircle2, Loader2, X, Zap, GitBranch, Clock, Send,
  SlidersHorizontal, Play, Download, ShieldAlert, ChevronDown, ChevronUp,
  AlertTriangle, Info, Circle, CheckCircle, XCircle, SkipForward,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// ─── Category meta ────────────────────────────────────────────────────────────
const CAT: Record<string, { color: string; bg: string; border: string; text: string }> = {
  Sales: { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  Support: { color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1" },
  Analytics: { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  Content: { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  Finance: { color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8", text: "#9d174d" },
  Operations: { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" },
  Marketing: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
};
const DEFAULT_CAT = { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" };

// ─── Run state types ──────────────────────────────────────────────────────────
type RunState = "idle" | "running" | "success" | "error" | "skipped" | "warning";
type RunStateMap = Record<string, RunState>;

const RUN_COLORS: Record<RunState, string> = {
  idle: "transparent",
  running: "#6366f1",
  success: "#10b981",
  error: "#ef4444",
  skipped: "#94a3b8",
  warning: "#f59e0b",
};

function RunOverlay({ state }: { state: RunState }) {
  if (state === "idle") return null;
  const color = RUN_COLORS[state];
  return (
    <div style={{
      position: "absolute", inset: -3, borderRadius: 14,
      border: `2.5px solid ${color}`,
      boxShadow: state === "running" ? `0 0 12px ${color}88` : `0 0 6px ${color}44`,
      pointerEvents: "none", zIndex: 10,
      animation: state === "running" ? "pulse-ring 1.2s ease-in-out infinite" : undefined,
    }}>
      <div style={{
        position: "absolute", top: -10, right: -10, width: 20, height: 20,
        borderRadius: "50%", background: color, display: "flex", alignItems: "center",
        justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      }}>
        {state === "running" && <Loader2 style={{ width: 11, height: 11, color: "#fff", animation: "spin 0.8s linear infinite" }} />}
        {state === "success" && <span style={{ fontSize: 9, color: "#fff" }}>✓</span>}
        {state === "error" && <span style={{ fontSize: 9, color: "#fff" }}>✗</span>}
        {state === "skipped" && <span style={{ fontSize: 9, color: "#fff" }}>–</span>}
        {state === "warning" && <span style={{ fontSize: 9, color: "#fff" }}>!</span>}
      </div>
    </div>
  );
}

// ─── Custom Node Components ───────────────────────────────────────────────────
type TriggerData = { label: string; triggerType: string; _runState?: RunState };
function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerData;
  const rs = d._runState ?? "idle";
  const icons: Record<string, string> = { manual: "👆", webhook: "🌐", scheduled: "⏱️", event: "⚡" };
  return (
    <div style={{ position: "relative" }}>
      <RunOverlay state={rs} />
      <div className={`rounded-xl border-2 bg-white shadow-md min-w-[160px] transition-shadow ${selected ? "shadow-lg" : ""}`}
        style={{ borderColor: selected ? "#6366f1" : "#c7d2fe" }}>
        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
          <span className="text-base">{icons[d.triggerType] || "⚡"}</span>
          <span className="text-white font-semibold text-[11px] uppercase tracking-wider">Trigger</span>
        </div>
        <div className="px-3 py-2.5">
          <div className="font-semibold text-[12.5px] text-foreground">{d.label || "Start"}</div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 capitalize">{d.triggerType || "manual"}</div>
        </div>
        <Handle type="source" position={Position.Bottom} style={{ width: 10, height: 10, background: "#6366f1", border: "2px solid white" }} />
      </div>
    </div>
  );
}

type AgentData = { label: string; agentId?: number; category?: string; iconEmoji?: string; model?: string; temperature?: number; systemPrompt?: string; _runState?: RunState };
function AgentNode({ data, selected }: NodeProps) {
  const d = data as AgentData;
  const rs = d._runState ?? "idle";
  const meta = CAT[d.category || ""] || DEFAULT_CAT;
  return (
    <div style={{ position: "relative" }}>
      <RunOverlay state={rs} />
      <div className={`rounded-xl border-2 bg-white shadow-md min-w-[180px] transition-shadow ${selected ? "shadow-lg" : ""}`}
        style={{ borderColor: selected ? meta.color : meta.border, borderTop: `3px solid ${meta.color}` }}>
        <Handle type="target" position={Position.Top} style={{ width: 10, height: 10, background: meta.color, border: "2px solid white" }} />
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: meta.bg }}>
              {d.iconEmoji || "🤖"}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[12.5px] text-foreground truncate">{d.label || "Agent"}</div>
              <div className="text-[10px] font-medium" style={{ color: meta.text }}>{d.category || "General"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {d.model && <span className="text-[9.5px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{d.model}</span>}
            {d.temperature !== undefined && <span className="text-[9.5px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">t={d.temperature}</span>}
            {!d.agentId && <span className="text-[9.5px] font-mono bg-red-50 border border-red-200 text-red-500 px-1.5 py-0.5 rounded">no agent</span>}
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} style={{ width: 10, height: 10, background: meta.color, border: "2px solid white" }} />
      </div>
    </div>
  );
}

type ConditionData = { label: string; condition?: string; _runState?: RunState };
function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionData;
  const rs = d._runState ?? "idle";
  return (
    <div style={{ position: "relative" }}>
      <RunOverlay state={rs} />
      <div className={`rounded-xl border-2 bg-white shadow-md min-w-[160px] transition-shadow ${selected ? "shadow-lg" : ""}`}
        style={{ borderColor: selected ? "#f59e0b" : "#fde68a" }}>
        <Handle type="target" position={Position.Top} style={{ width: 10, height: 10, background: "#f59e0b", border: "2px solid white" }} />
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-white" />
          <span className="text-white font-semibold text-[11px] uppercase tracking-wider">Condition</span>
        </div>
        <div className="px-3 py-2.5">
          <div className="font-semibold text-[12.5px] text-foreground">{d.label || "If / Else"}</div>
          {d.condition
            ? <div className="text-[10.5px] font-mono text-muted-foreground mt-1 bg-muted px-2 py-1 rounded truncate">{d.condition}</div>
            : <div className="text-[10.5px] text-red-400 mt-1">⚠ no condition set</div>
          }
        </div>
        <Handle type="source" position={Position.Bottom} id="true" style={{ left: "30%", width: 10, height: 10, background: "#10b981", border: "2px solid white" }} />
        <Handle type="source" position={Position.Bottom} id="false" style={{ left: "70%", width: 10, height: 10, background: "#ef4444", border: "2px solid white" }} />
        <div style={{ position: "absolute", bottom: -18, left: "25%", fontSize: 9, color: "#10b981", fontWeight: 700 }}>TRUE</div>
        <div style={{ position: "absolute", bottom: -18, left: "65%", fontSize: 9, color: "#ef4444", fontWeight: 700 }}>FALSE</div>
      </div>
    </div>
  );
}

type OutputData = { label: string; outputType?: string; _runState?: RunState };
function OutputNode({ data, selected }: NodeProps) {
  const d = data as OutputData;
  const rs = d._runState ?? "idle";
  const icons: Record<string, string> = { webhook: "🌐", email: "✉️", notification: "🔔", log: "📋" };
  return (
    <div style={{ position: "relative" }}>
      <RunOverlay state={rs} />
      <div className={`rounded-xl border-2 bg-white shadow-md min-w-[160px] transition-shadow ${selected ? "shadow-lg" : ""}`}
        style={{ borderColor: selected ? "#10b981" : "#a7f3d0" }}>
        <Handle type="target" position={Position.Top} style={{ width: 10, height: 10, background: "#10b981", border: "2px solid white" }} />
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
          <span className="text-base">{icons[d.outputType || ""] || "📤"}</span>
          <span className="text-white font-semibold text-[11px] uppercase tracking-wider">Output</span>
        </div>
        <div className="px-3 py-2.5">
          <div className="font-semibold text-[12.5px] text-foreground">{d.label || "Response"}</div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 capitalize">{d.outputType || "webhook"}</div>
        </div>
      </div>
    </div>
  );
}

type DelayData = { label: string; delay?: number; _runState?: RunState };
function DelayNode({ data, selected }: NodeProps) {
  const d = data as DelayData;
  const rs = d._runState ?? "idle";
  return (
    <div style={{ position: "relative" }}>
      <RunOverlay state={rs} />
      <div className={`rounded-xl border-2 bg-white shadow-md min-w-[140px] transition-shadow ${selected ? "shadow-lg" : ""}`}
        style={{ borderColor: selected ? "#8b5cf6" : "#ddd6fe" }}>
        <Handle type="target" position={Position.Top} style={{ width: 10, height: 10, background: "#8b5cf6", border: "2px solid white" }} />
        <div className="bg-gradient-to-r from-violet-500 to-purple-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-white" />
          <span className="text-white font-semibold text-[11px] uppercase tracking-wider">Delay</span>
        </div>
        <div className="px-3 py-2.5">
          <div className="font-semibold text-[12.5px] text-foreground">{d.label || "Wait"}</div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5">{d.delay ?? 5}s delay</div>
        </div>
        <Handle type="source" position={Position.Bottom} style={{ width: 10, height: 10, background: "#8b5cf6", border: "2px solid white" }} />
      </div>
    </div>
  );
}

const NODE_TYPES = { triggerNode: TriggerNode, agentNode: AgentNode, conditionNode: ConditionNode, outputNode: OutputNode, delayNode: DelayNode };

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  { type: "triggerNode", label: "Trigger", icon: <Zap className="w-3.5 h-3.5" />, color: "#6366f1", bg: "#eef2ff", defaultData: { label: "Start", triggerType: "manual" } },
  { type: "conditionNode", label: "Condition", icon: <GitBranch className="w-3.5 h-3.5" />, color: "#f59e0b", bg: "#fffbeb", defaultData: { label: "If / Else", condition: "" } },
  { type: "delayNode", label: "Delay", icon: <Clock className="w-3.5 h-3.5" />, color: "#8b5cf6", bg: "#f5f3ff", defaultData: { label: "Wait", delay: 5 } },
  { type: "outputNode", label: "Output", icon: <Send className="w-3.5 h-3.5" />, color: "#10b981", bg: "#ecfdf5", defaultData: { label: "Response", outputType: "webhook" } },
];

let nodeIdCounter = Date.now();
const nextId = () => `node-${++nodeIdCounter}`;
const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// ─── Validation engine ────────────────────────────────────────────────────────
type ValidationSeverity = "error" | "warning" | "info";
interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  nodeId?: string;
  message: string;
}

function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const triggers = nodes.filter(n => n.type === "triggerNode");
  if (triggers.length === 0) {
    issues.push({ id: "no-trigger", severity: "error", message: "חסר Trigger — כל workflow חייב להתחיל מ-Trigger" });
  }
  if (triggers.length > 1) {
    issues.push({ id: "multi-trigger", severity: "warning", message: `${triggers.length} Trigger nodes — n8n תומך בטריגר אחד per workflow` });
  }

  const connectedNodeIds = new Set([...edges.map(e => e.source), ...edges.map(e => e.target)]);
  nodes.forEach(n => {
    if (n.type === "agentNode") {
      const d = n.data as AgentData;
      if (!d.agentId) {
        issues.push({ id: `no-agent-${n.id}`, severity: "error", nodeId: n.id, message: `Node "${d.label || n.id}": לא נבחר סוכן` });
      }
    }
    if (n.type === "conditionNode") {
      const d = n.data as ConditionData;
      if (!d.condition?.trim()) {
        issues.push({ id: `no-cond-${n.id}`, severity: "warning", nodeId: n.id, message: `Condition "${d.label || n.id}": ביטוי ריק — תמיד יחזיר FALSE` });
      }
    }
    if (nodes.length > 1 && !connectedNodeIds.has(n.id) && n.type !== "triggerNode") {
      issues.push({ id: `floating-${n.id}`, severity: "warning", nodeId: n.id, message: `Node "${(n.data as Record<string, unknown>).label || n.id}" מנותק — לא מחובר לאף edge` });
    }
  });

  const outputs = nodes.filter(n => n.type === "outputNode");
  if (outputs.length === 0 && nodes.length > 1) {
    issues.push({ id: "no-output", severity: "warning", message: "אין Output node — הworkflow לא יחזיר תגובה" });
  }

  if (nodes.length === 0) {
    issues.push({ id: "empty", severity: "error", message: "הworkflow ריק לחלוטין" });
  }

  return issues;
}

// ─── Simulation engine ────────────────────────────────────────────────────────
interface SimStep {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  state: "success" | "error" | "skipped" | "warning";
  message: string;
  duration: number;
  payload?: Record<string, unknown>;
}

function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));
  const adj = new Map<string, string[]>(nodes.map(n => [n.id, []]));

  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    adj.get(e.source)?.push(e.target);
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

  const sorted: Node[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.find(n => n.id === id);
    if (node) sorted.push(node);
    (adj.get(id) ?? []).forEach(nextId => {
      const deg = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, deg);
      if (deg === 0) queue.push(nextId);
    });
  }

  return sorted;
}

async function* simulateWorkflow(
  nodes: Node[],
  edges: Edge[],
  onRunState: (map: RunStateMap) => void,
): AsyncGenerator<SimStep> {
  const issues = validateWorkflow(nodes, edges);
  const errors = issues.filter(i => i.severity === "error");
  if (errors.length > 0) {
    for (const e of errors) {
      yield { nodeId: "", nodeLabel: "Validator", nodeType: "validator", state: "error", message: e.message, duration: 0 };
    }
    return;
  }

  const sorted = topoSort(nodes, edges);
  const runState: RunStateMap = {};
  nodes.forEach(n => { runState[n.id] = "idle"; });
  onRunState({ ...runState });

  let mockPayload: Record<string, unknown> = {
    type: "test_event",
    source: "agenthub_simulation",
    timestamp: new Date().toISOString(),
    data: { message: "Simulated input", priority: "normal" },
  };

  for (const node of sorted) {
    const d = node.data as Record<string, unknown>;
    const label = String(d.label || node.type);
    const stepStart = Date.now();

    runState[node.id] = "running";
    onRunState({ ...runState });
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

    let step: SimStep;

    if (node.type === "triggerNode") {
      runState[node.id] = "success";
      onRunState({ ...runState });
      step = {
        nodeId: node.id, nodeLabel: label, nodeType: "triggerNode", state: "success",
        message: `Trigger "${d.triggerType}" activated — payload generated`,
        duration: Date.now() - stepStart, payload: mockPayload,
      };

    } else if (node.type === "agentNode") {
      if (!d.agentId) {
        runState[node.id] = "error";
        onRunState({ ...runState });
        step = { nodeId: node.id, nodeLabel: label, nodeType: "agentNode", state: "error", message: `לא נבחר סוכן — לא ניתן להריץ`, duration: Date.now() - stepStart };
      } else {
        const response = `[Simulated] Agent "${label}" processed input with model ${d.model ?? "gpt-4o"} (temp=${d.temperature ?? 0.7})`;
        mockPayload = { ...mockPayload, agentResponse: response, processedBy: label };
        runState[node.id] = "success";
        onRunState({ ...runState });
        step = {
          nodeId: node.id, nodeLabel: label, nodeType: "agentNode", state: "success",
          message: response, duration: Date.now() - stepStart, payload: mockPayload,
        };
      }

    } else if (node.type === "conditionNode") {
      const expr = String(d.condition || "");
      let result = false;
      let evalMsg = "";
      if (!expr.trim()) {
        evalMsg = "ביטוי ריק — FALSE";
      } else {
        try {
          // eslint-disable-next-line no-new-func
          result = Boolean(new Function("$json", `try { return (${expr}); } catch(e) { return false; }`)(mockPayload));
          evalMsg = `${expr} → ${result ? "TRUE ✓" : "FALSE ✗"}`;
        } catch {
          evalMsg = `שגיאת syntax בביטוי: "${expr}"`;
        }
      }
      runState[node.id] = result ? "success" : "warning";
      onRunState({ ...runState });
      mockPayload = { ...mockPayload, conditionResult: result };
      step = {
        nodeId: node.id, nodeLabel: label, nodeType: "conditionNode",
        state: result ? "success" : "warning",
        message: `Condition: ${evalMsg} — ממשיך ל${result ? "ענף TRUE" : "ענף FALSE"}`,
        duration: Date.now() - stepStart, payload: mockPayload,
      };

    } else if (node.type === "delayNode") {
      const delayMs = (Number(d.delay) || 5);
      runState[node.id] = "success";
      onRunState({ ...runState });
      step = {
        nodeId: node.id, nodeLabel: label, nodeType: "delayNode", state: "success",
        message: `Delay of ${delayMs}s simulated (skipped in test mode)`,
        duration: Date.now() - stepStart,
      };

    } else if (node.type === "outputNode") {
      runState[node.id] = "success";
      onRunState({ ...runState });
      step = {
        nodeId: node.id, nodeLabel: label, nodeType: "outputNode", state: "success",
        message: `Output "${d.outputType}" — payload dispatched successfully`,
        duration: Date.now() - stepStart, payload: mockPayload,
      };

    } else {
      runState[node.id] = "skipped";
      onRunState({ ...runState });
      step = { nodeId: node.id, nodeLabel: label, nodeType: node.type ?? "unknown", state: "skipped", message: "Node type unknown — skipped", duration: 0 };
    }

    yield step;
    await new Promise(r => setTimeout(r, 200));
  }
}

// ─── n8n JSON Export ──────────────────────────────────────────────────────────
function exportToN8n(nodes: Node[], edges: Edge[], name: string): string {
  const nodeMap: Record<string, string> = {};
  nodes.forEach(n => { nodeMap[n.id] = (n.data as Record<string, unknown>).label as string || n.id; });

  const n8nNodes = nodes.map(n => {
    const d = n.data as Record<string, unknown>;
    const label = String(d.label || n.id);
    const pos: [number, number] = [Math.round(n.position.x), Math.round(n.position.y)];

    if (n.type === "triggerNode") {
      const tt = String(d.triggerType || "manual");
      if (tt === "webhook") {
        return { parameters: { httpMethod: "POST", path: String(label).toLowerCase().replace(/\s/g, "-"), responseMode: "responseNode" }, id: uid(), name: label, type: "n8n-nodes-base.webhook", typeVersion: 2, position: pos };
      } else if (tt === "scheduled") {
        return { parameters: { rule: { interval: [{ field: "hours", hoursInterval: 1 }] } }, id: uid(), name: label, type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: pos };
      } else if (tt === "event") {
        return { parameters: {}, id: uid(), name: label, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: pos, notes: "Replace with your event trigger (Webhook/Queue/etc)" };
      }
      return { parameters: {}, id: uid(), name: label, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: pos };
    }

    if (n.type === "agentNode") {
      const model = String(d.model || "gpt-4o");
      const temp = Number(d.temperature ?? 0.7);
      const sysPrompt = String(d.systemPrompt || "You are a helpful AI assistant.");
      const isOpenAI = model.startsWith("gpt");
      const isClaude = model.startsWith("claude");

      if (isOpenAI) {
        return {
          parameters: {
            model: model,
            options: { temperature: temp },
            messages: { values: [{ role: "system", content: sysPrompt }, { role: "user", content: "={{ $json.message ?? $json.data.message ?? JSON.stringify($json) }}" }] },
          },
          id: uid(), name: label,
          type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
          typeVersion: 1, position: pos,
        };
      }
      if (isClaude) {
        return {
          parameters: {
            model: model,
            options: { temperature: temp },
            messages: { values: [{ role: "user", content: `${sysPrompt}\n\n{{ $json.message ?? JSON.stringify($json) }}` }] },
          },
          id: uid(), name: label,
          type: "@n8n/n8n-nodes-langchain.lmChatAnthropic",
          typeVersion: 1, position: pos,
        };
      }
      return {
        parameters: { model: model, systemMessage: sysPrompt, temperature: temp, promptType: "define", text: "={{ $json.message ?? JSON.stringify($json) }}" },
        id: uid(), name: label,
        type: "@n8n/n8n-nodes-langchain.openAi",
        typeVersion: 1, position: pos,
      };
    }

    if (n.type === "conditionNode") {
      const cond = String(d.condition || "");
      return {
        parameters: {
          conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict" }, combinator: "and", conditions: [{ id: uid(), operator: { type: "string", operation: "equals" }, leftValue: `={{ ${cond || "$json.type"} }}`, rightValue: "true" }] },
          looseTypeValidation: false, options: {},
        },
        id: uid(), name: label, type: "n8n-nodes-base.if", typeVersion: 2, position: pos,
      };
    }

    if (n.type === "delayNode") {
      return {
        parameters: { unit: "seconds", value: Number(d.delay || 5), resume: "timeInterval" },
        id: uid(), name: label, type: "n8n-nodes-base.wait", typeVersion: 1, position: pos,
      };
    }

    if (n.type === "outputNode") {
      const ot = String(d.outputType || "webhook");
      if (ot === "webhook") {
        return { parameters: { respondWith: "json", responseBody: "={{ { success: true, data: $json, processedAt: new Date().toISOString() } }}" }, id: uid(), name: label, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1, position: pos };
      }
      if (ot === "email") {
        return { parameters: { fromEmail: "noreply@agenthub.ai", toEmail: "={{ $json.email ?? 'team@agenthub.ai' }}", subject: `AgentHub: ${name}`, message: "={{ JSON.stringify($json, null, 2) }}" }, id: uid(), name: label, type: "n8n-nodes-base.emailSend", typeVersion: 2, position: pos };
      }
      if (ot === "notification") {
        return { parameters: { text: `AgentHub Notification\n{{ JSON.stringify($json, null, 2) }}` }, id: uid(), name: label, type: "n8n-nodes-base.telegram", typeVersion: 1, position: pos };
      }
      return { parameters: {}, id: uid(), name: label, type: "n8n-nodes-base.noOp", typeVersion: 1, position: pos };
    }

    return { parameters: {}, id: uid(), name: label, type: "n8n-nodes-base.noOp", typeVersion: 1, position: pos };
  });

  // Build connections
  const connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }> = {};
  edges.forEach(e => {
    const srcLabel = nodeMap[e.source];
    if (!srcLabel) return;
    if (!connections[srcLabel]) connections[srcLabel] = { main: [] };
    const tgtLabel = nodeMap[e.target];
    if (!tgtLabel) return;
    const outputIndex = e.sourceHandle === "false" ? 1 : 0;
    while (connections[srcLabel].main.length <= outputIndex) {
      connections[srcLabel].main.push([]);
    }
    connections[srcLabel].main[outputIndex].push({ node: tgtLabel, type: "main", index: 0 });
  });

  const workflow = {
    name,
    nodes: n8nNodes,
    connections,
    active: false,
    settings: { executionOrder: "v1", saveManualExecutions: true, callerPolicy: "workflowsFromSameOwner", errorWorkflow: "" },
    versionId: uid(),
    meta: { templateCredsSetupCompleted: true, instanceId: "agenthub-export" },
    tags: [{ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), id: uid(), name: "AgentHub" }],
  };

  return JSON.stringify(workflow, null, 2);
}

// ─── Test Console ─────────────────────────────────────────────────────────────
function StepRow({ step, index }: { step: SimStep; index: number }) {
  const [open, setOpen] = useState(false);
  const icons = { success: <CheckCircle className="w-4 h-4 text-emerald-500" />, error: <XCircle className="w-4 h-4 text-red-500" />, skipped: <SkipForward className="w-4 h-4 text-slate-400" />, warning: <AlertTriangle className="w-4 h-4 text-amber-500" /> };
  const bgs = { success: "bg-emerald-50 border-emerald-200", error: "bg-red-50 border-red-200", skipped: "bg-slate-50 border-slate-200", warning: "bg-amber-50 border-amber-200" };
  const nodeLabels: Record<string, string> = { triggerNode: "TRIGGER", agentNode: "AGENT", conditionNode: "CONDITION", delayNode: "DELAY", outputNode: "OUTPUT", validator: "VALIDATOR" };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <div className={`flex items-center gap-3 px-4 py-2.5 border rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${bgs[step.state]}`} onClick={() => setOpen(o => !o)}>
        <span className="text-[10px] font-mono text-muted-foreground w-5 text-center">{index + 1}</span>
        {icons[step.state]}
        <span className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground w-20 shrink-0">{nodeLabels[step.nodeType] ?? step.nodeType}</span>
        <span className="text-[12px] font-semibold text-foreground flex-1 truncate">{step.nodeLabel}</span>
        <span className="text-[11px] text-muted-foreground">{step.message}</span>
        <span className="text-[10px] font-mono text-muted-foreground w-16 text-right shrink-0">{step.duration}ms</span>
        {step.payload && (open ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />)}
      </div>
      {open && step.payload && (
        <div className="mx-2 mb-1 border border-t-0 border-slate-200 rounded-b-lg bg-slate-900 px-4 py-3 overflow-x-auto">
          <pre className="text-[10.5px] text-emerald-300 font-mono whitespace-pre-wrap">{JSON.stringify(step.payload, null, 2)}</pre>
        </div>
      )}
    </motion.div>
  );
}

function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;
  const colors: Record<ValidationSeverity, string> = { error: "text-red-600 bg-red-50 border-red-200", warning: "text-amber-600 bg-amber-50 border-amber-200", info: "text-blue-600 bg-blue-50 border-blue-200" };
  const icons: Record<ValidationSeverity, React.ReactNode> = {
    error: <XCircle className="w-3.5 h-3.5 shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
    info: <Info className="w-3.5 h-3.5 shrink-0" />,
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      className="border-t border-border bg-white">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Validation</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{issues.filter(i => i.severity === "error").length} שגיאות · {issues.filter(i => i.severity === "warning").length} אזהרות</span>
      </div>
      <div className="px-4 py-2 flex flex-col gap-1.5 max-h-32 overflow-y-auto">
        {issues.map(issue => (
          <div key={issue.id} className={`flex items-center gap-2 text-[11.5px] px-3 py-1.5 rounded-lg border ${colors[issue.severity]}`}>
            {icons[issue.severity]}
            <span className="font-medium">{issue.message}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Node Editor ──────────────────────────────────────────────────────────────
function NodeEditor({ node, agents, onChange, onClose }: {
  node: Node; agents: Agent[];
  onChange: (id: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const d = node.data as Record<string, unknown>;
  const set = (key: string, value: unknown) => onChange(node.id, { ...d, [key]: value });

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="w-[300px] shrink-0 bg-white border-l border-border overflow-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-white z-10">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Node Config</div>
          <div className="text-[13px] font-bold text-foreground mt-0.5 capitalize">{node.type?.replace("Node", "")}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Label</label>
          <Input value={String(d.label || "")} onChange={(e) => set("label", e.target.value)} className="h-8 rounded-lg text-sm" />
        </div>

        {node.type === "triggerNode" && (
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Trigger Type</label>
            <Select value={String(d.triggerType || "manual")} onValueChange={(v) => set("triggerType", v)}>
              <SelectTrigger className="h-8 rounded-lg text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">👆 Manual</SelectItem>
                <SelectItem value="webhook">🌐 Webhook</SelectItem>
                <SelectItem value="scheduled">⏱️ Scheduled</SelectItem>
                <SelectItem value="event">⚡ Event</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {node.type === "conditionNode" && (
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Condition Expression</label>
            <Input value={String(d.condition || "")} onChange={(e) => set("condition", e.target.value)}
              placeholder='e.g. $json.type === "sales"' className="h-8 rounded-lg text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground">Use <code className="bg-muted px-1 rounded">$json</code> to access payload · True → left · False → right</p>
          </div>
        )}

        {node.type === "outputNode" && (
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Output Type</label>
            <Select value={String(d.outputType || "webhook")} onValueChange={(v) => set("outputType", v)}>
              <SelectTrigger className="h-8 rounded-lg text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">🌐 Webhook Response</SelectItem>
                <SelectItem value="email">✉️ Email</SelectItem>
                <SelectItem value="notification">🔔 Telegram Notification</SelectItem>
                <SelectItem value="log">📋 Log Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {node.type === "delayNode" && (
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Delay (seconds)</label>
            <div className="flex items-center gap-3">
              <Slider value={[Number(d.delay || 5)]} onValueChange={([v]) => set("delay", v)} min={1} max={300} step={1} className="flex-1" />
              <div className="w-12 h-8 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-semibold">{Number(d.delay || 5)}s</div>
            </div>
          </div>
        )}

        {node.type === "agentNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Agent</label>
              <Select value={String(d.agentId || "")} onValueChange={(v) => {
                const a = agents.find(ag => ag.id === Number(v));
                if (a) onChange(node.id, { ...d, agentId: a.id, label: a.name, category: a.category, iconEmoji: a.iconEmoji, model: a.model || "gpt-4o", temperature: a.temperature ?? 0.7, systemPrompt: a.systemPrompt || "" });
              }}>
                <SelectTrigger className="h-8 rounded-lg text-sm"><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      <div className="flex items-center gap-2"><span>{a.iconEmoji || "🤖"}</span><span className="font-medium">{a.name}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3" />Override Parameters
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-semibold text-muted-foreground">Model</label>
                <Select value={String(d.model || "gpt-4o")} onValueChange={(v) => set("model", v)}>
                  <SelectTrigger className="h-8 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="llama-3.3-70b">Llama 3.3 70B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-semibold text-muted-foreground">Temperature</label>
                  <span className="font-mono text-xs text-primary font-semibold">{Number(d.temperature ?? 0.7).toFixed(1)}</span>
                </div>
                <Slider value={[Number(d.temperature ?? 0.7)]} onValueChange={([v]) => set("temperature", v)} min={0} max={2} step={0.1} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-semibold text-muted-foreground">System Prompt</label>
                <Textarea value={String(d.systemPrompt || "")} onChange={(e) => set("systemPrompt", e.target.value)}
                  placeholder="Leave empty to use agent default..." rows={5} className="rounded-lg resize-none font-mono text-[11px]" />
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Canvas Inner ─────────────────────────────────────────────────────────────
function CanvasInner({ workflowId }: { workflowId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const rfWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const { data: workflow, isLoading } = useGetWorkflow(workflowId, {
    query: { enabled: !!workflowId, queryKey: getGetWorkflowQueryKey(workflowId) },
  });
  const { data: agents = [] } = useListAgents();
  const updateWorkflow = useUpdateWorkflow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [workflowName, setWorkflowName] = useState("");

  // Simulation state
  const [simRunning, setSimRunning] = useState(false);
  const [simSteps, setSimSteps] = useState<SimStep[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [runStateMap, setRunStateMap] = useState<RunStateMap>({});
  const simRef = useRef<boolean>(false);

  useEffect(() => {
    if (!workflow) return;
    setWorkflowName(workflow.name);
    try {
      const parsedNodes = JSON.parse(workflow.nodes || "[]");
      const parsedEdges = JSON.parse(workflow.edges || "[]");
      setNodes(parsedNodes.length > 0 ? parsedNodes : [{
        id: "trigger-1", type: "triggerNode", position: { x: 250, y: 50 },
        data: { label: "Start", triggerType: "manual" },
      }]);
      setEdges(parsedEdges);
    } catch { /* ignore */ }
  }, [workflow?.id]); // eslint-disable-line

  // Sync run state into node data
  useEffect(() => {
    if (Object.keys(runStateMap).length === 0) return;
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, _runState: runStateMap[n.id] ?? "idle" },
    })));
  }, [runStateMap]); // eslint-disable-line

  const onConnect: OnConnect = useCallback((params) =>
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }, eds)), [setEdges]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("application/reactflow-type");
    const nodeDataStr = e.dataTransfer.getData("application/reactflow-data");
    if (!nodeType) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const nodeData = nodeDataStr ? JSON.parse(nodeDataStr) : {};
    setNodes(nds => nds.concat({ id: nextId(), type: nodeType, position, data: nodeData }));
  }, [screenToFlowPosition, setNodes]);

  const handleSave = () => {
    // Strip _runState from nodes before saving
    const cleanNodes = nodes.map(n => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { _runState, ...cleanData } = n.data as any;
      void _runState;
      return { ...n, data: cleanData };
    });
    updateWorkflow.mutate(
      { id: workflowId, data: { name: workflowName, nodes: JSON.stringify(cleanNodes), edges: JSON.stringify(edges) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWorkflowQueryKey(workflowId) });
          toast({ title: "✅ Workflow saved" });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  const handleValidate = () => {
    const issues = validateWorkflow(nodes, edges);
    setValidationIssues(issues);
    setShowValidation(true);
    if (issues.filter(i => i.severity === "error").length === 0) {
      toast({ title: `✅ Workflow valid`, description: `${issues.length === 0 ? "No issues found" : `${issues.filter(i => i.severity === "warning").length} warnings`}` });
    } else {
      toast({ title: `❌ ${issues.filter(i => i.severity === "error").length} errors found`, variant: "destructive" });
    }
  };

  const handleRun = async () => {
    const issues = validateWorkflow(nodes, edges);
    setValidationIssues(issues);
    if (issues.filter(i => i.severity === "error").length > 0) {
      setShowValidation(true);
      toast({ title: "❌ תקן שגיאות לפני הרצה", variant: "destructive" });
      return;
    }

    setSimRunning(true);
    setSimSteps([]);
    setShowConsole(true);
    setShowValidation(false);
    simRef.current = true;

    // Reset all run states
    const initMap: RunStateMap = {};
    nodes.forEach(n => { initMap[n.id] = "idle"; });
    setRunStateMap(initMap);

    try {
      const gen = simulateWorkflow(nodes, edges, (map) => setRunStateMap(map));
      for await (const step of gen) {
        if (!simRef.current) break;
        setSimSteps(prev => [...prev, step]);
      }
    } finally {
      setSimRunning(false);
      simRef.current = false;
    }
  };

  const handleExportN8n = () => {
    const issues = validateWorkflow(nodes, edges);
    const errors = issues.filter(i => i.severity === "error");
    if (errors.length > 0) {
      setValidationIssues(issues);
      setShowValidation(true);
      toast({ title: "❌ תקן שגיאות לפני ייצוא", description: "הWorkflow מכיל שגיאות שימנעו ייבוא תקין ל-n8n", variant: "destructive" });
      return;
    }

    const json = exportToN8n(nodes, edges, workflowName);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, "_").toLowerCase() || "workflow"}_n8n.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📥 n8n JSON exported", description: `${nodes.length} nodes · ייבא ישירות ל-n8n` });
  };

  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data } : n));
  }, [setNodes]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const errorCount = validationIssues.filter(i => i.severity === "error").length;
  const warnCount = validationIssues.filter(i => i.severity === "warning").length;
  const simPassed = simSteps.length > 0 && simSteps.every(s => s.state !== "error");
  const simHasError = simSteps.some(s => s.state === "error");

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="space-y-3 w-80">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );

  return (
    <div className="-m-8 flex flex-col" style={{ height: "calc(100vh - 60px)" }}>
      {/* Topbar */}
      <div className="h-12 border-b border-border bg-white flex items-center px-4 gap-3 shrink-0">
        <Link href="/workflows">
          <button className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </Link>
        <Input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)}
          className="h-7 rounded-lg text-[13px] font-semibold border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1 w-64" />
        <div className="flex-1" />

        {/* Validation badge */}
        {validationIssues.length > 0 && (
          <button onClick={() => setShowValidation(v => !v)} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors"
            style={{ background: errorCount > 0 ? "#fef2f2" : "#fffbeb", borderColor: errorCount > 0 ? "#fecaca" : "#fde68a", color: errorCount > 0 ? "#dc2626" : "#d97706" }}>
            {errorCount > 0 ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {errorCount > 0 ? `${errorCount} errors` : `${warnCount} warnings`}
          </button>
        )}

        <span className="text-[11px] text-muted-foreground">{nodes.length} nodes · {edges.length} edges</span>

        {/* Validate */}
        <Button variant="outline" size="sm" onClick={handleValidate} className="h-7 rounded-lg text-xs gap-1.5 px-3">
          <ShieldAlert className="w-3 h-3" />
          Validate
        </Button>

        {/* Run Test */}
        <Button variant="outline" size="sm" onClick={simRunning ? undefined : handleRun} disabled={simRunning} className="h-7 rounded-lg text-xs gap-1.5 px-3"
          style={{ borderColor: simRunning ? "#6366f1" : undefined, color: simRunning ? "#6366f1" : undefined }}>
          {simRunning
            ? <><Loader2 className="w-3 h-3 animate-spin" />Running…</>
            : simPassed ? <><CheckCircle className="w-3 h-3 text-emerald-500" />Run Test</>
            : simHasError ? <><XCircle className="w-3 h-3 text-red-500" />Run Test</>
            : <><Play className="w-3 h-3" />Run Test</>
          }
        </Button>

        {/* Export n8n */}
        <Button size="sm" onClick={handleExportN8n} className="h-7 rounded-lg text-xs gap-1.5 px-3 bg-indigo-600 hover:bg-indigo-700">
          <Download className="w-3 h-3" />
          Export n8n JSON
        </Button>

        {/* Save */}
        <Button onClick={handleSave} disabled={updateWorkflow.isPending} variant="outline" size="sm" className="h-7 rounded-lg text-xs gap-1.5 px-3">
          <AnimatePresence mode="wait" initial={false}>
            {updateWorkflow.isPending ? (
              <motion.span key="s" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="w-3 h-3 animate-spin" />Saving…
              </motion.span>
            ) : saved ? (
              <motion.span key="d" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />Saved
              </motion.span>
            ) : (
              <motion.span key="i" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Save className="w-3 h-3" />Save
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {/* Validation panel */}
      <AnimatePresence>
        {showValidation && <ValidationPanel issues={validationIssues} />}
      </AnimatePresence>

      {/* Canvas body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[200px] shrink-0 border-r border-border bg-white overflow-auto">
          <div className="p-3 space-y-4">
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">Node Types</div>
              <div className="space-y-1.5">
                {PALETTE.map((item) => (
                  <div key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow-type", item.type);
                      e.dataTransfer.setData("application/reactflow-data", JSON.stringify(item.defaultData));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-white cursor-grab active:cursor-grabbing hover:border-primary/30 hover:bg-primary/5 transition-all select-none"
                    style={{ borderLeft: `3px solid ${item.color}` }}
                  >
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <span className="text-[12px] font-medium text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">Agent Library</div>
              <div className="space-y-1">
                {agents.filter(a => a.status === "active").map((agent) => {
                  const meta = CAT[agent.category] || DEFAULT_CAT;
                  return (
                    <div key={agent.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/reactflow-type", "agentNode");
                        e.dataTransfer.setData("application/reactflow-data", JSON.stringify({
                          agentId: agent.id, label: agent.name, category: agent.category,
                          iconEmoji: agent.iconEmoji, model: agent.model || "gpt-4o",
                          temperature: agent.temperature ?? 0.7, systemPrompt: agent.systemPrompt || "",
                        }));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-muted/60 transition-colors select-none"
                    >
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0" style={{ background: meta.bg }}>
                        {agent.iconEmoji || "🤖"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-medium text-foreground truncate">{agent.name}</div>
                        <div className="text-[9.5px] font-medium" style={{ color: meta.text }}>{agent.category}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* React Flow */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1" ref={rfWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={NODE_TYPES}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              defaultEdgeOptions={{ animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }}
              fitView
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 13% 88%)" />
              <Controls className="!rounded-xl !border !border-border !shadow-sm" />
              <MiniMap nodeStrokeWidth={3} className="!rounded-xl !border !border-border !shadow-sm" />
            </ReactFlow>
          </div>

          {/* Test Console */}
          <AnimatePresence>
            {showConsole && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 260 }}
                exit={{ height: 0 }}
                className="shrink-0 border-t border-border bg-white flex flex-col overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
                  <div className="flex items-center gap-2">
                    {simRunning && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                    {!simRunning && simPassed && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    {!simRunning && simHasError && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    {!simRunning && !simPassed && !simHasError && simSteps.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    {simSteps.length === 0 && !simRunning && <Circle className="w-3.5 h-3.5 text-slate-300" />}
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Test Console</span>
                    {simSteps.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {simSteps.filter(s => s.state === "success").length} passed · {simSteps.filter(s => s.state === "error").length} failed · {simSteps.reduce((a, s) => a + s.duration, 0)}ms total
                      </span>
                    )}
                  </div>
                  <div className="flex-1" />
                  <button onClick={() => { setShowConsole(false); setSimSteps([]); setRunStateMap({}); setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, _runState: "idle" } }))); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 bg-slate-50/50">
                  {simSteps.length === 0 && simRunning && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> מריץ סימולציה...
                    </div>
                  )}
                  <AnimatePresence>
                    {simSteps.map((step, i) => <StepRow key={`${step.nodeId}-${i}`} step={step} index={i} />)}
                  </AnimatePresence>
                  {!simRunning && simSteps.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center gap-2 px-4 py-3 rounded-lg border mt-2 ${simPassed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      {simPassed
                        ? <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-[12px] font-semibold text-emerald-700">Simulation passed — Workflow מוכן לייצוא n8n</span></>
                        : <><XCircle className="w-4 h-4 text-red-500" /><span className="text-[12px] font-semibold text-red-700">Simulation failed — תקן שגיאות לפני ייצוא</span></>
                      }
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel */}
        <AnimatePresence>
          {selectedNode && (
            <NodeEditor node={selectedNode} agents={agents} onChange={updateNodeData} onClose={() => setSelectedNodeId(null)} />
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function WorkflowCanvas() {
  const { id } = useParams<{ id: string }>();
  const workflowId = parseInt(id, 10);
  return (
    <ReactFlowProvider>
      <CanvasInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
