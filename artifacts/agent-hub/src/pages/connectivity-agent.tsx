import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Zap, Database, Globe, GitMerge, Lock, CheckCircle2,
  AlertTriangle, ChevronRight, ChevronLeft, Copy, Download,
  RefreshCw, Wifi, Server, Key, Link2, Layers, ArrowRight,
  ShieldCheck, Activity, Code2, Terminal, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemType =
  | "erp" | "crm" | "ecommerce" | "custom_api" | "database"
  | "legacy" | "saas" | "iot" | "mobile";

type AuthMethod = "api_key" | "oauth2" | "basic" | "mtls" | "jwt" | "none";
type DataFormat = "json" | "xml" | "csv" | "graphql" | "soap" | "binary";
type ScaleLevel = "small" | "medium" | "large" | "enterprise";
type ComplianceFlag = "gdpr" | "iso27001" | "pci_dss" | "hipaa" | "sox";

interface SystemProfile {
  type: SystemType | null;
  name: string;
  auth: AuthMethod | null;
  format: DataFormat | null;
  scale: ScaleLevel | null;
  compliance: ComplianceFlag[];
  hasPublicEndpoint: boolean;
  cloudProvider: string;
}

type IntegrationMethod =
  | "webhook_push" | "rest_polling" | "oauth_bridge"
  | "message_queue" | "sdk_embed" | "ipaas" | "mtls_gateway" | "db_connector";

interface RecommendedMethod {
  id: IntegrationMethod;
  label: string;
  labelHe: string;
  score: number;
  rationale: string;
  rationaleHe: string;
  security: number;
  complexity: number;
  scalability: number;
  icon: React.FC<{ className?: string }>;
  code: string;
  zeroTrustNotes: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_TYPES: { id: SystemType; label: string; labelHe: string; icon: string; desc: string }[] = [
  { id: "erp",        label: "ERP System",    labelHe: "מערכת ERP",         icon: "🏭", desc: "SAP, Oracle, Priority, Odoo" },
  { id: "crm",        label: "CRM",           labelHe: "מערכת CRM",         icon: "👥", desc: "Salesforce, HubSpot, Zoho" },
  { id: "ecommerce",  label: "E-Commerce",    labelHe: "חנות אינטרנטית",    icon: "🛒", desc: "Shopify, WooCommerce, Magento" },
  { id: "custom_api", label: "Custom API",    labelHe: "API פנימי",          icon: "⚙️", desc: "REST / GraphQL / gRPC" },
  { id: "database",   label: "Database",      labelHe: "מסד נתונים",         icon: "🗄️", desc: "PostgreSQL, MySQL, MongoDB, MSSQL" },
  { id: "legacy",     label: "Legacy System", labelHe: "מערכת ישנה",         icon: "📺", desc: "COBOL, AS/400, Mainframe, SOAP" },
  { id: "saas",       label: "SaaS Platform", labelHe: "פלטפורמת SaaS",     icon: "☁️", desc: "Slack, Notion, Jira, Monday" },
  { id: "iot",        label: "IoT / Sensors", labelHe: "IoT / חיישנים",     icon: "📡", desc: "MQTT, CoAP, OPC-UA" },
  { id: "mobile",     label: "Mobile App",    labelHe: "אפליקציית מובייל",  icon: "📱", desc: "iOS, Android, React Native" },
];

const AUTH_METHODS: { id: AuthMethod; label: string; labelHe: string; trust: number }[] = [
  { id: "api_key", label: "API Key",          labelHe: "מפתח API",           trust: 2 },
  { id: "oauth2",  label: "OAuth 2.0",        labelHe: "OAuth 2.0",           trust: 4 },
  { id: "basic",   label: "Basic Auth",       labelHe: "Basic Auth",          trust: 1 },
  { id: "mtls",    label: "Mutual TLS",       labelHe: "mTLS",                trust: 5 },
  { id: "jwt",     label: "JWT / OIDC",       labelHe: "JWT / OIDC",          trust: 4 },
  { id: "none",    label: "No Auth",          labelHe: "ללא אימות",           trust: 0 },
];

const DATA_FORMATS: { id: DataFormat; label: string }[] = [
  { id: "json",    label: "JSON" },
  { id: "xml",     label: "XML / RSS" },
  { id: "csv",     label: "CSV / Flat Files" },
  { id: "graphql", label: "GraphQL" },
  { id: "soap",    label: "SOAP / WSDL" },
  { id: "binary",  label: "Binary / Protobuf" },
];

const SCALE_LEVELS: { id: ScaleLevel; label: string; labelHe: string; desc: string; rpm: string }[] = [
  { id: "small",      label: "Small",      labelHe: "קטן",        desc: "< 1K events/day",    rpm: "< 1 RPM" },
  { id: "medium",     label: "Medium",     labelHe: "בינוני",     desc: "1K–100K events/day", rpm: "1–100 RPM" },
  { id: "large",      label: "Large",      labelHe: "גדול",       desc: "100K–1M events/day", rpm: "100–1K RPM" },
  { id: "enterprise", label: "Enterprise", labelHe: "ארגוני",     desc: "> 1M events/day",    rpm: "> 1K RPM" },
];

const COMPLIANCES: { id: ComplianceFlag; label: string; color: string }[] = [
  { id: "gdpr",     label: "GDPR",     color: "#3b82f6" },
  { id: "iso27001", label: "ISO 27001",color: "#8b5cf6" },
  { id: "pci_dss",  label: "PCI DSS",  color: "#ef4444" },
  { id: "hipaa",    label: "HIPAA",    color: "#22c55e" },
  { id: "sox",      label: "SOX",      color: "#f59e0b" },
];

// ─── Analysis Engine ──────────────────────────────────────────────────────────

function computeRecommendations(profile: SystemProfile): RecommendedMethod[] {
  const methods: RecommendedMethod[] = [
    {
      id: "webhook_push",
      label: "Webhook (Event Push)",
      labelHe: "Webhook — דחיפת אירועים",
      score: 0,
      rationale: "Client system pushes events to AgentHub in real-time. Best for event-driven architectures.",
      rationaleHe: "מערכת הלקוח דוחפת אירועים ל-AgentHub בזמן אמת. מומלץ לארכיטקטורה מבוססת אירועים.",
      security: 3, complexity: 2, scalability: 4,
      icon: Zap,
      zeroTrustNotes: ["Validate webhook signature (HMAC-SHA256)", "IP allowlisting", "TLS 1.3 required", "Replay attack prevention (timestamp check)"],
      code: `// AgentHub Webhook Receiver — Zero Trust
const crypto = require('crypto');

app.post('/webhook/ingest', (req, res) => {
  // 1. Verify signature
  const sig = req.headers['x-agenthub-signature'];
  const ts  = req.headers['x-agenthub-timestamp'];
  const secret = process.env.WEBHOOK_SECRET;

  // Replay protection — reject if > 5 minutes old
  if (Date.now() / 1000 - Number(ts) > 300) {
    return res.status(401).json({ error: 'Request expired' });
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${ts}.\${JSON.stringify(req.body)}\`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Process event
  const { eventType, payload, clientId } = req.body;
  agentBus.publish({ from: 'external', to: 'jarvis', type: 'task', text: JSON.stringify(payload) });
  res.json({ ok: true, received: eventType });
});

// Client-side sender (your existing system)
async function sendToAgentHub(event) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = hmacSha256(WEBHOOK_SECRET, \`\${ts}.\${JSON.stringify(event)}\`);
  await fetch('https://your-agenthub.replit.app/webhook/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AgentHub-Signature': sig,
      'X-AgentHub-Timestamp': ts,
    },
    body: JSON.stringify(event),
  });
}`,
    },
    {
      id: "oauth_bridge",
      label: "OAuth 2.0 Bridge",
      labelHe: "גשר OAuth 2.0",
      score: 0,
      rationale: "Industry-standard secure token-based integration. Best for SaaS and modern APIs.",
      rationaleHe: "אינטגרציה מבוססת טוקן — תקן תעשייתי. מומלץ ל-SaaS ו-API מודרניים.",
      security: 5, complexity: 3, scalability: 5,
      icon: Key,
      zeroTrustNotes: ["Short-lived access tokens (15 min TTL)", "Refresh token rotation", "PKCE for public clients", "Scope-limited access (least privilege)"],
      code: `// OAuth 2.0 PKCE Flow — Zero Trust Integration
// Step 1: Generate PKCE verifier & challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Step 2: Authorization URL
function getAuthUrl(clientId, redirectUri, scope) {
  const { verifier, challenge } = generatePKCE();
  sessionStorage.setItem('pkce_verifier', verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: crypto.randomBytes(16).toString('hex'), // CSRF protection
  });
  return \`https://your-system.com/oauth/authorize?\${params}\`;
}

// Step 3: Token exchange
async function exchangeCode(code, redirectUri, clientId) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  const resp = await fetch('https://your-system.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code, redirect_uri: redirectUri,
      client_id: clientId, code_verifier: verifier,
    }),
  });
  const { access_token, refresh_token, expires_in } = await resp.json();
  // Store securely — never in localStorage
  return { access_token, refresh_token, expires_in };
}`,
    },
    {
      id: "mtls_gateway",
      label: "mTLS API Gateway",
      labelHe: "שער API עם mTLS",
      score: 0,
      rationale: "Highest security tier. Both parties authenticate with certificates. Zero Trust by design.",
      rationaleHe: "רמת האבטחה הגבוהה ביותר. שני הצדדים מאמתים עם תעודות. Zero Trust by design.",
      security: 5, complexity: 5, scalability: 5,
      icon: ShieldCheck,
      zeroTrustNotes: ["Mutual certificate authentication", "Certificate pinning", "Automated cert rotation (90-day)", "No shared secrets", "Per-client certificate isolation"],
      code: `# mTLS Certificate Setup — Zero Trust ++

# 1. Generate CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 365 -key ca.key -out ca.crt \\
  -subj "/CN=AgentHub-CA/O=AgentHub/C=IL"

# 2. Generate client certificate (per client!)
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr \\
  -subj "/CN=client-{clientId}/O=CustomerName/C=IL"
openssl x509 -req -days 90 -in client.csr \\
  -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt

# Node.js server — enforce mTLS
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  key:  fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  ca:   fs.readFileSync('ca.crt'),
  requestCert: true,       // require client cert
  rejectUnauthorized: true // reject if invalid
}, app);

// Middleware — extract client identity from cert
app.use((req, res, next) => {
  const cert = req.socket.getPeerCertificate();
  if (!cert?.subject?.CN) return res.status(401).json({ error: 'No client cert' });
  req.clientId = cert.subject.CN.replace('client-', '');
  next();
});

// Client usage (curl example)
curl --cert client.crt --key client.key \\
     --cacert ca.crt \\
     https://api.agenthub.app/v1/tasks`,
    },
    {
      id: "message_queue",
      label: "Message Queue (Async)",
      labelHe: "תור הודעות — אסינכרוני",
      score: 0,
      rationale: "Best for high-volume, decoupled systems. Guarantees delivery and handles backpressure.",
      rationaleHe: "מומלץ לנפחים גבוהים. מבטיח מסירה ומתמודד עם עומסים.",
      security: 4, complexity: 4, scalability: 5,
      icon: Activity,
      zeroTrustNotes: ["TLS in transit", "Per-topic ACLs", "Consumer group isolation", "Dead-letter queue for failed events", "Message signing (JWS)"],
      code: `// Message Queue Integration — Kafka / RabbitMQ
// Option A: Kafka (high volume)
const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'agenthub-consumer',
  brokers: ['kafka.your-domain.com:9093'],
  ssl: true,
  sasl: { mechanism: 'scram-sha-512', username: process.env.KAFKA_USER, password: process.env.KAFKA_PASS },
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: 'agenthub-agents' });

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'client-events', fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      // Verify message signature
      if (!verifyJWS(payload)) throw new Error('Invalid message signature');
      await agentBus.publish({ from: 'external', to: 'all', type: 'task', text: JSON.stringify(payload) });
    },
  });
}

// Option B: RabbitMQ (simpler setup)
const amqp = require('amqplib');
const conn = await amqp.connect({ protocol: 'amqps', hostname: 'rabbitmq.your-domain.com',
  username: process.env.RABBIT_USER, password: process.env.RABBIT_PASS, vhost: '/agenthub' });
const ch = await conn.createChannel();
await ch.assertQueue('agent-tasks', { durable: true, arguments: { 'x-dead-letter-exchange': 'dlx' } });
ch.consume('agent-tasks', async (msg) => {
  if (!msg) return;
  try { await processTask(JSON.parse(msg.content.toString())); ch.ack(msg); }
  catch (e) { ch.nack(msg, false, false); } // send to DLQ
});`,
    },
    {
      id: "sdk_embed",
      label: "Embedded SDK",
      labelHe: "SDK מוטמע",
      score: 0,
      rationale: "Drop-in JavaScript/Python library. Easiest integration with built-in security.",
      rationaleHe: "ספריית JavaScript/Python מוכנה. ההטמעה הפשוטה ביותר עם אבטחה מובנית.",
      security: 3, complexity: 1, scalability: 3,
      icon: Code2,
      zeroTrustNotes: ["API key rotation built-in", "Request signing", "Rate limiting", "Sandboxed execution context"],
      code: `// AgentHub SDK — npm install @agenthub/sdk
import { AgentHub } from '@agenthub/sdk';

const hub = new AgentHub({
  apiKey: process.env.AGENTHUB_API_KEY,  // rotate every 30 days
  endpoint: 'https://api.agenthub.app',
  timeout: 5000,
  retry: { attempts: 3, backoff: 'exponential' },
  security: {
    signRequests: true,       // HMAC sign every request
    tlsMinVersion: 'TLSv1.3', // enforce TLS 1.3
    certificatePinning: true, // pin our cert fingerprint
  },
});

// Send task
const result = await hub.tasks.create({
  agentId: 'lead-qualifier',
  payload: { leadData: { name: 'אלון', email: 'alon@example.com' } },
  priority: 'high',
  webhookUrl: 'https://your-system.com/callbacks/task-done',
});

// Subscribe to real-time events (WebSocket, Zero Trust)
hub.events.on('task:completed', (event) => {
  console.log('Task done:', event.taskId, event.result);
});

hub.events.on('agent:alert', (event) => {
  notifySlack(event.message);
});

# Python equivalent
# pip install agenthub-sdk
from agenthub import AgentHub
hub = AgentHub(api_key=os.getenv('AGENTHUB_API_KEY'), sign_requests=True)
result = hub.tasks.create(agent_id='lead-qualifier', payload={...})`,
    },
    {
      id: "rest_polling",
      label: "REST API Polling",
      labelHe: "סקרינג REST API",
      score: 0,
      rationale: "Simple polling integration. Good for legacy systems without webhook support.",
      rationaleHe: "אינטגרציה פשוטה בסריקה. טוב למערכות ישנות ללא תמיכה ב-webhook.",
      security: 3, complexity: 2, scalability: 2,
      icon: RefreshCw,
      zeroTrustNotes: ["API key per environment", "Request rate limiting", "Response caching (ETags)", "Exponential backoff"],
      code: `// REST Polling — with Zero Trust headers
const BASE = 'https://api.agenthub.app/v1';
const KEY  = process.env.AGENTHUB_API_KEY;
let lastEtag = null;

async function pollAgentHub() {
  const headers = {
    'Authorization': \`Bearer \${KEY}\`,
    'X-Request-ID': crypto.randomUUID(),
    'X-Timestamp': Date.now().toString(),
    ...(lastEtag ? { 'If-None-Match': lastEtag } : {}),
  };

  const resp = await fetch(\`\${BASE}/tasks/pending\`, { headers });
  if (resp.status === 304) return; // Not modified — no change
  if (!resp.ok) throw new Error(\`HTTP \${resp.status}\`);

  lastEtag = resp.headers.get('etag');
  const tasks = await resp.json();
  for (const task of tasks.items) await handleTask(task);
}

// Adaptive polling — exponential backoff
let interval = 5000;
async function adaptivePoll() {
  try {
    await pollAgentHub();
    interval = Math.max(5000, interval * 0.9); // speed up on success
  } catch {
    interval = Math.min(60000, interval * 2); // back off on error
  }
  setTimeout(adaptivePoll, interval);
}
adaptivePoll();`,
    },
    {
      id: "ipaas",
      label: "iPaaS Connector",
      labelHe: "מחבר iPaaS",
      score: 0,
      rationale: "No-code integration via n8n, Make.com, or Zapier. Fastest time-to-market.",
      rationaleHe: "אינטגרציה ללא קוד דרך n8n, Make.com או Zapier. הכי מהיר לשוק.",
      security: 2, complexity: 1, scalability: 2,
      icon: Link2,
      zeroTrustNotes: ["Use dedicated integration account", "Scope to minimum permissions", "Audit log all flows", "Rotate tokens quarterly"],
      code: `// n8n Workflow JSON — AgentHub Node
// Import this into your n8n instance
{
  "name": "AgentHub Connector",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": { "path": "agenthub-trigger", "method": "POST",
        "authentication": "headerAuth", "headerName": "X-AgentHub-Token" }
    },
    {
      "name": "Transform Payload",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "return [{ json: { agentId: $input.first().json.agent, payload: $input.first().json.data, ts: Date.now() } }];"
      }
    },
    {
      "name": "Send to AgentHub",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.agenthub.app/v1/tasks",
        "method": "POST",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpBearerAuth",
        "sendBody": true, "bodyParameters": { "parameters": [{ "name": "=", "value": "={{ $json }}" }] }
      }
    }
  ]
}

# Zapier Zap — equivalent
# Trigger: Your App → New Record
# Action: AgentHub → Create Task (via Webhooks by Zapier)
# POST https://api.agenthub.app/v1/tasks
# Headers: Authorization: Bearer {{api_key}}`,
    },
    {
      id: "db_connector",
      label: "Database Connector (CDC)",
      labelHe: "קונקטור מסד נתונים",
      score: 0,
      rationale: "Change Data Capture — monitors DB changes and streams them to AgentHub.",
      rationaleHe: "Change Data Capture — עוקב אחר שינויים במסד הנתונים ומזרים לאגנטהאב.",
      security: 4, complexity: 4, scalability: 4,
      icon: Database,
      zeroTrustNotes: ["Read-only DB user (least privilege)", "VPN / private network only", "Encrypt connection string", "Row-level security if possible", "Audit log all queries"],
      code: `// CDC with Debezium → Kafka → AgentHub
// docker-compose.yml snippet
version: '3.8'
services:
  debezium:
    image: debezium/connect:2.4
    environment:
      GROUP_ID: 1
      CONFIG_STORAGE_TOPIC: debezium_configs
      OFFSET_STORAGE_TOPIC: debezium_offsets
      BOOTSTRAP_SERVERS: kafka:9092

# Register PostgreSQL connector (read-only user!)
curl -X POST http://debezium:8083/connectors -H 'Content-Type: application/json' -d '{
  "name": "pg-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "your-db.internal",
    "database.user": "agenthub_readonly",
    "database.password": "${DB_READONLY_PASSWORD}",
    "database.dbname": "production",
    "table.include.list": "public.clients,public.orders",
    "snapshot.mode": "initial",
    "publication.name": "agenthub_pub",
    "slot.name": "agenthub_slot"
  }
}'

// AgentHub CDC Consumer (Node.js)
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ brokers: ['kafka:9092'], ssl: true });
const consumer = kafka.consumer({ groupId: 'agenthub-cdc' });
await consumer.subscribe({ topic: 'dbserver.public.clients' });
await consumer.run({
  eachMessage: async ({ message }) => {
    const change = JSON.parse(message.value.toString());
    if (change.op === 'c') await agentBus.publish({ from: 'cdc', to: 'all', type: 'task', text: JSON.stringify(change.after) });
  },
});`,
    },
  ];

  // ─── Scoring logic ──────────────────────────────────────────────────────────
  const { type, auth, scale, compliance, hasPublicEndpoint } = profile;

  for (const m of methods) {
    let s = 0;

    if (m.id === "webhook_push") {
      if (hasPublicEndpoint) s += 3;
      if (type === "custom_api" || type === "saas" || type === "ecommerce") s += 3;
      if (scale === "small" || scale === "medium") s += 2;
      if (auth === "oauth2" || auth === "jwt") s += 1;
    }
    if (m.id === "oauth_bridge") {
      if (type === "saas" || type === "crm" || type === "ecommerce") s += 4;
      if (auth === "oauth2") s += 4;
      if (compliance.includes("gdpr")) s += 2;
      if (hasPublicEndpoint) s += 1;
    }
    if (m.id === "mtls_gateway") {
      if (compliance.length >= 2) s += 4;
      if (compliance.includes("pci_dss") || compliance.includes("hipaa")) s += 3;
      if (scale === "enterprise" || scale === "large") s += 2;
      if (auth === "mtls") s += 4;
      if (type === "erp" || type === "database") s += 2;
    }
    if (m.id === "message_queue") {
      if (scale === "large" || scale === "enterprise") s += 5;
      if (type === "iot") s += 4;
      if (type === "erp" || type === "database") s += 2;
      if (compliance.includes("iso27001")) s += 1;
    }
    if (m.id === "sdk_embed") {
      if (type === "custom_api" || type === "mobile") s += 4;
      if (scale === "small" || scale === "medium") s += 3;
      if (auth === "api_key" || auth === "jwt") s += 2;
    }
    if (m.id === "rest_polling") {
      if (type === "legacy") s += 5;
      if (!hasPublicEndpoint) s += 3;
      if (scale === "small") s += 3;
      if (auth === "basic" || auth === "api_key") s += 2;
    }
    if (m.id === "ipaas") {
      if (scale === "small") s += 4;
      if (type === "saas") s += 3;
      if (compliance.length === 0) s += 2;
    }
    if (m.id === "db_connector") {
      if (type === "database" || type === "erp") s += 5;
      if (!hasPublicEndpoint) s += 3;
      if (scale === "large" || scale === "enterprise") s += 2;
    }

    m.score = s;
  }

  return methods.sort((a, b) => b.score - a.score);
}

// ─── Zero Trust Score ─────────────────────────────────────────────────────────

function computeZeroTrustScore(profile: SystemProfile, topMethod: RecommendedMethod): number {
  let score = 0;
  if (profile.auth === "mtls") score += 30;
  else if (profile.auth === "oauth2" || profile.auth === "jwt") score += 20;
  else if (profile.auth === "api_key") score += 10;
  else if (profile.auth === "basic") score += 5;

  if (topMethod.security >= 4) score += 25;
  else if (topMethod.security >= 3) score += 15;

  if (profile.compliance.includes("iso27001")) score += 10;
  if (profile.compliance.includes("pci_dss")) score += 10;
  if (profile.compliance.includes("hipaa")) score += 10;
  if (profile.compliance.includes("gdpr")) score += 5;

  if (topMethod.scalability >= 4) score += 10;
  if (profile.scale === "enterprise") score += 5;

  return Math.min(100, score);
}

// ─── Pill / Badge ─────────────────────────────────────────────────────────────
const ScoreBadge = ({ n, max = 5, label }: { n: number; max?: number; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ color: "#6b7280", fontSize: 11 }}>{label}</span>
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: 2,
          background: i < n ? "#7c3aed" : "#e5e7eb",
        }} />
      ))}
    </div>
  </div>
);

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ["מערכת", "אבטחה", "עומס", "ניתוח"];

const StepBar = ({ step }: { step: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
    {STEPS.map((label, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: i < step ? "#7c3aed" : i === step ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#f3f4f6",
            border: i === step ? "2px solid #7c3aed" : "2px solid transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: i <= step ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 700,
            boxShadow: i === step ? "0 0 0 4px #ede9fe" : "none",
            transition: "all 0.3s",
          }}>
            {i < step ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : i + 1}
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: i <= step ? "#7c3aed" : "#9ca3af", direction: "rtl" }}>{label}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div style={{ flex: 1, height: 2, background: i < step ? "#7c3aed" : "#e5e7eb", margin: "0 4px", marginBottom: 16, transition: "background 0.3s" }} />
        )}
      </div>
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConnectivityAgent() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [results, setResults] = useState<RecommendedMethod[] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<IntegrationMethod | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [profile, setProfile] = useState<SystemProfile>({
    type: null, name: "", auth: null, format: null,
    scale: null, compliance: [], hasPublicEndpoint: true, cloudProvider: "",
  });

  const patch = useCallback(<K extends keyof SystemProfile>(k: K, v: SystemProfile[K]) =>
    setProfile((p) => ({ ...p, [k]: v })), []);

  const toggleCompliance = (flag: ComplianceFlag) =>
    patch("compliance", profile.compliance.includes(flag)
      ? profile.compliance.filter((f) => f !== flag)
      : [...profile.compliance, flag]);

  const runAnalysis = async () => {
    setStep(3);
    setAnalyzing(true);
    setAnalyzeProgress(0);

    const stages = [
      { label: "סורק ארכיטקטורת מערכת...", pct: 20 },
      { label: "מנתח דרישות אבטחה...",      pct: 40 },
      { label: "בודק תאימות Zero Trust...",  pct: 60 },
      { label: "מחשב ציוני שיטות חיבור...", pct: 80 },
      { label: "מייצר המלצות...",            pct: 100 },
    ];

    for (const s of stages) {
      await new Promise((r) => setTimeout(r, 700));
      setAnalyzeProgress(s.pct);
    }

    const recs = computeRecommendations(profile);
    setResults(recs);
    setSelectedMethod(recs[0].id);
    setAnalyzing(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "הועתק!", description: "הקוד הועתק ללוח." });
  };

  const selected = results?.find((r) => r.id === selectedMethod);
  const ztScore = results && selected ? computeZeroTrustScore(profile, selected) : 0;

  const ztColor = ztScore >= 70 ? "#22c55e" : ztScore >= 40 ? "#f59e0b" : "#ef4444";
  const ztLabel = ztScore >= 70 ? "STRONG" : ztScore >= 40 ? "MODERATE" : "WEAK";

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto", direction: "rtl" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg,#1e1b2e,#3b0764)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GitMerge style={{ width: 22, height: 22, color: "#a855f7" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: -0.5 }}>
              סוכן קישוריות
            </h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
              Connectivity Agent · ניתוח ממשוק Zero Trust אוטומטי
            </p>
          </div>
          <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 20,
              background: "linear-gradient(135deg,#0f172a,#1e1b2e)",
              border: "1px solid #334155",
            }}>
              <Shield style={{ width: 13, height: 13, color: "#a855f7" }} />
              <span style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>ZERO TRUST ++</span>
            </div>
          </div>
        </div>
        <p style={{ color: "#4b5563", fontSize: 14, margin: 0, lineHeight: 1.6, maxWidth: 680 }}>
          מלא את פרופיל המערכת הקיימת — הסוכן ינתח ויבחר את דרך ההתממשקות האופטימלית,
          ייצור קוד מוכן להטמעה, ויאמת אבטחת Zero Trust.
        </p>
      </div>

      {/* Step bar */}
      <StepBar step={step} />

      <AnimatePresence mode="wait">
        {/* ─── Step 0: System Type ─────────────────────────────────────── */}
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>מהי המערכת הקיימת של הלקוח?</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>בחר את סוג המערכת עמה נרצה לבצע אינטגרציה</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
              {SYSTEM_TYPES.map((sys) => (
                <motion.button key={sys.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => patch("type", sys.id)}
                  style={{
                    padding: "16px 18px", borderRadius: 12, cursor: "pointer", textAlign: "right",
                    background: profile.type === sys.id ? "linear-gradient(135deg,#ede9fe,#f5f3ff)" : "#fff",
                    border: `2px solid ${profile.type === sys.id ? "#7c3aed" : "#e5e7eb"}`,
                    transition: "all 0.2s", boxShadow: profile.type === sys.id ? "0 0 0 3px #ede9fe" : "none",
                  }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{sys.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{sys.labelHe}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sys.desc}</div>
                  {profile.type === sys.id && (
                    <div style={{ marginTop: 6 }}>
                      <CheckCircle2 style={{ width: 14, height: 14, color: "#7c3aed" }} />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* System name */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                שם המערכת / ספק (אופציונלי)
              </label>
              <input
                value={profile.name}
                onChange={(e) => patch("name", e.target.value)}
                placeholder='לדוגמה: "SAP B1", "Salesforce Enterprise", "PostgreSQL 15"'
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13,
                  border: "1.5px solid #e5e7eb", background: "#fff", direction: "rtl",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Endpoint */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "14px 18px", borderRadius: 10, background: "#f9fafb", border: "1.5px solid #e5e7eb" }}>
              <Globe style={{ width: 18, height: 18, color: "#6b7280", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>לחברה יש endpoint ציבורי (URL נגיש מהאינטרנט)?</span>
              <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
                {[true, false].map((v) => (
                  <button key={String(v)}
                    onClick={() => patch("hasPublicEndpoint", v)}
                    style={{
                      padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: profile.hasPublicEndpoint === v ? "#7c3aed" : "#fff",
                      color: profile.hasPublicEndpoint === v ? "#fff" : "#6b7280",
                      border: `1.5px solid ${profile.hasPublicEndpoint === v ? "#7c3aed" : "#e5e7eb"}`,
                    }}>
                    {v ? "כן" : "לא"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <Button onClick={() => setStep(1)} disabled={!profile.type}
                style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                הבא <ChevronLeft style={{ width: 16, height: 16 }} />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── Step 1: Security & Format ──────────────────────────────── */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>אבטחה ותקנות</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>מה שיטת האימות של המערכת הקיימת? אילו תקנות חלות?</p>

            {/* Auth method */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Key style={{ width: 15, height: 15, color: "#7c3aed" }} />
                שיטת אימות קיימת
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {AUTH_METHODS.map((a) => (
                  <button key={a.id} onClick={() => patch("auth", a.id)}
                    style={{
                      padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "right",
                      background: profile.auth === a.id ? "#f5f3ff" : "#fff",
                      border: `2px solid ${profile.auth === a.id ? "#7c3aed" : "#e5e7eb"}`,
                      transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{a.labelHe}</div>
                    <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ width: 8, height: 4, borderRadius: 1, background: i < a.trust ? "#7c3aed" : "#e5e7eb" }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data format */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Code2 style={{ width: 15, height: 15, color: "#7c3aed" }} />
                פורמט הנתונים
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DATA_FORMATS.map((f) => (
                  <button key={f.id} onClick={() => patch("format", f.id)}
                    style={{
                      padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: profile.format === f.id ? "#7c3aed" : "#f9fafb",
                      color: profile.format === f.id ? "#fff" : "#374151",
                      border: `1.5px solid ${profile.format === f.id ? "#7c3aed" : "#e5e7eb"}`,
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compliance */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield style={{ width: 15, height: 15, color: "#7c3aed" }} />
                תקנות ותאימות (בחר הכל שרלוונטי)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COMPLIANCES.map((c) => {
                  const active = profile.compliance.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleCompliance(c.id)}
                      style={{
                        padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
                        background: active ? `${c.color}18` : "#f9fafb",
                        color: active ? c.color : "#6b7280",
                        border: `2px solid ${active ? c.color : "#e5e7eb"}`,
                        transition: "all 0.15s",
                      }}>
                      {active && "✓ "}{c.label}
                    </button>
                  );
                })}
                <button onClick={() => patch("compliance", [])}
                  style={{ padding: "8px 14px", borderRadius: 20, fontSize: 12, color: "#9ca3af", background: "transparent", border: "1.5px dashed #e5e7eb", cursor: "pointer" }}>
                  ללא תקנות
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Button onClick={() => setStep(2)} disabled={!profile.auth || !profile.format}
                style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                הבא <ChevronLeft style={{ width: 16, height: 16 }} />
              </Button>
              <Button variant="outline" onClick={() => setStep(0)}
                style={{ borderRadius: 10, padding: "10px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronRight style={{ width: 16, height: 16 }} /> חזור
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── Step 2: Scale ──────────────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>עומס ונפח צפוי</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>כמה אירועים/בקשות צפויים ליום?</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 32 }}>
              {SCALE_LEVELS.map((s) => (
                <motion.button key={s.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => patch("scale", s.id)}
                  style={{
                    padding: "20px 22px", borderRadius: 14, cursor: "pointer", textAlign: "right",
                    background: profile.scale === s.id ? "linear-gradient(135deg,#ede9fe,#f5f3ff)" : "#fff",
                    border: `2px solid ${profile.scale === s.id ? "#7c3aed" : "#e5e7eb"}`,
                    boxShadow: profile.scale === s.id ? "0 0 0 3px #ede9fe" : "none",
                    transition: "all 0.2s",
                  }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: profile.scale === s.id ? "#7c3aed" : "#111827", marginBottom: 4 }}>
                    {s.labelHe}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{s.desc}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{s.rpm} average</div>
                  {profile.scale === s.id && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, color: "#7c3aed", fontSize: 11, fontWeight: 700 }}>
                      <CheckCircle2 style={{ width: 13, height: 13 }} /> נבחר
                    </div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Warning for high compliance + low scale */}
            {profile.compliance.length > 0 && profile.scale === "small" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ padding: "12px 16px", borderRadius: 10, background: "#fef3c7", border: "1px solid #fcd34d", display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-start" }}>
                <AlertTriangle style={{ width: 16, height: 16, color: "#d97706", marginTop: 1, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  <strong>שים לב:</strong> עם דרישות תקינה ({profile.compliance.join(", ")}) גם בנפח קטן — מומלץ לבחור ארכיטקטורה עמידה לעתיד.
                </div>
              </motion.div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Button onClick={runAnalysis} disabled={!profile.scale}
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", borderRadius: 10, padding: "12px 32px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px #7c3aed44" }}>
                <Zap style={{ width: 16, height: 16 }} /> הפעל ניתוח
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}
                style={{ borderRadius: 10, padding: "10px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronRight style={{ width: 16, height: 16 }} /> חזור
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── Step 3: Analysis + Results ─────────────────────────────── */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {analyzing ? (
              /* Analyzing state */
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <motion.div
                  animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid #ede9fe", borderTopColor: "#7c3aed", margin: "0 auto 28px" }}
                />
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  סוכן הקישוריות מנתח...
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 28 }}>
                  {analyzeProgress < 20 ? "סורק ארכיטקטורת מערכת..." :
                   analyzeProgress < 40 ? "מנתח דרישות אבטחה..." :
                   analyzeProgress < 60 ? "בודק תאימות Zero Trust..." :
                   analyzeProgress < 80 ? "מחשב ציוני שיטות חיבור..." :
                   "מייצר המלצות..."}
                </div>
                <div style={{ width: 320, height: 6, background: "#f3f4f6", borderRadius: 6, margin: "0 auto", overflow: "hidden" }}>
                  <motion.div animate={{ width: `${analyzeProgress}%` }} transition={{ duration: 0.4 }}
                    style={{ height: "100%", background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 6 }} />
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>{analyzeProgress}%</div>
              </div>
            ) : results && (
              /* Results state */
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 28 }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>תוצאות הניתוח</h2>
                    <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                      {profile.name ? `"${profile.name}" — ` : ""}{SYSTEM_TYPES.find(s => s.id === profile.type)?.labelHe} ·{" "}
                      {SCALE_LEVELS.find(s => s.id === profile.scale)?.labelHe}
                    </p>
                  </div>

                  {/* Zero Trust Score */}
                  <div style={{ padding: "16px 22px", borderRadius: 14, background: "#0f172a", border: "1px solid #1e293b", textAlign: "center", minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, letterSpacing: 1, fontWeight: 700 }}>ZERO TRUST SCORE</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: ztColor, lineHeight: 1 }}>{ztScore}</div>
                    <div style={{ fontSize: 10, color: ztColor, fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>{ztLabel}</div>
                    <div style={{ marginTop: 8, height: 4, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${ztScore}%` }} transition={{ duration: 1, delay: 0.3 }}
                        style={{ height: "100%", background: ztColor, borderRadius: 4 }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20 }}>
                  {/* Method list */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 10, letterSpacing: 0.5 }}>שיטות מוצעות — מדורגות</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {results.slice(0, 5).map((m, idx) => {
                        const Icon = m.icon;
                        const isTop = idx === 0;
                        const isSel = m.id === selectedMethod;
                        return (
                          <motion.button key={m.id}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.07 }}
                            onClick={() => setSelectedMethod(m.id)}
                            style={{
                              padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "right",
                              background: isSel ? "#f5f3ff" : "#fff",
                              border: `2px solid ${isSel ? "#7c3aed" : isTop ? "#ddd6fe" : "#e5e7eb"}`,
                              transition: "all 0.15s", position: "relative",
                            }}>
                            {isTop && (
                              <div style={{
                                position: "absolute", top: -8, right: 10,
                                background: "#7c3aed", color: "#fff", fontSize: 9, fontWeight: 800,
                                padding: "2px 8px", borderRadius: 10, letterSpacing: 1,
                              }}>מומלץ</div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Icon style={{ width: 16, height: 16, color: isSel ? "#7c3aed" : "#9ca3af", flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? "#7c3aed" : "#111827" }}>{m.labelHe}</div>
                                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                  <ScoreBadge n={m.security} label="🔒" />
                                  <ScoreBadge n={m.scalability} label="📈" />
                                </div>
                              </div>
                              <div style={{
                                width: 28, height: 28, borderRadius: "50%", background: isSel ? "#7c3aed" : "#f3f4f6",
                                color: isSel ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 800,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>{m.score}</div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Method detail */}
                  {selected && (
                    <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ background: "#fff", borderRadius: 16, border: "2px solid #e5e7eb", padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <selected.icon style={{ width: 20, height: 20, color: "#7c3aed" }} />
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{selected.labelHe}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{selected.rationaleHe}</p>
                      </div>

                      {/* Scores */}
                      <div style={{ display: "flex", gap: 16, padding: "12px 14px", background: "#f9fafb", borderRadius: 10 }}>
                        <ScoreBadge n={selected.security} label="אבטחה" />
                        <ScoreBadge n={selected.complexity} label="מורכבות" />
                        <ScoreBadge n={selected.scalability} label="סקייל" />
                      </div>

                      {/* Zero Trust checklist */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <ShieldCheck style={{ width: 14, height: 14, color: "#22c55e" }} />
                          Zero Trust Checklist
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {selected.zeroTrustNotes.map((note, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#374151", direction: "ltr" }}>
                              <CheckCircle2 style={{ width: 12, height: 12, color: "#22c55e", flexShrink: 0 }} />
                              {note}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Code toggle */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                            <Terminal style={{ width: 14, height: 14, color: "#7c3aed" }} />
                            קוד מוכן להטמעה
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowCode(!showCode)}
                              style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151" }}>
                              {showCode ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                              {showCode ? "הסתר" : "הצג"}
                            </button>
                            <button onClick={() => copyCode(selected.code)}
                              style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, background: "#7c3aed", border: "none", color: "#fff" }}>
                              <Copy style={{ width: 12, height: 12 }} /> העתק
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {showCode && (
                            <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              style={{
                                margin: 0, padding: "14px 16px", borderRadius: 10,
                                background: "#0f172a", color: "#e2e8f0", fontSize: 10,
                                lineHeight: 1.6, overflow: "auto", maxHeight: 280,
                                direction: "ltr", fontFamily: "monospace", whiteSpace: "pre-wrap",
                                border: "1px solid #1e293b",
                              }}>
                              {selected.code}
                            </motion.pre>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 10, paddingTop: 4, borderTop: "1px solid #f3f4f6" }}>
                        <Button onClick={() => { setShowCode(true); copyCode(selected.code); }}
                          style={{ flex: 1, background: "#7c3aed", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Download style={{ width: 14, height: 14 }} /> קוד מלא
                        </Button>
                        <Button variant="outline" onClick={() => { setStep(0); setResults(null); setSelectedMethod(null); setProfile({ type: null, name: "", auth: null, format: null, scale: null, compliance: [], hasPublicEndpoint: true, cloudProvider: "" }); }}
                          style={{ borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          <RefreshCw style={{ width: 14, height: 14 }} /> ניתוח חדש
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Implementation roadmap */}
                {selected && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    style={{ marginTop: 24, padding: "20px 24px", borderRadius: 14, background: "linear-gradient(135deg,#0f172a,#1e1b2e)", border: "1px solid #334155" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <Layers style={{ width: 16, height: 16 }} />
                      מפת דרכים להטמעה — {selected.labelHe}
                    </div>
                    <div style={{ display: "flex", gap: 0, direction: "ltr" }}>
                      {[
                        { step: "1", title: "Infrastructure", desc: "TLS certs, firewall rules, network isolation" },
                        { step: "2", title: "Auth Setup",    desc: selected.id === "oauth_bridge" ? "OAuth app registration, PKCE flow" : selected.id === "mtls_gateway" ? "Generate CA, client certs" : "API key generation & vault storage" },
                        { step: "3", title: "Integration",   desc: selected.id === "webhook_push" ? "Deploy receiver endpoint, HMAC validation" : selected.id === "message_queue" ? "Broker setup, topic ACLs, consumer group" : "SDK install, config, test connection" },
                        { step: "4", title: "Zero Trust",    desc: "Rotate secrets, enable logging, set alerts" },
                        { step: "5", title: "Go Live",       desc: "Canary rollout → 100% traffic → monitor" },
                      ].map((r, i, arr) => (
                        <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 0 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.step}</div>
                            {i < arr.length - 1 && <div style={{ width: 2, height: 0, flex: 1 }} />}
                          </div>
                          <div style={{ flex: 1, paddingLeft: 0, paddingRight: 0, marginRight: 10, marginLeft: i < arr.length - 1 ? 0 : 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{r.title}</div>
                            <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>{r.desc}</div>
                          </div>
                          {i < arr.length - 1 && (
                            <ArrowRight style={{ width: 14, height: 14, color: "#334155", marginTop: 6, flexShrink: 0 }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
