export default function Slide06() {
  const upgrades = [
    {
      status: "🚀 בוצע",
      color: "#10B981",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.25)",
      title: "זיהוי מסכים — JARVIS",
      desc: "מרובה מסכים → פתיחת גבר על מסך שני. מסך צר → Telegram Mini App",
      when: "יוני 2026",
    },
    {
      status: "🔧 בבנייה",
      color: "#6366F1",
      bg: "rgba(99,102,241,0.08)",
      border: "rgba(99,102,241,0.25)",
      title: "לוח מחוונים חי — לכל לקוח",
      desc: "ביצועים בזמן אמת · ניטור שגיאות · סוכני תיקון אוטומטי",
      when: "יוני 2026",
    },
    {
      status: "🔧 בבנייה",
      color: "#6366F1",
      bg: "rgba(99,102,241,0.08)",
      border: "rgba(99,102,241,0.25)",
      title: "Maintenance Agent",
      desc: "בדיקת תקינות יומית 05:00 · עדכון אוטומטי · דוח לצוות ב-Telegram",
      when: "יוני 2026",
    },
    {
      status: "📋 מתוכנן",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.25)",
      title: "Contact Agent",
      desc: "עיבוד פניות חדשות · העברה אוטומטית לאחראי · תזכורות follow-up",
      when: "Q3 2026",
    },
    {
      status: "📋 מתוכנן",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.25)",
      title: "Trigger History",
      desc: "מאגר אירועי webhook · replay · ניתוח דפוסים · אלרטים חכמים",
      when: "Q3 2026",
    },
    {
      status: "💡 חזון",
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.08)",
      border: "rgba(139,92,246,0.25)",
      title: "Client Self-Service Portal",
      desc: "ממשק ישיר ללקוח — מדדים · בקשות שינוי · דוחות אוטומטיים",
      when: "Q4 2026",
    },
  ];

  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "#0F172A", display: "flex", flexDirection: "column", padding: "80px 120px", fontFamily: "'Segoe UI',sans-serif", direction: "rtl", position: "relative", overflow: "hidden" }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 14, color: "#8B5CF6", fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 12 }}>רודמאפ</div>
        <h1 style={{ fontSize: 64, fontWeight: 900, color: "#F8FAFC", margin: 0 }}>שדרוגים — מה עוד חייבים</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, flex: 1 }}>
        {upgrades.map((u, i) => (
          <div key={i} style={{ background: u.bg, border: `1px solid ${u.border}`, borderRadius: 18, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: u.color, background: `${u.bg}`, border: `1px solid ${u.border}`, padding: "6px 16px", borderRadius: 20 }}>{u.status}</span>
              <span style={{ fontSize: 14, color: "#475569" }}>{u.when}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#F8FAFC" }}>{u.title}</div>
            <div style={{ fontSize: 18, color: "#64748B", lineHeight: 1.6 }}>{u.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 120, fontSize: 16, color: "#334155" }}>AgentHub — מדריך תפעול | שקופית 6</div>
    </div>
  );
}
