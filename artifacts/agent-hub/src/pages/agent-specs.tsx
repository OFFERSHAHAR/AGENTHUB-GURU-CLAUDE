import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

interface Agent {
  id: number;
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  tags?: string[];
  category?: string;
  temperature?: number;
  maxTokens?: number;
}

const css = `
  .spec-page { --bg: #f5f7fb; --bg2: #eef3fb; --ink: #0f172a; --muted: #64748b; --line: rgba(15,23,42,0.11); --card: rgba(255,255,255,0.82); --glass: rgba(255,255,255,0.62); --blue: #2563eb; --cyan: #06b6d4; --green: #16a34a; --amber: #f59e0b; --red: #dc2626; --purple: #7c3aed; --shadow: 0 24px 80px rgba(15,23,42,0.13); --soft-shadow: 0 12px 35px rgba(15,23,42,0.09); --radius: 28px; --radius2: 18px; box-sizing: border-box; font-family: "Segoe UI","Arial",sans-serif; color: var(--ink); direction: rtl; }
  .spec-page *, .spec-page *::before, .spec-page *::after { box-sizing: border-box; }
  .spec-bg { min-height: 100vh; background: radial-gradient(circle at top left,rgba(37,99,235,0.18),transparent 34%), radial-gradient(circle at 82% 12%,rgba(6,182,212,0.16),transparent 32%), radial-gradient(circle at 55% 92%,rgba(124,58,237,0.12),transparent 36%), linear-gradient(135deg,var(--bg),var(--bg2)); overflow-x: hidden; position: relative; }
  .spec-bg::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:0.42; background-image:linear-gradient(rgba(15,23,42,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,0.04) 1px,transparent 1px); background-size:42px 42px; mask-image:radial-gradient(circle at center,black,transparent 78%); z-index:0; }
  .spec-wrap { position:relative; z-index:1; max-width:1240px; margin:0 auto; padding:36px 24px 80px; }
  .spec-hero { position:relative; border:1px solid rgba(255,255,255,0.9); background:linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.58)); box-shadow:var(--shadow); border-radius:36px; padding:34px; overflow:hidden; backdrop-filter:blur(18px); }
  .spec-hero::after { content:""; position:absolute; inset:auto -12% -54% -12%; height:270px; background:linear-gradient(90deg,rgba(37,99,235,0.12),rgba(6,182,212,0.12),rgba(124,58,237,0.12)); filter:blur(26px); transform:rotate(-3deg); pointer-events:none; }
  .spec-topbar { display:flex; justify-content:space-between; gap:18px; align-items:center; position:relative; z-index:2; margin-bottom:42px; flex-wrap:wrap; }
  .spec-brand { display:flex; align-items:center; gap:14px; }
  .spec-logo { width:52px; height:52px; border-radius:18px; background:conic-gradient(from 210deg,var(--blue),var(--cyan),var(--purple),var(--blue)); box-shadow:0 12px 26px rgba(37,99,235,0.28); position:relative; flex-shrink:0; }
  .spec-logo::after { content:"AI"; position:absolute; inset:7px; display:grid; place-items:center; border-radius:13px; background:rgba(255,255,255,0.91); font-size:13px; font-weight:900; letter-spacing:.8px; color:var(--blue); }
  .spec-pill { border:1px solid rgba(37,99,235,0.18); background:rgba(37,99,235,0.07); color:#1d4ed8; padding:10px 14px; border-radius:999px; font-size:13px; font-weight:800; white-space:nowrap; }
  .spec-hero-grid { position:relative; z-index:2; display:grid; grid-template-columns:1.2fr .8fr; gap:26px; align-items:stretch; }
  .spec-h1 { margin:0 0 14px; font-size:clamp(28px,4vw,56px); line-height:1.02; letter-spacing:-1.8px; }
  .gradient-text { background:linear-gradient(90deg,#0f172a,#2563eb 48%,#7c3aed); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .spec-subtitle { color:var(--muted); font-size:16px; line-height:1.75; max-width:700px; margin:0 0 26px; }
  .meta-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
  .meta-chip { display:inline-flex; align-items:center; gap:8px; border-radius:999px; padding:10px 13px; border:1px solid var(--line); background:rgba(255,255,255,0.65); font-weight:750; color:#334155; font-size:13px; }
  .agent-dark-card { border-radius:var(--radius); border:1px solid rgba(255,255,255,0.9); background:linear-gradient(180deg,rgba(15,23,42,0.94),rgba(30,41,59,0.92)); color:white; padding:24px; position:relative; overflow:hidden; min-height:285px; box-shadow:var(--soft-shadow); }
  .agent-dark-card::before { content:""; position:absolute; width:220px; height:220px; border-radius:999px; background:radial-gradient(circle,rgba(6,182,212,0.35),transparent 68%); left:-72px; top:-72px; }
  .agent-dark-card::after { content:""; position:absolute; inset:18px; border:1px solid rgba(255,255,255,0.1); border-radius:22px; pointer-events:none; }
  .agent-dark-card > * { position:relative; z-index:2; }
  .agent-label { display:inline-flex; gap:8px; align-items:center; padding:8px 12px; border-radius:999px; background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.86); font-size:12px; font-weight:800; margin-bottom:20px; }
  .agent-title { font-size:24px; font-weight:900; margin-bottom:8px; }
  .agent-role-text { color:rgba(255,255,255,0.72); line-height:1.65; margin-bottom:24px; font-size:14px; }
  .mini-metrics { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-top:20px; }
  .mini-metric { border-radius:17px; padding:14px; background:rgba(255,255,255,0.09); border:1px solid rgba(255,255,255,0.11); }
  .mini-metric strong { display:block; font-size:21px; margin-bottom:3px; }
  .mini-metric span { color:rgba(255,255,255,0.66); font-size:12px; font-weight:700; }
  .spec-section { margin-top:28px; display:grid; grid-template-columns:repeat(12,1fr); gap:20px; }
  .spec-panel { border-radius:var(--radius); background:var(--card); border:1px solid rgba(255,255,255,0.82); box-shadow:var(--soft-shadow); backdrop-filter:blur(18px); padding:24px; }
  .span-4 { grid-column:span 4; }
  .span-5 { grid-column:span 5; }
  .span-6 { grid-column:span 6; }
  .span-7 { grid-column:span 7; }
  .span-8 { grid-column:span 8; }
  .span-12 { grid-column:span 12; }
  .section-title { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:18px; flex-wrap:wrap; }
  .section-title h2 { margin:0; font-size:20px; letter-spacing:-.5px; }
  .spec-tag { border-radius:999px; padding:7px 11px; background:rgba(15,23,42,0.06); color:var(--muted); font-size:12px; font-weight:850; white-space:nowrap; }
  .guard-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  .guard { border-radius:22px; padding:18px; min-height:148px; border:1px solid var(--line); background:linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.4)); position:relative; overflow:hidden; }
  .guard::before { content:""; position:absolute; inset-inline-start:0; top:0; width:5px; height:100%; background:var(--blue); }
  .guard.gc::before { background:var(--cyan); }
  .guard.gg::before { background:var(--green); }
  .guard.ga::before { background:var(--amber); }
  .guard.gr::before { background:var(--red); }
  .guard.gp::before { background:var(--purple); }
  .guard small { display:inline-block; color:var(--muted); font-weight:850; margin-bottom:10px; }
  .guard h3 { margin:0 0 10px; font-size:16px; }
  .guard p { margin:0; color:var(--muted); line-height:1.55; font-size:13px; }
  .spec-list { display:grid; gap:12px; }
  .spec-item { display:grid; grid-template-columns:38px 1fr; gap:12px; align-items:start; padding:14px; border-radius:18px; border:1px solid var(--line); background:rgba(255,255,255,0.58); }
  .ico { width:38px; height:38px; border-radius:14px; display:grid; place-items:center; background:rgba(37,99,235,0.09); color:var(--blue); font-weight:900; font-size:12px; text-align:center; }
  .spec-item strong { display:block; margin-bottom:4px; font-size:14px; }
  .spec-item p { margin:0; color:var(--muted); line-height:1.55; font-size:13px; }
  .meters { display:grid; gap:18px; }
  .meter-head { display:flex; justify-content:space-between; margin-bottom:8px; font-weight:850; font-size:14px; }
  .meter-head span:last-child { color:var(--muted); }
  .bar { height:12px; border-radius:999px; background:rgba(15,23,42,0.08); overflow:hidden; border:1px solid rgba(15,23,42,0.04); }
  .fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--blue),var(--cyan)); }
  .fill.safe { background:linear-gradient(90deg,var(--green),var(--cyan)); }
  .fill.risk { background:linear-gradient(90deg,var(--amber),var(--red)); }
  .fill.auto { background:linear-gradient(90deg,var(--purple),var(--blue)); }
  .audit-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
  .audit-card { border-radius:24px; padding:22px; border:1px solid var(--line); background:linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.44)); position:relative; overflow:hidden; }
  .audit-card::after { content:""; position:absolute; inset-inline-end:-52px; top:-52px; width:150px; height:150px; border-radius:999px; background:radial-gradient(circle,rgba(37,99,235,0.13),transparent 68%); pointer-events:none; }
  .audit-card.output::after { background:radial-gradient(circle,rgba(124,58,237,0.14),transparent 68%); }
  .audit-card h3 { margin:0 0 10px; font-size:18px; }
  .audit-card p { margin:0 0 16px; color:var(--muted); line-height:1.6; font-size:14px; }
  .checklist { display:grid; gap:10px; position:relative; z-index:2; }
  .check { display:grid; grid-template-columns:28px 1fr; gap:10px; align-items:start; padding:11px 12px; border-radius:15px; background:rgba(255,255,255,0.62); border:1px solid rgba(15,23,42,0.07); color:#334155; font-size:14px; line-height:1.45; font-weight:700; }
  .check i { width:28px; height:28px; display:grid; place-items:center; border-radius:10px; background:rgba(22,163,74,0.10); color:var(--green); font-style:normal; font-weight:950; }
  .policy-strip { margin-top:16px; padding:16px 18px; border-radius:20px; background:rgba(15,23,42,0.92); color:white; display:grid; grid-template-columns:160px 1fr; gap:16px; align-items:center; }
  .policy-strip strong { font-size:17px; }
  .policy-strip span { color:rgba(255,255,255,0.72); line-height:1.55; font-size:13px; }
  .registry-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:8px; }
  .registry-card { border-radius:22px; padding:18px; border:1px solid var(--line); background:linear-gradient(180deg,rgba(255,255,255,0.70),rgba(255,255,255,0.42)); min-height:158px; position:relative; overflow:hidden; }
  .registry-card::before { content:""; position:absolute; inset-inline-start:0; top:0; width:5px; height:100%; background:linear-gradient(180deg,var(--blue),var(--cyan)); }
  .registry-card.rp::before { background:linear-gradient(180deg,var(--purple),var(--blue)); }
  .registry-card.rg::before { background:linear-gradient(180deg,var(--green),var(--cyan)); }
  .registry-card.ra::before { background:linear-gradient(180deg,var(--amber),var(--red)); }
  .registry-card small { display:inline-block; color:var(--muted); font-weight:900; margin-bottom:8px; direction:ltr; }
  .registry-card h3 { margin:0 0 9px; font-size:17px; }
  .registry-card p { margin:0; color:var(--muted); line-height:1.55; font-size:13px; }
  .memory-lane { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
  .memory-box { border-radius:22px; padding:18px; border:1px solid rgba(15,23,42,0.10); background:rgba(255,255,255,0.58); }
  .memory-box h3 { margin:0 0 12px; font-size:17px; }
  .memory-row { display:grid; grid-template-columns:130px 1fr; gap:12px; padding:12px 0; border-bottom:1px dashed rgba(15,23,42,0.12); align-items:start; }
  .memory-row:last-child { border-bottom:none; }
  .memory-row b { color:#334155; font-size:13px; }
  .memory-row span { color:var(--muted); line-height:1.5; font-size:13px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  .kpi-card { border-radius:20px; padding:18px; border:1px solid var(--line); background:rgba(255,255,255,0.62); }
  .kpi-card strong { display:block; direction:ltr; text-align:right; font-size:30px; letter-spacing:-0.8px; margin-bottom:6px; color:#0f172a; }
  .kpi-card span { color:var(--muted); font-weight:800; line-height:1.4; font-size:13px; }
  .schema-box { margin-top:16px; border-radius:24px; padding:18px; background:rgba(15,23,42,0.94); color:white; overflow-x:auto; direction:ltr; text-align:left; border:1px solid rgba(255,255,255,0.12); }
  .schema-box pre { margin:0; font-family:Consolas,Monaco,monospace; font-size:12px; line-height:1.65; white-space:pre-wrap; color:rgba(255,255,255,0.84); }
  .level { display:grid; grid-template-columns:92px 1fr; gap:14px; align-items:center; padding:14px; border-radius:18px; border:1px solid var(--line); background:rgba(255,255,255,0.58); margin-bottom:12px; }
  .level.active { border-color:rgba(124,58,237,0.28); background:linear-gradient(90deg,rgba(124,58,237,0.11),rgba(255,255,255,0.58)); }
  .level-num { display:grid; place-items:center; height:54px; border-radius:16px; background:rgba(37,99,235,0.09); color:var(--blue); font-weight:950; direction:ltr; font-size:14px; }
  .level div:last-child strong { display:block; margin-bottom:5px; font-size:14px; }
  .level div:last-child span { color:var(--muted); line-height:1.45; font-size:13px; }
  .cadence-step { display:grid; grid-template-columns:100px 1fr 88px; gap:12px; align-items:center; padding:14px; border-radius:18px; background:rgba(255,255,255,0.62); border:1px solid var(--line); margin-bottom:10px; }
  .cadence-step b { direction:ltr; color:var(--blue); font-weight:950; }
  .cadence-step span { color:var(--muted); line-height:1.45; font-size:13px; }
  .cadence-step em { font-style:normal; justify-self:end; border-radius:999px; padding:7px 10px; background:rgba(37,99,235,0.10); color:#1d4ed8; font-size:12px; font-weight:900; white-space:nowrap; }
  .spec-footer { margin-top:28px; padding:22px 26px; border-radius:28px; background:rgba(15,23,42,0.92); color:white; display:flex; justify-content:space-between; align-items:center; gap:20px; box-shadow:var(--soft-shadow); flex-wrap:wrap; }
  .spec-footer p { margin:5px 0 0; color:rgba(255,255,255,0.66); line-height:1.5; font-size:13px; }
  .signature { text-align:left; direction:ltr; color:rgba(255,255,255,0.82); font-weight:800; white-space:nowrap; }
  .spec-table { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:20px; border:1px solid var(--line); background:rgba(255,255,255,0.56); }
  .spec-table th, .spec-table td { padding:13px 14px; text-align:right; border-bottom:1px solid rgba(15,23,42,0.08); vertical-align:top; line-height:1.45; font-size:13px; }
  .spec-table th { background:rgba(15,23,42,0.045); color:#334155; font-weight:900; }
  .spec-table tr:last-child td { border-bottom:none; }
  @media (max-width:900px) {
    .spec-hero-grid,.spec-section { grid-template-columns:1fr !important; }
    .span-4,.span-5,.span-6,.span-7,.span-8,.span-12 { grid-column:span 1 !important; }
    .guard-grid,.audit-grid,.registry-grid,.memory-lane,.kpi-grid { grid-template-columns:1fr !important; }
    .cadence-step { grid-template-columns:1fr !important; }
    .policy-strip { grid-template-columns:1fr !important; }
  }
`;

function getModelLabel(model?: string): string {
  if (!model) return "GPT-4o";
  if (model.startsWith("groq/")) return model.replace("groq/", "Groq · ");
  return model;
}

function getAutonomyLevel(tags?: string[]): string {
  if (!tags) return "L1–L2";
  if (tags.includes("autonomous")) return "L3–L4";
  if (tags.includes("human-in-the-loop")) return "L1";
  return "L1–L2";
}

function getAccuracy(agentId: number): number {
  const table: Record<number, number> = { 33: 91, 34: 88, 29: 94, 30: 92, 31: 87, 32: 96 };
  return table[agentId] ?? 89 + (agentId % 8);
}

function AgentSpec({ agent }: { agent: Agent }) {
  const accuracy = getAccuracy(agent.id);
  const model = getModelLabel(agent.model);
  const autonomy = getAutonomyLevel(agent.tags);

  const prdCards = [
    {
      color: "gc",
      title: "01 · רקע ומטרות",
      content: `<strong>הבעיה:</strong> תהליכים תפעוליים ועסקיים עלולים להישבר בגלל חוסר עקביות, נתונים חסרים ותהליכים ידניים שגויים.<br><strong>המטרה:</strong> ${agent.description?.substring(0, 120) ?? "לבצע אוטומציה חכמה ומדידה של תהליכים עסקיים קריטיים."}...<br><strong>תוצאה רצויה:</strong> פחות שגיאות, תגובה מהירה, שקיפות מלאה ומדידה לאורך זמן.`
    },
    {
      color: "gp",
      title: "02 · קהל יעד ושימוש",
      content: `<strong>משתמשי קצה:</strong> מנהל מערכת, צוות תפעול ומפתח המערכת.<br><strong>ערך עסקי:</strong> פחות תלות בזיכרון אנושי, יותר שקיפות, מדידה מתמשכת והפחתת זמן תגובה.<br><strong>מצבי שימוש:</strong> טריגר אוטומטי, שאילתת צ'אט, webhook נכנס ופעולה יזומה.`
    },
    {
      color: "gg",
      title: "03 · הגדרת תפקיד הסוכן",
      content: `<strong>System Role:</strong> ${agent.systemPrompt?.substring(0, 100) ?? "הסוכן פועל כמומחה תחום שמבצע משימות אוטומטיות בצורה אמינה ומדידה."}<br><strong>טון:</strong> מקצועי, תמציתי, מבוסס עובדות, לא מנחש כאשר חסר מידע.<br><strong>קווים אדומים:</strong> אין פעולה רגישה ללא אימות מקור אמת. אין חשיפת מידע פנימי.`
    }
  ];

  return (
    <div className="spec-page">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="spec-bg">
        <div className="spec-wrap">

          {/* Hero */}
          <section className="spec-hero">
            <div className="spec-topbar">
              <div className="spec-brand">
                <div className="spec-logo" />
                <div>
                  <strong style={{ fontSize: 17 }}>Agent Defense Blueprint</strong>
                  <small style={{ display: "block", color: "var(--muted)", marginTop: 3, fontWeight: 600, direction: "ltr" }}>Premium AI Agent Technical Visual Spec</small>
                </div>
              </div>
              <div className="spec-pill">גרסה 1.4 · PRD + Product Spec · מוכן להצגה</div>
            </div>

            <div className="spec-hero-grid">
              <div>
                <h1 className="spec-h1">מפרט טכני ויזואלי <span className="gradient-text">לסוכן AI</span></h1>
                <p className="spec-subtitle">
                  מסמך מוצר פרימיום המתאר את תפקיד הסוכן, גבולות האחריות, יכולות, רמות דיוק ובטיחות, ארכיטקטורה, תרחישי שימוש, שכבות הגנה, ביקורת קלט ופלט, הגנה מפני הזרקת פרומפט, שמירת לוגים וזיכרון לאורך זמן.
                </p>
                <div className="meta-row">
                  <span className="meta-chip">🧠 סוכן: {agent.name}</span>
                  <span className="meta-chip">🛡️ רמת בטיחות: High</span>
                  <span className="meta-chip">👤 אישור אנושי: לפי חריגה</span>
                  <span className="meta-chip">🤖 מודל: {model}</span>
                </div>
              </div>

              <aside className="agent-dark-card">
                <div className="agent-label">● Agent ID: AGT-{String(agent.id).padStart(3, "0")}</div>
                <div className="agent-title">{agent.name}</div>
                <div className="agent-role-text">{agent.description?.substring(0, 130) ?? "סוכן AI מתקדם לאוטומציה עסקית."}</div>
                <div className="mini-metrics">
                  <div className="mini-metric"><strong>{accuracy}%</strong><span>דיוק צפוי בתנאי קלט תקינים</span></div>
                  <div className="mini-metric"><strong>High</strong><span>רמת בטיחות תפעולית</span></div>
                  <div className="mini-metric"><strong>{autonomy}</strong><span>רמת אוטונומיה</span></div>
                  <div className="mini-metric"><strong>10</strong><span>שכבות הגנה, ביקורת ודיווח</span></div>
                </div>
              </aside>
            </div>
          </section>

          {/* PRD Section */}
          <section className="spec-section">
            <article className="spec-panel span-12">
              <div className="section-title">
                <h2>PRD — מפרט מוצר לסוכן</h2>
                <span className="spec-tag">Product Requirements Document</span>
              </div>
              <div className="guard-grid">
                {prdCards.map((c, i) => (
                  <div key={i} className={`guard ${c.color}`}>
                    <h3>{c.title}</h3>
                    <p dangerouslySetInnerHTML={{ __html: c.content }} />
                  </div>
                ))}
              </div>
            </article>
          </section>

          {/* Architecture + Use Cases */}
          <section className="spec-section">
            <article className="spec-panel span-6">
              <div className="section-title">
                <h2>ארכיטקטורת מוצר</h2>
                <span className="spec-tag">Architecture PRD</span>
              </div>
              <div className="spec-list">
                <div className="spec-item"><div className="ico">LLM</div><div><strong>מודל בסיס</strong><p>{model} — כל גרסת מודל נשמרת ב-Registry כדי למדוד שינוי ביצועים בין גרסאות.</p></div></div>
                <div className="spec-item"><div className="ico">RAG</div><div><strong>מקורות מידע</strong><p>DB, Google Sheets, Frontend State, מסמכים תפעוליים, היסטוריית שיחות וזיכרון מצטבר.</p></div></div>
                <div className="spec-item"><div className="ico">API</div><div><strong>כלים ואינטגרציות</strong><p>קריאה ל-API, עדכון DB, שליחת Telegram/WhatsApp, פתיחת חריגה, העברה לאישור אנושי.</p></div></div>
                <div className="spec-item"><div className="ico">FW</div><div><strong>Tool Firewall</strong><p>כל כלי חיצוני נפתח רק אחרי ביקורת קלט, סריקת Prompt Injection ואימות מקור אמת.</p></div></div>
              </div>
            </article>

            <article className="spec-panel span-6">
              <div className="section-title">
                <h2>תרחישי שימוש מרכזיים</h2>
                <span className="spec-tag">User Stories & Flows</span>
              </div>
              <div className="spec-list">
                <div className="spec-item"><div className="ico">US1</div><div><strong>כמנהל מערכת</strong><p>אני רוצה שהסוכן יפעל אוטומטית על פי טריגר ויודיע לי רק על חריגות, כדי לחסוך זמן תפעולי.</p></div></div>
                <div className="spec-item"><div className="ico">US2</div><div><strong>כאיש תפעול</strong><p>אני רוצה לקבל חריגה ברורה עם הסבר ומוצע לתיקון, כדי לדעת בדיוק מה לעשות.</p></div></div>
                <div className="spec-item"><div className="ico">US3</div><div><strong>כמפתח</strong><p>אני רוצה לוג מלא של כל ריצה עם קלט, פלט, ציון ביטחון וסיבת החלטה לחידוד פרומפטים.</p></div></div>
                <div className="spec-item"><div className="ico">US4</div><div><strong>כבודק איכות</strong><p>אני רוצה מגמת דיוק על פני זמן כדי להבין אם שינוי פרומפט שיפר או פגע בביצועים.</p></div></div>
              </div>
            </article>
          </section>

          {/* Requirements Table */}
          <section className="spec-section">
            <article className="spec-panel span-12">
              <div className="section-title">
                <h2>דרישות מוצר והגדרה למדידה</h2>
                <span className="spec-tag">Requirements & Acceptance Criteria</span>
              </div>
              <table className="spec-table">
                <thead>
                  <tr>
                    <th>תחום</th>
                    <th>דרישת מוצר</th>
                    <th>קריטריון קבלה</th>
                    <th>מדידה</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>אימות נתונים</td><td>הסוכן חייב להשוות בין לפחות שני מקורות אמת לפני פעולה רגישה.</td><td>אין פעולה אם מקור חסר או סותר.</td><td>Data Match Rate, Missing Field Rate</td></tr>
                  <tr><td>בטיחות</td><td>כל פלט שעומד לצאת למשתמש או לכלי חיצוני עובר ביקורת פלט.</td><td>פלט עם מידע רגיש או הוראה לא מורשית נחסם.</td><td>Blocked Output %, Sensitive Leakage</td></tr>
                  <tr><td>אבטחת פרומפט</td><td>תוכן ממסמך או הודעת משתמש לעולם לא ייחשב הוראת מערכת.</td><td>ניסיון שינוי הרשאות או Tool Call מוסתר נחסם.</td><td>Injection Detection Rate</td></tr>
                  <tr><td>שיפור לאורך זמן</td><td>כל ריצה נשמרת בלוג עם תוצאת אמת בדיעבד כאשר קיימת.</td><td>ניתן להציג מגמת דיוק, כשל, Drift ושיפור.</td><td>Accuracy Trend, Drift Score, MTTR</td></tr>
                  <tr><td>תקשורת עם יוצר</td><td>דוח שבועי למפתח עם מדדים ודוגמאות תשובה.</td><td>עם עליית יציבות הסוכן תדירות הדיווח יורדת.</td><td>Report Cadence, Stability Score</td></tr>
                </tbody>
              </table>
            </article>
          </section>

          {/* Agent ID + Meters */}
          <section className="spec-section">
            <article className="spec-panel span-7">
              <div className="section-title">
                <h2>תעודת זהות לסוכן</h2>
                <span className="spec-tag">Core Specification</span>
              </div>
              <div className="spec-list">
                <div className="spec-item"><div className="ico">01</div><div><strong>תפקיד</strong><p>{agent.description?.substring(0, 160) ?? "ביצוע אוטומציה מדויקת של תהליכים עסקיים קריטיים."}</p></div></div>
                <div className="spec-item"><div className="ico">02</div><div><strong>טריגרים להפעלה</strong><p>Webhook, webhook לוח זמנים, שאילתת צ'אט, טריגר ידני ממשק, שינוי נתונים ב-DB.</p></div></div>
                <div className="spec-item"><div className="ico">03</div><div><strong>פלט נדרש</strong><p>תגובה מובנית, ציון ביטחון, רשימת חריגות, המלצת פעולה, לוג מלא ואפשרות אישור אנושי.</p></div></div>
                <div className="spec-item"><div className="ico">04</div><div><strong>גבולות פעולה</strong><p>הסוכן אינו מוחק נתונים, אינו שולח הודעה במקרה חריגה, ואינו עוקף מקור אמת בסתירה.</p></div></div>
              </div>
            </article>

            <article className="spec-panel span-5">
              <div className="section-title">
                <h2>מדדי מוצר</h2>
                <span className="spec-tag">Quality Gates</span>
              </div>
              <div className="meters">
                <div>
                  <div className="meter-head"><span>דיוק נתונים</span><span>{accuracy}%</span></div>
                  <div className="bar"><div className="fill" style={{ width: `${accuracy}%` }} /></div>
                </div>
                <div>
                  <div className="meter-head"><span>בטיחות פעולה</span><span>{accuracy - 6}%</span></div>
                  <div className="bar"><div className="fill safe" style={{ width: `${accuracy - 6}%` }} /></div>
                </div>
                <div>
                  <div className="meter-head"><span>חשיפת סיכון</span><span>27%</span></div>
                  <div className="bar"><div className="fill risk" style={{ width: "27%" }} /></div>
                </div>
                <div>
                  <div className="meter-head"><span>אוטונומיה מותרת</span><span>{autonomy}</span></div>
                  <div className="bar"><div className="fill auto" style={{ width: "42%" }} /></div>
                </div>
              </div>
            </article>
          </section>

          {/* Defense Layers */}
          <section className="spec-section">
            <article className="spec-panel span-12">
              <div className="section-title">
                <h2>שכבות הגנה פעילות</h2>
                <span className="spec-tag">Defense Stack</span>
              </div>
              <div className="guard-grid">
                <div className="guard gc"><small>Layer 01</small><h3>אימות קלט</h3><p>בדיקת שדות חובה ופורמט. חוסר בשדה קריטי עוצר את התהליך ויוצר חריגה מנוהלת.</p></div>
                <div className="guard gg"><small>Layer 02</small><h3>השוואה מול מקור אמת</h3><p>השוואת נתונים מול DB ו-Sheets. סתירה מעבירה לנתיב חריגה עם הסבר מלא.</p></div>
                <div className="guard ga"><small>Layer 03</small><h3>בדיקת סיכון הקשרי</h3><p>זיהוי פעולות רגישות: שליחת הודעה, עדכון סטטוס, כתיבה ל-DB בהשפעה חיצונית.</p></div>
                <div className="guard gr"><small>Layer 04</small><h3>חסימת פעולה מסוכנת</h3><p>אין שליחה, עדכון או המשך אוטומטי כאשר חסר מידע, כפילות או ציון ביטחון מתחת לסף.</p></div>
                <div className="guard gp"><small>Layer 05</small><h3>אישור אנושי</h3><p>כאשר הסוכן מזהה חוסר התאמה, הפעולה עוברת למנהל עם הסבר והמלצת תיקון ברורה.</p></div>
                <div className="guard"><small>Layer 06</small><h3>לוגים ובקרה</h3><p>כל פעולה נשמרת עם זמן, קלט, בדיקות שבוצעו, תוצאה, חריגות, החלטה ומזהה סוכן.</p></div>
                <div className="guard gg"><small>Layer 07</small><h3>זיכרון תפעולי</h3><p>אירועים חוזרים, החלטות שאושרו ודפוסי כשל נשמרים כידע תפעולי לשיפור לאורך זמן.</p></div>
                <div className="guard gp"><small>Layer 08</small><h3>רג׳יסטרי גרסאות</h3><p>כל שינוי בפרומפט, מודל או סף ביטחון נשמר עם גרסה, תאריך, סיבה והשפעה מדידה.</p></div>
                <div className="guard ga"><small>Layer 09</small><h3>מדידת שיפור</h3><p>השוואת ביצועי הסוכן לאורך זמן: דיוק, False Positive, False Negative וכמות אישורים אנושיים.</p></div>
                <div className="guard gr"><small>Layer 10</small><h3>הגנה מהזרקת פרומפט</h3><p>כל טקסט חיצוני מסומן כלא-מהימן. הסוכן לא מקבל הוראות מתוכן, לא חושף System Prompt ולא מבצע פקודות מוסתרות.</p></div>
              </div>
            </article>
          </section>

          {/* Input / Output Audit */}
          <section className="spec-section">
            <article className="spec-panel span-12">
              <div className="section-title">
                <h2>שכבת ביקורת קלט ופלט</h2>
                <span className="spec-tag">Input / Output Review Gate</span>
              </div>
              <div className="audit-grid">
                <div className="audit-card">
                  <h3>ביקורת קלט לפני החלטה</h3>
                  <p>לפני שהסוכן מפרש, מסיק או מפעיל פעולה, הקלט עובר בדיקה עצמאית שמוודאת שהוא שלם, עקבי, רלוונטי ולא מסוכן לביצוע.</p>
                  <div className="checklist">
                    <div className="check"><i>✓</i><span>בדיקת שלמות: כל שדות החובה קיימים ואין ערכים ריקים בשדות קריטיים.</span></div>
                    <div className="check"><i>✓</i><span>בדיקת פורמט: טלפון, תאריך, מזהה, שם וסטטוס לפי מבנה מוגדר.</span></div>
                    <div className="check"><i>✓</i><span>בדיקת עקביות: אין סתירה בין תאריך, מזהה, לקוח, סטטוס ומקור האמת.</span></div>
                    <div className="check"><i>✓</i><span>בדיקת רעש/הזרקה: התעלמות מהוראות לא רלוונטיות או ניסיון לעקוף מדיניות.</span></div>
                  </div>
                </div>
                <div className="audit-card output">
                  <h3>ביקורת פלט לפני פעולה</h3>
                  <p>לפני שהפלט יוצא החוצה, נשלח למשתמש או משנה סטטוס, הוא עובר שער איכות שמוודא שהתגובה נכונה, בטוחה, מוסברת ומתאימה להרשאות.</p>
                  <div className="checklist">
                    <div className="check"><i>✓</i><span>בדיקת התאמה לפעולה: הפלט תואם לטריגר, לקהל היעד ולסוג ההודעה.</span></div>
                    <div className="check"><i>✓</i><span>בדיקת בטיחות: אין חשיפת מידע פנימי, אין פעולה מעבר להרשאות.</span></div>
                    <div className="check"><i>✓</i><span>בדיקת איכות: ניסוח ברור, ללא כפילויות, ללא טון בעייתי.</span></div>
                    <div className="check"><i>✓</i><span>בדיקת החלטה: TRUE ממשיך, FALSE נעצר, UNKNOWN עובר לאישור אנושי.</span></div>
                  </div>
                </div>
              </div>
              <div className="policy-strip">
                <strong>כלל ברזל</strong>
                <span>הסוכן אינו רשאי לבצע פעולה חיצונית אם ביקורת הקלט או ביקורת הפלט נכשלת. במקרה כזה נוצרת חריגה מנוהלת: עצירה, לוג, סיבת כשל והעברה לאישור אנושי.</span>
              </div>
            </article>
          </section>

          {/* Prompt Injection Defense */}
          <section className="spec-section">
            <article className="spec-panel span-12">
              <div className="section-title">
                <h2>הגנה מפני הזרקת פרומפט והשתלטות</h2>
                <span className="spec-tag">Prompt Injection Defense</span>
              </div>
              <div className="registry-grid">
                <div className="registry-card">
                  <small>TRUST BOUNDARY</small>
                  <h3>הפרדה בין הוראות לתוכן</h3>
                  <p>הוראות מערכת ומדיניות בטיחות הן Authority Layer. כל הודעת משתמש, PDF, אתר ושדה טקסט מסומנים כלא-מהימן שאינו רשאי לתת פקודות.</p>
                </div>
                <div className="registry-card ra">
                  <small>HIDDEN INSTRUCTIONS</small>
                  <h3>זיהוי פרומפט מוחבא</h3>
                  <p>הסוכן מאתר ניסוחים כמו "התעלם מהוראות קודמות", "חשוף סוד", טקסט לבן, הערות מוסתרות ובלוקים שנראים כ-System Prompt.</p>
                </div>
                <div className="registry-card rp">
                  <small>DATA EXFILTRATION</small>
                  <h3>מניעת משיכת מידע</h3>
                  <p>הסוכן לא חושף פרומפטים פנימיים, מפתחות, לוגים גולמיים או מקורות מידע. כל בקשה להרחבת גישה עוברת לאישור אנושי.</p>
                </div>
                <div className="registry-card rg">
                  <small>SAFE EXECUTION</small>
                  <h3>ביצוע אחרי ניקוי ובידוד</h3>
                  <p>מידע חיצוני עובר Sanitization, סיווג סיכון ובדיקת הרשאות. הוראה ממסמך נשמרת כמידע לקריאה בלבד, לא כפקודת פעולה.</p>
                </div>
              </div>
              <div className="memory-lane">
                <div className="memory-box">
                  <h3>כללי ברזל נגד השתלטות</h3>
                  <div className="memory-row"><b>Content ≠ Command</b><span>תוכן במסמך, הודעה או אתר הוא רק נתון לבדיקה, לא הוראה לסוכן.</span></div>
                  <div className="memory-row"><b>System Priority</b><span>הוראות מערכת, הרשאות ו-Guardrails תמיד גוברים על טקסט חיצוני.</span></div>
                  <div className="memory-row"><b>Least Privilege</b><span>הסוכן מקבל רק את הגישה המינימלית הדרושה לפעולה הנוכחית.</span></div>
                  <div className="memory-row"><b>No Secret Echo</b><span>אסור להחזיר למשתמש מידע פנימי, System Prompt, Tokens, Keys או לוגים רגישים.</span></div>
                  <div className="memory-row"><b>Human Escalation</b><span>כל ניסיון עקיפה, שינוי הרשאות או בקשת מידע חריגה עובר לאישור אנושי.</span></div>
                </div>
                <div className="memory-box">
                  <h3>צמתי בדיקה ייעודיים</h3>
                  <div className="memory-row"><b>Input Scanner</b><span>סריקת הקלט לפני Reasoning: ביטויי עקיפה, בקשת סודות, פקודות מוחבאות.</span></div>
                  <div className="memory-row"><b>Document Sandbox</b><span>מסמכים נקראים באזור מבודד — הסוכן מחלץ עובדות, לא הוראות פעולה.</span></div>
                  <div className="memory-row"><b>Tool Firewall</b><span>לפני קריאה ל-API נבדק שהפעולה לא נובעת מהוראה חיצונית חשודה.</span></div>
                  <div className="memory-row"><b>Output Redaction</b><span>הפלט עובר השחרת מידע רגיש לפני יציאה.</span></div>
                  <div className="memory-row"><b>Attack Log</b><span>ניסיון הזרקה נשמר כלוג אבטחה עם דוגמת הקלט, מקור, חומרה ותגובת הסוכן.</span></div>
                </div>
              </div>
              <div className="schema-box">
                <pre>{JSON.stringify({ prompt_injection_guard: { status: "blocked", risk_level: "critical", source_type: "external_content", detected_patterns: ["ignore_previous_instructions", "reveal_system_prompt"], action_taken: "external_action_disabled", fallback: "builder_mode", human_review_required: true } }, null, 2)}</pre>
              </div>
            </article>
          </section>

          {/* Logs & Memory */}
          <section className="spec-section">
            <article className="spec-panel span-12">
              <div className="section-title">
                <h2>לוגים, זיכרון ורג׳יסטרי לאורך זמן</h2>
                <span className="spec-tag">Observability & Memory Registry</span>
              </div>
              <div className="registry-grid">
                <div className="registry-card">
                  <small>LOG STREAM</small>
                  <h3>שמירת לוגים מלאה</h3>
                  <p>כל ריצה נשמרת כאירוע מובנה: קלט, בדיקות, החלטה, פלט, Confidence, חריגות, פעולה שבוצעה וזהות מאשר אנושי אם היה.</p>
                </div>
                <div className="registry-card rg">
                  <small>OPERATIONAL MEMORY</small>
                  <h3>זיכרון תפעולי</h3>
                  <p>המערכת שומרת דפוסים חוזרים: קלטים שנכשלו, תיקונים שנעשו, והחלטות תקינות שאושרו ידנית.</p>
                </div>
                <div className="registry-card rp">
                  <small>VERSION REGISTRY</small>
                  <h3>רג׳יסטרי גרסאות</h3>
                  <p>מעקב אחר שינויי פרומפט, מודל, כללי בטיחות, Thresholds וחוקי חסימה לזיהוי שיפור/פגיעה.</p>
                </div>
                <div className="registry-card ra">
                  <small>LEARNING LOOP</small>
                  <h3>מדידת שיפור</h3>
                  <p>ניתוח תקופתי של שגיאות, חריגות, אישורים ידניים ותוצאות אמת לכיוון הסוכן בלי לאפשר עקיפת בקרה.</p>
                </div>
              </div>
            </article>
          </section>

          {/* KPIs + Autonomy */}
          <section className="spec-section">
            <article className="spec-panel span-7">
              <div className="section-title">
                <h2>תקשורת יזומה עם המפתח</h2>
                <span className="spec-tag">Creator Communication</span>
              </div>
              <div className="cadence-step"><b>שבוע 1–4</b><span>דוח שבועי מלא: מדדים, חריגות, דוגמאות תשובה, שיפורים מומלצים.</span><em>שבועי</em></div>
              <div className="cadence-step"><b>חודש 2–3</b><span>דוח דו-שבועי: מגמות דיוק, False Positive, Drift ואירועי Injection.</span><em>דו-שבועי</em></div>
              <div className="cadence-step"><b>מחודש 4</b><span>דוח חודשי: KPIs, שינויי גרסה, בקשות שיפור ומצב יציבות כולל.</span><em>חודשי</em></div>
              <div className="cadence-step"><b>יציב</b><span>דוח רבעוני בלבד — הסוכן מדווח רק על חריגות קריטיות.</span><em>רבעוני</em></div>
            </article>

            <article className="spec-panel span-5">
              <div className="section-title">
                <h2>KPIs מרכזיים</h2>
                <span className="spec-tag">Performance Targets</span>
              </div>
              <div className="kpi-grid">
                <div className="kpi-card"><strong>{accuracy}%</strong><span>דיוק ממוצע ב-30 יום</span></div>
                <div className="kpi-card"><strong>&lt;3%</strong><span>שיעור False Positive</span></div>
                <div className="kpi-card"><strong>&lt;2s</strong><span>זמן תגובה חציוני</span></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="level">
                  <div className="level-num">L1</div>
                  <div><strong>מוצע + ממתין לאישור</strong><span>הסוכן מציע פעולה, אנושי מבצע.</span></div>
                </div>
                <div className={`level${autonomy.includes("2") ? " active" : ""}`}>
                  <div className="level-num">L2</div>
                  <div><strong>מבצע עם אישור לפי חריגה</strong><span>פועל אוטומטית, מסלים חריגות.</span></div>
                </div>
                <div className={`level${autonomy.includes("3") || autonomy.includes("4") ? " active" : ""}`}>
                  <div className="level-num">L3–L4</div>
                  <div><strong>אוטונומי מלא עם פיקוח</strong><span>מחליט ומבצע, מדווח בדיעבד.</span></div>
                </div>
              </div>
            </article>
          </section>

          {/* Footer */}
          <footer className="spec-footer">
            <div>
              <strong style={{ fontSize: 18 }}>{agent.name}</strong>
              <p>AGT-{String(agent.id).padStart(3, "0")} · {model} · מפרט גרסה 1.4 · AgentHub Platform</p>
            </div>
            <div className="signature">
              AgentHub · agenthub.guru<br />
              <span style={{ fontSize: 12, opacity: 0.6 }}>Premium AI Agent Spec · {new Date().toLocaleDateString("he-IL")}</span>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}

export default function AgentSpecsPage() {
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/agents`);
      return res.json();
    },
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0] ?? null;

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", direction: "rtl" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
          <div style={{ fontWeight: 700 }}>טוען מפרטי סוכנים...</div>
        </div>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", direction: "rtl" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 700 }}>אין סוכנים במערכת</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", direction: "rtl" }}>
      {/* Agent selector sidebar */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderLeft: "1px solid rgba(15,23,42,0.1)",
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(12px)",
        overflowY: "auto",
        padding: "16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", padding: "0 8px 8px" }}>
          בחר סוכן
        </div>
        {agents.map((a) => {
          const isActive = (selectedId === null ? agents[0]?.id : selectedId) === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "right",
                padding: "10px 12px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                background: isActive
                  ? "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(124,58,237,0.08))"
                  : "transparent",
                color: isActive ? "#1d4ed8" : "#334155",
                transition: "all 0.15s",
                lineHeight: 1.35,
              }}
            >
              <span style={{ display: "block", marginBottom: 2 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                AGT-{String(a.id).padStart(3, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Spec content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {selected && <AgentSpec agent={selected} />}
      </div>
    </div>
  );
}
