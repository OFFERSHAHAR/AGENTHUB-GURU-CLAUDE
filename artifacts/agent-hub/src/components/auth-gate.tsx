import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

type GateState = "checking" | "anon" | "authed";

export type AppUser = {
  username: "eli" | "aor";
  displayName: string;
};

export const UserContext = createContext<AppUser | null>(null);

export function useCurrentUser(): AppUser | null {
  return useContext(UserContext);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [user, setUser] = useState<AppUser | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function checkSession() {
    try {
      const r = await fetch(`${API_BASE}/auth/session`, { credentials: "include" });
      const data = await r.json();
      if (data?.authenticated) {
        setUser({ username: data.user ?? "eli", displayName: data.displayName ?? "אדמין" });
        setState("authed");
      } else {
        setState("anon");
      }
    } catch {
      setState("anon");
    }
  }

  useEffect(() => { checkSession(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        const data = await r.json();
        setUser({ username: data.user ?? "eli", displayName: data.displayName ?? "אדמין" });
        setPassword("");
        setState("authed");
        return;
      }
      if (r.status === 401) setError("סיסמה שגויה, נסה שוב");
      else if (r.status === 503) setError("הכניסה עדיין לא הוגדרה במערכת");
      else setError("אירעה שגיאה, נסה שוב");
    } catch {
      setError("בעיית תקשורת, נסה שוב");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return (
      <div
        className="flex h-screen w-full items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0b1020 0%, #0f1628 50%, #0d0a1e 100%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5, #0ea5e9)",
              boxShadow: "0 0 20px rgba(124,58,237,0.5)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white" opacity="0.9" />
            </svg>
          </div>
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: "rgba(167,139,250,0.6)" }}
          />
        </div>
      </div>
    );
  }

  if (state === "authed") {
    return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
  }

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4"
      style={{ background: "linear-gradient(135deg, #0b1020 0%, #0f1628 40%, #0d0a1e 100%)" }}
    >
      <div
        className="pointer-events-none absolute float-orb"
        style={{ top: "-80px", right: "-60px", width: "360px", height: "360px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 65%)" }}
      />
      <div
        className="pointer-events-none absolute float-orb-delay"
        style={{ bottom: "-100px", left: "-80px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 65%)" }}
      />
      <div
        className="pointer-events-none absolute"
        style={{ top: "40%", left: "15%", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 65%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />

      <div
        className="relative w-full max-w-[360px] rounded-2xl p-8"
        style={{
          background: "rgba(15,22,40,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(139,92,246,0.18)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.12)",
        }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] rounded-full"
          style={{ width: "60%", background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)" }}
        />

        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="mb-5 w-14 h-14 rounded-2xl flex items-center justify-center relative"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #0ea5e9 100%)", boxShadow: "0 0 24px rgba(124,58,237,0.5), 0 0 60px rgba(124,58,237,0.2)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" fillOpacity="0.95" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "rgba(255,255,255,0.95)" }}>AgentHub</h1>
          <p
            className="mt-1.5 text-[13px] font-medium"
            style={{ background: "linear-gradient(90deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            AI Operations Platform
          </p>
          <p className="mt-2 text-[12.5px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            הזן סיסמה כדי להמשיך
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.25)" }} />
            <input
              type="password"
              autoFocus
              dir="ltr"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="סיסמה"
              className="w-full rounded-xl pr-10 pl-4 py-3 text-center text-[14px] font-medium outline-none transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)", caretColor: "#a78bfa" }}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.12)";
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
            />
          </div>

          {error && (
            <p className="text-center text-[12.5px] font-semibold rounded-lg py-2" style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full py-3 rounded-xl text-[13.5px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #4338ca 100%)", boxShadow: "0 0 20px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.12)" }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = "0 0 32px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 20px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "כניסה"}
          </button>
        </form>

        <p className="mt-6 text-center text-[10.5px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          AgentHub • Secured Access
        </p>
      </div>
    </div>
  );
}
