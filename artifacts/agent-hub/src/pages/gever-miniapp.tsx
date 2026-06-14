import { useState, useEffect, useRef } from "react";
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

// ─── Matrix Eye (same as gabar.tsx) ──────────────────────────────────────────
function MatrixEye({ active, size = 44 }: { active: boolean; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dropsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cols = Math.floor(size / 7);
    dropsRef.current = Array(cols).fill(1);
    const CHARS = "אבגדהוזחטיכלמנסעפצקרשת01{}[]<>=/\\+-*!?";

    if (!active) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#1a0a2e";
      ctx.fillRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.38);
      grad.addColorStop(0, "#1a1a6e");
      grad.addColorStop(0.6, "#2244aa");
      grad.addColorStop(1, "#0d0d2a");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(cx - size * 0.1, cy - size * 0.1, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#00ff41";
      ctx.font = `bold 7px monospace`;
      dropsRef.current.forEach((y, i) => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillText(char, i * 7, y * 7);
        if (y * 7 > size && Math.random() > 0.96) dropsRef.current[i] = 0;
        else dropsRef.current[i]++;
      });
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        borderRadius: "50%",
        border: active ? "2px solid #00ff41" : "2px solid #2244aa",
        boxShadow: active ? "0 0 10px #00ff4166" : "0 0 5px #2244aa44",
      }}
    />
  );
}

// ─── Stats types ──────────────────────────────────────────────────────────────
interface Stats {
  clients: number;
  agents: number;
  errors: number;
  warnings: number;
  totalLogs: number;
}

interface Client {
  id: number;
  name: string;
  status: string;
  industry: string | null;
}

// ─── Mini App Page ─────────────────────────────────────────────────────────────
export default function GeverMiniApp() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [tab, setTab] = useState<"home" | "clients" | "logs">("home");
  const [logs, setLogs] = useState<Array<{ id: number; status: string; source: string; eventType: string; timestamp: string; agentName: string | null }>>([]);
  const [greeting, setGreeting] = useState("מה נשמע? טוען נתונים...");
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  // Initialize Telegram WebApp
  useEffect(() => {
    const app = tg();
    if (app) {
      app.ready();
      app.expand();
      const user = app.initDataUnsafe?.user;
      if (user?.first_name) setGreeting(`שלום ${user.first_name}! מה נשמע?`);
    }
  }, []);

  // Load data
  useEffect(() => {
    setThinking(true);
    Promise.all([
      fetch(`${BASE}/api/clients`).then((r) => r.json()).catch(() => []),
      fetch(`${BASE}/api/agents`).then((r) => r.json()).catch(() => []),
      fetch(`${BASE}/api/logs?limit=50`).then((r) => r.json()).catch(() => []),
    ]).then(([cls, ags, lgs]) => {
      const clientList = Array.isArray(cls) ? cls : [];
      const agentList = Array.isArray(ags) ? ags : [];
      const logList = Array.isArray(lgs) ? lgs : [];
      setClients(clientList);
      setLogs(logList);
      setStats({
        clients: clientList.length,
        agents: agentList.length,
        errors: logList.filter((l: { status: string }) => l.status === "error").length,
        warnings: logList.filter((l: { status: string }) => l.status === "warning").length,
        totalLogs: logList.length,
      });
      setGreeting(
        clientList.length > 0
          ? `${clientList.length} לקוחות פעילים, ${agentList.length} סוכנים. המערכת רצה.`
          : "המערכת מחוברת. אין לקוחות עדיין."
      );
      setLoading(false);
      setThinking(false);
    });
  }, [BASE]);

  const STATUS_COLOR: Record<string, string> = {
    active: "#22c55e", trial: "#f59e0b", inactive: "#6b7280", churned: "#ef4444",
  };
  const LOG_COLOR: Record<string, string> = {
    success: "#22c55e", error: "#ef4444", warning: "#f59e0b", info: "#60a5fa",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #0d0d1a 0%, #12122a 60%, #1a0d2e 100%)",
        color: "#e2e8f0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* Header — גבר face + greeting */}
      <div
        style={{
          padding: "24px 20px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderBottom: "1px solid #1e1e3a",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {/* Face */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg
            viewBox="0 0 80 80"
            width={72}
            height={72}
            style={{
              borderRadius: "50%",
              border: thinking ? "2px solid #00ff41" : "2px solid #2244aa",
              boxShadow: thinking ? "0 0 16px #00ff4144" : "0 0 10px #2244aa33",
              filter: thinking ? "brightness(0.7) grayscale(0.5)" : "none",
              transition: "all 0.4s",
              background: "linear-gradient(160deg,#1a1a2e,#16213e)",
            }}
          >
            <ellipse cx="40" cy="37" rx="24" ry="28" fill="#c8956c" />
            <ellipse cx="40" cy="17" rx="24" ry="12" fill="#2a1a0a" />
            <rect x="16" y="17" width="48" height="10" fill="#2a1a0a" />
            <rect x="26" y="53" width="28" height="10" rx="5" fill="#a06840" opacity="0.5" />
            <ellipse cx="40" cy="46" rx="6" ry="7" fill="#b07550" />
            {/* Eyes */}
            {thinking ? (
              <>
                <rect x="22" y="35" width="10" height="4" rx="2" fill="#c8956c" />
                <rect x="48" y="35" width="10" height="4" rx="2" fill="#c8956c" />
              </>
            ) : (
              <>
                <ellipse cx="29" cy="36" rx="5" ry="4" fill="#fff" />
                <circle cx="29" cy="36" r="2.5" fill="#2a1a00" />
                <ellipse cx="51" cy="36" rx="5" ry="4" fill="#fff" />
                <circle cx="51" cy="36" r="2.5" fill="#2a1a00" />
              </>
            )}
            <path d="M32 57 Q40 62 48 57" stroke="#7a4a30" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          {/* Matrix eye overlay on face when thinking */}
          {thinking && (
            <div
              style={{
                position: "absolute",
                top: "38%",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 6,
                pointerEvents: "none",
              }}
            >
              <MatrixEye active size={18} />
              <MatrixEye active size={18} />
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3, marginBottom: 4 }}>
            גבר 🧔
          </div>
          <motion.div
            key={greeting}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: 13,
              color: thinking ? "#00ff41" : "#94a3b8",
              lineHeight: 1.4,
              direction: "rtl",
            }}
          >
            {loading ? "טוען נתונים..." : greeting}
          </motion.div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #1e1e3a",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        {(["home", "clients", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #7c3aed" : "2px solid transparent",
              color: tab === t ? "#a78bfa" : "#6b7280",
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t === "home" ? "🏠 בית" : t === "clients" ? "👥 לקוחות" : "📋 לוגים"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
        <AnimatePresence mode="wait">
          {tab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "לקוחות", value: stats?.clients ?? "—", color: "#60a5fa", emoji: "👥" },
                  { label: "סוכנים", value: stats?.agents ?? "—", color: "#a78bfa", emoji: "🤖" },
                  { label: "לוגים (50)", value: stats?.totalLogs ?? "—", color: "#94a3b8", emoji: "📋" },
                  { label: "שגיאות", value: stats?.errors ?? "—", color: stats?.errors ? "#ef4444" : "#22c55e", emoji: stats?.errors ? "⚠️" : "✅" },
                ].map(({ label, value, color, emoji }) => (
                  <div
                    key={label}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 14,
                      padding: "14px 12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color }}>{loading ? "..." : value}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Status banner */}
              <div
                style={{
                  background: stats?.errors ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  border: `1px solid ${stats?.errors ? "#ef444440" : "#22c55e40"}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                  direction: "rtl",
                }}
              >
                <span style={{ fontSize: 20 }}>{stats?.errors ? "⚠️" : "✅"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: stats?.errors ? "#fca5a5" : "#86efac" }}>
                    {stats?.errors ? `יש ${stats.errors} שגיאות בלוגים האחרונים` : "המערכת רצה תקין"}
                  </div>
                  {stats?.warnings ? (
                    <div style={{ fontSize: 11, color: "#fcd34d", marginTop: 2 }}>{stats.warnings} אזהרות</div>
                  ) : null}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                  פעולות מהירות
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "👥 הצג לקוחות", action: () => setTab("clients") },
                    { label: "📋 הצג לוגים אחרונים", action: () => setTab("logs") },
                    { label: "🔄 רענן נתונים", action: () => window.location.reload() },
                    { label: "🚪 סגור", action: () => tg()?.close() },
                  ].map(({ label, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        background: "rgba(124,58,237,0.12)",
                        border: "1px solid rgba(124,58,237,0.25)",
                        borderRadius: 12,
                        padding: "12px 16px",
                        color: "#c4b5fd",
                        fontSize: 14,
                        cursor: "pointer",
                        textAlign: "right",
                        direction: "rtl",
                        transition: "background 0.15s",
                        fontFamily: "inherit",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "clients" && (
            <motion.div key="clients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
                {clients.length} לקוחות
              </div>
              {loading ? (
                <div style={{ textAlign: "center", color: "#6b7280", padding: 32, fontSize: 13 }}>טוען...</div>
              ) : clients.length === 0 ? (
                <div style={{ textAlign: "center", color: "#6b7280", padding: 32, fontSize: 13 }}>אין לקוחות עדיין</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {clients.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        direction: "rtl",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                        {c.industry && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.industry}</div>}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: `${STATUS_COLOR[c.status] ?? "#6b7280"}22`,
                          color: STATUS_COLOR[c.status] ?? "#6b7280",
                          border: `1px solid ${STATUS_COLOR[c.status] ?? "#6b7280"}44`,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {c.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === "logs" && (
            <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
                50 לוגים אחרונים
              </div>
              {loading ? (
                <div style={{ textAlign: "center", color: "#6b7280", padding: 32, fontSize: 13 }}>טוען...</div>
              ) : logs.length === 0 ? (
                <div style={{ textAlign: "center", color: "#6b7280", padding: 32, fontSize: 13 }}>אין לוגים עדיין</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${LOG_COLOR[l.status] ?? "#6b7280"}22`,
                        borderLeft: `3px solid ${LOG_COLOR[l.status] ?? "#6b7280"}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                        direction: "rtl",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: LOG_COLOR[l.status] ?? "#e2e8f0" }}>
                          {l.eventType}
                        </span>
                        <span style={{ fontSize: 10, color: "#6b7280" }}>
                          {new Date(l.timestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {l.source}{l.agentName ? ` · ${l.agentName}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #1e1e3a",
          background: "rgba(0,0,0,0.3)",
          textAlign: "center",
          fontSize: 11,
          color: "#374151",
        }}
      >
        AgentHub · גבר mini app · {new Date().toLocaleDateString("he-IL")}
      </div>
    </div>
  );
}
