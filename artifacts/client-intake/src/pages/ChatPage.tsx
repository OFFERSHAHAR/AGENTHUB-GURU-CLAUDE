import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface ConvMeta {
  agentId: number;
  clientId: number;
  title: string;
}

function parseMessages(raw: string): ChatMessage[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function formatContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}

export default function ChatPage({ convId, agentName }: { convId: string; agentName?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<ConvMeta | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!convId) return;
    fetch(`/api/conversations/${convId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError("השיחה לא נמצאה."); setLoading(false); return; }
        setMeta({ agentId: data.agentId, clientId: data.clientId, title: data.title });
        setMessages(parseMessages(typeof data.messages === "string" ? data.messages : JSON.stringify(data.messages)));
        setLoading(false);
      })
      .catch(() => { setError("שגיאה בטעינת השיחה."); setLoading(false); });
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.assistantMessage) {
        setMessages((prev) => [...prev, data.assistantMessage]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "מצטערים, אירעה שגיאה. אנא נסה שוב.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!convId || convId === "__loading__") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f11" }}>
        <Loader2 style={{ width: 32, height: 32, color: "#6366f1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f11" }}>
        <Loader2 style={{ width: 32, height: 32, color: "#6366f1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f11" }}>
        <div style={{ color: "#ef4444", textAlign: "center", fontFamily: "system-ui" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16 }}>{error}</div>
        </div>
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => {
    if (m.role !== "assistant") return true;
    const c = m.content || "";
    if (c.startsWith("📩 **ליד נכנס ממייל**")) return false;
    if (c.startsWith("📩 מייל חדש נוסף")) return false;
    return true;
  });

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f0f11 0%, #14141a 100%)",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Bot style={{ width: 20, height: 20, color: "white" }} />
        </div>
        <div>
          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{agentName || meta?.title || "יועץ AI"}</div>
          <div style={{ color: "#10b981", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            מחובר ופעיל
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleMessages.length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", marginTop: 40, fontSize: 14 }}>
            השיחה עדיין ריקה — שלח הודעה כדי להתחיל
          </div>
        )}

        <AnimatePresence initial={false}>
          {visibleMessages.map((msg, i) => {
            const isAssistant = msg.role === "assistant";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: "flex",
                  justifyContent: isAssistant ? "flex-start" : "flex-end",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                {isAssistant && (
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginBottom: 2,
                  }}>
                    <Bot style={{ width: 14, height: 14, color: "white" }} />
                  </div>
                )}
                <div style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: isAssistant ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  background: isAssistant
                    ? "rgba(255,255,255,0.06)"
                    : "linear-gradient(135deg, #6366f1, #7c3aed)",
                  color: "#f1f5f9",
                  fontSize: 14,
                  lineHeight: 1.6,
                  border: isAssistant ? "1px solid rgba(255,255,255,0.08)" : "none",
                  wordBreak: "break-word",
                }}>
                  <span dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Bot style={{ width: 14, height: 14, color: "white" }} />
            </div>
            <div style={{
              padding: "12px 16px",
              borderRadius: "4px 18px 18px 18px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", gap: 4, alignItems: "center",
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#6366f1",
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        bottom: 0,
      }}>
        <div style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "8px 8px 8px 14px",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה..."
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f1f5f9",
              fontSize: 14,
              lineHeight: 1.5,
              resize: "none",
              fontFamily: "inherit",
              paddingTop: 4,
              maxHeight: 120,
              overflowY: "auto",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              border: "none",
              background: sending || !input.trim()
                ? "rgba(99,102,241,0.3)"
                : "linear-gradient(135deg, #6366f1, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: sending || !input.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {sending
              ? <Loader2 style={{ width: 16, height: 16, color: "white", animation: "spin 1s linear infinite" }} />
              : <Send style={{ width: 16, height: 16, color: "white" }} />
            }
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#374151", marginTop: 8 }}>
          מופעל על ידי AI · השיחה מוקלטת לשיפור השירות
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
