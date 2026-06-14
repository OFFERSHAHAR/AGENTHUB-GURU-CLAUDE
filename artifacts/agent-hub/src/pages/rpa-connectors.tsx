import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Plug, Play, Trash2, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertCircle, Eye, EyeOff,
  Zap, Shield, Globe, CalendarSync, Check, X, BellRing,
  Link2, MessageSquare,
} from "lucide-react";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Action { id: string; label: string; description: string; }
interface SystemDef {
  id: string; label: string; labelHe: string; icon: string;
  description: string; vendor: string; actions: Action[];
}
interface SessionStatus { loggedIn: boolean; hasCookies: boolean; }
interface Connector {
  id: number; name: string; systemType: string; baseUrl: string;
  username: string; status: string; notes: string | null;
  hasPassword: boolean; createdAt: string;
  lastTestedAt: string | null; lastSuccessAt: string | null;
  availableActions: Action[]; sessionStatus: SessionStatus;
  clientId: number | null;
}
interface RunLog {
  id: number; action: string; status: string;
  result: unknown; errorMessage: string | null;
  durationMs: number | null; createdAt: string;
}
interface Client {
  id: number; name: string; telegramChatId: string | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...((opts?.headers as object) ?? {}) },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    connected:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "מחובר", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    disconnected: { icon: <Clock className="w-3.5 h-3.5" />, label: "לא מחובר", cls: "bg-slate-50 text-slate-600 border-slate-200" },
    error:        { icon: <XCircle className="w-3.5 h-3.5" />, label: "שגיאה", cls: "bg-red-50 text-red-700 border-red-200" },
    testing:      { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, label: "בודק...", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    running:      { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, label: "מריץ...", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    success:      { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "הצלחה", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const s = MAP[status] ?? MAP.disconnected;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── System icon map ──────────────────────────────────────────────────────────

const SYSTEM_COLORS: Record<string, string> = {
  palgat: "#6366f1", optima: "#0ea5e9", priority: "#f59e0b",
  hashavshevet: "#10b981", generic_form: "#94a3b8",
};

// ─── Add/Edit Connector Modal ─────────────────────────────────────────────────

function ConnectorModal({
  systems, editing, onClose, onSave,
}: {
  systems: SystemDef[];
  editing?: Connector;
  onClose: () => void;
  onSave: (data: Record<string, string>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({
    name: editing?.name ?? "",
    systemType: editing?.systemType ?? (systems[0]?.id ?? ""),
    baseUrl: editing?.baseUrl ?? "",
    username: editing?.username ?? "",
    password: "",
    notes: editing?.notes ?? "",
  });
  const [showPass, setShowPass] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const selectedSystem = systems.find(s => s.id === form.systemType);

  const PLACEHOLDERS: Record<string, string> = {
    palgat: "https://app.palgat.co.il",
    optima: "https://company.optimacloud.co.il",
    priority: "https://your-company.priority.co.il",
    hashavshevet: "https://app.hashavshevet.co.il",
    generic_form: "https://your-system.example.com/login",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b" style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}>
          <h2 className="font-bold text-[17px] text-gray-900" dir="rtl">
            {editing ? "✏️ עריכת Connector" : "➕ Connector חדש"}
          </h2>
          <p className="text-[13px] text-gray-500 mt-1" dir="rtl">חיבור למערכת עסקית ללא API רשמי</p>
        </div>

        <div className="p-6 space-y-5">
          {/* System type */}
          <div dir="rtl">
            <label className="text-[13px] font-semibold text-gray-700 block mb-2">סוג מערכת *</label>
            <div className="grid grid-cols-2 gap-2">
              {systems.map(s => (
                <button key={s.id}
                  onClick={() => set("systemType", s.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-right transition-all ${
                    form.systemType === s.id
                      ? "border-indigo-400 bg-indigo-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}>
                  <span className="text-xl">{s.icon}</span>
                  <div>
                    <div className="font-semibold text-[12.5px] text-gray-900">{s.label}</div>
                    <div className="text-[10.5px] text-gray-500">{s.vendor}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div dir="rtl">
            <label className="text-[13px] font-semibold text-gray-700 block mb-1">שם הconnector *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder={`${selectedSystem?.labelHe ?? ""} — לקוח X`}
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>

          {/* Base URL */}
          <div dir="rtl">
            <label className="text-[13px] font-semibold text-gray-700 block mb-1">כתובת המערכת (URL) *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 text-left"
              dir="ltr"
              placeholder={PLACEHOLDERS[form.systemType] ?? "https://..."}
              value={form.baseUrl} onChange={e => set("baseUrl", e.target.value)} />
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-3" dir="rtl">
            <div>
              <label className="text-[13px] font-semibold text-gray-700 block mb-1">שם משתמש *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="user@company.co.il"
                value={form.username} onChange={e => set("username", e.target.value)} />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-gray-700 block mb-1">
                {editing ? "סיסמה חדשה (אופציונלי)" : "סיסמה *"}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder={editing ? "•••••• (ללא שינוי)" : "••••••"}
                  value={form.password} onChange={e => set("password", e.target.value)} />
                <button onClick={() => setShowPass(v => !v)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div dir="rtl">
            <label className="text-[13px] font-semibold text-gray-700 block mb-1">הערות (אופציונלי)</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={2} placeholder="לדוגמה: חשבון ייצור, לא לגעת ביום שישי..."
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-amber-700" dir="rtl">
              הסיסמה מוצפנת ב-base64 ומאוחסנת בבסיס הנתונים. לאבטחה מרבית, מומלץ להשתמש בחשבון ייעודי עם הרשאות קריאה בלבד.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-gray-200 transition-colors">
            ביטול
          </button>
          <button
            onClick={() => {
              if (!form.name || !form.systemType || !form.baseUrl || !form.username) return;
              if (!editing && !form.password) return;
              onSave(form);
            }}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            {editing ? "עדכן Connector" : "צור Connector"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Run Log Row ──────────────────────────────────────────────────────────────

function RunLogRow({ log, actions }: { log: RunLog; actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const action = actions.find(a => a.id === log.action);
  const label = action?.label ?? log.action;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-right">
        <StatusBadge status={log.status} />
        <span className="flex-1 text-[13px] font-medium text-gray-800">{label}</span>
        <span className="text-[11px] text-gray-400">
          {log.durationMs ? `${log.durationMs}ms` : ""} · {new Date(log.createdAt).toLocaleString("he-IL")}
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t">
            <pre className="p-4 text-[11.5px] bg-gray-900 text-green-300 overflow-x-auto whitespace-pre-wrap max-h-64">
              {log.errorMessage
                ? `❌ Error: ${log.errorMessage}`
                : JSON.stringify(log.result, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Connector Card ───────────────────────────────────────────────────────────

// ─── Optima occupancy-sync panel (human-in-the-loop) ──────────────────────────

interface SyncConfig { enabled: boolean; intervalHours: number; }
interface SyncApproval {
  id: number; connectorId: number; clientId: number | null;
  action: string; status: string;
  newCount: number; overwriteCount: number; removedCount: number; unchangedCount: number;
  decidedBy: string | null; createdAt: string;
  decidedAt: string | null; appliedAt: string | null;
}

const APPROVAL_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "ממתין לאישור", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  applied:   { label: "אושר ובוצע",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "בוטל",          cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

function OptimaSyncPanel({ connId, color, clientId, onLinked }: {
  connId: number; color: string; clientId: number | null; onLinked: () => void;
}) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [runMsg, setRunMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => apiFetch("/clients"),
  });
  const linkedClient = clients.find(c => c.id === clientId) ?? null;
  const [chatInput, setChatInput] = useState("");
  useEffect(() => {
    setChatInput(linkedClient?.telegramChatId ?? "");
  }, [linkedClient?.id, linkedClient?.telegramChatId]);

  const linkClient = useMutation({
    mutationFn: (cid: string) =>
      apiFetch(`/rpa-connectors/${connId}`, {
        method: "PATCH",
        body: JSON.stringify({ clientId: cid ? Number(cid) : null }),
      }),
    onSuccess: () => onLinked(),
  });
  const saveChat = useMutation({
    mutationFn: (chat: string) =>
      apiFetch(`/clients/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({ telegramChatId: chat }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  const { data: config } = useQuery<SyncConfig>({
    queryKey: ["optima-config", connId],
    queryFn: () => apiFetch(`/optima-sync/config/${connId}`),
  });

  const { data: session } = useQuery<{ loggedIn: boolean }>({
    queryKey: ["optima-session", connId],
    queryFn: () => apiFetch(`/optima-sync/session/${connId}`),
    refetchInterval: 30000,
  });
  const loggedIn = session?.loggedIn ?? false;

  const login = useMutation<{ status: string; message: string }, Error, string | undefined>({
    mutationFn: (oneTimeCode) =>
      apiFetch(`/optima-sync/login/${connId}`, {
        method: "POST",
        body: JSON.stringify(oneTimeCode ? { code: oneTimeCode } : {}),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["optima-session", connId] });
      if (r.status === "logged_in") {
        setNeedsCode(false);
        setCode("");
        setLoginMsg({ kind: "ok", text: r.message });
      } else if (r.status === "needs_code") {
        setNeedsCode(true);
        setLoginMsg({ kind: "info", text: r.message });
      } else {
        setLoginMsg({ kind: "err", text: r.message });
      }
    },
    onError: (e) => setLoginMsg({ kind: "err", text: e.message || "ההתחברות נכשלה" }),
  });

  const { data: approvals = [] } = useQuery<SyncApproval[]>({
    queryKey: ["optima-approvals", connId],
    queryFn: () => apiFetch(`/optima-sync/approvals?connectorId=${connId}`),
    refetchInterval: 15000,
  });

  const saveConfig = useMutation({
    mutationFn: (cfg: SyncConfig) =>
      apiFetch(`/optima-sync/config/${connId}`, { method: "PUT", body: JSON.stringify(cfg) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["optima-config", connId] }),
  });

  const invalidateApprovals = () =>
    qc.invalidateQueries({ queryKey: ["optima-approvals", connId] });

  const RUN_REASONS: Record<string, { kind: "ok" | "err" | "info"; text: string }> = {
    not_logged_in: { kind: "err", text: "יש להתחבר לאופטימה לפני הרצת הסנכרון — לחצי «התחבר לאופטימה» למעלה." },
    approval_already_pending: { kind: "info", text: "כבר קיימת בקשת אישור פתוחה — יש לאשר או לבטל אותה תחילה." },
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const result = await apiFetch(`/optima-sync/run/${connId}`, { method: "POST", body: "{}" });
      invalidateApprovals();
      const status = result?.status as string | undefined;
      if (status === "error" || status === "skipped_open") {
        const reason = result?.reason as string | undefined;
        setRunMsg(
          (reason ? RUN_REASONS[reason] : undefined) ??
          { kind: "err", text: "ההרצה נכשלה — נסי שוב או בדקי את החיבור." },
        );
        if (reason === "not_logged_in") {
          qc.invalidateQueries({ queryKey: ["optima-session", connId] });
        }
      } else if (status === "no_changes") {
        setRunMsg({ kind: "ok", text: "הסנכרון הסתיים — לא נמצאו שינויים בתפוסה." });
      } else {
        setRunMsg({ kind: "ok", text: "הסנכרון רץ — נשלחה בקשת אישור לטלגרם." });
      }
    } catch (e) {
      setRunMsg({ kind: "err", text: (e as Error).message || "ההרצה נכשלה" });
    } finally { setRunning(false); }
  };

  const decide = async (id: number, decision: "approve" | "cancel") => {
    setActing(id);
    try {
      await apiFetch(`/optima-sync/approvals/${id}/${decision}`, { method: "POST", body: "{}" });
      invalidateApprovals();
    } finally { setActing(null); }
  };

  const pending = approvals.filter(a => a.status === "pending");
  const history = approvals.filter(a => a.status !== "pending").slice(0, 5);
  const interval = config?.intervalHours ?? 5;

  return (
    <div className="border-t px-5 py-4 bg-sky-50/40" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-[12.5px] font-bold text-gray-700 flex items-center gap-1.5">
          <CalendarSync className="w-4 h-4" style={{ color }} />
          סנכרון נתוני תפוסה (עם אישור אנושי)
        </h4>
        <button
          onClick={handleRunNow}
          disabled={running || !loggedIn}
          title={!loggedIn ? "יש להתחבר לאופטימה תחילה" : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: color }}>
          {running
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> בודק שינויים...</>
            : <><RefreshCw className="w-3.5 h-3.5" /> בדוק שינויים עכשיו</>}
        </button>
      </div>

      {/* Attended sign-in to Optima (manual mode, optional one-time 2FA code) */}
      <div className="mt-3 bg-white rounded-xl border px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-gray-700">
            <Shield className="w-4 h-4" style={{ color }} />
            התחברות לאופטימה
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border ${
            loggedIn
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}>
            {loggedIn
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> מחובר</>
              : <><XCircle className="w-3.5 h-3.5" /> לא מחובר</>}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setLoginMsg(null); login.mutate(undefined); }}
            disabled={login.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 transition-colors">
            {login.isPending
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> מתחבר...</>
              : <><Plug className="w-3.5 h-3.5" /> {loggedIn ? "התחבר מחדש" : "התחבר לאופטימה"}</>}
          </button>

          {needsCode && (
            <>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="קוד אימות חד-פעמי"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px] font-mono w-40 text-left focus:outline-none focus:ring-2 focus:ring-sky-300" />
              <button
                onClick={() => { setLoginMsg(null); login.mutate(code.trim()); }}
                disabled={login.isPending || !code.trim()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Check className="w-3.5 h-3.5" /> אשר קוד
              </button>
            </>
          )}
        </div>

        {loginMsg && (
          <p className={`text-[11.5px] leading-relaxed ${
            loginMsg.kind === "ok" ? "text-emerald-600"
            : loginMsg.kind === "err" ? "text-red-600"
            : "text-sky-600"
          }`}>
            {loginMsg.text}
          </p>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          ההתחברות מתבצעת דרך AgentHub עם פרטי הכניסה השמורים של המחבר. אם אופטימה מבקשת אימות דו-שלבי,
          יוצג שדה להזנת הקוד החד-פעמי שקיבלת — הקוד משמש פעם אחת בלבד ואינו נשמר. לאחר ההתחברות לחצי «בדוק שינויים עכשיו».
        </p>
      </div>

      {/* Connection: linked client + Telegram destination */}
      <div className="mt-3 bg-white rounded-xl border px-4 py-3 space-y-3">
        <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-gray-700">
          <Link2 className="w-4 h-4" style={{ color }} />
          חיבור ויעד הודעות האישור
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] text-gray-500">לקוח משויך:</span>
          <select
            value={clientId ?? ""}
            onChange={e => linkClient.mutate(e.target.value)}
            disabled={linkClient.isPending}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60">
            <option value="">— ללא לקוח (צ׳אט ראשי) —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {linkClient.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />}
        </div>

        {linkedClient ? (
          <div className="flex items-center gap-2 flex-wrap">
            <MessageSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="text-[12.5px] text-gray-500">צ׳אט טלגרם של {linkedClient.name}:</span>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="מזהה צ׳אט (chat id)"
              dir="ltr"
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px] font-mono w-44 text-left focus:outline-none focus:ring-2 focus:ring-sky-300" />
            <button
              onClick={() => saveChat.mutate(chatInput.trim())}
              disabled={saveChat.isPending || chatInput.trim() === (linkedClient.telegramChatId ?? "")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {saveChat.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              שמור
            </button>
            {!linkedClient.telegramChatId && (
              <span className="text-[11px] text-amber-600">ריק — יישלח לצ׳אט הראשי</span>
            )}
          </div>
        ) : (
          <p className="text-[11.5px] text-gray-400">
            ללא לקוח משויך — הודעות האישור יישלחו לצ׳אט הטלגרם הראשי של המערכת.
          </p>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          לפני כל עדכון תפוסה תישלח לצ׳אט הזה הודעה עם כפתורי «אשר / בטל». השינוי יבוצע רק לאחר אישור.
        </p>
      </div>

      {/* Auto-sync schedule */}
      <div className="mt-3 flex items-center gap-3 flex-wrap bg-white rounded-xl border px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config?.enabled ?? false}
            onChange={e => saveConfig.mutate({ enabled: e.target.checked, intervalHours: interval })}
            className="w-4 h-4 accent-sky-600"
          />
          <span className="text-[13px] font-medium text-gray-800">סנכרון אוטומטי</span>
        </label>
        <span className="text-[12.5px] text-gray-500">כל</span>
        <select
          value={interval}
          onChange={e => saveConfig.mutate({ enabled: config?.enabled ?? false, intervalHours: Number(e.target.value) })}
          className="text-[12.5px] border rounded-lg px-2 py-1 bg-white">
          {[1, 2, 3, 5, 8, 12, 24].map(h => <option key={h} value={h}>{h} שעות</option>)}
        </select>
        <span className="text-[11.5px] text-gray-400">
          לפני כל עדכון תישלח הודעת אישור לטלגרם — שום שינוי לא יבוצע ללא אישור.
        </span>
        {!config?.enabled && (
          <span className="w-full text-[11.5px] text-amber-600 leading-relaxed">
            מצב ידני פעיל: הסנכרון האוטומטי כבוי. כדי לסנכרן, התחברי לאופטימה ולחצי «בדוק שינויים עכשיו».
          </span>
        )}
      </div>

      {/* Run result message */}
      {runMsg && (
        <p className={`mt-3 text-[12px] leading-relaxed ${
          runMsg.kind === "ok" ? "text-emerald-600"
          : runMsg.kind === "err" ? "text-red-600"
          : "text-sky-600"
        }`}>
          {runMsg.text}
        </p>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="mt-3 space-y-2">
          {pending.map(a => (
            <div key={a.id} className="rounded-xl border-2 border-amber-200 bg-amber-50/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-amber-800">
                <BellRing className="w-4 h-4" />
                ממתין לאישורך — {new Date(a.createdAt).toLocaleString("he-IL")}
              </div>
              <div className="mt-2 flex items-center gap-4 text-[12.5px] text-gray-700 flex-wrap">
                <span>🆕 חדשות: <b>{a.newCount}</b></span>
                <span>♻️ יוחלפו: <b>{a.overwriteCount}</b></span>
                <span>🗑️ יוסרו: <b>{a.removedCount}</b></span>
                <span>✅ ללא שינוי: <b>{a.unchangedCount}</b></span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => decide(a.id, "approve")}
                  disabled={acting === a.id}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60">
                  <Check className="w-3.5 h-3.5" /> אישור וביצוע
                </button>
                <button
                  onClick={() => decide(a.id, "cancel")}
                  disabled={acting === a.id}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-60">
                  <X className="w-3.5 h-3.5" /> ביטול
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent history */}
      {history.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">היסטוריה אחרונה</div>
          <div className="space-y-1.5">
            {history.map(a => {
              const s = APPROVAL_STATUS[a.status] ?? APPROVAL_STATUS.cancelled;
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border px-3 py-2 text-[12px]">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${s.cls}`}>
                    {s.label}
                  </span>
                  <span className="text-gray-600">🆕 {a.newCount} · ♻️ {a.overwriteCount} · 🗑️ {a.removedCount}</span>
                  <span className="text-gray-400 mr-auto">
                    {a.decidedBy ? `${a.decidedBy} · ` : ""}
                    {new Date(a.decidedAt ?? a.createdAt).toLocaleString("he-IL")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pending.length === 0 && history.length === 0 && (
        <p className="mt-3 text-[12px] text-gray-400 text-center py-2">אין סנכרונים עדיין</p>
      )}
    </div>
  );
}

function ConnectorCard({
  conn, systems, onDelete, onRefetch,
}: {
  conn: Connector; systems: SystemDef[];
  onDelete: () => void; onRefetch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const system = systems.find(s => s.id === conn.systemType);
  const color = SYSTEM_COLORS[conn.systemType] ?? "#94a3b8";

  const { data: logs = [] } = useQuery<RunLog[]>({
    queryKey: ["rpa-logs", conn.id],
    queryFn: () => apiFetch(`/rpa-connectors/${conn.id}/logs`),
    enabled: showLogs,
  });
  const qc = useQueryClient();

  const handleTest = async () => {
    setTesting(true);
    try {
      await apiFetch(`/rpa-connectors/${conn.id}/test`, { method: "POST" });
      onRefetch();
      qc.invalidateQueries({ queryKey: ["rpa-logs", conn.id] });
    } finally { setTesting(false); }
  };

  const handleRun = async (action: string) => {
    setRunning(action);
    try {
      await apiFetch(`/rpa-connectors/${conn.id}/run/${action}`, { method: "POST", body: JSON.stringify({}) });
      onRefetch();
      qc.invalidateQueries({ queryKey: ["rpa-logs", conn.id] });
    } finally { setRunning(null); }
  };

  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
      {/* Top bar */}
      <div className="h-1.5 w-full" style={{ background: color }} />

      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: color + "15" }}>
              {system?.icon ?? "🔌"}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[15px] text-gray-900 truncate">{conn.name}</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">{system?.labelHe ?? conn.systemType} · {system?.vendor}</p>
              <p className="text-[11.5px] font-mono text-gray-400 mt-1 truncate">{conn.baseUrl}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={conn.status} />
            {conn.sessionStatus.loggedIn && (
              <span className="text-[10.5px] text-emerald-600 font-medium">● session active</span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center gap-4 text-[11.5px] text-gray-400">
          <span>👤 {conn.username}</span>
          {conn.lastTestedAt && <span>נבדק: {new Date(conn.lastTestedAt).toLocaleString("he-IL")}</span>}
          {conn.lastSuccessAt && <span className="text-emerald-600">✓ {new Date(conn.lastSuccessAt).toLocaleString("he-IL")}</span>}
        </div>

        {conn.notes && (
          <p className="mt-2 text-[12px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2" dir="rtl">{conn.notes}</p>
        )}

        {/* Actions row */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: color }}>
            {testing
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> בודק...</>
              : <><Plug className="w-3.5 h-3.5" /> בדוק חיבור</>}
          </button>
          <button onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
            <Play className="w-3.5 h-3.5" />
            הרץ פעולה
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { setShowLogs(v => !v); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            <Clock className="w-3.5 h-3.5" />
            לוגים
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] text-red-500 hover:bg-red-50 transition-colors ml-auto">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Actions panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="border-t px-5 py-4 bg-gray-50">
              <h4 className="text-[12px] font-bold text-gray-600 uppercase tracking-wide mb-3" dir="rtl">
                פעולות זמינות ל-{system?.labelHe}
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {conn.availableActions.map(action => (
                  <button key={action.id}
                    onClick={() => handleRun(action.id)}
                    disabled={running === action.id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-all text-right disabled:opacity-60">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: color + "20" }}>
                      {running === action.id
                        ? <RefreshCw className="w-4 h-4 animate-spin" style={{ color }}/>
                        : <Zap className="w-4 h-4" style={{ color }}/>}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[13px] text-gray-900">{action.label}</div>
                      <div className="text-[11.5px] text-gray-500">{action.description}</div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs panel */}
      <AnimatePresence>
        {showLogs && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="border-t px-5 py-4">
              <h4 className="text-[12px] font-bold text-gray-600 uppercase tracking-wide mb-3">
                Run History
              </h4>
              {logs.length === 0
                ? <p className="text-[13px] text-gray-400 text-center py-4">אין לוגים עדיין</p>
                : (
                  <div className="space-y-2">
                    {logs.map(log => (
                      <RunLogRow key={log.id} log={log} actions={conn.availableActions} />
                    ))}
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optima occupancy sync (human-in-the-loop) */}
      {conn.systemType === "optima" && (
        <OptimaSyncPanel connId={conn.id} color={color} clientId={conn.clientId} onLinked={onRefetch} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RpaConnectorsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Connector | undefined>();
  const qc = useQueryClient();

  const { data: connectors = [], isLoading, refetch } = useQuery<Connector[]>({
    queryKey: ["rpa-connectors"],
    queryFn: () => apiFetch("/rpa-connectors"),
  });

  const { data: systems = [] } = useQuery<SystemDef[]>({
    queryKey: ["rpa-systems"],
    queryFn: () => apiFetch("/rpa-connectors/systems"),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiFetch("/rpa-connectors", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rpa-connectors"] }); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/rpa-connectors/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rpa-connectors"] }),
  });

  const stats = {
    total: connectors.length,
    connected: connectors.filter(c => c.status === "connected").length,
    error: connectors.filter(c => c.status === "error").length,
    activeSessions: connectors.filter(c => c.sessionStatus?.loggedIn).length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            RPA Connectors
          </h1>
          <p className="text-[14px] text-gray-500 mt-1" dir="rtl">
            חיבור למערכות ישראליות ללא API — PAL GAT, OPTIMA, Priority, חשבשבת ועוד
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Connector חדש
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "סה\"כ חיבורים", value: stats.total, color: "#6366f1", icon: <Plug className="w-4 h-4" /> },
          { label: "מחוברים", value: stats.connected, color: "#10b981", icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: "שגיאות", value: stats.error, color: "#ef4444", icon: <XCircle className="w-4 h-4" /> },
          { label: "Sessions פעילים", value: stats.activeSessions, color: "#0ea5e9", icon: <Zap className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2" style={{ color: s.color }}>
              {s.icon}
              <span className="text-[11.5px] font-medium text-gray-500">{s.label}</span>
            </div>
            <div className="text-[26px] font-black text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-50 to-slate-50 p-5">
        <h3 className="font-bold text-[14px] text-gray-900 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-600" />
          איך זה עובד?
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: "1", title: "מגדיר credentials", text: "שם משתמש + סיסמה של המערכת הקיימת", icon: "🔑" },
            { step: "2", title: "RPA Engine מתחבר", text: "מדמה דפדפן, נכנס למערכת ושומר session", icon: "🤖" },
            { step: "3", title: "מריץ פעולות", text: "שולף נתונים, ממלא טפסים, מייצא דוחות", icon: "⚡" },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3" dir="rtl">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                {s.step}
              </div>
              <div>
                <div className="font-semibold text-[13px] text-gray-900">{s.icon} {s.title}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connectors list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          טוען...
        </div>
      ) : connectors.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-gray-500 mb-1">אין Connectors עדיין</h3>
          <p className="text-[13px] text-gray-400 mb-4">הוסף את המערכת הראשונה — PAL GAT, OPTIMA, Priority...</p>
          <button onClick={() => { setEditing(undefined); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            הוסף Connector
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {connectors.map(conn => (
            <motion.div key={conn.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <ConnectorCard
                conn={conn}
                systems={systems}
                onDelete={() => {
                  if (confirm(`למחוק את "${conn.name}"?`)) deleteMutation.mutate(conn.id);
                }}
                onRefetch={refetch}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Supported systems quick view */}
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="font-bold text-[14px] text-gray-900 mb-4">מערכות נתמכות</h3>
        <div className="grid grid-cols-2 gap-3">
          {systems.map(s => (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl border hover:bg-gray-50 transition-colors">
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div>
                <div className="font-semibold text-[13px] text-gray-900">{s.label}</div>
                <div className="text-[11.5px] text-gray-500 mb-1">{s.description}</div>
                <div className="flex flex-wrap gap-1">
                  {s.actions.map(a => (
                    <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <ConnectorModal
            systems={systems}
            editing={editing}
            onClose={() => setShowModal(false)}
            onSave={data => createMutation.mutate(data)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
