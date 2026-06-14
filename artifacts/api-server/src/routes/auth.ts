import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";

const router: IRouter = Router();

const COOKIE_NAME = "ah_auth";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// המזהה הפנימי "eli" מייצג את עופר (משמש לשיוך בעלות לקוחות בכל ה-frontend).
// שם התצוגה הוא "עופר". לא לשנות את המזהה הפנימי בלי מיגרציה של ownerUser ב-DB.
type Username = "eli" | "aor";

const USERS: { username: Username; displayName: string; getPassword: () => string }[] = [
  { username: "eli", displayName: "עופר", getPassword: () => process.env.APP_ACCESS_PASSWORD ?? "" },
  { username: "aor", displayName: "אור", getPassword: () => process.env.AOR_ACCESS_PASSWORD ?? "" },
];

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    maxAge: MAX_AGE_MS,
    path: "/",
  };
}

function passwordMatches(input: string, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function findUser(password: string): { username: Username; displayName: string } | null {
  for (const u of USERS) {
    const pw = u.getPassword();
    if (pw && passwordMatches(password, pw)) {
      return { username: u.username, displayName: u.displayName };
    }
  }
  return null;
}

function getUserInfo(cookieVal: string | undefined): { authenticated: boolean; user: Username | null; displayName: string | null } {
  if (!cookieVal) return { authenticated: false, user: null, displayName: null };
  const found = USERS.find((u) => u.username === cookieVal);
  if (found) return { authenticated: true, user: found.username, displayName: found.displayName };
  // Legacy: old cookie value was "1" — treat as "eli" (=עופר)
  if (cookieVal === "1") return { authenticated: true, user: "eli", displayName: "עופר" };
  return { authenticated: false, user: null, displayName: null };
}

router.get("/auth/session", (req, res) => {
  const configured = Boolean(process.env.APP_ACCESS_PASSWORD);
  const cookieVal = req.signedCookies?.[COOKIE_NAME] as string | undefined;
  const info = getUserInfo(cookieVal);
  res.json({ authenticated: info.authenticated, configured, user: info.user, displayName: info.displayName });
});

router.post("/auth/login", (req, res) => {
  const configured = USERS.some((u) => u.getPassword());
  if (!configured) {
    res.status(503).json({ error: "auth_not_configured" });
    return;
  }
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    res.status(400).json({ error: "missing_password" });
    return;
  }
  const matched = findUser(password);
  if (!matched) {
    res.status(401).json({ error: "invalid_password" });
    return;
  }
  res.cookie(COOKIE_NAME, matched.username, cookieOptions());
  res.json({ authenticated: true, user: matched.username, displayName: matched.displayName });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  res.json({ authenticated: false });
});

export default router;
