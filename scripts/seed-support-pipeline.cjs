/**
 * Seeds the automated support escalation pipeline that wires the three
 * support agents together:
 *   Customer Triage Agent (id 12) -> Human Rep Companion (id 13) -> Technical Fix Agent (id 14)
 *
 * This script is idempotent — it upserts by name / unique keys so it can be
 * re-run safely. It performs three things:
 *   1. Creates (or updates) the "Support Escalation Pipeline" visual workflow
 *      in the Workflows section, with an importable N8N-compatible node graph.
 *   2. Assigns the three agents to a reference client (Nexus Ventures, id 1)
 *      so the orchestrator agent pools resolve.
 *   3. Configures that client's orchestrator to route through the triage chain.
 */
const { Client } = require("pg");

const WORKFLOW_NAME = "Support Escalation Pipeline";
const REFERENCE_CLIENT_ID = 1;
const PIPELINE_AGENT_IDS = [12, 13, 14];

// ── Visual workflow graph (XYFlow nodes/edges, same shape as the built-in templates) ──
const nodes = [
  {
    id: "t1",
    type: "triggerNode",
    position: { x: 320, y: 40 },
    data: { label: "New Support Request", triggerType: "webhook" },
  },
  {
    id: "a1",
    type: "agentNode",
    position: { x: 320, y: 190 },
    data: {
      label: "Customer Triage Agent",
      agentId: 12,
      category: "Support",
      iconEmoji: "🎯",
      model: "gpt-4o",
      temperature: 0.2,
      systemPrompt:
        "Classify the incoming customer request as ROUTINE, URGENT, or CRITICAL. " +
        "Return JSON { classification, summary, routeTo, reason, urgency_score }. " +
        "CRITICAL = full outage, data loss, or security breach → escalate to a human representative immediately.",
    },
  },
  {
    id: "c1",
    type: "conditionNode",
    position: { x: 320, y: 350 },
    data: {
      label: "Critical Escalation?",
      condition: 'classification === "CRITICAL"',
    },
  },
  {
    id: "a2",
    type: "agentNode",
    position: { x: 120, y: 510 },
    data: {
      label: "Human Rep Companion",
      agentId: 13,
      category: "Support",
      iconEmoji: "🔍",
      model: "gpt-4o",
      temperature: 0.3,
      systemPrompt:
        "Assist the human representative on the escalated issue. Run diagnostics, aggregate logs, " +
        "identify the root cause with evidence, then output: ## Problem Summary, ## Root Cause Analysis, " +
        "## Recommended Solution, ## Risk Assessment.",
    },
  },
  {
    id: "o1",
    type: "outputNode",
    position: { x: 520, y: 510 },
    data: { label: "Route to Support Queue", outputType: "email" },
  },
  {
    id: "a3",
    type: "agentNode",
    position: { x: 120, y: 670 },
    data: {
      label: "Technical Fix Agent",
      agentId: 14,
      category: "Operations",
      iconEmoji: "🔧",
      model: "gpt-4o",
      temperature: 0.2,
      systemPrompt:
        "Apply a code-level fix for the diagnosed root cause. Read the affected files, generate a precise " +
        "patch, run tests, and roll back on failure. Document every change as JSON " +
        "{ file_modified, change_type, diff_summary, tests_passed, rollback_available }.",
    },
  },
  {
    id: "o2",
    type: "outputNode",
    position: { x: 120, y: 830 },
    data: { label: "Apply Fix & Notify", outputType: "webhook" },
  },
];

const edges = [
  { id: "e1", source: "t1", target: "a1" },
  { id: "e2", source: "a1", target: "c1" },
  { id: "e3", source: "c1", target: "a2", sourceHandle: "true" },
  { id: "e4", source: "c1", target: "o1", sourceHandle: "false" },
  { id: "e5", source: "a2", target: "a3" },
  { id: "e6", source: "a3", target: "o2" },
];

const description =
  "Automated support escalation chain: a webhook receives a new request, the Customer Triage Agent " +
  "classifies its severity, and critical issues escalate to the Human Rep Companion for root-cause " +
  "analysis and then to the Technical Fix Agent for a code-level resolution. Non-critical requests are " +
  "routed to the support queue. Importable to n8n via the canvas \u201cDownload n8n JSON\u201d action.";

// ── Orchestrator routing config for the reference client ──
const routingRules = {
  strategy: "category-based",
  fallback: "Support",
  pipeline: WORKFLOW_NAME,
  rules: [
    { trigger: "critical outage", assignTo: "Support" },
    { trigger: "data loss", assignTo: "Support" },
    { trigger: "security breach", assignTo: "Support" },
    { trigger: "code-level fix", assignTo: "Operations" },
    { trigger: "general question", assignTo: "Support" },
  ],
  escalationChain: [
    { step: 1, agent: "Customer Triage Agent", category: "Support", on: "all requests" },
    { step: 2, agent: "Human Rep Companion", category: "Support", on: "classification === CRITICAL" },
    { step: 3, agent: "Technical Fix Agent", category: "Operations", on: "root cause requires code change" },
  ],
};

const orchestratorDescription =
  "Support escalation orchestrator — routes incoming requests through the Triage → Human Rep Companion → Technical Fix chain.";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // 1. Upsert workflow by name (keeps a stable id across re-runs).
    const existing = await client.query("SELECT id FROM workflows WHERE name = $1", [WORKFLOW_NAME]);
    let workflowId;
    if (existing.rows.length > 0) {
      workflowId = existing.rows[0].id;
      await client.query(
        "UPDATE workflows SET description = $1, status = $2, nodes = $3, edges = $4, updated_at = now() WHERE id = $5",
        [description, "active", JSON.stringify(nodes), JSON.stringify(edges), workflowId],
      );
      console.log(`Updated workflow #${workflowId} "${WORKFLOW_NAME}"`);
    } else {
      const inserted = await client.query(
        "INSERT INTO workflows (name, description, status, nodes, edges) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [WORKFLOW_NAME, description, "active", JSON.stringify(nodes), JSON.stringify(edges)],
      );
      workflowId = inserted.rows[0].id;
      console.log(`Created workflow #${workflowId} "${WORKFLOW_NAME}"`);
    }

    // 2. Assign the three pipeline agents to the reference client (idempotent).
    for (const agentId of PIPELINE_AGENT_IDS) {
      const a = await client.query(
        "SELECT id FROM assignments WHERE client_id = $1 AND agent_id = $2",
        [REFERENCE_CLIENT_ID, agentId],
      );
      if (a.rows.length === 0) {
        await client.query(
          "INSERT INTO assignments (client_id, agent_id, status, automation_enabled) VALUES ($1, $2, 'active', true)",
          [REFERENCE_CLIENT_ID, agentId],
        );
        console.log(`Assigned agent #${agentId} to client #${REFERENCE_CLIENT_ID}`);
      } else {
        console.log(`Agent #${agentId} already assigned to client #${REFERENCE_CLIENT_ID}`);
      }
    }

    // 3. Configure the client's orchestrator to use the triage chain.
    const orch = await client.query("SELECT id FROM orchestrators WHERE client_id = $1", [REFERENCE_CLIENT_ID]);
    const rulesJson = JSON.stringify(routingRules);
    if (orch.rows.length > 0) {
      await client.query(
        "UPDATE orchestrators SET routing_rules = $1, description = $2, updated_at = now() WHERE client_id = $3",
        [rulesJson, orchestratorDescription, REFERENCE_CLIENT_ID],
      );
      console.log(`Updated orchestrator for client #${REFERENCE_CLIENT_ID}`);
    } else {
      await client.query(
        "INSERT INTO orchestrators (client_id, routing_rules, description) VALUES ($1, $2, $3)",
        [REFERENCE_CLIENT_ID, rulesJson, orchestratorDescription],
      );
      console.log(`Created orchestrator for client #${REFERENCE_CLIENT_ID}`);
    }

    console.log(`\nDone. Workflow id = ${workflowId}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
