# DEPLOY — פריסת AgentHub ב-Render (Runbook)

הפריסה בפועל: **Render, ללא Docker**, לפי `render.yaml`. מסד הנתונים ב-**Neon**.
(מסמכי Railway / Docker / Caddy הישנים הוסרו — הם לא משקפים את המצב.)

## ארכיטקטורה
```
משתמש ──▶ agenthub-guru-claude (Static Site — artifacts/agent-hub)
             ├── /api/*  ──rewrite──▶ agenthub-guru-claude-api (Node — artifacts/api-server) ──▶ Neon Postgres
             └── /*      ──▶ index.html (SPA)
```
ה-rewrite שומר origin אחד, ולכן עוגיית ההתחברות היא first-party.

## פריסה רגילה
- כל push ל-`main` אמור לפרוס את שני השירותים (`autoDeploy: true`).
- לפני כן רץ ב-GitHub ה-workflow
  `ci`
  (typecheck, בנייה, בדיקות). אדום = לא לפרוס.
- **אם Render לא פרס** (האתר נשאר על גרסה ישנה):
  Render Dashboard ▸ השירות ▸ **Manual Deploy ▸ Deploy latest commit** — לשני השירותים.
  אם זה חוזר: Settings ▸ Build & Deploy ▸ ודא ש-Auto-Deploy מופעל ושהריפו מחובר.

## בדיקות אחרי פריסה
```bash
curl https://agenthub-guru-claude-api.onrender.com/api/healthz/db
```
מצופה: `{"status":"ok","db":"ok",...}`. ‏503 = ה-API חי אבל אין חיבור למסד.
- עמוד הבית נטען ומציג את שער הכניסה.
- התחברות עובדת. אחרי 8 ניסיונות שגויים מאותה כתובת: 429 למשך 15 דקות.

## סכימת מסד הנתונים
הסכימה ב-`lib/db/src/schema`. אין מיגרציות — יש `drizzle-kit push`, ו**הוא לא רץ אוטומטית בפריסה**
(בכוונה: push לא-אינטראקטיבי יכול למחוק עמודות). אחרי שינוי סכימה:
1. צור ב-Neon branch לגיבוי.
2. מקומית, מול ה-DATABASE_URL של פרודקשן:
   ```bash
   pnpm --filter @workspace/db run push
   ```
3. קרא את מה ש-drizzle מציג לפני אישור. אם הוא מציע מחיקה — עצור.

## משתני סביבה (שירות ה-API)
חובה: `DATABASE_URL`, `SESSION_SECRET`, `APP_ACCESS_PASSWORD` (+ `AOR_ACCESS_PASSWORD`).
אופציונלי (הפיצ'ר כבוי בלעדיהם):
| משתנה | מה הוא עושה |
|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` | בוט טלגרם והתראות |
| `TELEGRAM_MINIAPP_USER_IDS` | מזהי משתמשי טלגרם (פסיקים) שמורשים במיני-אפליקציות `/gever` `/jarvis`. ריק = מזהי הצ'אט של המנהלים |
| `EMAIL_INBOUND_SECRET` | כשמוגדר, `/api/email/inbound` דורש כותרת `x-inbound-secret` |
| `FRONTEND_ORIGIN` | דומיין נוסף ל-CORS |
| `GITHUB_TOKEN` | כוכבי GitHub בעמוד הקוד הפתוח |
| `RESEND_*`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `WHATSAPP_*`, `N8N_BASE_URL`, `OLLAMA_*` | אינטגרציות |

## שמירה על השרת ער (free plan)
- השרת עושה self-ping כל 4 דק' ל-`/api/healthz/db` (מעיר גם את Neon).
- workflow
  `keep-alive`
  ב-GitHub כל 5 דק'. GitHub משהה workflows מתוזמנים אחרי 60 יום בלי פעילות בריפו — אם הפינג נעלם, הפעל מחדש ב-Actions.

## בנייה מקומית ב-Windows
ה-workspace נעול לבינארים של Linux, ולכן `vite build` נכשל מקומית ב-Windows.
אם צריך: התקן בתיקייה זמנית את
`@rollup/rollup-win32-x64-msvc`, `lightningcss-win32-x64-msvc`, `@tailwindcss/oxide-win32-x64-msvc`
(באותן גרסאות), הגדר `NODE_PATH` אליה, ובגיט-באש הוסף `MSYS_NO_PATHCONV=1` כדי ש-`BASE_PATH=/` לא יהפוך לנתיב Windows.

## ידוע ופתוח
- Google Sheets דרך `@replit/connectors-sdk` עובד רק ב-Replit — סנכרון גיליונות (palgate / sheets-reader) לא יעבוד ב-Render עד מעבר ל-Service Account.
- `artifacts/agent-hub-mobile`, `client-intake`, `ops-guide`, `product-review`, `study-listener` לא נפרסים.
