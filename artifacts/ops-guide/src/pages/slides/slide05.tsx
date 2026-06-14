export default function Slide05() {
  const scenarios = [
    {
      trigger: "n8n לא מגיב",
      icon: "⚠️",
      action: "retry אוטומטי × 3",
      result: "Telegram alert + המשך תור",
      severity: "#F59E0B",
    },
    {
      trigger: "שם כותרת השתנה ב-DB",
      icon: "🔄",
      action: "סנכרון מחדש עם n8n",
      result: "עדכון ה-workflow + לוג",
      severity: "#6366F1",
    },
    {
      trigger: "webhook timeout",
      icon: "🔴",
      action: "הפניה לסוכן backup",
      result: "אפס שבירת זרימה ללקוח",
      severity: "#EF4444",
    },
    {
      trigger: "עדכון גרסת n8n",
      icon: "🆙",
      action: "בדיקת תאימות אוטומטית",
      result: "rollback / אישור וקידום",
      severity: "#10B981",
    },
  ];

  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "#0F172A", display: "flex", flexDirection: "column", padding: "80px 120px", fontFamily: "'Segoe UI',sans-serif", direction: "rtl", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", right: -100, transform: "translateY(-50%)", width: 500, height: 500, background: "radial-gradient(circle,rgba(239,68,68,0.05) 0%,transparent 70%)" }} />

      <div style={{ marginBottom: 60 }}>
        <div style={{ fontSize: 14, color: "#EF4444", fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 12 }}>תיקון אוטומטי</div>
        <h1 style={{ fontSize: 64, fontWeight: 900, color: "#F8FAFC", margin: 0, lineHeight: 1 }}>סוכני תיקון בזמן אמת<br/><span style={{ color: "#64748B", fontSize: 36, fontWeight: 400 }}>שמירת זרימה ללא שבירה</span></h1>
      </div>

      {/* Scenarios */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, flex: 1 }}>
        {scenarios.map((s, i) => (
          <div key={i} style={{ background: "#1E293B", borderRadius: 20, padding: "36px 40px", borderRight: `4px solid ${s.severity}` }}>
            {/* Trigger */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <span style={{ fontSize: 36 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 14, color: "#475569", fontWeight: 600, letterSpacing: 4, textTransform: "uppercase" }}>טריגר</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.severity }}>{s.trigger}</div>
              </div>
            </div>
            {/* Arrow flow */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 20, color: "#475569" }}>→</span>
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 20px", flex: 1 }}>
                  <span style={{ fontSize: 14, color: "#6366F1", fontWeight: 700 }}>פעולה: </span>
                  <span style={{ fontSize: 18, color: "#CBD5E1" }}>{s.action}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 20, color: "#475569" }}>→</span>
                <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 10, padding: "12px 20px", flex: 1, border: "1px solid rgba(16,185,129,0.2)" }}>
                  <span style={{ fontSize: 14, color: "#10B981", fontWeight: 700 }}>תוצאה: </span>
                  <span style={{ fontSize: 18, color: "#CBD5E1" }}>{s.result}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Principle footer */}
      <div style={{ marginTop: 32, padding: "20px 36px", background: "rgba(99,102,241,0.08)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)", textAlign: "center" }}>
        <span style={{ fontSize: 22, color: "#A5B4FC" }}>
          🎯 עיקרון ליבה — <strong>הלקוח לא חש בתקלה.</strong> כל טיפול מתרחש ברקע מבלי לשבור את הזרימה הקיימת.
        </span>
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 120, fontSize: 16, color: "#334155" }}>AgentHub — מדריך תפעול | שקופית 5</div>
    </div>
  );
}
