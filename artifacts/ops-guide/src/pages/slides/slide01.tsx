export default function Slide01() {
  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#0F172A 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "'Segoe UI',sans-serif" }}>
      {/* Grid lines */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(99,102,241,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.07) 1px,transparent 1px)", backgroundSize: "80px 80px" }} />
      {/* Glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 800, height: 800, background: "radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)" }} />

      {/* Logo badge */}
      <div style={{ position: "relative", marginBottom: 48, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(99,102,241,0.5)" }}>
          <span style={{ fontSize: 40 }}>🤖</span>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#6366F1", letterSpacing: 8, textTransform: "uppercase" }}>AgentHub</div>
          <div style={{ fontSize: 14, color: "#64748B", letterSpacing: 4, textTransform: "uppercase" }}>AI Agent Management Platform</div>
        </div>
      </div>

      {/* Main title */}
      <h1 style={{ position: "relative", fontSize: 96, fontWeight: 900, color: "#F8FAFC", textAlign: "center", lineHeight: 1.1, margin: "0 0 24px", direction: "rtl" }}>
        מדריך תפעול
      </h1>
      <h2 style={{ position: "relative", fontSize: 40, fontWeight: 400, color: "#94A3B8", textAlign: "center", margin: "0 0 64px", direction: "rtl" }}>
        ושיתוף פעולה
      </h2>

      {/* Divider */}
      <div style={{ position: "relative", width: 200, height: 3, background: "linear-gradient(90deg,transparent,#6366F1,transparent)", margin: "0 0 64px" }} />

      {/* Tags */}
      <div style={{ position: "relative", display: "flex", gap: 20 }}>
        {["ניהול סוכנים", "תחזוקה יומית", "לוחות חי", "תיקון אוטומטי"].map(tag => (
          <div key={tag} style={{ padding: "10px 24px", borderRadius: 40, border: "1px solid rgba(99,102,241,0.4)", color: "#A5B4FC", fontSize: 20, fontWeight: 500, direction: "rtl" }}>{tag}</div>
        ))}
      </div>

      {/* Version */}
      <div style={{ position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)", color: "#334155", fontSize: 16, letterSpacing: 4 }}>
        VERSION 2.0 — JUNE 2026
      </div>
    </div>
  );
}
