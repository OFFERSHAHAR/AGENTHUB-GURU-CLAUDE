export default function Slide04() {
  const metrics = [
    { label: "סוכנים פעילים", value: "7/8", color: "#10B981", icon: "🤖" },
    { label: "קריאות היום", value: "1,240", color: "#6366F1", icon: "⚡" },
    { label: "שגיאות", value: "0", color: "#10B981", icon: "🛡️" },
    { label: "זמן תגובה ממוצע", value: "1.2s", color: "#F59E0B", icon: "⏱️" },
  ];

  const events = [
    { time: "09:14", type: "✅", text: "Lead Qualifier Pro — הצלחה", client: "Nexus Ventures" },
    { time: "09:08", type: "⚡", text: "Webhook triggered — סנכרון CRM", client: "TechFlow" },
    { time: "08:52", type: "⚠️", text: "n8n עיכוב 2.4s — ניטור", client: "Sapphire" },
    { time: "08:31", type: "✅", text: "דוח שבועי נשלח ללקוח", client: "Nexus Ventures" },
    { time: "08:15", type: "✅", text: "בדיקת תקינות — עבר", client: "כל הלקוחות" },
  ];

  return (
    <div className="slide" style={{ width: 1920, height: 1080, background: "#0F172A", display: "flex", flexDirection: "column", padding: "80px 120px", fontFamily: "'Segoe UI',sans-serif", direction: "rtl", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 500, height: 500, background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)" }} />

      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 14, color: "#14B8A6", fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 12 }}>ממשק לקוח</div>
        <h1 style={{ fontSize: 64, fontWeight: 900, color: "#F8FAFC", margin: 0 }}>לוח מחוונים חי — לכל לקוח</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 24, marginBottom: 40 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: "#1E293B", borderRadius: 16, padding: "32px 36px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{m.icon}</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: m.color, marginBottom: 8 }}>{m.value}</div>
            <div style={{ fontSize: 18, color: "#64748B" }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* Events feed */}
        <div style={{ background: "#1E293B", borderRadius: 16, padding: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#94A3B8", marginBottom: 24 }}>אירועים אחרונים — עדכון כל 5 שניות</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 20, alignItems: "center", padding: "12px 16px", borderRadius: 10, background: i === 0 ? "rgba(99,102,241,0.08)" : "transparent", borderRight: i === 0 ? "3px solid #6366F1" : "3px solid transparent" }}>
                <span style={{ fontSize: 22 }}>{e.type}</span>
                <span style={{ fontFamily: "monospace", fontSize: 16, color: "#475569", width: 48 }}>{e.time}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, color: "#CBD5E1" }}>{e.text}</div>
                  <div style={{ fontSize: 14, color: "#475569" }}>{e.client}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { icon: "📊", title: "ביצועים בזמן אמת", desc: "polling כל 5 שניות — עדכון חי ללא רענון" },
            { icon: "🔴", title: "ניטור תקלות", desc: "זיהוי אוטומטי של שגיאות webhook ו-timeout" },
            { icon: "🔧", title: "סוכני תיקון", desc: "תגובה מיידית ללא שבירת זרימה קיימת" },
            { icon: "🔔", title: "התראות ב-Telegram", desc: "push notification לצוות + ללקוח בעת הצורך" },
          ].map((f, i) => (
            <div key={i} style={{ background: "#1E293B", borderRadius: 14, padding: "24px 32px", display: "flex", gap: 24, alignItems: "center" }}>
              <span style={{ fontSize: 36 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 17, color: "#64748B" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 120, fontSize: 16, color: "#334155" }}>AgentHub — מדריך תפעול | שקופית 4</div>
    </div>
  );
}
