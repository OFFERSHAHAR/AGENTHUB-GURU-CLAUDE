export default function Slide07() {
  const schedule = [
    { time: "05:00", icon: "🤖", title: "Maintenance Agent מופעל", desc: "בדיקת DB, n8n, שמות, מדדים", tag: "אוטומטי", color: "#6366F1" },
    { time: "05:05", icon: "📨", title: "דוח בוקר לצוות", desc: "סיכום תוצאות הבדיקות ב-Telegram", tag: "אוטומטי", color: "#6366F1" },
    { time: "09:00", icon: "👀", title: "סקירת לוגי לילה", desc: "בדיקת Logs Page — שגיאות, anomalies", tag: "ידני", color: "#F59E0B" },
    { time: "12:00", icon: "📊", title: "בדיקת לוחות לקוחות", desc: "Client Live Dashboard לכל לקוח פעיל", tag: "ידני", color: "#F59E0B" },
    { time: "17:00", icon: "✅", title: "סגירת יום", desc: "סיכום ביצועים + תכנון מחר", tag: "ידני", color: "#F59E0B" },
    { time: "23:00", icon: "💤", title: "Mode לילה", desc: "המערכת בניטור פסיבי בלבד", tag: "אוטומטי", color: "#6366F1" },
  ];

  const principles = [
    "כל שינוי ב-DB מלווה בבדיקת n8n",
    "כל תקלה מתועדת לפני שינסו תיקון",
    "escalation לצוות תוך 5 דקות מכישלון",
    "Telegram הוא ערוץ דיווח ראשי",
  ];

  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "#0F172A", display: "flex", gap: 0, fontFamily: "'Segoe UI',sans-serif", direction: "rtl", overflow: "hidden" }}>

      {/* Main left */}
      <div style={{ flex: 1, padding: "80px 80px", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 14, color: "#10B981", fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 12 }}>תפעול יומי</div>
          <h1 style={{ fontSize: 56, fontWeight: 900, color: "#F8FAFC", margin: 0 }}>לוח זמנים תפעולי</h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {schedule.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, padding: "20px 28px", background: "#1E293B", borderRadius: 14, borderRight: `3px solid ${s.color}` }}>
              <span style={{ fontFamily: "monospace", fontSize: 22, color: s.color, width: 60, textAlign: "left", flexShrink: 0 }}>{s.time}</span>
              <span style={{ fontSize: 32, flexShrink: 0 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#F8FAFC" }}>{s.title}</div>
                <div style={{ fontSize: 16, color: "#64748B" }}>{s.desc}</div>
              </div>
              <span style={{ fontSize: 14, padding: "4px 14px", borderRadius: 20, background: s.tag === "אוטומטי" ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)", color: s.tag === "אוטומטי" ? "#A5B4FC" : "#FCD34D" }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 480, background: "#1E293B", padding: "80px 60px", display: "flex", flexDirection: "column", gap: 40 }}>
        <div>
          <div style={{ fontSize: 14, color: "#10B981", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 20 }}>עקרונות מנחים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {principles.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", marginTop: 8, flexShrink: 0 }} />
                <span style={{ fontSize: 18, color: "#CBD5E1", lineHeight: 1.5 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #334155", paddingTop: 40 }}>
          <div style={{ fontSize: 14, color: "#6366F1", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 20 }}>כלים מרכזיים</div>
          {[
            ["JARVIS + גבר", "בינה + שליטה"],
            ["Telegram Bot", "התראות + דוחות"],
            ["Logs Page", "ניתוח שגיאות"],
            ["Client Live", "מדדי לקוח חי"],
            ["Maintenance", "בדיקות יומיות"],
          ].map(([tool, desc]) => (
            <div key={tool} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #0F172A" }}>
              <span style={{ fontSize: 17, color: "#A5B4FC", fontWeight: 600 }}>{tool}</span>
              <span style={{ fontSize: 15, color: "#475569" }}>{desc}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", background: "rgba(99,102,241,0.1)", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 16, color: "#6366F1", marginBottom: 8 }}>לשאלות תפעוליות</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#A5B4FC" }}>@AgentHubBot</div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 80, fontSize: 16, color: "#334155" }}>AgentHub — מדריך תפעול | שקופית 7</div>
    </div>
  );
}
