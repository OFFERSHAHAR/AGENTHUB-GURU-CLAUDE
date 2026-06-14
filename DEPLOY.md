# DEPLOY — פריסת ההאב ל-Railway (Runbook)

מסמך הפעלה לפריסת ה-monorepo (agent-hub + api-server + Postgres) מחוץ ל-Replit.
כל קבצי הפריסה כבר מוכנים בריפו: `Dockerfile`, `deploy/Caddyfile`, `deploy/start.sh`,
`railway.json`, `.dockerignore`, `.env.example`.

## ארכיטקטורה
```
                 ┌────────────────── קונטיינר אחד ──────────────────┐
משתמש ──HTTPS──▶ │  Caddy ( :$PORT )                                 │
                 │   ├── /api/*  ──▶ api-server (node, :5000)  ──▶ Postgres
                 │   └── /*      ──▶ קבצים סטטיים (agent-hub SPA)     │
                 └──────────────────────────────────────────────────┘
```
ה-frontend קורא ל-API ב-origin יחסי (`/api`), לכן Caddy מאחד את שניהם לדומיין אחד.

## דרישות מקדימות
- חשבון Railway + טוקן (Account Settings → Tokens) — או Railway CLI מחובר.
- הסודות מ-`.env.example` (לפחות החובה).
- DB ייווצר ע"י תוסף Postgres של Railway.

## שלבים

### 1. ריפו ל-Git (Railway פורס מ-Git או מ-Docker)
```bash
cd Review-Metrics-Roadmap
git init && git add . && git commit -m "deploy: railway docker setup"
# דחוף ל-GitHub (פרטי) או השתמש ב-`railway up` מקומי
```

### 2. יצירת פרויקט + Postgres
- ב-Railway: New Project → Deploy from Repo (או `railway init`).
- Add → Database → **PostgreSQL**. Railway יספק `DATABASE_URL` כמשתנה משותף.

### 3. הזרקת משתני סביבה
- העתק את הערכים מ-`.env.example` ל-Variables של השירות.
- `DATABASE_URL` — קשר ל-Postgres שנוצר (Reference Variable).
- אל תגדיר `PORT` ידנית — Railway מזריק; Caddy משתמש בו אוטומטית.

### 4. פריסה
- Railway יזהה את `Dockerfile` (דרך `railway.json`) ויבנה. הבנייה רצה ב-Linux —
  כך נפתר ה-pinning ל-linux-x64.
- בדוק לוגים: `[start] api-server` ואז `[start] Caddy מאזין`.

### 5. דחיפת סכימת DB (פעם ראשונה)
מתוך shell של הפריסה או מקומית מול ה-DATABASE_URL:
```bash
pnpm --filter @workspace/db run push
```

### 6. דומיין
- Railway → Settings → Networking → Generate Domain (או Custom Domain).
- עדכן `APP_BASE_URL` לכתובת הסופית.

## ✅ בדיקות קבלה
- [ ] עמוד הבית של ההאב נטען
- [ ] קריאת `/api/...` מחזירה JSON (לא דף ה-SPA)
- [ ] התחברות/שער גישה עובד
- [ ] אין שגיאות DB בלוגים

## ⚠️ נקודות לתשומת לב
1. **Google Sheets (שלב 2):** `@replit/connectors-sdk` הוא Replit-only — מסלולי
   Sheets (telegram.ts, sheets-reader, palgate) ייכשלו עד שנחליף ל-Google
   Service Account. שאר המערכת תעבוד.
2. **נתיבי backend לא תחת /api:** ב-`deploy/Caddyfile` יש רשימת נתיבים נוספים
   (/healthz, /webhooks, /telegram). ודא מול הקוד והתאם אם צריך.
3. **lockfile drift:** אם `pnpm install --frozen-lockfile` נכשל בבנייה — שנה ב-Dockerfile
   ל-`--no-frozen-lockfile`.
4. **minimumReleaseAge=1440** ב-pnpm-workspace — בנייה רגילה לא מושפעת (חבילות ישנות).

## מסלול Render (Blueprint) — היעד הנבחר ✅
קובץ `render.yaml` כבר מגדיר הכל: שירות Docker + Postgres מנוהל + משתני הסביבה.

1. **דחיפת הקוד ל-GitHub** (Render פורס מ-Git):
   ```bash
   cd Review-Metrics-Roadmap
   rm -rf .git                       # מנקה את ה-remotes הישנים של Replit
   git init && git add . && git commit -m "deploy: render blueprint"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. **Render Dashboard** → **New** → **Blueprint** → חבר את הריפו → Render קורא `render.yaml`.
3. מלא את הסודות המסומנים `sync: false` (RESEND, TELEGRAM, OPENAI, סיסמאות...).
   `DATABASE_URL` ו-`SESSION_SECRET` נוצרים אוטומטית.
4. **Apply** → Render בונה (Docker, ב-Linux) ופורס. עקוב אחרי הלוגים.
5. **db push** — מתוך Render Shell של השירות: `pnpm --filter @workspace/db run push`
6. דומיין: Render נותן `*.onrender.com`; עדכן `APP_BASE_URL`. (אפשר דומיין מותאם.)

### הערות Render
- `plan: free` ל-DB פג אחרי 90 יום — לפרודקשן שדרג ל-`starter`.
- שירות Docker דורש plan בתשלום (starter); free לא תומך ב-Docker רציף.
- Render מזריק `PORT` → Caddy מאזין עליו אוטומטית.

## חלופות נוספות
- **Railway:** `railway.json` קיים; New Project → Repo + תוסף Postgres.
- **Fly.io:** `fly launch` עם ה-Dockerfile; Postgres דרך `fly postgres`.
