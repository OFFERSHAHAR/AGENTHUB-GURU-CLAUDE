import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, RefreshCw, CheckCircle2, Clock, XCircle, Trash2,
  Bell, Download, Upload, Shield, ChevronDown, ChevronRight,
  Calendar, Phone, User, Home, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...((opts?.headers as object) ?? {}) },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

interface Permit {
  id: number;
  clientId: number | null;
  guestName: string;
  guestPhone: string;
  unitOrNote: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  sheetRowId: string | null;
  addedToGate: string | null;
  removedFromGate: string | null;
  addedConfirmedBy: string | null;
  removedConfirmedBy: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  pending:   { label: "ממתין להוספה", bg: "#fff7ed", text: "#c2410c", dot: "#f97316", icon: <Clock className="w-3.5 h-3.5" /> },
  active:    { label: "פעיל בשער", bg: "#ecfdf5", text: "#065f46", dot: "#10b981", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  removed:   { label: "הוסר", bg: "#f9fafb", text: "#6b7280", dot: "#9ca3af", icon: <XCircle className="w-3.5 h-3.5" /> },
  expired:   { label: "פג תוקף", bg: "#fef2f2", text: "#991b1b", dot: "#ef4444", icon: <XCircle className="w-3.5 h-3.5" /> },
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ background: m.bg, color: m.text, borderColor: m.dot + "44" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

// ─── Sync from Google Sheets ────────────────────────────────────────────────
function SheetSyncPanel({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);

  const parseRows = (text: string) => {
    return text.trim().split("\n").map((line) => {
      const cols = line.split("\t");
      return {
        guestName: cols[0]?.trim() ?? "",
        guestPhone: cols[1]?.trim() ?? "",
        unitOrNote: cols[2]?.trim() || undefined,
        checkIn: cols[3]?.trim() ?? "",
        checkOut: cols[4]?.trim() ?? "",
        notes: cols[5]?.trim() || undefined,
      };
    }).filter(r => r.guestName && r.guestPhone && r.checkIn && r.checkOut);
  };

  const handleSync = async () => {
    const rows = parseRows(raw);
    if (rows.length === 0) { toast({ title: "אין שורות תקינות", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const result = await apiFetch("/palgate/permits/sync-sheet", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      toast({ title: `יובאו ${result.inserted} אורחים חדשים (${result.skipped} כפילויות דולגו)` });
      setRaw("");
      onDone();
    } catch (e: any) {
      toast({ title: "שגיאה בייבוא", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground leading-relaxed">
        העתק שורות מ-Google Sheets (טאב בין עמודות):<br />
        <span className="font-mono text-[10px]">שם אורח | טלפון | יחידה/הערה | תאריך הגעה | תאריך עזיבה | הערות</span>
      </div>
      <textarea
        className="w-full h-32 text-[12px] font-mono border border-border rounded-lg p-2.5 bg-muted/30 resize-y"
        placeholder={"ישראל ישראלי\t0501234567\t101\t2026-06-10\t2026-06-13"}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        dir="ltr"
      />
      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5" onClick={handleSync} disabled={loading || !raw.trim()}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          ייבא מ-Sheets
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRaw("")}>נקה</Button>
      </div>
    </div>
  );
}

// ─── Add Manual Permit ───────────────────────────────────────────────────────
function AddPermitForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ guestName: "", guestPhone: "", unitOrNote: "", checkIn: today(), checkOut: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.guestName || !form.guestPhone || !form.checkIn || !form.checkOut) {
      toast({ title: "נא למלא כל השדות החובה", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      await apiFetch("/palgate/permits", { method: "POST", body: JSON.stringify(form) });
      toast({ title: `הרשאה נוספה עבור ${form.guestName}` });
      setForm({ guestName: "", guestPhone: "", unitOrNote: "", checkIn: today(), checkOut: "" });
      onDone();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">שם אורח *</label>
        <Input placeholder="ישראל ישראלי" value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} className="h-8 text-[12px]" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">טלפון *</label>
        <Input placeholder="0501234567" value={form.guestPhone} onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} className="h-8 text-[12px]" dir="ltr" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">יחידה / הערה</label>
        <Input placeholder="דירה 101" value={form.unitOrNote} onChange={e => setForm(f => ({ ...f, unitOrNote: e.target.value }))} className="h-8 text-[12px]" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">תאריך הגעה *</label>
        <Input type="date" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} className="h-8 text-[12px]" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">תאריך עזיבה *</label>
        <Input type="date" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} className="h-8 text-[12px]" />
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" className="gap-1.5 h-8 w-full" disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          הוסף הרשאה
        </Button>
      </div>
    </form>
  );
}

// ─── Permit Row ──────────────────────────────────────────────────────────────
function PermitRow({ permit, onRefresh }: { permit: Permit; onRefresh: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const confirm = async (action: "confirm-add" | "confirm-remove") => {
    setLoading(action);
    try {
      await apiFetch(`/palgate/permits/${permit.id}/${action}`, { method: "POST", body: JSON.stringify({ confirmedBy: "ops" }) });
      toast({ title: action === "confirm-add" ? "הרשאה הוספה לשער ✅" : "הרשאה הוסרה מהשער ✅" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setLoading(null); }
  };

  const remove = async () => {
    if (!confirm(`מחיקת הרשאה של ${permit.guestName}?`)) return;
    setLoading("delete");
    try {
      await apiFetch(`/palgate/permits/${permit.id}`, { method: "DELETE" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setLoading(null); }
  };

  const isToday = (d: string) => d === today();
  const checkInToday = isToday(permit.checkIn);
  const checkOutToday = isToday(permit.checkOut);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border overflow-hidden ${checkInToday || checkOutToday ? "border-amber-300 ring-1 ring-amber-200" : "border-border"}`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 text-lg">
          🧑‍🤝‍🧑
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13px] text-foreground">{permit.guestName}</span>
            {(checkInToday || checkOutToday) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
                {checkInToday ? "🔑 היום" : "🚪 עוזב היום"}
              </span>
            )}
            <StatusBadge status={permit.status} />
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{permit.guestPhone}</span>
            {permit.unitOrNote && <span className="flex items-center gap-1"><Home className="w-3 h-3" />{permit.unitOrNote}</span>}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {permit.checkIn} → {permit.checkOut}
            </span>
          </div>

          {permit.addedConfirmedBy && (
            <div className="text-[10px] text-emerald-600">✓ נוסף ע״י {permit.addedConfirmedBy} ב-{permit.addedToGate ? new Date(permit.addedToGate).toLocaleDateString("he-IL") : ""}</div>
          )}
          {permit.removedConfirmedBy && (
            <div className="text-[10px] text-slate-500">✓ הוסר ע״י {permit.removedConfirmedBy} ב-{permit.removedFromGate ? new Date(permit.removedFromGate).toLocaleDateString("he-IL") : ""}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {permit.status === "pending" && (
            <Button size="sm" className="gap-1 h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
              onClick={() => confirm("confirm-add")} disabled={!!loading}>
              {loading === "confirm-add" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              הוספתי
            </Button>
          )}
          {permit.status === "active" && (
            <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => confirm("confirm-remove")} disabled={!!loading}>
              {loading === "confirm-remove" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              הסרתי
            </Button>
          )}
          <button onClick={remove} disabled={!!loading}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PalgatePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [addPanel, setAddPanel] = useState<"none" | "manual" | "sheet">("none");
  const [dailyLoading, setDailyLoading] = useState(false);

  const { data: permits = [], isLoading } = useQuery<Permit[]>({
    queryKey: ["palgate-permits", filter],
    queryFn: () => apiFetch(`/palgate/permits${filter !== "all" ? `?status=${filter}` : ""}`),
    refetchInterval: 30000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["palgate-permits"] });

  const runDailyCheck = async () => {
    setDailyLoading(true);
    try {
      const r = await apiFetch("/palgate/daily-check", { method: "POST" });
      toast({ title: `בדיקה יומית הושלמה`, description: `${r.arrivals} הגעות, ${r.departures} עזיבות${r.telegramSent ? " — נשלח לטלגרם" : " — טלגרם לא מוגדר"}` });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setDailyLoading(false); }
  };

  const todayPermits = permits.filter(p => p.checkIn === today() || p.checkOut === today());
  const pending = permits.filter(p => p.status === "pending");
  const active = permits.filter(p => p.status === "active");

  const filtered = filter === "all" ? permits
    : filter === "today" ? todayPermits
    : permits.filter(p => p.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PALGATE — ניהול הרשאות שער</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול הרשאות כניסה לשערים אוטומטיים — הגעה, עזיבה, ואישור ידני
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-[12px]"
            onClick={runDailyCheck} disabled={dailyLoading}>
            {dailyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            בדיקה יומית + טלגרם
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-[12px]"
            onClick={() => setAddPanel(p => p === "sheet" ? "none" : "sheet")}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            ייבא מ-Sheets
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-[12px]"
            onClick={() => setAddPanel(p => p === "manual" ? "none" : "manual")}>
            <Plus className="w-3.5 h-3.5" />
            הוסף ידנית
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "סה״כ", value: permits.length, color: "#6366f1", bg: "#eef2ff" },
          { label: "ממתין להוספה", value: pending.length, color: "#f97316", bg: "#fff7ed" },
          { label: "פעיל בשער", value: active.length, color: "#10b981", bg: "#ecfdf5" },
          { label: "היום", value: todayPermits.length, color: "#f59e0b", bg: "#fffbeb" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border px-4 py-3 flex items-center gap-3"
            style={{ borderTop: `2.5px solid ${s.color}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Add panels */}
      <AnimatePresence>
        {addPanel !== "none" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-white rounded-xl border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[13px] text-foreground">
                  {addPanel === "manual" ? "➕ הוסף הרשאה ידנית" : "📊 ייבוא מ-Google Sheets"}
                </div>
                <button onClick={() => setAddPanel("none")} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
              </div>
              {addPanel === "manual"
                ? <AddPermitForm onDone={() => { setAddPanel("none"); refresh(); }} />
                : <SheetSyncPanel onDone={() => { setAddPanel("none"); refresh(); }} />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: "all", label: "הכל" },
          { id: "today", label: "🔔 היום" },
          { id: "pending", label: "ממתין להוספה" },
          { id: "active", label: "פעיל בשער" },
          { id: "removed", label: "הוסר" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${filter === f.id ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/30"}`}>
            {f.label}
          </button>
        ))}
        <button onClick={refresh} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Permits list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">טוען הרשאות...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">אין הרשאות בפילטר הזה</div>
          <div className="text-[12px] text-muted-foreground/70 mt-1">הוסף הרשאה ידנית או ייבא מ-Google Sheets</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => <PermitRow key={p.id} permit={p} onRefresh={refresh} />)}
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-[12px] text-blue-800 space-y-1.5">
        <div className="font-semibold text-[13px]">💡 איך עובד הזרימה</div>
        <div>1. <b>ייבא</b> אורחים מ-Google Sheets (או הוסף ידנית)</div>
        <div>2. לחץ <b>בדיקה יומית + טלגרם</b> כל בוקר — תקבל הודעות עם כל ההגעות והעזיבות של היום</div>
        <div>3. לאחר שהוספת הרשאה ב-PALGATE, לחץ <b>הוספתי ✅</b> לסימון</div>
        <div>4. ביום העזיבה, לאחר הסרה ב-PALGATE, לחץ <b>הסרתי</b></div>
        <div className="text-blue-600">🔌 בעתיד: כשיהיה API של PALGATE, השלבים 3-4 יבוצעו אוטומטית</div>
      </div>
    </div>
  );
}
