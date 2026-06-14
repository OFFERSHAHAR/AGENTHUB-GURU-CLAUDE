/**
 * RPA Engine — HTTP Session Simulator
 * Connects to legacy systems without official APIs via browser-session emulation.
 * Supports PAL GAT, OPTIMA Cloud, and any generic web-form system.
 */

export type SystemType = "palgat" | "optima" | "priority" | "generic_form" | "hashavshevet";

export interface SessionState {
  cookies: Record<string, string>;
  headers: Record<string, string>;
  loggedIn: boolean;
  lastActivity: number;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  rawHtml?: string;
  /** Set when the system answered the login with a two-factor challenge and a
   * one-time code is required to complete the sign-in (attended login). */
  needsTwoFactor?: boolean;
}

const sessions = new Map<number, SessionState>();

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = val;
  }
  return result;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeSession(existing: SessionState, newCookies: Record<string, string>): SessionState {
  return {
    ...existing,
    cookies: { ...existing.cookies, ...newCookies },
    lastActivity: Date.now(),
  };
}

// ─── Base fetch with session ─────────────────────────────────────────────────

async function sessionFetch(
  connId: number,
  url: string,
  opts: RequestInit & { followRedirects?: boolean } = {}
): Promise<{ response: Response; text: string; newSession: SessionState }> {
  const session = sessions.get(connId) ?? {
    cookies: {},
    headers: {},
    loggedIn: false,
    lastActivity: Date.now(),
  };

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    ...(session.headers ?? {}),
    ...(opts.headers as Record<string, string> ?? {}),
  };

  if (Object.keys(session.cookies).length > 0) {
    headers["Cookie"] = cookieHeader(session.cookies);
  }

  const response = await fetch(url, {
    ...opts,
    headers,
    redirect: "follow",
  });

  const setCookies = response.headers.getSetCookie?.() ?? [];
  const newCookies = parseCookies(setCookies);
  const newSession = mergeSession(session, newCookies);
  sessions.set(connId, newSession);

  const text = await response.text();
  return { response, text, newSession };
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function extractInputs(html: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  const re = /<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"[^>]*/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    inputs[m[1]] = m[2];
  }
  return inputs;
}

function extractValue(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? m[1].trim() : null;
}

function extractTableRows(html: string, tableId?: string): string[][] {
  const tableRe = tableId
    ? new RegExp(`<table[^>]*id="${tableId}"[^>]*>([\\s\\S]*?)<\\/table>`, "i")
    : /<table[^>]*>([\s\S]*?)<\/table>/i;
  const tableMatch = html.match(tableRe);
  if (!tableMatch) return [];

  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(tableMatch[1])) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// ─── PAL GAT Adapter ─────────────────────────────────────────────────────────

const PalGatAdapter = {
  async login(connId: number, baseUrl: string, username: string, password: string): Promise<ActionResult> {
    try {
      const loginUrl = `${baseUrl}/Account/Login`;

      // Get login page to capture CSRF/viewstate tokens
      const { text: loginHtml } = await sessionFetch(connId, loginUrl, { method: "GET" });
      const inputs = extractInputs(loginHtml);

      // Build form data with CSRF tokens + credentials
      const formData = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(inputs).filter(([k]) =>
            k.toLowerCase().includes("token") ||
            k.toLowerCase().includes("viewstate") ||
            k.toLowerCase().includes("csrf") ||
            k.toLowerCase().includes("__")
          )
        ),
        UserName: username,
        Password: password,
        RememberMe: "false",
      });

      const { response, text } = await sessionFetch(connId, loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": loginUrl,
        },
        body: formData.toString(),
      });

      const loggedIn = response.ok && !text.includes("שגיאה") && !text.includes("Error") && !text.includes("incorrect");

      const session = sessions.get(connId)!;
      sessions.set(connId, { ...session, loggedIn });

      return loggedIn
        ? { success: true, data: { message: "התחברות ל-PAL GAT בוצעה בהצלחה" } }
        : { success: false, error: "פרטי ההתחברות שגויים או שהגישה נדחתה" };
    } catch (err) {
      return { success: false, error: `שגיאת חיבור: ${String(err)}` };
    }
  },

  async getEmployees(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/Employees/Index`, { method: "GET" });
      const rows = extractTableRows(text);

      return {
        success: true,
        data: {
          employees: rows.slice(1).map((row) => ({
            id: row[0],
            name: row[1],
            role: row[2],
            department: row[3],
            startDate: row[4],
          })),
          count: rows.length - 1,
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getSalaryReport(connId: number, baseUrl: string, month?: string): Promise<ActionResult> {
    try {
      const url = month
        ? `${baseUrl}/Payroll/Report?month=${month}`
        : `${baseUrl}/Payroll/Report`;

      const { text } = await sessionFetch(connId, url, { method: "GET" });
      const rows = extractTableRows(text);

      return {
        success: true,
        data: {
          month: month ?? "current",
          rows: rows.slice(1).map((row) => ({
            employeeId: row[0],
            name: row[1],
            grossSalary: row[2],
            deductions: row[3],
            netSalary: row[4],
          })),
          totalRows: rows.length - 1,
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getAttendance(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/Attendance/Monthly`, { method: "GET" });
      const rows = extractTableRows(text);

      return {
        success: true,
        data: {
          attendance: rows.slice(1).map((row) => ({
            employeeId: row[0],
            name: row[1],
            present: row[2],
            absent: row[3],
            late: row[4],
          })),
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

// ─── OPTIMA Cloud Adapter ─────────────────────────────────────────────────────

const OptimaAdapter = {
  async login(connId: number, baseUrl: string, username: string, password: string, code?: string): Promise<ActionResult> {
    try {
      const loginUrl = `${baseUrl}/login`;
      const { text: loginPage } = await sessionFetch(connId, loginUrl, { method: "GET" });

      const csrfToken = extractValue(loginPage, /csrf[_-]?token[^"]*"[^"]*"[^"]*"([^"]+)"/i)
        ?? extractValue(loginPage, /name="csrf"[^>]+value="([^"]+)"/i)
        ?? "";

      // A one-time 2FA code (when supplied) is sent under several common field
      // names so we don't depend on Optima's exact contract. It is used once
      // for this request and never stored.
      const payload: Record<string, string> = { username, password, csrf: csrfToken };
      if (code) {
        payload.code = code;
        payload.otp = code;
        payload.twoFactorCode = code;
      }

      const { response, text } = await sessionFetch(connId, `${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": loginUrl,
        },
        body: JSON.stringify(payload),
      });

      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { /* html response */ }

      const loggedIn = response.ok && (parsed["success"] === true || parsed["token"] !== undefined || response.url.includes("dashboard"));

      // Detect a two-factor challenge so the UI can prompt for a one-time code.
      // Best-effort: covers JSON flags and common challenge wording (EN/HE).
      const challengeText = `${text}`;
      const needsTwoFactor = !loggedIn && !code && (
        parsed["requiresTwoFactor"] === true ||
        parsed["requires2fa"] === true ||
        parsed["mfaRequired"] === true ||
        parsed["challenge"] === "2fa" ||
        parsed["status"] === "mfa_required" ||
        /two[\s-]?factor|2fa|\bmfa\b|one[\s-]?time|otp|verification code|אימות דו|קוד אימות|קוד חד/i.test(challengeText)
      );

      const session = sessions.get(connId)!;
      const token = parsed["token"] as string | undefined;
      sessions.set(connId, {
        ...session,
        loggedIn,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (loggedIn) {
        return { success: true, data: { message: "התחברות ל-OPTIMA בוצעה בהצלחה", token: token ? "✓" : "session" } };
      }
      if (needsTwoFactor) {
        return { success: false, needsTwoFactor: true, error: "נדרש קוד אימות דו-שלבי" };
      }
      return { success: false, error: "ההתחברות נכשלה — בדוק פרטי כניסה" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getCustomers(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/api/customers?pageSize=100`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      try {
        const data = JSON.parse(text);
        return { success: true, data };
      } catch {
        const rows = extractTableRows(text);
        return { success: true, data: { rows, count: rows.length } };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getOpenOrders(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/api/orders?status=open`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      try {
        return { success: true, data: JSON.parse(text) };
      } catch {
        const rows = extractTableRows(text);
        return { success: true, data: { rows, count: rows.length } };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getInventory(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/api/inventory`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      try {
        return { success: true, data: JSON.parse(text) };
      } catch {
        return { success: true, data: { rawText: text.slice(0, 500) } };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getOccupancy(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/api/occupancy`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      try {
        return { success: true, data: JSON.parse(text) };
      } catch {
        const rows = extractTableRows(text);
        return { success: true, data: { rows, count: rows.length } };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

// ─── Priority ERP Adapter ────────────────────────────────────────────────────

const PriorityAdapter = {
  async login(connId: number, baseUrl: string, username: string, password: string): Promise<ActionResult> {
    try {
      const credentials = Buffer.from(`${username}:${password}`).toString("base64");
      const session = sessions.get(connId) ?? { cookies: {}, headers: {}, loggedIn: false, lastActivity: Date.now() };
      sessions.set(connId, {
        ...session,
        headers: { Authorization: `Basic ${credentials}` },
        loggedIn: true,
      });

      const { response } = await sessionFetch(connId, `${baseUrl}/odata/Priority/tabula.ini,-.usd/ENVIRONMENT`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      const loggedIn = response.ok;
      const s = sessions.get(connId)!;
      sessions.set(connId, { ...s, loggedIn });

      return loggedIn
        ? { success: true, data: { message: "התחברות ל-Priority בוצעה בהצלחה (Basic Auth)" } }
        : { success: false, error: "גישה נדחתה — בדוק פרטים" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getCustomers(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/odata/Priority/tabula.ini,-.usd/CUSTOMERS?$top=50`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      return { success: true, data: JSON.parse(text) };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getInvoices(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/odata/Priority/tabula.ini,-.usd/AINVOICES?$top=50&$filter=STATDES eq 'Open'`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      return { success: true, data: JSON.parse(text) };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

// ─── Hashavshevet Adapter ────────────────────────────────────────────────────

const HashavshevetAdapter = {
  async login(connId: number, baseUrl: string, username: string, password: string): Promise<ActionResult> {
    try {
      const { response, text } = await sessionFetch(connId, `${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username, password }),
      });

      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* ok */ }

      const loggedIn = response.ok && (data["success"] === true || data["sessionId"] !== undefined);
      const session = sessions.get(connId)!;
      sessions.set(connId, {
        ...session,
        loggedIn,
        headers: data["sessionId"] ? { "X-Session-ID": data["sessionId"] as string } : {},
      });

      return loggedIn
        ? { success: true, data: { message: "התחברות לחשבשבת בוצעה בהצלחה" } }
        : { success: false, error: "ההתחברות נכשלה" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getAccountBalance(connId: number, baseUrl: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, `${baseUrl}/api/accounts/balance`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      return { success: true, data: JSON.parse(text) };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

// ─── Generic Form Adapter ─────────────────────────────────────────────────────

const GenericFormAdapter = {
  async login(connId: number, baseUrl: string, username: string, password: string): Promise<ActionResult> {
    try {
      const { text: loginPage } = await sessionFetch(connId, baseUrl, { method: "GET" });
      const inputs = extractInputs(loginPage);

      const userField = Object.keys(inputs).find(k =>
        /user|email|login|שם/i.test(k)
      ) ?? "username";
      const passField = Object.keys(inputs).find(k =>
        /pass|pwd|סיסמ/i.test(k)
      ) ?? "password";

      const formData = new URLSearchParams({
        ...inputs,
        [userField]: username,
        [passField]: password,
      });

      const actionMatch = loginPage.match(/action="([^"]+)"/i);
      const actionUrl = actionMatch
        ? new URL(actionMatch[1], baseUrl).href
        : baseUrl;

      const { response } = await sessionFetch(connId, actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": baseUrl },
        body: formData.toString(),
      });

      const loggedIn = response.ok;
      const session = sessions.get(connId)!;
      sessions.set(connId, { ...session, loggedIn });

      return loggedIn
        ? { success: true, data: { message: "התחברות בוצעה (Generic Form)" } }
        : { success: false, error: "ההתחברות נכשלה" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async fetchPage(connId: number, url: string, xpath?: string): Promise<ActionResult> {
    try {
      const { text } = await sessionFetch(connId, url, { method: "GET" });

      if (xpath) {
        const re = new RegExp(xpath);
        const match = text.match(re);
        return { success: true, data: { match: match?.[1] ?? null } };
      }

      const rows = extractTableRows(text);
      return { success: true, data: { url, rows, tableCount: rows.length } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async submitForm(connId: number, url: string, fields: Record<string, string>): Promise<ActionResult> {
    try {
      const body = new URLSearchParams(fields);
      const { response, text } = await sessionFetch(connId, url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      return {
        success: response.ok,
        data: { status: response.status, preview: text.slice(0, 300) },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

// ─── Action definitions per system ──────────────────────────────────────────

export const SYSTEM_ACTIONS: Record<SystemType, { id: string; label: string; description: string }[]> = {
  palgat: [
    { id: "get_employees", label: "רשימת עובדים", description: "שליפת כל העובדים הפעילים" },
    { id: "get_salary_report", label: "דוח שכר חודשי", description: "ייצוא דוח שכר לחודש הנוכחי" },
    { id: "get_attendance", label: "דוח נוכחות", description: "נתוני נוכחות חודשיים לכל העובדים" },
  ],
  optima: [
    { id: "get_customers", label: "רשימת לקוחות", description: "שליפת לקוחות פעילים" },
    { id: "get_open_orders", label: "הזמנות פתוחות", description: "כל ההזמנות הממתינות לטיפול" },
    { id: "get_inventory", label: "מצב מלאי", description: "כמויות ומחירים נוכחיים" },
    { id: "get_occupancy", label: "נתוני תפוסה", description: "סנכרון נתוני תפוסה עם אישור אנושי" },
  ],
  priority: [
    { id: "get_customers", label: "לקוחות (OData)", description: "שליפת לקוחות דרך Priority OData API" },
    { id: "get_invoices", label: "חשבוניות פתוחות", description: "חשבוניות ממתינות לגבייה" },
  ],
  hashavshevet: [
    { id: "get_balance", label: "יתרות חשבונות", description: "יתרות חשבונות בנק ולקוחות" },
  ],
  generic_form: [
    { id: "fetch_page", label: "שליפת עמוד", description: "קריאת תוכן עמוד מהמערכת" },
    { id: "submit_form", label: "שליחת טופס", description: "מילוי ושליחת טופס אוטומטית" },
  ],
};

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export async function testConnection(
  connId: number,
  systemType: SystemType,
  baseUrl: string,
  username: string,
  password: string
): Promise<ActionResult> {
  sessions.delete(connId);
  switch (systemType) {
    case "palgat":
      return PalGatAdapter.login(connId, baseUrl, username, password);
    case "optima":
      return OptimaAdapter.login(connId, baseUrl, username, password);
    case "priority":
      return PriorityAdapter.login(connId, baseUrl, username, password);
    case "hashavshevet":
      return HashavshevetAdapter.login(connId, baseUrl, username, password);
    case "generic_form":
      return GenericFormAdapter.login(connId, baseUrl, username, password);
    default:
      return { success: false, error: "סוג מערכת לא מוכר" };
  }
}

export async function runAction(
  connId: number,
  systemType: SystemType,
  baseUrl: string,
  username: string,
  password: string,
  action: string,
  params: Record<string, string> = {}
): Promise<ActionResult> {
  const session = sessions.get(connId);
  if (!session?.loggedIn) {
    const loginResult = await testConnection(connId, systemType, baseUrl, username, password);
    if (!loginResult.success) return loginResult;
  }

  switch (systemType) {
    case "palgat":
      if (action === "get_employees") return PalGatAdapter.getEmployees(connId, baseUrl);
      if (action === "get_salary_report") return PalGatAdapter.getSalaryReport(connId, baseUrl, params.month);
      if (action === "get_attendance") return PalGatAdapter.getAttendance(connId, baseUrl);
      break;
    case "optima":
      if (action === "get_customers") return OptimaAdapter.getCustomers(connId, baseUrl);
      if (action === "get_open_orders") return OptimaAdapter.getOpenOrders(connId, baseUrl);
      if (action === "get_inventory") return OptimaAdapter.getInventory(connId, baseUrl);
      if (action === "get_occupancy") return OptimaAdapter.getOccupancy(connId, baseUrl);
      break;
    case "priority":
      if (action === "get_customers") return PriorityAdapter.getCustomers(connId, baseUrl);
      if (action === "get_invoices") return PriorityAdapter.getInvoices(connId, baseUrl);
      break;
    case "hashavshevet":
      if (action === "get_balance") return HashavshevetAdapter.getAccountBalance(connId, baseUrl);
      break;
    case "generic_form":
      if (action === "fetch_page") return GenericFormAdapter.fetchPage(connId, params.url ?? baseUrl, params.pattern);
      if (action === "submit_form") return GenericFormAdapter.submitForm(connId, params.url ?? baseUrl, params as Record<string, string>);
      break;
  }

  return { success: false, error: `פעולה לא מוכרת: ${action}` };
}

/**
 * Attended login for Optima: establishes (or refreshes) the per-connector
 * session using the operator's credentials, plus an optional one-time 2FA code
 * entered live by the human. The code is used for this single sign-in and is
 * never persisted. Returns needsTwoFactor when a challenge is detected.
 */
export async function establishOptimaSession(
  connId: number,
  baseUrl: string,
  username: string,
  password: string,
  code?: string,
): Promise<ActionResult> {
  return OptimaAdapter.login(connId, baseUrl, username, password, code);
}

export function getSessionStatus(connId: number): { loggedIn: boolean; hasCookies: boolean } {
  const s = sessions.get(connId);
  return {
    loggedIn: s?.loggedIn ?? false,
    hasCookies: Object.keys(s?.cookies ?? {}).length > 0,
  };
}

export function clearSession(connId: number): void {
  sessions.delete(connId);
}
