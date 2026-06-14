import { useParams, Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetClient,
  useGetAgent,
  getOrCreateConversation,
  sendMessage,
  clearConversation,
  getGetClientQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Trash2, Bot, User, Sparkles, Copy, RotateCcw, Loader2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "text-emerald-600",
  groq: "text-violet-600",
  ollama: "text-sky-600",
  template: "text-amber-600",
  error: "text-red-500",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "GPT-4o",
  groq: "Groq",
  ollama: "Ollama",
  template: "Template",
  error: "שגיאה",
};

function timeStr(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MessageBubble({ msg, index }: { msg: any; index: number }) {
  const { toast } = useToast();
  const isUser = msg.role === "user";
  const isAssistant = msg.role === "assistant";

  const copyText = () => {
    navigator.clipboard.writeText(msg.content).then(() => toast({ title: "הועתק ✓" }));
  };

  if (!isUser && !isAssistant) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} group`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? "bg-primary text-white" : "bg-violet-100 text-violet-700"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
          isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-white border border-border text-foreground rounded-tl-sm shadow-sm"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div
              className="prose prose-sm max-w-none
                prose-headings:font-bold prose-headings:text-foreground prose-headings:mt-3 prose-headings:mb-1
                prose-h1:text-base prose-h2:text-sm prose-h3:text-[13px]
                prose-p:text-[13px] prose-p:leading-relaxed prose-p:my-1
                prose-li:text-[13px] prose-li:my-0.5
                prose-strong:text-foreground prose-strong:font-semibold
                prose-code:text-[11px] prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-table:text-[12px]
                prose-th:bg-muted prose-th:font-semibold prose-th:px-2 prose-th:py-1 prose-th:border prose-th:border-border
                prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-border
                prose-blockquote:border-l-violet-300 prose-blockquote:text-violet-800 prose-blockquote:bg-violet-50/40 prose-blockquote:py-1"
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className={`flex items-center gap-2 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-[10px] text-muted-foreground">{timeStr(msg.createdAt)}</span>
          {isAssistant && msg.provider && (
            <span className={`text-[10px] font-medium ${PROVIDER_COLORS[msg.provider] || "text-muted-foreground"}`}>
              {PROVIDER_LABELS[msg.provider] || msg.provider}
              {msg.tokens ? ` · ${msg.tokens} tokens` : ""}
            </span>
          )}
          <button
            onClick={copyText}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatPage() {
  const { clientId: clientIdStr, agentId: agentIdStr } = useParams<{ clientId: string; agentId: string }>();
  const clientId = parseInt(clientIdStr, 10);
  const agentId = parseInt(agentIdStr, 10);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: client } = useGetClient(clientId, { query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) } });
  const { data: agent } = useGetAgent(agentId, { query: { enabled: !!agentId } });

  const convKey = ["conversation", clientId, agentId];
  const { data: conversation, isLoading: convLoading } = useQuery({
    queryKey: convKey,
    queryFn: () => getOrCreateConversation(clientId, agentId),
    enabled: !!clientId && !!agentId,
  });

  const messages: any[] = conversation?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isPending || !conversation) return;
    setInput("");
    setIsPending(true);
    try {
      await sendMessage(conversation.id, { content: text });
      qc.invalidateQueries({ queryKey: convKey });
    } catch {
      toast({ title: "שגיאה בשליחת הודעה", variant: "destructive" });
    } finally {
      setIsPending(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = async () => {
    if (!conversation) return;
    if (!confirm("למחוק את כל הזיכרון של הסוכן עם הלקוח הזה?")) return;
    await clearConversation(conversation.id);
    qc.invalidateQueries({ queryKey: convKey });
    toast({ title: "הזיכרון נוקה ✓" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const agentName = agent?.name ?? "סוכן";
  const clientName = client?.name ?? "לקוח";
  const initials = clientName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href={`/clients/${clientId}`}>
          <motion.button
            whileTap={{ scale: 0.94 }}
            className="w-8 h-8 rounded-lg border border-border bg-white card-shadow flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        </Link>

        <div className="flex-1 bg-white rounded-xl border border-border card-shadow px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 text-lg shrink-0">
            {agent?.iconEmoji || "🤖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[14px] text-foreground">{agentName}</span>
              <span className="text-muted-foreground/40 text-sm">×</span>
              <span className="text-[13px] text-muted-foreground font-medium">{clientName}</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Sparkles className="w-3 h-3 text-violet-500" />
              זיכרון מתמשך · {conversation?.messageCount ?? 0} הודעות
            </div>
          </div>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            נקה זיכרון
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-muted/30 rounded-xl border border-border p-4 space-y-4 min-h-0">
        {convLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}>
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <Skeleton className={`h-16 rounded-2xl ${i % 2 === 0 ? "w-48" : "w-64"}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl">
              {agent?.iconEmoji || "🤖"}
            </div>
            <div className="font-semibold text-foreground">{agentName} מוכן</div>
            <div className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">
              שוחח עם הסוכן. הוא זוכר את כל השיחות הקודמות עם {clientName} ויבנה על ידע קודם.
            </div>
            {agent?.systemPrompt && (
              <div className="mt-3 max-w-sm bg-violet-50 border border-violet-100 rounded-xl p-3 text-left">
                <div className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1.5">System Prompt</div>
                <p className="text-[11px] text-violet-700 line-clamp-4 leading-relaxed font-mono">
                  {agent.systemPrompt.slice(0, 200)}...
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg: any, i: number) => (
              <MessageBubble key={i} msg={msg} index={i} />
            ))}
            <AnimatePresence>
              {isPending && <TypingIndicator key="typing" />}
            </AnimatePresence>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-3 shrink-0">
        <div className="bg-white rounded-xl border border-border card-shadow p-3 flex gap-3 items-end">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0 mb-0.5">
            {initials}
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`כתוב ל-${agentName}… (Enter לשליחה, Shift+Enter לשורה חדשה)`}
            className="flex-1 resize-none text-[13.5px] leading-relaxed focus:outline-none min-h-[40px] max-h-32 bg-transparent placeholder:text-muted-foreground/60"
            rows={1}
            disabled={isPending}
            autoFocus
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:bg-primary/90"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </motion.button>
        </div>
        <div className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
          זיכרון מלא נשלח בכל בקשה · מודל: {agent?.model ?? "gpt-4o"}
        </div>
      </div>
    </div>
  );
}
