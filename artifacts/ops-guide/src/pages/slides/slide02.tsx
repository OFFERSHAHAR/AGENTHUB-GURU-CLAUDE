export default function Slide02() {
  const layers = [
    {
      title: "שכבת ממשק",
      color: "#6366F1",
      items: ["AgentHub — לוח בקרה ראשי", "Client Intake — קליטת לקוחות", "Gever Mini App — Telegram", "JARVIS + גבר — בינה מלאכותית"],
    },
    {
      title: "שכבת לוגיקה",
      color: "#14B8A6",
      items: ["Express 5 API Server", "Drizzle ORM — גישה ל-DB", "Agent Bus — תקשורת בין סוכנים", "Log Processor — ניתוח שוטף"],
    },
    {
      title: "שכבת אוטומציה",
      color: "#F59E0B",
      items: ["n8n — תזמון ו-workflow", "Webhook Triggers — אירועים", "Telegram Bot — התראות", "Maintenance Agent — תחזוקה"],
    },
    {
      title: "שכבת נתונים",
      color: "#EF4444",
      items: ["PostgreSQL — מסד נתונים ראשי", "Clients + Agents Tables", "Assignments + Logs", "Activity & Stats"],
    },
  ];

  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "#0F172A", display: "flex", flexDirection: "column", padding: "80px 120px", fontFamily: "'Segoe UI',sans-serif", direction: "rtl", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 600, height: 600, background: "radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)" }} />

      <div style={{ marginBottom: 60 }}>
        <div style={{ fontSize: 16, color: "#6366F1", fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 12 }}>ארכיטקטורה</div>
        <h1 style={{ fontSize: 64, fontWeight: 900, color: "#F8FAFC", margin: 0, lineHeight: 1 }}>מבנה המערכת</h1>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 32 }}>
        {layers.map((layer, i) => (
          <div key={i} style={{ background: "#1E293B", borderRadius: 20, padding: 40, borderTop: `4px solid ${layer.color}`, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: layer.color }}>{layer.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {layer.items.map((item, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: layer.color, marginTop: 8, flexShrink: 0 }} />
                  <span style={{ fontSize: 18, color: "#CBD5E1", lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Flow arrow at bottom */}
      <div style={{ marginTop: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
        {["ממשק", "→", "לוגיקה", "→", "אוטומציה", "→", "נתונים"].map((item, i) => (
          <span key={i} style={{ fontSize: 22, color: i % 2 === 1 ? "#334155" : "#64748B", padding: "0 16px" }}>{item}</span>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 120, fontSize: 16, color: "#334155" }}>AgentHub — מדריך תפעול | שקופית 2</div>
    </div>
  );
}
