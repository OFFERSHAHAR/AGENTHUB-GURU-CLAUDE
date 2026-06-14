import { useState } from "react";
import {
  Download, Copy, Check, MessageSquare, Brain, Database, GitBranch,
  Zap, ChevronRight, Settings2, Server, Bot, RefreshCw, Layers,
  ExternalLink, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// ─── Ollama models ────────────────────────────────────────────────────────────
const OLLAMA_MODELS = [
  { value: "llama3.2", label: "Llama 3.2 (3B) — קל ומהיר", size: "2GB", best: "chat" },
  { value: "llama3.1", label: "Llama 3.1 (8B) — מאוזן", size: "5GB", best: "general" },
  { value: "llama3.1:70b", label: "Llama 3.1 (70B) — חזק", size: "40GB", best: "complex" },
  { value: "mistral", label: "Mistral (7B) — מהיר ומדויק", size: "4GB", best: "analysis" },
  { value: "gemma2", label: "Gemma 2 (9B) — Google", size: "5GB", best: "chat" },
  { value: "gemma2:27b", label: "Gemma 2 (27B) — Google חזק", size: "16GB", best: "complex" },
  { value: "phi4", label: "Phi-4 (14B) — Microsoft", size: "9GB", best: "reasoning" },
  { value: "qwen2.5", label: "Qwen 2.5 (7B) — Alibaba", size: "5GB", best: "multilingual" },
  { value: "qwen2.5:14b", label: "Qwen 2.5 (14B) — רב-לשוני", size: "9GB", best: "multilingual" },
  { value: "deepseek-r1", label: "DeepSeek R1 — חשיבה עמוקה", size: "5GB", best: "reasoning" },
  { value: "deepseek-coder-v2", label: "DeepSeek Coder V2 — קוד", size: "9GB", best: "code" },
  { value: "codellama", label: "Code Llama — קוד (Meta)", size: "4GB", best: "code" },
  { value: "nomic-embed-text", label: "Nomic Embed — Embeddings בלבד", size: "274MB", best: "rag" },
];

const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// ─── Template generator functions ────────────────────────────────────────────
function makeChatBotBasic(model: string, baseUrl: string) {
  const id1 = uid(), id2 = uid(), id3 = uid(), id4 = uid();
  return {
    name: `🤖 Ollama Basic Chatbot — ${model}`,
    nodes: [
      {
        parameters: { options: {} },
        id: id1, name: "Chat Trigger", type: "@n8n/n8n-nodes-langchain.chatTrigger",
        typeVersion: 1, position: [240, 300],
        webhookId: uid(),
      },
      {
        parameters: { options: {} },
        id: id2, name: "Conversational Chain", type: "@n8n/n8n-nodes-langchain.chainConversational",
        typeVersion: 1.4, position: [540, 300],
      },
      {
        parameters: { model, options: { numCtx: 4096 }, baseUrl },
        id: id3, name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama",
        typeVersion: 1, position: [540, 500],
        credentials: {},
      },
      {
        parameters: {
          sessionIdType: "fromInput",
          sessionKey: "={{ $json.sessionId ?? $execution.id }}",
          contextWindowLength: 20,
        },
        id: id4, name: "Window Buffer Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
        typeVersion: 1.3, position: [760, 500],
      },
    ],
    connections: {
      "Chat Trigger": { main: [[{ node: "Conversational Chain", type: "main", index: 0 }]] },
      "Conversational Chain": { ai_languageModel: [[{ node: `Ollama — ${model}`, type: "ai_languageModel", index: 0 }]], ai_memory: [[{ node: "Window Buffer Memory", type: "ai_memory", index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: "v1" },
    versionId: uid(),
    meta: { instanceId: "agenthub-export" },
    tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Ollama" }, { id: uid(), name: "Chatbot" }],
  };
}

function makeSupportBot(model: string, baseUrl: string) {
  const nodes = [
    {
      parameters: { httpMethod: "POST", path: "support-chat", responseMode: "responseNode", options: {} },
      id: uid(), name: "Webhook — Chat Input", type: "n8n-nodes-base.webhook",
      typeVersion: 2, position: [200, 300], webhookId: uid(),
    },
    {
      parameters: {
        systemMessage: `You are a professional customer support agent. You are helpful, empathetic, and concise.

Guidelines:
- Always greet the user warmly on first interaction
- If you don't know something, say so clearly — never make up information
- Escalate to human if the issue is billing, account suspension, or legal
- Keep responses under 150 words unless the user asks for detail
- Detect the user's language and respond in the same language

When you need to escalate, respond with: [ESCALATE] followed by the reason.`,
        options: { returnIntermediateSteps: false },
      },
      id: uid(), name: "Support AI Agent", type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7, position: [500, 300],
    },
    {
      parameters: { model, options: { numCtx: 8192, temperature: 0.3 }, baseUrl },
      id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [500, 520],
    },
    {
      parameters: {
        sessionIdType: "fromInput",
        sessionKey: "={{ $json.body.sessionId ?? $json.body.userId ?? 'default' }}",
        contextWindowLength: 30,
      },
      id: uid(), name: "Conversation Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.3, position: [720, 520],
    },
    {
      parameters: {
        url: "https://api.example.com/search",
        method: "GET",
        sendQuery: true,
        queryParameters: { parameters: [{ name: "q", value: "={{ $fromAI('search_query') }}" }] },
        options: {},
        description: "Search the knowledge base for answers",
        name: "search_knowledge_base",
      },
      id: uid(), name: "Knowledge Base Search", type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
      typeVersion: 1.1, position: [940, 520],
    },
    {
      parameters: {
        conditions: {
          string: [{ value1: "={{ $json.output }}", operation: "contains", value2: "[ESCALATE]" }],
        },
      },
      id: uid(), name: "Needs Escalation?", type: "n8n-nodes-base.if",
      typeVersion: 2, position: [800, 300],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ { reply: $json.output.replace('[ESCALATE]', '').trim(), escalated: false, sessionId: $('Webhook — Chat Input').item.json.body.sessionId } }}" },
      id: uid(), name: "Send Reply", type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1, position: [1060, 220],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ { reply: 'אני מעביר אותך לנציג אנושי. אנא המתן...', escalated: true, reason: $json.output, sessionId: $('Webhook — Chat Input').item.json.body.sessionId } }}" },
      id: uid(), name: "Escalate to Human", type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1, position: [1060, 420],
    },
  ];
  const names = nodes.map(n => n.name);
  return {
    name: `🎧 Support Bot + Escalation — ${model}`,
    nodes,
    connections: {
      [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] },
      [names[1]]: {
        main: [[{ node: names[5], type: "main", index: 0 }]],
        ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]],
        ai_memory: [[{ node: names[3], type: "ai_memory", index: 0 }]],
        ai_tool: [[{ node: names[4], type: "ai_tool", index: 0 }]],
      },
      [names[5]]: {
        main: [
          [{ node: names[6], type: "main", index: 0 }],
          [{ node: names[7], type: "main", index: 0 }],
        ],
      },
    },
    active: false,
    settings: { executionOrder: "v1" },
    versionId: uid(),
    meta: { instanceId: "agenthub-export" },
    tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Ollama" }, { id: uid(), name: "Support" }],
  };
}

function makeRagBot(model: string, embedModel: string, baseUrl: string) {
  const nodes = [
    {
      parameters: { options: {} },
      id: uid(), name: "Chat Trigger", type: "@n8n/n8n-nodes-langchain.chatTrigger",
      typeVersion: 1, position: [200, 300], webhookId: uid(),
    },
    {
      parameters: {
        systemMessage: `You are a knowledgeable assistant with access to a document knowledge base.

RULES:
1. Always search the knowledge base first before answering
2. Cite which documents you used: "According to [document name]..."
3. If the knowledge base has no relevant info, say: "This topic is not in my knowledge base. Here's what I know generally..."
4. Be precise — don't add information not found in the retrieved documents
5. If asked to do something outside your knowledge domain, politely decline`,
        options: {},
      },
      id: uid(), name: "RAG Agent", type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7, position: [460, 300],
    },
    {
      parameters: { model, options: { numCtx: 16384, temperature: 0.1 }, baseUrl },
      id: uid(), name: `Ollama Chat — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [460, 500],
    },
    {
      parameters: { model: embedModel, baseUrl, options: {} },
      id: uid(), name: `Ollama Embeddings — ${embedModel}`, type: "@n8n/n8n-nodes-langchain.embeddingsOllama",
      typeVersion: 1, position: [760, 580],
    },
    {
      parameters: {
        mode: "retrieve-as-tool",
        toolName: "knowledge_base_search",
        toolDescription: "Search the knowledge base to find relevant information for answering questions. Input should be the user's question or key terms.",
        topK: 5,
      },
      id: uid(), name: "Vector Store Retriever", type: "@n8n/n8n-nodes-langchain.vectorStoreInMemory",
      typeVersion: 1.1, position: [760, 480],
    },
    {
      parameters: {
        sessionIdType: "fromInput",
        sessionKey: "={{ $json.sessionId ?? 'default' }}",
        contextWindowLength: 15,
      },
      id: uid(), name: "Chat Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.3, position: [960, 480],
    },
  ];
  const names = nodes.map(n => n.name);
  return {
    name: `📚 RAG Document Bot — ${model} + ${embedModel}`,
    nodes,
    connections: {
      [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] },
      [names[1]]: {
        ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]],
        ai_tool: [[{ node: names[4], type: "ai_tool", index: 0 }]],
        ai_memory: [[{ node: names[5], type: "ai_memory", index: 0 }]],
      },
      [names[4]]: {
        ai_vectorStore: [],
        ai_embedding: [[{ node: names[3], type: "ai_embedding", index: 0 }]],
      },
    },
    active: false,
    settings: { executionOrder: "v1" },
    versionId: uid(),
    meta: { instanceId: "agenthub-export" },
    tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Ollama" }, { id: uid(), name: "RAG" }],
  };
}

function makeMultiModelRouter(baseUrl: string) {
  const nodes = [
    {
      parameters: { httpMethod: "POST", path: "smart-chat", responseMode: "responseNode", options: {} },
      id: uid(), name: "Webhook", type: "n8n-nodes-base.webhook",
      typeVersion: 2, position: [200, 380], webhookId: uid(),
    },
    {
      parameters: {
        model: "llama3.2",
        options: { numCtx: 2048, temperature: 0 },
        baseUrl,
        systemPrompt: `Classify this user message into ONE category. Reply with ONLY the category name, nothing else.

Categories:
- CODE: programming, debugging, code review, algorithms, tech questions
- ANALYSIS: data analysis, comparison, research, summarization, structured thinking
- CREATIVE: creative writing, brainstorming, storytelling, marketing copy
- CHAT: general conversation, questions, support, advice

User message: {{ $json.body.message }}`,
      },
      id: uid(), name: "Classify Intent", type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [440, 380],
    },
    {
      parameters: {
        conditions: {
          string: [{ value1: "={{ $json.response.trim().toUpperCase() }}", operation: "equals", value2: "CODE" }],
        },
      },
      id: uid(), name: "Is Code Task?", type: "n8n-nodes-base.if",
      typeVersion: 2, position: [660, 280],
    },
    {
      parameters: {
        conditions: {
          string: [{ value1: "={{ $('Classify Intent').item.json.response.trim().toUpperCase() }}", operation: "equals", value2: "ANALYSIS" }],
        },
      },
      id: uid(), name: "Is Analysis Task?", type: "n8n-nodes-base.if",
      typeVersion: 2, position: [660, 480],
    },
    {
      parameters: { model: "deepseek-coder-v2", options: { numCtx: 16384, temperature: 0.1 }, baseUrl },
      id: uid(), name: "DeepSeek Coder", type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [900, 180],
    },
    {
      parameters: { model: "mistral", options: { numCtx: 8192, temperature: 0.3 }, baseUrl },
      id: uid(), name: "Mistral Analyst", type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [900, 380],
    },
    {
      parameters: { model: "llama3.1", options: { numCtx: 8192, temperature: 0.8 }, baseUrl },
      id: uid(), name: "Llama3 Creative", type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [900, 580],
    },
    {
      parameters: {
        assignments: { assignments: [{ id: uid(), name: "reply", value: "={{ $json.response }}", type: "string" }, { id: uid(), name: "model_used", value: "={{ $node.name }}", type: "string" }] },
        options: {},
      },
      id: uid(), name: "Format Response", type: "n8n-nodes-base.set",
      typeVersion: 3.4, position: [1100, 380],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ { reply: $json.reply, model: $json.model_used, category: $('Classify Intent').item.json.response.trim() } }}" },
      id: uid(), name: "Send Response", type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1, position: [1280, 380],
    },
  ];
  const names = nodes.map(n => n.name);
  return {
    name: "🔀 Multi-Model Router — ניתוב אוטומטי למודל הנכון",
    nodes,
    connections: {
      [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] },
      [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] },
      [names[2]]: { main: [[{ node: names[4], type: "main", index: 0 }], [{ node: names[3], type: "main", index: 0 }]] },
      [names[3]]: { main: [[{ node: names[5], type: "main", index: 0 }], [{ node: names[6], type: "main", index: 0 }]] },
      [names[4]]: { main: [[{ node: names[7], type: "main", index: 0 }]] },
      [names[5]]: { main: [[{ node: names[7], type: "main", index: 0 }]] },
      [names[6]]: { main: [[{ node: names[7], type: "main", index: 0 }]] },
      [names[7]]: { main: [[{ node: names[8], type: "main", index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: "v1" },
    versionId: uid(),
    meta: { instanceId: "agenthub-export" },
    tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Ollama" }, { id: uid(), name: "Router" }],
  };
}

function makeSalesLeadBot(model: string, baseUrl: string) {
  const nodes = [
    {
      parameters: { httpMethod: "POST", path: "sales-chat", responseMode: "responseNode", options: {} },
      id: uid(), name: "Webhook — Lead Chat", type: "n8n-nodes-base.webhook",
      typeVersion: 2, position: [160, 360], webhookId: uid(),
    },
    {
      parameters: {
        systemMessage: `You are a professional sales assistant for a B2B SaaS company.

Your job:
1. Qualify leads by understanding their: company size, budget, use case, timeline, decision maker status
2. Book demos for qualified leads (score >= 7/10)
3. Provide product info for information-seekers
4. Detect unqualified leads politely and focus on future potential

Lead Scoring (1-10):
- Company size: <10 = 2pts, 10-100 = 5pts, 100+ = 8pts
- Budget confirmed: +2pts
- Decision maker: +2pts
- Urgent need (< 3 months): +2pts
- Relevant use case: +1pt

Always extract and output a JSON block at the end of every message:
<lead_data>
{"name": "", "email": "", "company": "", "size": "", "score": 0, "intent": "qualify|demo|info", "budget": ""}
</lead_data>`,
        options: { returnIntermediateSteps: false },
      },
      id: uid(), name: "Sales Agent", type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7, position: [400, 360],
    },
    {
      parameters: { model, options: { numCtx: 8192, temperature: 0.4 }, baseUrl },
      id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [400, 560],
    },
    {
      parameters: {
        sessionIdType: "fromInput",
        sessionKey: "={{ $json.body.sessionId ?? $json.body.email ?? 'guest' }}",
        contextWindowLength: 40,
      },
      id: uid(), name: "Lead Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.3, position: [620, 560],
    },
    {
      parameters: {
        url: "https://api.cal.com/v2/bookings",
        method: "POST",
        sendBody: true,
        bodyParameters: { parameters: [{ name: "start", value: "={{ $fromAI('booking_time', 'ISO datetime for the demo') }}" }, { name: "name", value: "={{ $fromAI('lead_name') }}" }, { name: "email", value: "={{ $fromAI('lead_email') }}" }] },
        options: {},
        description: "Book a demo meeting using Cal.com. Call when the lead is ready to book.",
        name: "book_demo",
      },
      id: uid(), name: "Book Demo — Cal.com", type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
      typeVersion: 1.1, position: [840, 560],
    },
    {
      parameters: {
        jsCode: `const output = $input.first().json.output;
const match = output.match(/<lead_data>([\s\S]*?)<\/lead_data>/);
let leadData = {};
try { leadData = JSON.parse(match?.[1] ?? '{}'); } catch {}
const cleanOutput = output.replace(/<lead_data>[\s\S]*?<\/lead_data>/, '').trim();
return [{ json: { reply: cleanOutput, lead: leadData, score: leadData.score ?? 0 } }];`,
      },
      id: uid(), name: "Extract Lead Data", type: "n8n-nodes-base.code",
      typeVersion: 2, position: [640, 360],
    },
    {
      parameters: {
        conditions: { number: [{ value1: "={{ $json.lead.score }}", operation: "largerEqual", value2: 7 }] },
      },
      id: uid(), name: "Qualified Lead?", type: "n8n-nodes-base.if",
      typeVersion: 2, position: [860, 360],
    },
    {
      parameters: {
        url: "https://your-crm.com/api/leads",
        method: "POST",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { lead: $json.lead, score: $json.score, source: 'chatbot', timestamp: new Date().toISOString() } }}",
        options: {},
      },
      id: uid(), name: "Save to CRM", type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2, position: [1060, 260],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ { reply: $('Extract Lead Data').item.json.reply, score: $('Extract Lead Data').item.json.score, qualified: $json.score >= 7 } }}" },
      id: uid(), name: "Send Reply", type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1, position: [1060, 460],
    },
  ];
  const names = nodes.map(n => n.name);
  return {
    name: `💼 Sales Lead Qualifier Bot — ${model}`,
    nodes,
    connections: {
      [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] },
      [names[1]]: {
        main: [[{ node: names[5], type: "main", index: 0 }]],
        ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]],
        ai_memory: [[{ node: names[3], type: "ai_memory", index: 0 }]],
        ai_tool: [[{ node: names[4], type: "ai_tool", index: 0 }]],
      },
      [names[5]]: { main: [[{ node: names[6], type: "main", index: 0 }]] },
      [names[6]]: { main: [[{ node: names[7], type: "main", index: 0 }], [{ node: names[8], type: "main", index: 0 }]] },
      [names[7]]: { main: [[{ node: names[8], type: "main", index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: "v1" },
    versionId: uid(),
    meta: { instanceId: "agenthub-export" },
    tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Ollama" }, { id: uid(), name: "Sales" }],
  };
}

function makeHebChatBot(model: string, baseUrl: string) {
  const nodes = [
    {
      parameters: { options: {} },
      id: uid(), name: "Chat Trigger", type: "@n8n/n8n-nodes-langchain.chatTrigger",
      typeVersion: 1, position: [200, 320], webhookId: uid(),
    },
    {
      parameters: {
        systemMessage: `אתה עוזר AI מקצועי ואדיב שמדבר בעברית.

כללים:
- תמיד ענה בעברית, גם אם נשאלת באנגלית (אלא אם המשתמש מבקש אנגלית)
- שמור על טון מקצועי אך ידידותי
- כשאתה לא בטוח — אמור זאת בכנות
- השתמש בניקוד רשמי ובדיקוק עברי תקין
- אם שאלה רגישה — הפנה לאיש מקצוע מתאים
- הגב בתשובות קצרות ומדויקות (עד 200 מילים) אלא אם נבקש פירוט

אתה יכול לסייע ב: מידע כללי, ניתוח מסמכים, כתיבה, תכנון, שאלות עסקיות וטכנולוגיות.`,
        options: {},
      },
      id: uid(), name: "Hebrew Chat Agent", type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7, position: [460, 320],
    },
    {
      parameters: { model, options: { numCtx: 8192, temperature: 0.6 }, baseUrl },
      id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama",
      typeVersion: 1, position: [460, 520],
    },
    {
      parameters: {
        sessionIdType: "fromInput",
        sessionKey: "={{ $json.sessionId ?? $execution.id }}",
        contextWindowLength: 25,
      },
      id: uid(), name: "Session Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.3, position: [680, 520],
    },
    {
      parameters: {
        url: "https://en.wikipedia.org/api/rest_v1/page/summary/{{ encodeURIComponent($fromAI('search_term', 'English search term for Wikipedia')) }}",
        method: "GET",
        options: {},
        description: "Search Wikipedia for factual information. Use ONLY for factual questions that need verification.",
        name: "wikipedia_search",
      },
      id: uid(), name: "Wikipedia Search", type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
      typeVersion: 1.1, position: [880, 520],
    },
  ];
  const names = nodes.map(n => n.name);
  return {
    name: `🇮🇱 Hebrew AI Assistant — ${model}`,
    nodes,
    connections: {
      [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] },
      [names[1]]: {
        ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]],
        ai_memory: [[{ node: names[3], type: "ai_memory", index: 0 }]],
        ai_tool: [[{ node: names[4], type: "ai_tool", index: 0 }]],
      },
    },
    active: false,
    settings: { executionOrder: "v1" },
    versionId: uid(),
    meta: { instanceId: "agenthub-export" },
    tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Ollama" }, { id: uid(), name: "Hebrew" }],
  };
}

// ─── Additional generator functions ──────────────────────────────────────────

function makeTelegramBot(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { updates: ["message"], additionalFields: {} }, id: uid(), name: "Telegram Trigger", type: "n8n-nodes-base.telegramTrigger", typeVersion: 1.1, position: [200, 300], webhookId: uid() },
    { parameters: { systemMessage: `You are a helpful Telegram bot assistant. Be concise (max 200 chars). Always friendly. If asked in Hebrew — answer in Hebrew. If asked in English — answer in English.`, options: { returnIntermediateSteps: false } }, id: uid(), name: "Telegram AI Agent", type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 1.7, position: [460, 300] },
    { parameters: { model, options: { numCtx: 4096, temperature: 0.7 }, baseUrl }, id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [460, 500] },
    { parameters: { sessionIdType: "customKey", sessionKey: "={{ $json.message.chat.id }}", contextWindowLength: 20 }, id: uid(), name: "Chat Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow", typeVersion: 1.3, position: [680, 500] },
    { parameters: { chatId: "={{ $('Telegram Trigger').item.json.message.chat.id }}", text: "={{ $json.output }}", additionalFields: { parse_mode: "Markdown" } }, id: uid(), name: "Send Telegram Reply", type: "n8n-nodes-base.telegram", typeVersion: 1.2, position: [760, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `📱 Telegram AI Bot — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[4], type: "main", index: 0 }]], ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]], ai_memory: [[{ node: names[3], type: "ai_memory", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "AgentHub" }, { id: uid(), name: "Telegram" }] };
}

function makeEmailAutoReply(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { mailbox: "INBOX", postProcessAction: "read", options: { allowUnauthorizedCerts: false } }, id: uid(), name: "IMAP Email Trigger", type: "n8n-nodes-base.emailReadImap", typeVersion: 2, position: [200, 300] },
    { parameters: { systemMessage: `You are a professional email auto-responder. Your task:\n1. Read the incoming email carefully\n2. Draft a professional, warm reply\n3. Keep replies under 150 words\n4. ALWAYS end with: "Best regards,\\n[Your Company Name]"\n5. If the email is in Hebrew — reply in Hebrew\n6. Do NOT make up facts. If you don't know something, say you'll follow up.`, options: {} }, id: uid(), name: "Email Drafter AI", type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 1.7, position: [500, 300] },
    { parameters: { model, options: { numCtx: 8192, temperature: 0.4 }, baseUrl }, id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [500, 500] },
    { parameters: { fromEmail: "no-reply@yourcompany.com", toEmail: "={{ $('IMAP Email Trigger').item.json.from.value[0].address }}", subject: "={{ 'Re: ' + $('IMAP Email Trigger').item.json.subject }}", text: "={{ $json.output }}", options: {} }, id: uid(), name: "Send Auto Reply", type: "n8n-nodes-base.emailSend", typeVersion: 2.1, position: [780, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `📧 Email Auto-Responder — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[3], type: "main", index: 0 }]], ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Email" }, { id: uid(), name: "Automation" }] };
}

function makeDocumentSummarizer(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "summarize-doc", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Upload Doc", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { operation: "extractContent", options: {} }, id: uid(), name: "Extract Text (PDF/Word)", type: "n8n-nodes-base.extractFromFile", typeVersion: 1, position: [440, 300] },
    { parameters: { model, prompt: `Summarize the following document in a structured way:\n\n1. **Main Topic** (1 sentence)\n2. **Key Points** (3-5 bullet points)\n3. **Action Items** (if any)\n4. **Important Dates/Numbers** (if any)\n\nDocument:\n{{ $json.text.slice(0, 12000) }}`, options: { numCtx: 16384, temperature: 0.2 }, baseUrl }, id: uid(), name: `Ollama Summarize — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [680, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ { summary: $json.response, wordCount: $('Extract Text (PDF/Word)').item.json.text.split(' ').length, model: '{{ model }}' } }}" }, id: uid(), name: "Return Summary", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [920, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `📄 Document Summarizer — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Documents" }, { id: uid(), name: "Summarization" }] };
}

function makeSocialPostGenerator(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { rule: { interval: [{ field: "days", daysInterval: 1 }] } }, id: uid(), name: "Daily Trigger (09:00)", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [200, 300] },
    { parameters: { url: "https://your-content-calendar.com/api/today", method: "GET", options: {} }, id: uid(), name: "Fetch Today's Topic", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [420, 300] },
    { parameters: { model, prompt: `Create social media posts for today's topic: {{ $json.topic }}\n\nGenerate:\n1. LinkedIn post (professional, 150 words, include 3 hashtags)\n2. Twitter/X post (under 280 chars, punchy, 2 hashtags)\n3. Instagram caption (engaging, 100 words, 5 hashtags)\n\nBrand tone: professional but approachable. Language: {{ $json.language ?? 'Hebrew' }}\n\nFormat as JSON: { linkedin: "...", twitter: "...", instagram: "..." }`, options: { numCtx: 8192, temperature: 0.8 }, baseUrl }, id: uid(), name: `Generate Posts — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [660, 300] },
    { parameters: { mode: "runOnceForEachItem", jsCode: `const raw = $input.item.json.response;\nconst match = raw.match(/\\{[\\s\\S]*\\}/);\nreturn [{ json: match ? JSON.parse(match[0]) : { linkedin: raw, twitter: raw, instagram: raw } }];` }, id: uid(), name: "Parse JSON Posts", type: "n8n-nodes-base.code", typeVersion: 2, position: [900, 300] },
    { parameters: { url: "https://api.linkedin.com/v2/ugcPosts", method: "POST", sendBody: true, bodyParameters: { parameters: [{ name: "text", value: "={{ $json.linkedin }}" }] }, options: {} }, id: uid(), name: "Post to LinkedIn", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1140, 200] },
    { parameters: { url: "https://api.twitter.com/2/tweets", method: "POST", sendBody: true, bodyParameters: { parameters: [{ name: "text", value: "={{ $json.twitter }}" }] }, options: {} }, id: uid(), name: "Post to Twitter/X", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1140, 400] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `📱 Social Media Post Generator — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] }, [names[3]]: { main: [[{ node: names[4], type: "main", index: 0 }], [{ node: names[5], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Social Media" }, { id: uid(), name: "Content" }] };
}

function makeSentimentAnalyzer(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "analyze-sentiment", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Reviews Input", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model, prompt: `Analyze the sentiment of each review below and return a JSON array.\n\nReviews:\n{{ JSON.stringify($json.body.reviews) }}\n\nFor each review return:\n{ "text": "...", "sentiment": "positive|negative|neutral", "score": 1-10, "emotions": ["..."], "actionRequired": true/false, "summary": "one sentence" }\n\nReturn ONLY valid JSON array, nothing else.`, options: { numCtx: 8192, temperature: 0.1 }, baseUrl }, id: uid(), name: `Sentiment Analysis — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { mode: "runOnceForEachItem", jsCode: `const raw = $input.item.json.response;\nconst match = raw.match(/\\[[\\s\\S]*\\]/);\nconst results = match ? JSON.parse(match[0]) : [];\nconst avg = results.reduce((s,r) => s + r.score, 0) / (results.length || 1);\nreturn [{ json: { results, averageScore: Math.round(avg * 10) / 10, total: results.length, positive: results.filter(r => r.sentiment === 'positive').length, negative: results.filter(r => r.sentiment === 'negative').length } }];` }, id: uid(), name: "Parse & Aggregate", type: "n8n-nodes-base.code", typeVersion: 2, position: [720, 300] },
    { parameters: { conditions: { number: [{ value1: "={{ $json.averageScore }}", operation: "smallerEqual", value2: 4 }] } }, id: uid(), name: "Negative Alert?", type: "n8n-nodes-base.if", typeVersion: 2, position: [960, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ $json }}" }, id: uid(), name: "Return Analysis", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1200, 200] },
    { parameters: { chatId: "YOUR_TELEGRAM_CHAT_ID", text: "={{ '🚨 Alert: Avg sentiment score ' + $json.averageScore + '/10\\n' + $json.negative + ' negative reviews detected!' }}", additionalFields: {} }, id: uid(), name: "Telegram Alert", type: "n8n-nodes-base.telegram", typeVersion: 1.2, position: [1200, 420] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `😊 Sentiment Analyzer + Alert — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] }, [names[3]]: { main: [[{ node: names[4], type: "main", index: 0 }], [{ node: names[5], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Sentiment" }, { id: uid(), name: "Analytics" }] };
}

function makeMeetingNotesBot(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "meeting-notes", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Transcript", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model, prompt: `Convert this meeting transcript into structured notes:\n\n{{ $json.body.transcript }}\n\nCreate:\n# Meeting Notes — {{ $json.body.title ?? 'Meeting' }}\n**Date:** {{ $json.body.date ?? new Date().toLocaleDateString() }}\n**Participants:** {{ $json.body.participants ?? 'See transcript' }}\n\n## Summary\n(2-3 sentences)\n\n## Key Decisions\n- (bullet list)\n\n## Action Items\n| Task | Owner | Deadline |\n|------|-------|----------|\n\n## Next Meeting\n(if mentioned)\n\nBe precise and factual. Only include what was actually discussed.`, options: { numCtx: 16384, temperature: 0.2 }, baseUrl }, id: uid(), name: `Generate Notes — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { fromEmail: "meetings@yourcompany.com", toEmail: "={{ $('Webhook — Transcript').item.json.body.recipientEmail }}", subject: "={{ '📝 Meeting Notes: ' + ($('Webhook — Transcript').item.json.body.title ?? 'Meeting') }}", text: "={{ $json.response }}", options: { appendAttribution: false } }, id: uid(), name: "Email Notes", type: "n8n-nodes-base.emailSend", typeVersion: 2.1, position: [740, 200] },
    { parameters: { respondWith: "json", responseBody: "={{ { notes: $json.response, emailSent: true } }}" }, id: uid(), name: "Return Notes", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [740, 420] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `📝 Meeting Notes Generator — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }], [{ node: names[3], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Productivity" }, { id: uid(), name: "Meetings" }] };
}

function makeTranslatorBot(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { options: {} }, id: uid(), name: "Chat Trigger", type: "@n8n/n8n-nodes-langchain.chatTrigger", typeVersion: 1, position: [200, 300], webhookId: uid() },
    { parameters: { systemMessage: `You are a professional multilingual translator. \n\nRules:\n1. Detect the source language automatically\n2. Ask the user what language to translate to if not specified\n3. Translate accurately, preserving tone and formality\n4. For Hebrew ↔ English: maintain proper RTL/LTR formatting\n5. After translating, offer: "Want me to also translate to [another common language]?"\n6. You support: Hebrew, English, Arabic, French, Spanish, German, Russian, Chinese, Japanese\n\nFormat: "**[Source Lang] → [Target Lang]:**\\n[Translation]"`, options: {} }, id: uid(), name: "Translator Agent", type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 1.7, position: [460, 300] },
    { parameters: { model, options: { numCtx: 8192, temperature: 0.3 }, baseUrl }, id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [460, 500] },
    { parameters: { sessionIdType: "fromInput", sessionKey: "={{ $json.sessionId ?? $execution.id }}", contextWindowLength: 30 }, id: uid(), name: "Translation Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow", typeVersion: 1.3, position: [680, 500] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `🌍 Multi-Language Translator — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { ai_languageModel: [[{ node: names[2], type: "ai_languageModel", index: 0 }]], ai_memory: [[{ node: names[3], type: "ai_memory", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Translation" }, { id: uid(), name: "Languages" }] };
}

function makeSeoWriter(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "seo-writer", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Keyword Input", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { url: "https://api.yoursite.com/existing-articles", method: "GET", sendQuery: true, queryParameters: { parameters: [{ name: "keyword", value: "={{ $json.body.keyword }}" }] }, options: {} }, id: uid(), name: "Check Existing Content", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [440, 300] },
    { parameters: { model, prompt: `Write a comprehensive SEO-optimized blog article.\n\nKeyword: {{ $('Webhook — Keyword Input').item.json.body.keyword }}\nTarget audience: {{ $('Webhook — Keyword Input').item.json.body.audience ?? 'business owners' }}\nLanguage: {{ $('Webhook — Keyword Input').item.json.body.language ?? 'Hebrew' }}\nWord count: {{ $('Webhook — Keyword Input').item.json.body.wordCount ?? 1200 }}\n\nStructure:\n# [SEO Title with keyword]\n\n**Meta Description:** (155 chars max, include keyword)\n\n## Introduction (hook the reader)\n\n## [Section 1 — use H2]\n### [Subsection if needed — H3]\n\n## [Section 2]\n\n## [Section 3]\n\n## Conclusion + CTA\n\n**Internal Link Suggestions:** (3 related topics)\n**External Link Suggestions:** (2 authoritative sources)\n**Keyword Density:** mention keyword naturally 8-12 times`, options: { numCtx: 16384, temperature: 0.7 }, baseUrl }, id: uid(), name: `SEO Article Writer — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [680, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ { article: $json.response, keyword: $('Webhook — Keyword Input').item.json.body.keyword, wordCount: $json.response.split(' ').length } }}" }, id: uid(), name: "Return Article", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [920, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `✍️ SEO Content Writer — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "SEO" }, { id: uid(), name: "Content" }] };
}

function makeCrmAutoUpdater(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "crm-update", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Email/Form", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model, prompt: `Extract structured CRM data from this input.\n\nInput: {{ JSON.stringify($json.body) }}\n\nExtract and return ONLY valid JSON:\n{\n  "firstName": "",\n  "lastName": "",\n  "email": "",\n  "phone": "",\n  "company": "",\n  "role": "",\n  "industry": "",\n  "budget": "",\n  "timeline": "",\n  "painPoints": [],\n  "leadScore": 1-10,\n  "stage": "new|qualified|proposal|negotiation|closed",\n  "nextAction": "",\n  "notes": ""\n}`, options: { numCtx: 4096, temperature: 0 }, baseUrl }, id: uid(), name: `Extract CRM Data — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { mode: "runOnceForEachItem", jsCode: `const raw = $input.item.json.response;\nconst match = raw.match(/\\{[\\s\\S]*\\}/);\nreturn [{ json: match ? JSON.parse(match[0]) : { error: 'Parse failed', raw } }];` }, id: uid(), name: "Parse CRM JSON", type: "n8n-nodes-base.code", typeVersion: 2, position: [720, 300] },
    { parameters: { url: "https://your-crm.com/api/contacts", method: "POST", sendBody: true, contentType: "json", body: "={{ $json }}", options: { response: { response: { fullResponse: false } } } }, id: uid(), name: "Update CRM via API", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [960, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ { success: true, crmId: $json.id, leadScore: $('Parse CRM JSON').item.json.leadScore } }}" }, id: uid(), name: "Confirm Update", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1200, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `🗂️ CRM Auto-Updater — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] }, [names[3]]: { main: [[{ node: names[4], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "CRM" }, { id: uid(), name: "Sales" }] };
}

function makeCompetitorMonitor(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { rule: { interval: [{ field: "hours", hoursInterval: 6 }] } }, id: uid(), name: "Every 6h Trigger", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [200, 300] },
    { parameters: { url: "https://your-competitor.com/pricing", method: "GET", options: { response: { response: { fullResponse: false } }, timeout: 10000 } }, id: uid(), name: "Scrape Competitor Site", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [440, 300] },
    { parameters: { model, prompt: `Analyze this competitor webpage content and extract:\n\n{{ $json.slice(0, 5000) }}\n\nExtract as JSON:\n{\n  "prices": [{ "plan": "", "price": "", "currency": "" }],\n  "newFeatures": [],\n  "removedFeatures": [],\n  "promotions": [],\n  "changes": "summary of what changed (or 'No significant changes detected')",\n  "alertRequired": true/false,\n  "alertReason": ""\n}`, options: { numCtx: 8192, temperature: 0 }, baseUrl }, id: uid(), name: `Analyze Changes — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [680, 300] },
    { parameters: { mode: "runOnceForEachItem", jsCode: `const raw = $input.item.json.response;\nconst match = raw.match(/\\{[\\s\\S]*\\}/);\nreturn [{ json: match ? JSON.parse(match[0]) : { alertRequired: false } }];` }, id: uid(), name: "Parse Analysis", type: "n8n-nodes-base.code", typeVersion: 2, position: [920, 300] },
    { parameters: { conditions: { boolean: [{ value1: "={{ $json.alertRequired }}", value2: true }] } }, id: uid(), name: "Alert Needed?", type: "n8n-nodes-base.if", typeVersion: 2, position: [1160, 300] },
    { parameters: { chatId: "YOUR_TELEGRAM_CHAT_ID", text: "={{ '🕵️ Competitor Alert!\\n' + $json.alertReason + '\\n\\nChanges:\\n' + $json.changes }}", additionalFields: {} }, id: uid(), name: "Send Alert", type: "n8n-nodes-base.telegram", typeVersion: 1.2, position: [1400, 200] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `🕵️ Competitor Monitor + Alert — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] }, [names[3]]: { main: [[{ node: names[4], type: "main", index: 0 }]] }, [names[4]]: { main: [[{ node: names[5], type: "main", index: 0 }], []] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Monitoring" }, { id: uid(), name: "Competitive Intel" }] };
}

function makeHrOnboarding(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "new-employee", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — New Employee", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model, prompt: `Create a personalized onboarding guide for a new employee.\n\nEmployee details: {{ JSON.stringify($json.body) }}\n\nGenerate:\n# Welcome to the Team, {{ $json.body.firstName }}! 🎉\n\n## Your First Day Checklist\n- [ ] (role-specific items)\n\n## Week 1 Goals\n(3-5 specific goals based on their role)\n\n## Key People to Meet\n(based on department)\n\n## Tools & Access Needed\n(role-specific software list)\n\n## 30-Day Success Milestones\n(measurable goals)\n\n## Resources & Learning\n(specific to their role/department)\n\nMake it warm, specific, and actionable. Language: {{ $json.body.language ?? 'Hebrew' }}`, options: { numCtx: 8192, temperature: 0.5 }, baseUrl }, id: uid(), name: `Onboarding Guide — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { fromEmail: "hr@yourcompany.com", toEmail: "={{ $('Webhook — New Employee').item.json.body.email }}", subject: "={{ '🎉 ברוך הבא ' + $('Webhook — New Employee').item.json.body.firstName + '!' }}", text: "={{ $json.response }}", options: {} }, id: uid(), name: "Email Welcome Guide", type: "n8n-nodes-base.emailSend", typeVersion: 2.1, position: [740, 200] },
    { parameters: { chatId: "HR_TEAM_CHAT_ID", text: "={{ '👋 New employee ' + $('Webhook — New Employee').item.json.body.firstName + ' (' + $('Webhook — New Employee').item.json.body.role + ') onboarding started!' }}", additionalFields: {} }, id: uid(), name: "Notify HR Team", type: "n8n-nodes-base.telegram", typeVersion: 1.2, position: [740, 420] },
    { parameters: { respondWith: "json", responseBody: "={{ { success: true, employeeName: $('Webhook — New Employee').item.json.body.firstName } }}" }, id: uid(), name: "Confirm", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [980, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `👥 HR Onboarding Automation — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }], [{ node: names[3], type: "main", index: 0 }], [{ node: names[4], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "HR" }, { id: uid(), name: "Onboarding" }] };
}

function makeInvoiceBot(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "create-invoice", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Invoice Request", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model, prompt: `Create a professional invoice based on these details:\n{{ JSON.stringify($json.body) }}\n\nGenerate a clean invoice in Markdown format:\n\n# INVOICE #{{ $json.body.invoiceNumber ?? Math.floor(Math.random()*10000) }}\n\n**From:** {{ $json.body.sellerName }} | {{ $json.body.sellerEmail }}\n**To:** {{ $json.body.clientName }} | {{ $json.body.clientEmail }}\n**Date:** {{ new Date().toLocaleDateString('he-IL') }}\n**Due Date:** {{ $json.body.dueDate ?? '30 days' }}\n\n## Services\n| Description | Qty | Unit Price | Total |\n|-------------|-----|-----------|-------|\n{{ (for each item in $json.body.items) }}\n\n**Subtotal:** {{ calculate }}\n**VAT (17%):** {{ calculate }}\n**Total:** {{ calculate }} {{ $json.body.currency ?? 'ILS' }}\n\n**Payment:** {{ $json.body.paymentMethod ?? 'Bank Transfer' }}\n\n*Thank you for your business!*`, options: { numCtx: 8192, temperature: 0.2 }, baseUrl }, id: uid(), name: `Generate Invoice — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { fromEmail: "billing@yourcompany.com", toEmail: "={{ $('Webhook — Invoice Request').item.json.body.clientEmail }}", subject: "={{ '🧾 Invoice #' + ($('Webhook — Invoice Request').item.json.body.invoiceNumber ?? 'NEW') }}", text: "={{ $json.response }}", options: {} }, id: uid(), name: "Email Invoice", type: "n8n-nodes-base.emailSend", typeVersion: 2.1, position: [740, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ { success: true, invoice: $json.response } }}" }, id: uid(), name: "Return Invoice", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [980, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `🧾 Invoice Generator Bot — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }], [{ node: names[3], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Finance" }, { id: uid(), name: "Invoicing" }] };
}

function makeWhatsAppBot(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "whatsapp-webhook", responseMode: "responseNode", options: {} }, id: uid(), name: "WhatsApp Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { conditions: { string: [{ value1: "={{ $json.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type }}", operation: "equals", value2: "text" }] } }, id: uid(), name: "Is Text Message?", type: "n8n-nodes-base.if", typeVersion: 2, position: [440, 300] },
    { parameters: { systemMessage: `You are a WhatsApp business assistant. Rules:\n- Keep replies under 300 characters (WhatsApp best practice)\n- Use simple language, no markdown\n- Detect language and reply in same language\n- Be helpful, friendly, professional\n- If business hours query: 09:00-18:00 Sun-Thu\n- For complex issues: "I'll connect you with our team 👋"`, options: {} }, id: uid(), name: "WhatsApp AI Agent", type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 1.7, position: [700, 200] },
    { parameters: { model, options: { numCtx: 4096, temperature: 0.6 }, baseUrl }, id: uid(), name: `Ollama — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [700, 400] },
    { parameters: { sessionIdType: "customKey", sessionKey: "={{ $('WhatsApp Webhook').item.json.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from }}", contextWindowLength: 15 }, id: uid(), name: "WA Memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow", typeVersion: 1.3, position: [920, 400] },
    { parameters: { url: "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages", method: "POST", sendBody: true, contentType: "json", body: "={{ { messaging_product: 'whatsapp', to: $('WhatsApp Webhook').item.json.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from, type: 'text', text: { body: $json.output } } }}", sendHeaders: true, headerParameters: { parameters: [{ name: "Authorization", value: "Bearer YOUR_WHATSAPP_TOKEN" }] }, options: {} }, id: uid(), name: "Send WhatsApp Reply", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1140, 200] },
    { parameters: { respondWith: "json", responseBody: '={{ { status: "ok" } }}' }, id: uid(), name: "Webhook ACK", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [680, 480] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `💬 WhatsApp Business Bot — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }], [{ node: names[6], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[5], type: "main", index: 0 }]], ai_languageModel: [[{ node: names[3], type: "ai_languageModel", index: 0 }]], ai_memory: [[{ node: names[4], type: "ai_memory", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "WhatsApp" }, { id: uid(), name: "Customer Service" }] };
}

function makeLeadNurture(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "lead-nurture", responseMode: "responseNode", options: {} }, id: uid(), name: "New Lead Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model, prompt: `You are a lead nurturing specialist. Analyze this lead and create a 5-email nurture sequence.\n\nLead data: {{ JSON.stringify($json.body) }}\n\nCreate:\n{\n  "leadProfile": { "score": 1-10, "stage": "awareness|consideration|decision", "mainPainPoint": "", "idealProduct": "" },\n  "sequence": [\n    { "day": 0, "subject": "", "preview": "", "body": "", "cta": "" },\n    { "day": 3, "subject": "", "preview": "", "body": "", "cta": "" },\n    { "day": 7, "subject": "", "preview": "", "body": "", "cta": "" },\n    { "day": 14, "subject": "", "preview": "", "body": "", "cta": "" },\n    { "day": 30, "subject": "", "preview": "", "body": "", "cta": "" }\n  ]\n}\n\nMake each email relevant to their industry and pain points. Language: {{ $json.body.language ?? 'Hebrew' }}`, options: { numCtx: 16384, temperature: 0.6 }, baseUrl }, id: uid(), name: `Build Nurture Sequence — ${model}`, type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { mode: "runOnceForEachItem", jsCode: `const raw = $input.item.json.response;\nconst match = raw.match(/\\{[\\s\\S]*\\}/);\nreturn [{ json: match ? JSON.parse(match[0]) : { error: 'Parse failed' } }];` }, id: uid(), name: "Parse Sequence", type: "n8n-nodes-base.code", typeVersion: 2, position: [720, 300] },
    { parameters: { url: "https://your-crm.com/api/sequences", method: "POST", sendBody: true, contentType: "json", body: "={{ $json }}", options: {} }, id: uid(), name: "Save to CRM/Automation", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [960, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ { success: true, leadScore: $('Parse Sequence').item.json.leadProfile?.score, emailsCreated: 5 } }}" }, id: uid(), name: "Return Result", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1200, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `💌 Lead Nurture Sequence Builder — ${model}`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] }, [names[2]]: { main: [[{ node: names[3], type: "main", index: 0 }]] }, [names[3]]: { main: [[{ node: names[4], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Lead Nurturing" }, { id: uid(), name: "Email" }] };
}

function makeCodeReviewer(model: string, baseUrl: string) {
  const nodes = [
    { parameters: { httpMethod: "POST", path: "code-review", responseMode: "responseNode", options: {} }, id: uid(), name: "Webhook — Code Input", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [200, 300], webhookId: uid() },
    { parameters: { model: "deepseek-coder-v2", prompt: `You are an expert code reviewer. Review this code thoroughly.\n\nLanguage: {{ $json.body.language ?? 'auto-detect' }}\nCode:\n\`\`\`\n{{ $json.body.code }}\n\`\`\`\n\nProvide:\n## Code Review Report\n\n### Overall Score: X/10\n\n### ✅ Strengths\n- (what's done well)\n\n### 🐛 Bugs Found\n- (line number + description + fix)\n\n### 🔒 Security Issues\n- (if any)\n\n### ⚡ Performance Improvements\n- (specific suggestions)\n\n### 🧹 Code Quality\n- (readability, naming, structure)\n\n### 📝 Refactored Version\n\`\`\`{{ $json.body.language ?? '' }}\n(improved code here)\n\`\`\``, options: { numCtx: 16384, temperature: 0.2 }, baseUrl }, id: uid(), name: "DeepSeek Code Reviewer", type: "@n8n/n8n-nodes-langchain.lmOllama", typeVersion: 1, position: [480, 300] },
    { parameters: { respondWith: "json", responseBody: "={{ { review: $json.response, model: 'deepseek-coder-v2' } }}" }, id: uid(), name: "Return Review", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [720, 300] },
  ];
  const names = nodes.map(n => n.name);
  return { name: `🔍 AI Code Reviewer — DeepSeek Coder`, nodes, connections: { [names[0]]: { main: [[{ node: names[1], type: "main", index: 0 }]] }, [names[1]]: { main: [[{ node: names[2], type: "main", index: 0 }]] } }, active: false, settings: { executionOrder: "v1" }, versionId: uid(), meta: { instanceId: "agenthub-export" }, tags: [{ id: uid(), name: "Code Review" }, { id: uid(), name: "Developer" }] };
}

// ─── Template definitions ─────────────────────────────────────────────────────
interface TemplateDef {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  complexity: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  features: string[];
  nodes: string[];
  ollamaRole: string;
  embedModel?: boolean;
  fixedModels?: boolean;
  generate: (model: string, embedModel: string, baseUrl: string) => object;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "basic",
    name: "Basic Ollama Chatbot",
    nameHe: "🤖 צ'אטבוט בסיסי",
    description: "הטמפלט הפשוט ביותר — Chat Trigger של n8n עם Ollama וזיכרון שיחה. מושלם להתחלה.",
    complexity: "Beginner",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
    features: ["n8n Chat Trigger מובנה", "זיכרון שיחה (Window Buffer)", "ממשק צ'אט מוכן", "ללא webhook נוסף"],
    nodes: ["Chat Trigger", "Conversational Chain", "Ollama LLM", "Window Buffer Memory"],
    ollamaRole: "LLM לשיחה",
    generate: (m, _e, b) => makeChatBotBasic(m, b),
  },
  {
    id: "support",
    name: "Support Bot + Escalation",
    nameHe: "🎧 בוט תמיכה עם העברה לנציג",
    description: "בוט תמיכה מקצועי עם זיכרון שיחה, כלי חיפוש בbase ידע, וזיהוי אוטומטי של מקרים להעברה לנציג אנושי.",
    complexity: "Intermediate",
    icon: <Bot className="w-5 h-5" />,
    color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd",
    features: ["AI Agent עם כלים", "זיהוי עצמאי מתי להעלות לנציג", "חיפוש ב-knowledge base", "Session memory לפי userId", "Webhook POST"],
    nodes: ["Webhook", "AI Agent", "Ollama LLM", "Buffer Memory", "HTTP Search Tool", "IF — Escalation", "Respond to Webhook"],
    ollamaRole: "LLM לשיחה + קבלת החלטות",
    generate: (m, _e, b) => makeSupportBot(m, b),
  },
  {
    id: "rag",
    name: "RAG Document Bot",
    nameHe: "📚 בוט מסמכים — RAG",
    description: "בוט שעונה שאלות מתוך מסמכים שלך. משתמש ב-Ollama גם לembeddings וגם לshיחה — ללא API חיצוני.",
    complexity: "Advanced",
    icon: <Database className="w-5 h-5" />,
    color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe",
    features: ["Vector Store מקומי (In-Memory)", "Ollama Embeddings — ללא API חיצוני", "חיפוש סמנטי Top-5", "ציטוט מקורות בתשובות", "n8n Chat Trigger"],
    nodes: ["Chat Trigger", "AI Agent", "Ollama LLM", "Ollama Embeddings", "In-Memory Vector Store", "Window Memory"],
    ollamaRole: "LLM לשיחה + Embeddings",
    embedModel: true,
    generate: (m, e, b) => makeRagBot(m, e, b),
  },
  {
    id: "router",
    name: "Multi-Model Smart Router",
    nameHe: "🔀 ניתוב חכם בין מודלים",
    description: "מנתב כל הודעה למודל המתאים ביותר: DeepSeek Coder לקוד, Mistral לניתוח, Llama לשיחה — אוטומטי.",
    complexity: "Advanced",
    icon: <GitBranch className="w-5 h-5" />,
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a",
    features: ["סיווג intent אוטומטי", "3 מודלים: Coder/Analyst/Creative", "Webhook POST", "מחזיר איזה מודל השתמשו"],
    nodes: ["Webhook", "Classify (Llama3.2)", "IF Code", "IF Analysis", "DeepSeek Coder", "Mistral", "Llama3", "Format", "Respond"],
    ollamaRole: "3 מודלים מקומיים שונים",
    fixedModels: true,
    generate: (_m, _e, b) => makeMultiModelRouter(b),
  },
  {
    id: "sales",
    name: "Sales Lead Qualifier Bot",
    nameHe: "💼 בוט קיוואליפיקציה של לידים",
    description: "בוט מכירות שמסווג לידים (1-10), שואל שאלות קוואליפיקציה, שומר ב-CRM ומאפשר הזמנת demo — הכל מהשיחה.",
    complexity: "Expert",
    icon: <Zap className="w-5 h-5" />,
    color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0",
    features: ["Lead Scoring אוטומטי (1-10)", "זיכרון לפי email", "שמירה ב-CRM דרך HTTP", "הזמנת demo דרך Cal.com", "חילוץ JSON מהתשובה", "IF לפי score"],
    nodes: ["Webhook", "Sales AI Agent", "Ollama LLM", "Lead Memory", "Book Demo Tool", "Extract Lead Data", "Qualified IF", "Save CRM", "Send Reply"],
    ollamaRole: "LLM לשיחה + הפקת JSON מובנה",
    generate: (m, _e, b) => makeSalesLeadBot(m, b),
  },
  {
    id: "hebrew",
    name: "Hebrew AI Assistant",
    nameHe: "🇮🇱 עוזר AI בעברית",
    description: "עוזר AI מלא בעברית עם system prompt מותאם, זיכרון שיחה וחיפוש Wikipedia. מגיב תמיד בעברית.",
    complexity: "Intermediate",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8",
    features: ["System prompt בעברית מלאה", "זיכרון שיחה (25 הודעות)", "חיפוש Wikipedia כלי", "n8n Chat Trigger מובנה", "טון מקצועי ואדיב"],
    nodes: ["Chat Trigger", "Hebrew AI Agent", "Ollama LLM", "Session Memory", "Wikipedia Tool"],
    ollamaRole: "LLM בעברית",
    generate: (m, _e, b) => makeHebChatBot(m, b),
  },
  {
    id: "telegram",
    name: "Telegram AI Bot",
    nameHe: "📱 בוט טלגרם חכם",
    description: "בוט Telegram עם AI מלא — עונה לכל הודעה, זוכר שיחות לפי chat ID, תומך עברית ואנגלית.",
    complexity: "Beginner",
    icon: <Bot className="w-5 h-5" />,
    color: "#0088cc", bg: "#e6f4ff", border: "#b3d9f7",
    features: ["Telegram Trigger מובנה", "זיכרון לפי chat ID", "Markdown support", "עברית + אנגלית"],
    nodes: ["Telegram Trigger", "AI Agent", "Ollama LLM", "Chat Memory", "Send Reply"],
    ollamaRole: "LLM לשיחה",
    generate: (m, _e, b) => makeTelegramBot(m, b),
  },
  {
    id: "email-reply",
    name: "Email Auto-Responder",
    nameHe: "📧 מענה אוטומטי לאימיילים",
    description: "מתחבר לתיבת IMAP, קורא אימיילים חדשים, כותב מענה מקצועי ושולח אוטומטית. תומך עברית.",
    complexity: "Intermediate",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#f97316", bg: "#fff7ed", border: "#fed7aa",
    features: ["IMAP Trigger", "AI כותב מענה מותאם", "SMTP שליחה", "זיהוי שפה אוטומטי", "הגבלת 150 מילים"],
    nodes: ["IMAP Trigger", "Email Drafter AI", "Ollama LLM", "Send SMTP Reply"],
    ollamaRole: "LLM לכתיבת מענה",
    generate: (m, _e, b) => makeEmailAutoReply(m, b),
  },
  {
    id: "doc-summarizer",
    name: "Document Summarizer",
    nameHe: "📄 סיכום מסמכים אוטומטי",
    description: "מקבל PDF/Word דרך webhook, מחלץ טקסט, מסכם עם Ollama ומחזיר: נושא, נקודות מפתח, tasks.",
    complexity: "Intermediate",
    icon: <Database className="w-5 h-5" />,
    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe",
    features: ["Extract PDF/Word", "סיכום מובנה 4 חלקים", "Webhook REST API", "תמיכה ב-12K tokens"],
    nodes: ["Webhook Upload", "Extract Text", "Ollama Summarize", "Return Summary JSON"],
    ollamaRole: "LLM לסיכום",
    generate: (m, _e, b) => makeDocumentSummarizer(m, b),
  },
  {
    id: "social-posts",
    name: "Social Media Post Generator",
    nameHe: "📱 גנרטור פוסטים לרשתות חברתיות",
    description: "מייצר כל יום פוסטים ל-LinkedIn, Twitter/X ו-Instagram מנושא יומי — אוטומטי לחלוטין.",
    complexity: "Advanced",
    icon: <Zap className="w-5 h-5" />,
    color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
    features: ["Cron Trigger יומי", "3 פלטפורמות במקביל", "Tone of voice מותאם", "הגבלת תווים per platform", "JSON parsing"],
    nodes: ["Daily Trigger", "Fetch Topic", "Generate Posts", "Parse JSON", "LinkedIn API", "Twitter API"],
    ollamaRole: "LLM ליצירת תוכן",
    generate: (m, _e, b) => makeSocialPostGenerator(m, b),
  },
  {
    id: "sentiment",
    name: "Sentiment Analyzer + Alert",
    nameHe: "😊 ניתוח סנטימנט + התראות",
    description: "מנתח ביקורות לקוחות, מחשב ציון ממוצע, מזהה רגשות ושולח התראה לטלגרם אם הציון נמוך.",
    complexity: "Advanced",
    icon: <Brain className="w-5 h-5" />,
    color: "#14b8a6", bg: "#f0fdfa", border: "#99f6e4",
    features: ["ניתוח batch ביקורות", "ציון 1-10 לכל ביקורת", "זיהוי רגשות", "התראה Telegram אוטומטית", "JSON structured output"],
    nodes: ["Webhook Reviews", "Sentiment AI", "Parse & Aggregate", "Negative IF", "Return JSON", "Telegram Alert"],
    ollamaRole: "LLM לניתוח סנטימנט",
    generate: (m, _e, b) => makeSentimentAnalyzer(m, b),
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes Generator",
    nameHe: "📝 גנרטור פרוטוקולי ישיבות",
    description: "מקבל transcript של ישיבה, מייצר פרוטוקול מובנה עם decisions, action items ו-next steps — שולח במייל.",
    complexity: "Intermediate",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd",
    features: ["Webhook transcript", "פרוטוקול Markdown", "Action Items + Owner + Deadline", "שליחה במייל אוטומטית", "תמיכה עברית"],
    nodes: ["Webhook Transcript", "Generate Notes", "Email Notes", "Return JSON"],
    ollamaRole: "LLM לעיבוד שפה",
    generate: (m, _e, b) => makeMeetingNotesBot(m, b),
  },
  {
    id: "translator",
    name: "Multi-Language Translator",
    nameHe: "🌍 מתרגם רב-לשוני",
    description: "צ'אטבוט תרגום מקצועי — מזהה שפה, מתרגם ל-9 שפות, שומר context ומציע תרגומים נוספים.",
    complexity: "Beginner",
    icon: <GitBranch className="w-5 h-5" />,
    color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0",
    features: ["9 שפות נתמכות", "זיהוי שפה אוטומטי", "שמירת context", "מקצועי ומדויק", "Chat Trigger"],
    nodes: ["Chat Trigger", "Translator Agent", "Ollama LLM", "Translation Memory"],
    ollamaRole: "LLM לתרגום",
    generate: (m, _e, b) => makeTranslatorBot(m, b),
  },
  {
    id: "seo-writer",
    name: "SEO Content Writer",
    nameHe: "✍️ כותב תוכן SEO",
    description: "מקבל keyword + נושא ומייצר מאמר SEO מלא: כותרת, מטא תיאור, H2/H3, CTA, והמלצות לינקים.",
    complexity: "Advanced",
    icon: <Zap className="w-5 h-5" />,
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a",
    features: ["1,200+ מילים", "מבנה SEO מלא", "Meta description", "הצעות לינקים", "עברית/אנגלית", "Webhook REST"],
    nodes: ["Webhook Keyword", "Check Existing", "SEO Article AI", "Return Article"],
    ollamaRole: "LLM ליצירת תוכן ארוך",
    generate: (m, _e, b) => makeSeoWriter(m, b),
  },
  {
    id: "crm-updater",
    name: "CRM Auto-Updater",
    nameHe: "🗂️ עדכון CRM אוטומטי",
    description: "מחלץ פרטי ליד מטקסט חופשי/אימייל, ממיר ל-JSON מובנה ושולח ל-CRM דרך API — אוטומטי.",
    complexity: "Advanced",
    icon: <Database className="w-5 h-5" />,
    color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe",
    features: ["חילוץ 12 שדות CRM", "Lead Scoring אוטומטי", "Stage classification", "HTTP CRM API", "JSON parsing"],
    nodes: ["Webhook Input", "Extract CRM Data", "Parse JSON", "Update CRM API", "Confirm"],
    ollamaRole: "LLM לחילוץ מידע מובנה",
    generate: (m, _e, b) => makeCrmAutoUpdater(m, b),
  },
  {
    id: "competitor-monitor",
    name: "Competitor Monitor",
    nameHe: "🕵️ מעקב אחרי מתחרים",
    description: "כל 6 שעות — scrape אתר מתחרה, מנתח שינויים במחירים/פיצ'רים ושולח התראה Telegram אם נדרש.",
    complexity: "Expert",
    icon: <RefreshCw className="w-5 h-5" />,
    color: "#ef4444", bg: "#fef2f2", border: "#fecaca",
    features: ["Cron כל 6 שעות", "Web scraping", "ניתוח שינויים", "IF alert logic", "Telegram notification"],
    nodes: ["Schedule Trigger", "Scrape Site", "Analyze Changes", "Parse", "IF Alert", "Telegram"],
    ollamaRole: "LLM לניתוח שינויים",
    generate: (m, _e, b) => makeCompetitorMonitor(m, b),
  },
  {
    id: "hr-onboarding",
    name: "HR Onboarding Automation",
    nameHe: "👥 אוטומציית קליטת עובדים",
    description: "מקבל פרטי עובד חדש, יוצר מדריך קליטה מותאם אישית לתפקיד, שולח במייל ומודיע לצוות HR.",
    complexity: "Advanced",
    icon: <Bot className="w-5 h-5" />,
    color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0",
    features: ["מדריך קליטה אישי", "Checklist לפי תפקיד", "30-Day milestones", "אימייל אוטומטי לעובד", "Telegram ל-HR"],
    nodes: ["Webhook New Employee", "Onboarding Guide AI", "Email Welcome", "Notify HR", "Confirm"],
    ollamaRole: "LLM לכתיבת מדריך",
    generate: (m, _e, b) => makeHrOnboarding(m, b),
  },
  {
    id: "invoice-bot",
    name: "Invoice Generator Bot",
    nameHe: "🧾 גנרטור חשבוניות",
    description: "מקבל פרטי עסקה, מייצר חשבונית מקצועית עם מע\"מ, שולח לאימייל הלקוח ומחזיר JSON.",
    complexity: "Intermediate",
    icon: <Zap className="w-5 h-5" />,
    color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd",
    features: ["חשבונית Markdown", "חישוב מע\"מ 17%", "שליחה אוטומטית במייל", "JSON response", "מספר חשבונית אוטומטי"],
    nodes: ["Webhook Invoice", "Generate Invoice AI", "Email to Client", "Return JSON"],
    ollamaRole: "LLM לכתיבת חשבונית",
    generate: (m, _e, b) => makeInvoiceBot(m, b),
  },
  {
    id: "whatsapp-bot",
    name: "WhatsApp Business Bot",
    nameHe: "💬 בוט WhatsApp עסקי",
    description: "בוט WhatsApp Business API מלא עם AI — עונה לטקסט, זיכרון לפי מספר טלפון, זיהוי שפה.",
    complexity: "Expert",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#25d366", bg: "#f0fdf4", border: "#bbf7d0",
    features: ["WhatsApp Business API", "Text message handling", "זיכרון לפי phone number", "300-char replies", "Session memory"],
    nodes: ["WhatsApp Webhook", "Is Text IF", "WA AI Agent", "Ollama LLM", "WA Memory", "Send Reply", "ACK"],
    ollamaRole: "LLM לשיחה",
    generate: (m, _e, b) => makeWhatsAppBot(m, b),
  },
  {
    id: "lead-nurture",
    name: "Lead Nurture Sequence Builder",
    nameHe: "💌 בונה רצף ליד נירצ'ר",
    description: "מנתח ליד ובונה רצף של 5 אימיילים מותאמים אישית לפי תחום, תפקיד ו-pain points — שמור ב-CRM.",
    complexity: "Expert",
    icon: <GitBranch className="w-5 h-5" />,
    color: "#f43f5e", bg: "#fff1f2", border: "#fecdd3",
    features: ["ניתוח lead profile", "5 אימיילים + timing", "Lead scoring", "שמירה ב-CRM", "עברית/אנגלית"],
    nodes: ["Webhook Lead", "Build Sequence AI", "Parse JSON", "Save to CRM", "Return Result"],
    ollamaRole: "LLM לבניית רצף",
    generate: (m, _e, b) => makeLeadNurture(m, b),
  },
  {
    id: "code-reviewer",
    name: "AI Code Reviewer",
    nameHe: "🔍 Code Reviewer עם AI",
    description: "מקבל קוד דרך API, מנתח bugs/security/performance עם DeepSeek Coder ומחזיר גרסה משופרת.",
    complexity: "Expert",
    icon: <Brain className="w-5 h-5" />,
    color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
    features: ["DeepSeek Coder מיוחד לקוד", "ציון 1-10", "Bugs + Security + Performance", "גרסה משופרת", "כל שפת תכנות"],
    nodes: ["Webhook Code", "DeepSeek Code Review", "Return Report"],
    ollamaRole: "DeepSeek Coder V2 בלבד",
    fixedModels: true,
    generate: (_m, _e, b) => makeCodeReviewer("deepseek-coder-v2", b),
  },
];

const COMPLEXITY_META = {
  Beginner:     { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
  Intermediate: { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  Advanced:     { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  Expert:       { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
};

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ tmpl, model, embedModel, baseUrl }: { tmpl: TemplateDef; model: string; embedModel: string; baseUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const cx = COMPLEXITY_META[tmpl.complexity];

  const generate = () => tmpl.generate(model, embedModel, baseUrl);

  const handleDownload = () => {
    const json = JSON.stringify(generate(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fname = tmpl.id + "_" + model.replace(/[^a-z0-9]/gi, "_") + "_n8n.json";
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `📥 Downloaded: ${fname}`, description: "Import into n8n: Workflows → Import from file" });
  };

  const handleCopy = async () => {
    const json = JSON.stringify(generate(), null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "📋 Copied to clipboard", description: "Paste into n8n Import dialog" });
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Top strip */}
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${tmpl.color}, ${tmpl.color}88)` }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tmpl.bg, color: tmpl.color }}>
            {tmpl.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[14px] text-foreground">{tmpl.nameHe}</h3>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{ color: cx.color, background: cx.bg, borderColor: cx.border }}>
                {tmpl.complexity}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{tmpl.name}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-[12.5px] text-muted-foreground leading-relaxed" dir="rtl">{tmpl.description}</p>

        {/* Features */}
        <div className="flex flex-wrap gap-1.5">
          {tmpl.features.map(f => (
            <span key={f} className="text-[9.5px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full" style={{ background: tmpl.color }} />
              {f}
            </span>
          ))}
        </div>

        {/* Node flow preview */}
        <button onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Layers className="w-3 h-3" />
          {tmpl.nodes.length} nodes
          {expanded ? <ChevronRight className="w-3 h-3 rotate-90" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 py-2">
                {tmpl.nodes.map((n, i) => (
                  <span key={n} className="flex items-center gap-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ borderColor: `${tmpl.color}44`, background: tmpl.bg, color: tmpl.color }}>
                      {n}
                    </span>
                    {i < tmpl.nodes.length - 1 && <span className="text-muted-foreground text-[10px]">→</span>}
                  </span>
                ))}
              </div>
              <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10.5px] text-muted-foreground">
                <span className="font-semibold text-foreground">Ollama role: </span>{tmpl.ollamaRole}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ollama model note */}
        {tmpl.fixedModels && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[10.5px] text-amber-700">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>מכיל 3 מודלים קבועים: llama3.2, deepseek-coder-v2, mistral. ודא שכולם מותקנים ב-Ollama שלך.</span>
          </div>
        )}
        {tmpl.embedModel && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[10.5px] text-purple-700">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>דרוש מודל Embeddings נפרד (מוגדר בסינון הגלובלי). מומלץ: nomic-embed-text</span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-border p-4 flex gap-2">
        <Button onClick={handleDownload} size="sm" className="flex-1 h-8 rounded-lg text-xs gap-1.5"
          style={{ background: tmpl.color }}>
          <Download className="w-3.5 h-3.5" />
          הורד JSON
        </Button>
        <Button onClick={handleCopy} variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 px-3">
          {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function N8nTemplatesPage() {
  const [model, setModel] = useState("llama3.2");
  const [embedModel, setEmbedModel] = useState("nomic-embed-text");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [filter, setFilter] = useState("All");
  const { toast } = useToast();

  const filtered = filter === "All" ? TEMPLATES : TEMPLATES.filter(t => t.complexity === filter);

  const handleDownloadAll = () => {
    filtered.forEach((tmpl, i) => {
      setTimeout(() => {
        const json = JSON.stringify(tmpl.generate(model, embedModel, baseUrl), null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tmpl.id}_${model.replace(/[^a-z0-9]/gi, "_")}_n8n.json`;
        a.click();
        URL.revokeObjectURL(url);
      }, i * 300);
    });
    toast({ title: `📦 מוריד ${filtered.length} טמפלטים`, description: "בדוק את תיקיית ההורדות" });
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl p-8"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c4a6e 100%)" }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 10% 30%, #6366f1 0%, transparent 40%), radial-gradient(circle at 90% 70%, #0ea5e9 0%, transparent 40%)"
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-[11px] font-semibold uppercase tracking-widest">100% Local — No API Keys</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            n8n × Ollama — Chatbot Templates
          </h1>
          <p className="text-slate-300 text-[13px] max-w-2xl leading-relaxed">
            {TEMPLATES.length} טמפלטים מוכנים לייבוא ישיר ל-n8n. כולם רצים עם המודלים המקומיים שלך דרך Ollama —
            ללא API key, ללא עלויות, ללא שליחת נתונים החוצה.
          </p>
          <div className="flex gap-6 mt-5">
            {[
              { v: TEMPLATES.length, l: "טמפלטים" },
              { v: "100%", l: "Local" },
              { v: "0₪", l: "עלות API" },
              { v: OLLAMA_MODELS.filter(m => m.best !== "rag").length, l: "מודלים נתמכים" },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-xl font-bold text-white">{s.v}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global config */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-[13px] text-foreground">הגדרות גלובליות — יחולו על כל הטמפלטים</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Brain className="w-3 h-3" />מודל שיחה (LLM)
            </label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OLLAMA_MODELS.filter(m => m.best !== "rag").map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <span className="text-[9px] text-muted-foreground ml-auto">{m.size}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Database className="w-3 h-3" />מודל Embeddings (RAG)
            </label>
            <Select value={embedModel} onValueChange={setEmbedModel}>
              <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OLLAMA_MODELS.filter(m => m.best === "rag" || m.value.includes("embed")).map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
                <SelectItem value="mxbai-embed-large">mxbai-embed-large — איכות גבוהה</SelectItem>
                <SelectItem value="all-minilm">all-minilm — קל מאוד</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3 h-3" />Ollama Base URL
            </label>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        {/* Ollama install hint */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700">
          <div className="text-[10.5px] font-mono text-slate-300 leading-relaxed">
            <span className="text-slate-500"># התקנת מודל ב-Ollama</span><br />
            <span className="text-emerald-400">$ ollama pull {model}</span><br />
            {embedModel !== model && <><span className="text-emerald-400">$ ollama pull {embedModel}</span><br /></>}
            <span className="text-slate-500"># הפעלת Ollama</span><br />
            <span className="text-emerald-400">$ ollama serve</span>
          </div>
          <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 transition-colors">
            Download Ollama <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Filter + Download All */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border">
          {["All", "Beginner", "Intermediate", "Advanced", "Expert"].map(f => {
            const cx = f !== "All" ? COMPLEXITY_META[f as keyof typeof COMPLEXITY_META] : null;
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${filter === f ? "bg-white shadow-sm text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
                style={filter === f && cx ? { color: cx.color } : undefined}>
                {f}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{filtered.length} טמפלטים</span>
          <Button onClick={handleDownloadAll} variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1.5">
            <RefreshCw className="w-3 h-3" />
            הורד הכל ({filtered.length})
          </Button>
        </div>
      </div>

      {/* Template grid */}
      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <AnimatePresence>
          {filtered.map(tmpl => (
            <TemplateCard key={tmpl.id} tmpl={tmpl} model={model} embedModel={embedModel} baseUrl={baseUrl} />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Import guide */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="font-bold text-[13px] text-foreground mb-4 flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-primary" />
          איך מייבאים ל-n8n?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "1", title: "הורד JSON", desc: "לחץ 'הורד JSON' על הטמפלט הרצוי" },
            { step: "2", title: "פתח n8n", desc: "Workflows → + New Workflow → Import from file" },
            { step: "3", title: "הגדר Ollama", desc: "ב-node של Ollama, ודא שה-Base URL נכון (localhost:11434)" },
            { step: "4", title: "הפעל", desc: "Save → Activate — הbot מוכן לקבל הודעות" },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[12px] font-bold shrink-0">{s.step}</div>
              <div>
                <div className="font-semibold text-[12.5px] text-foreground">{s.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5" dir="rtl">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
