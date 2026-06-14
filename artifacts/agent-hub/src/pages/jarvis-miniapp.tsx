import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Telegram WebApp SDK types ─────────────────────────────────────────────────
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        close: () => void;
        expand: () => void;
        colorScheme: "light" | "dark";
        themeParams: Record<string, string>;
        initDataUnsafe?: { user?: { first_name?: string; username?: string } };
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
      };
    };
  }
}

const tg = () => window.Telegram?.WebApp;

// ─── STARK palette ─────────────────────────────────────────────────────────────
const CYAN = "#00e5ff";
const BLUE = "#0d47a1";
const GOLD = "#ffd600";
const DARK = "#010b14";
const RED = "#ff1744";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Trigger status presentation ───────────────────────────────────────────────
// Each agent in the multi-trigger pick-list shows its live trigger status so ops
// can avoid firing an agent that is already running (or stuck on a fired event).
const GREEN = "#00ff88";
function statusMeta(status?: string): { label: string; color: string; busy: boolean } {
  switch (status) {
    case "running":
      return { label: "רץ כעת", color: GOLD, busy: true };
    case "triggered":
      return { label: "הופעל", color: GOLD, busy: true };
    case "idle":
      return { label: "פנוי", color: GREEN, busy: false };
    default:
      return { label: "—", color: `${CYAN}88`, busy: false };
  }
}

// ─── Arc reactor mini ──────────────────────────────────────────────────────────
function ArcReactor({ thinking }: { thinking: boolean }) {
  return (
    <div style={{ width: 40, height: 40, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: "absolute", inset: 0 }}>
        <motion.circle cx="20" cy="20" r="17" fill="none" stroke={CYAN} strokeWidth="1" strokeDasharray="5 3"
          animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50% 50%" }} />
        <motion.circle cx="20" cy="20" r="12" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="3 4"
          animate={{ rotate: -360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50% 50%" }} />
      </svg>
      <motion.div
        animate={thinking ? { scale: [1, 1.25, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 0.9 }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{
          width: 12, height: 12, borderRadius: "50%",
          background: `radial-gradient(circle, #fff 10%, ${CYAN} 55%, ${BLUE} 100%)`,
          boxShadow: `0 0 12px ${CYAN}, 0 0 24px ${BLUE}`,
        }}
      />
    </div>
  );
}

// ─── Message type ──────────────────────────────────────────────────────────────
interface ChatMsg {
  id: string;
  role: "user" | "jarvis";
  text: string;
  ts: number;
}

const POLL_INTERVAL_MS = 700;
const POLL_TIMEOUT_MS = 30_000;

export default function JarvisMiniApp() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "boot", role: "jarvis", text: "ג׳ארביס מקוון, מר סטארק. אני מחובר לדסקטופ ומוכן לפקודות.", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState<boolean | null>(null);
  const [clock, setClock] = useState("");
  // When the desktop asks for confirmation before a write action (trigger run),
  // we render a one-tap confirm/cancel bar instead of a plain reply.
  const [pendingConfirm, setPendingConfirm] = useState<{ label: string } | null>(null);
  // When the matched client has more than one configured trigger, the desktop
  // sends a pick-list so ops can choose which agent to run before confirming.
  // Each option carries the agent's live trigger status so ops can see which
  // candidate is already busy before firing it.
  const [pendingChoices, setPendingChoices] = useState<{ label: string; status?: string }[] | null>(null);
  // Busy (running / triggered) options are guarded behind an extra explicit tap:
  // the first tap "arms" the option, the second actually selects it. This blocks
  // accidental double-runs while still letting ops force a stuck agent if needed.
  const [armedBusyIdx, setArmedBusyIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Guards against overlapping live status-refresh polls for the open pick-list.
  const refreshInFlightRef = useRef(false);

  // Telegram init
  useEffect(() => {
    const app = tg();
    if (app) {
      app.ready();
      app.expand();
    }
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Desktop connection status poll
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`${BASE}/api/jarvis/status`);
        const d = await r.json();
        if (!cancelled) setDesktopConnected(Boolean(d.desktopConnected));
      } catch {
        if (!cancelled) setDesktopConnected(false);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const pollResult = useCallback(
    async (commandId: string): Promise<{ result: string; confirm: { label: string } | null; choices: { label: string; status?: string }[] | null }> => {
      const start = Date.now();
      while (Date.now() - start < POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const r = await fetch(`${BASE}/api/jarvis/result/${commandId}`);
          if (r.status === 404) return { result: "הפקודה פגה. נסה שוב, מר סטארק.", confirm: null, choices: null };
          const d = await r.json();
          if (d.status === "done") return { result: d.result || "בוצע.", confirm: d.confirm ?? null, choices: d.choices ?? null };
        } catch {
          // keep polling
        }
      }
      return { result: "אין תגובה מהדסקטופ בזמן. ודא ש-AgentHub פתוח במחשב.", confirm: null, choices: null };
    },
    [],
  );

  // ── Live status refresh for the open pick-list ──
  // While the pick-list is visible, periodically ask the desktop (via the
  // bridge) for each candidate's current status and merge the fresh values
  // into the existing options in place. Runs silently — no chat messages, no
  // thinking spinner — so it never disturbs the rest of the session. Returns
  // the same array reference when nothing changed so the render stays stable.
  const refreshChoicesStatus = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const r = await fetch(`${BASE}/api/jarvis/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "רענון סטטוס", action: "refresh_choices", initData: (tg() as { initData?: string } | undefined)?.initData ?? "" }),
      });
      const d = await r.json();
      if (!d.ok || !d.commandId) return;
      // Quietly poll for the desktop's reply (short, best-effort window).
      const start = Date.now();
      while (Date.now() - start < 8000) {
        await new Promise((res) => setTimeout(res, 600));
        let res2: Response;
        try {
          res2 = await fetch(`${BASE}/api/jarvis/result/${d.commandId}`);
        } catch {
          continue;
        }
        if (res2.status === 404) return;
        const rd = await res2.json();
        if (rd.status !== "done") continue;
        const fresh = Array.isArray(rd.choices) ? (rd.choices as { label: string; status?: string }[]) : null;
        // null choices → the pick-list is no longer pending on the desktop;
        // leave the current options untouched (selection will report if stale).
        if (fresh) {
          setPendingChoices((prev) => {
            if (!prev) return prev;
            let changed = false;
            const next = prev.map((opt, i) => {
              const f = fresh[i];
              if (f && f.label === opt.label && f.status !== opt.status) {
                changed = true;
                return { ...opt, status: f.status };
              }
              return opt;
            });
            return changed ? next : prev;
          });
        }
        return;
      }
    } catch {
      // best-effort; the next tick retries
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  // Drive the refresh loop only while the pick-list is open. The cleanup tears
  // it down the moment the list closes or a choice is made (pendingChoices →
  // null), so polling never outlives the visible list.
  useEffect(() => {
    if (!pendingChoices || pendingChoices.length === 0) return;
    let cancelled = false;
    const id = setInterval(() => {
      if (!cancelled && !thinking) void refreshChoicesStatus();
    }, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pendingChoices, thinking, refreshChoicesStatus]);

  // Submit a command to the bridge and append the result. `action` carries
  // write-action verbs (confirm/cancel) for a pending trigger run.
  const sendCommand = useCallback(
    async (text: string, action?: "confirm_trigger" | "cancel_trigger" | "select_trigger", choiceIndex?: number) => {
      setThinking(true);
      try {
        const r = await fetch(`${BASE}/api/jarvis/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, action, choiceIndex, initData: (tg() as { initData?: string } | undefined)?.initData ?? "" }),
        });
        const d = await r.json();
        if (!d.ok || !d.commandId) {
          setMessages((prev) => [...prev, { id: `j${Date.now()}`, role: "jarvis", text: "שגיאה בשליחת הפקודה.", ts: Date.now() }]);
          return;
        }
        const { result, confirm, choices } = await pollResult(d.commandId);
        setMessages((prev) => [...prev, { id: `j${Date.now()}`, role: "jarvis", text: result, ts: Date.now() }]);
        setPendingConfirm(confirm);
        setPendingChoices(choices);
      } catch {
        setMessages((prev) => [...prev, { id: `j${Date.now()}`, role: "jarvis", text: "שגיאת רשת. בדוק חיבור.", ts: Date.now() }]);
      } finally {
        setThinking(false);
      }
    },
    [pollResult],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setPendingConfirm(null);
    setPendingChoices(null);
    setArmedBusyIdx(null);
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", text, ts: Date.now() }]);
    await sendCommand(text);
  }, [input, thinking, sendCommand]);

  const confirmTrigger = useCallback(async () => {
    if (!pendingConfirm || thinking) return;
    const label = pendingConfirm.label;
    setPendingConfirm(null);
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", text: `✓ אישור: ${label}`, ts: Date.now() }]);
    await sendCommand("אישור הרצת trigger", "confirm_trigger");
  }, [pendingConfirm, thinking, sendCommand]);

  const cancelTrigger = useCallback(async () => {
    if (!pendingConfirm || thinking) return;
    setPendingConfirm(null);
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", text: "✕ ביטול", ts: Date.now() }]);
    await sendCommand("ביטול הרצת trigger", "cancel_trigger");
  }, [pendingConfirm, thinking, sendCommand]);

  // Pick one agent from the multi-trigger list, then flow into the confirm step.
  const selectTrigger = useCallback(async (index: number, label: string) => {
    if (thinking) return;
    setPendingChoices(null);
    setArmedBusyIdx(null);
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", text: `▸ ${label}`, ts: Date.now() }]);
    await sendCommand("בחירת trigger", "select_trigger", index);
  }, [thinking, sendCommand]);

  // Gate selection of busy agents behind an extra explicit tap. Idle agents are
  // selected immediately; busy ones must be armed (first tap) then confirmed
  // (second tap) so ops can't accidentally fire an already-running agent.
  const onPick = useCallback((index: number, label: string, busy: boolean) => {
    if (thinking) return;
    if (busy && armedBusyIdx !== index) {
      setArmedBusyIdx(index);
      return;
    }
    selectTrigger(index, label);
  }, [thinking, armedBusyIdx, selectTrigger]);

  const QUICK = ["מה המצב", "כמה לקוחות", "כמה סוכנים", "הצג לקוחות", "בדוק לוגים", "מי הלקוח הכי פעיל"];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: `radial-gradient(circle at 50% 0%, #06243a 0%, ${DARK} 70%)`,
        color: "#a0f0ff",
        fontFamily: "'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `1px solid ${CYAN}33`,
          background: `linear-gradient(180deg, ${DARK}, transparent)`,
        }}
      >
        <ArcReactor thinking={thinking} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: CYAN, fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>JARVIS v3.0</span>
            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ color: GOLD, fontSize: 9, letterSpacing: 1 }}>● ACTIVE</motion.span>
          </div>
          <div style={{ color: `${CYAN}88`, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>STARK INDUSTRIES AI · {clock}</div>
        </div>
      </div>

      {/* Connection banner */}
      <div
        style={{
          padding: "6px 16px",
          fontSize: 10,
          letterSpacing: 1,
          textAlign: "center",
          color: desktopConnected ? "#00ff88" : desktopConnected === false ? RED : `${CYAN}88`,
          background: desktopConnected ? "rgba(0,255,136,0.06)" : desktopConnected === false ? "rgba(255,23,68,0.06)" : "transparent",
          borderBottom: `1px solid ${CYAN}1a`,
        }}
      >
        {desktopConnected === null ? "📡 בודק חיבור לדסקטופ..." : desktopConnected ? "🖥 דסקטופ מחובר — פקודות יבוצעו בזמן אמת" : "🖥 דסקטופ לא מחובר — פתח את AgentHub במחשב"}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                alignSelf: m.role === "user" ? "flex-start" : "flex-end",
                maxWidth: "85%",
                direction: "rtl",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: m.role === "user" ? `${GOLD}14` : `${CYAN}12`,
                  border: `1px solid ${m.role === "user" ? GOLD + "44" : CYAN + "44"}`,
                  color: m.role === "user" ? GOLD : "#a0f0ff",
                  boxShadow: `0 0 16px ${m.role === "user" ? GOLD + "11" : CYAN + "11"}`,
                }}
              >
                {m.text}
              </div>
              <div style={{ fontSize: 8, color: `${CYAN}55`, marginTop: 3, textAlign: m.role === "user" ? "right" : "left", padding: "0 4px" }}>
                {m.role === "user" ? "מר סטארק" : "JARVIS"} · {new Date(m.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ alignSelf: "flex-end", direction: "rtl" }}>
            <div style={{ padding: "10px 14px", borderRadius: 14, background: `${CYAN}12`, border: `1px solid ${CYAN}44`, display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ color: `${CYAN}aa`, fontSize: 12 }}>מחשב</span>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: CYAN }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Pick-list — surfaced when the client has more than one configured trigger */}
      <AnimatePresence>
        {pendingChoices && pendingChoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              padding: "12px 12px 10px",
              borderTop: `1px solid ${CYAN}44`,
              background: "rgba(0,229,255,0.05)",
              direction: "rtl",
            }}
          >
            <div style={{ color: CYAN, fontSize: 12, marginBottom: 8, textAlign: "center", letterSpacing: 0.5 }}>
              ⚡ בחר איזה סוכן להפעיל
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingChoices.map((c, i) => {
                const st = statusMeta(c.status);
                const armed = st.busy && armedBusyIdx === i;
                return (
                  <button
                    key={`${c.label}-${i}`}
                    onClick={() => onPick(i, c.label, st.busy)}
                    disabled={thinking}
                    title={st.busy ? "הסוכן כבר עסוק — נדרשת הקשה נוספת לאישור הפעלה כפולה" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: thinking
                        ? `${CYAN}11`
                        : armed
                          ? `linear-gradient(135deg, ${RED}33, ${GOLD}33)`
                          : st.busy
                            ? `linear-gradient(135deg, ${GOLD}1a, ${BLUE}33)`
                            : `linear-gradient(135deg, ${CYAN}22, ${BLUE}44)`,
                      border: `1px solid ${armed ? RED + "aa" : st.busy ? GOLD + "88" : CYAN + "66"}`,
                      color: thinking ? `${CYAN}88` : armed ? GOLD : "#a0f0ff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: thinking ? "default" : "pointer",
                      fontFamily: "inherit",
                      textAlign: "right",
                      opacity: st.busy && !armed ? 0.92 : 1,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {armed ? `⚠ הקש שוב לאישור — ${c.label}` : `${st.busy ? "⚠ " : "▸ "}${c.label}`}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        color: st.color,
                        background: `${st.color}1a`,
                        border: `1px solid ${st.color}55`,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ color: `${GOLD}cc`, fontSize: 10, marginTop: 8, textAlign: "center", letterSpacing: 0.3 }}>
              ⚠ סוכן מסומן בצהוב כבר עסוק — נדרשת הקשה כפולה כדי להפעיל אותו שוב
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm bar — surfaced when the desktop requests approval for a write action */}
      <AnimatePresence>
        {pendingConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              padding: "12px 12px 10px",
              borderTop: `1px solid ${GOLD}44`,
              background: "rgba(255,214,0,0.05)",
              direction: "rtl",
            }}
          >
            <div style={{ color: GOLD, fontSize: 12, marginBottom: 8, textAlign: "center", letterSpacing: 0.5 }}>
              ⚡ הרצת trigger עבור {pendingConfirm.label}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={confirmTrigger}
                disabled={thinking}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  background: thinking ? `${GOLD}22` : `linear-gradient(135deg, ${GOLD}55, ${GOLD}22)`,
                  border: `1px solid ${GOLD}88`,
                  color: thinking ? `${GOLD}88` : GOLD,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: thinking ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                ✓ אשר והרץ
              </button>
              <button
                onClick={cancelTrigger}
                disabled={thinking}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(255,23,68,0.08)",
                  border: `1px solid ${RED}66`,
                  color: RED,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: thinking ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                ✕ ביטול
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick commands */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 12px", borderTop: `1px solid ${CYAN}1a` }}>
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); }}
            style={{
              flexShrink: 0,
              padding: "6px 12px",
              borderRadius: 16,
              background: `${CYAN}0d`,
              border: `1px solid ${CYAN}33`,
              color: `${CYAN}cc`,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              direction: "rtl",
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 12px 16px",
          borderTop: `1px solid ${CYAN}33`,
          background: `${DARK}cc`,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="הקלד פקודה לג׳ארביס..."
          dir="rtl"
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(0,229,255,0.05)",
            border: `1px solid ${CYAN}44`,
            color: "#a0f0ff",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={thinking || !input.trim()}
          style={{
            width: 48,
            borderRadius: 12,
            background: thinking || !input.trim() ? `${CYAN}11` : `linear-gradient(135deg, ${CYAN}33, ${BLUE}66)`,
            border: `1px solid ${CYAN}66`,
            color: CYAN,
            fontSize: 18,
            cursor: thinking || !input.trim() ? "default" : "pointer",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
