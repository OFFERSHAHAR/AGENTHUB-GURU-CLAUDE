/**
 * Basic real workflow execution engine.
 *
 * Executes a stored workflow graph (React-Flow nodes/edges) for real:
 *   - triggerNode   → seeds the run payload
 *   - agentNode     → calls the agent's model (runModel) with the live payload
 *   - conditionNode → evaluates a simple condition against the payload
 *   - delayNode     → waits (capped) so runs never hang
 *   - outputNode    → captures the final result
 *
 * Intentionally bounded (max agent calls, capped delays) so a run is safe and
 * cheap. This is a foundation, not a full n8n — but the agent steps are real
 * model calls, not a simulation.
 */
import { eq } from "drizzle-orm";
import { db, agentsTable } from "@workspace/db";
import { runModel, type ModelTier } from "./model-router.js";

export interface WFNode { id: string; type?: string; data?: Record<string, unknown>; }
export interface WFEdge { id?: string; source: string; target: string; }

export interface WorkflowStep {
  nodeId: string;
  label: string;
  type: string;
  status: "success" | "error" | "skipped";
  message: string;
  output?: unknown;
}

export interface WorkflowRunResult {
  ok: boolean;
  steps: WorkflowStep[];
  result: unknown;
  agentCalls: number;
}

const MAX_AGENT_CALLS = 5;     // bound model usage per run
const MAX_DELAY_MS = 2000;     // never hang on a delay node

type NodeKind = "trigger" | "agent" | "condition" | "delay" | "output";

/**
 * Normalize node types across the two schemes in the codebase:
 *   - canvas builder: triggerNode / agentNode / conditionNode / delayNode / outputNode
 *   - generated flows: trigger / ai / condition / notification / action / data
 */
function normalizeKind(type: string): NodeKind {
  const x = (type || "").toLowerCase();
  if (x.includes("trigger")) return "trigger";
  if (x.includes("agent") || x === "ai" || x.includes("llm") || x.includes("model")) return "agent";
  if (x.includes("condition") || x === "if" || x.includes("switch") || x.includes("filter")) return "condition";
  if (x.includes("delay") || x.includes("wait") || x.includes("sleep")) return "delay";
  return "output"; // output / action / notification / data / webhook / etc.
}

/** Kahn topological sort; leftover (cyclic) nodes are appended so nothing is dropped. */
function topoSort(nodes: WFNode[], edges: WFEdge[]): WFNode[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => { indeg.set(n.id, 0); adj.set(n.id, []); });
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  });
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const t of adj.get(id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 1) - 1);
      if ((indeg.get(t) ?? 0) === 0) queue.push(t);
    }
  }
  const seen = new Set(order);
  nodes.forEach((n) => { if (!seen.has(n.id)) order.push(n.id); });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return order.map((id) => byId.get(id)).filter((n): n is WFNode => !!n);
}

export async function runWorkflow(
  nodes: WFNode[],
  edges: WFEdge[],
  input?: Record<string, unknown>,
): Promise<WorkflowRunResult> {
  const steps: WorkflowStep[] = [];
  let payload: Record<string, unknown> = input ?? {
    type: "manual_run",
    source: "agenthub",
    timestamp: new Date().toISOString(),
    data: { message: "Manual workflow run" },
  };
  let result: unknown = null;
  let agentCalls = 0;

  for (const node of topoSort(nodes, edges)) {
    const d = node.data ?? {};
    const type = node.type || "";
    const kind = normalizeKind(type);
    const label = String(d.label || type || kind);
    try {
      if (kind === "trigger") {
        steps.push({ nodeId: node.id, label, type, status: "success", message: `Trigger "${String(d.triggerType ?? type ?? "manual")}" — payload ready`, output: payload });

      } else if (kind === "agent") {
        if (agentCalls >= MAX_AGENT_CALLS) {
          steps.push({ nodeId: node.id, label, type, status: "skipped", message: "הושג מקסימום קריאות מודל להרצה אחת" });
          continue;
        }
        // Configured agent if agentId is set; otherwise a generic AI step so an
        // unconfigured "ai" node still produces real output.
        let agentName = "AI";
        let sys = "אתה צעד AI ב-workflow. עבד את ה-payload שקיבלת והחזר תוצאה תמציתית ושימושית בעברית.";
        if (d.agentId) {
          const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, Number(d.agentId))).limit(1);
          if (agent) {
            agentName = agent.name;
            sys = agent.systemPrompt || `אתה ${agent.name}. ${agent.description}`;
          }
        } else if (typeof d.systemPrompt === "string" && d.systemPrompt.trim()) {
          sys = d.systemPrompt;
        }
        agentCalls++;
        const tier: ModelTier = process.env.GROQ_API_KEY ? "fallback" : "free";
        const userMsg = JSON.stringify(payload).slice(0, 4000);
        const r = await runModel(tier, sys, userMsg, "workflow-run");
        const out = r.content && r.content !== "__TEMPLATE__" ? r.content : "(המודל אינו זמין כרגע)";
        payload = { ...payload, agentResponse: out, processedBy: agentName };
        result = out;
        steps.push({ nodeId: node.id, label, type, status: "success", message: out.slice(0, 500), output: out });

      } else if (kind === "condition") {
        const expr = String(d.condition || "").trim();
        let pass = true; // empty condition = pass through
        if (expr) {
          const hay = JSON.stringify(payload).toLowerCase();
          pass = expr.toLowerCase() === "true" || hay.includes(expr.toLowerCase());
        }
        steps.push({ nodeId: node.id, label, type, status: "success", message: `תנאי "${expr || "(ריק → עובר)"}" → ${pass ? "TRUE" : "FALSE"}`, output: pass });

      } else if (kind === "delay") {
        const ms = Math.min(Math.max(Number(d.delay ?? 0) || 0, 0), MAX_DELAY_MS);
        if (ms > 0) await new Promise((r) => setTimeout(r, ms));
        steps.push({ nodeId: node.id, label, type, status: "success", message: `השהיה ${ms}ms` });

      } else {
        // output / action / notification / data — capture the running result.
        result = result ?? payload;
        steps.push({ nodeId: node.id, label, type, status: "success", message: `${type || "output"} — ${typeof result === "string" ? result.slice(0, 120) : "תוצאה נשמרה"}`, output: result });
      }
    } catch (err) {
      steps.push({ nodeId: node.id, label, type, status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const ok = !steps.some((s) => s.status === "error");
  return { ok, steps, result, agentCalls };
}
