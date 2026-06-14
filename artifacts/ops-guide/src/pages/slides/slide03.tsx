export default function Slide03() {
  const checks = [
    { icon: "🗄️", name: "בדיקת DB", desc: "connectivity + שלמות נתונים", color: "#6366F1" },
    { icon: "🔗", name: "n8n Webhooks", desc: "ping לכל endpoint פעיל", color: "#14B8A6" },
    { icon: "🤖", name: "שמות סוכנים", desc: "סנכרון בין DB ל-n8n", color: "#F59E0B" },
    { icon: "📊", name: "מדדי מערכת", desc: "עומס, שגיאות, תגובות", color: "#8B5CF6" },
    { icon: "💾", name: "שמירת לוג", desc: "תיעוד מלא של כל בדיקה", color: "#EF4444" },
    { icon: "📨", name: "דוח לצוות", desc: "Telegram — כל בוקר 05:05", color: "#10B981" },
  ];

  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "#0F172A", display: "flex", gap: 0, fontFamily: "'Segoe UI',sans-serif", direction: "rtl", overflow: "hidden" }}>

      {/* Left panel */}
      <div style={{ width: 520, background: "linear-gradient(180deg,#1E293B,#0F172A)", padding: "80px 60px", display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "1px solid #1E293B" }}>
        <div style={{ fontSize: 14, color: "#6366F1", fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 20 }}>סוכן תחזוקה</div>
        <h1 style={{ fontSize: 56, fontWeight: 900, color: "#F8FAFC", margin: "0 0 32px", lineHeight: 1.1 }}>שומר<br/>הסדר היומי</h1>

        <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 32, marginBottom: 32 }}>
          <div style={{ fontSize: 72, fontWeight: 900, color: "#6366F1", textAlign: "center" }}>05:00</div>
          <div style={{ fontSize: 20, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>הפעלה יומית אוטומטית</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { time: "05:00", label: "הפעלת בדיקות" },
            { time: "05:02", label: "שמירת לוגים" },
            { time: "05:04", label: "עדכון אוטומטי" },
            { time: "05:05", label: "שליחת דוח לצוות" },
          ].map(({ time, label }) => (
            <div key={time} style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <span style={{ fontFamily: "monospace", fontSize: 18, color: "#6366F1", width: 60, textAlign: "left" }}>{time}</span>
              <span style={{ fontSize: 18, color: "#CBD5E1" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, padding: "80px 80px", display: "flex", flexDirection: "column", gap: 40 }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, color: "#94A3B8", margin: 0 }}>רשימת בדיקות יומית</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, flex: 1 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ background: "#1E293B", borderRadius: 16, padding: "32px 36px", display: "flex", alignItems: "center", gap: 24, border: "1px solid #334155" }}>
              <span style={{ fontSize: 44 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginBottom: 8 }}>{c.name}</div>
                <div style={{ fontSize: 18, color: "#64748B" }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "20px 32px", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <span style={{ fontSize: 20, color: "#10B981" }}>במידה וזוהתה אי-התאמה — עדכון אוטומטי ידחה + התראה לצוות</span>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 80, fontSize: 16, color: "#334155" }}>AgentHub — מדריך תפעול | שקופית 3</div>
    </div>
  );
}
