import { useState, useEffect } from "react";
import {
  useGetDedupWarnThreshold,
  useUpdateDedupWarnThreshold,
  getGetDedupWarnThresholdQueryKey,
  useGetDedupWarnThresholdHistory,
  getGetDedupWarnThresholdHistoryQueryKey,
  useGetDedupWindow,
  useUpdateDedupWindow,
  getGetDedupWindowQueryKey,
  useGetDedupWindowHistory,
  getGetDedupWindowHistoryQueryKey,
  useGetWebhookTelegramNotifications,
  useUpdateWebhookTelegramNotifications,
  getGetWebhookTelegramNotificationsQueryKey,
  useGetWebhookTelegramNotificationsHistory,
  getGetWebhookTelegramNotificationsHistoryQueryKey,
} from "@workspace/api-client-react";
import type { DedupWindowSettingUnit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useOpsIdentity } from "@/hooks/use-ops-identity";
import { formatWindowShort, formatWindowLong } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Filter, Check, RefreshCw, Globe2, History, ChevronDown, ArrowRight, Clock, CalendarRange, Undo2, UserCircle, Bell, MessageCircle, Send, AlertCircle } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

// Keep in sync with MAX_DEDUP_WINDOW_HOURS in the API (artifacts/api-server/src/routes/settings.ts).
const MAX_DEDUP_WINDOW_HOURS = 8760; // 365 days
const MAX_DEDUP_WINDOW_DAYS = MAX_DEDUP_WINDOW_HOURS / 24; // 365

function formatWindowHistoryValue(hours: number): string {
  return hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`;
}

function formatThresholdHistoryDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatThresholdHistoryDateShort(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function DedupThresholdSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: thresholdData, isLoading } = useGetDedupWarnThreshold({
    query: {
      queryKey: getGetDedupWarnThresholdQueryKey(),
      staleTime: 30_000,
    },
  });

  const { data: thresholdHistory } = useGetDedupWarnThresholdHistory({
    query: {
      queryKey: getGetDedupWarnThresholdHistoryQueryKey(),
      staleTime: 30_000,
    },
  });

  const { data: windowData } = useGetDedupWindow({
    query: { queryKey: getGetDedupWindowQueryKey(), staleTime: 30_000 },
  });
  const windowHours = windowData?.windowHours ?? 168;
  const windowUnit = windowData?.unit ?? "days";
  const windowLabel = formatWindowShort(windowHours, windowUnit);

  const { name: actorName, setName: setActorName } = useOpsIdentity();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [nameInput, setNameInput] = useState(actorName);

  const { mutate: saveThreshold, isPending: saving } = useUpdateDedupWarnThreshold({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Threshold updated", description: `Warn when ≥ ${data.threshold} duplicates in ${formatWindowLong(windowHours, windowUnit)}` });
        queryClient.invalidateQueries({ queryKey: getGetDedupWarnThresholdQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDedupWarnThresholdHistoryQueryKey() });
        setEditing(false);
      },
      onError: () => {
        toast({ title: "Failed to update threshold", variant: "destructive" });
      },
    },
  });

  const currentThreshold = thresholdData?.threshold ?? 10;

  function openEditor() {
    setInput(String(currentThreshold));
    setNameInput(actorName);
    setEditing(true);
  }

  function commit() {
    const val = parseInt(input, 10);
    if (isNaN(val) || val < 1) {
      toast({ title: "Enter a positive number", variant: "destructive" });
      return;
    }
    const name = nameInput.trim();
    setActorName(name);
    saveThreshold({ data: { threshold: val, ...(name ? { changedBy: name } : {}) } });
  }

  function undoLastChange(previousValue: number) {
    const name = actorName.trim();
    saveThreshold({ data: { threshold: previousValue, ...(name ? { changedBy: name } : {}) } });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Filter className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground leading-tight">
            Duplicate warning threshold
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            When a webhook trigger fires too frequently, duplicate runs are suppressed. AgentHub
            flags an agent with a <span className="font-medium text-foreground">high duplicate rate</span> once
            the number of suppressed duplicates in a rolling {formatWindowLong(windowHours, windowUnit)} window reaches this threshold.
            This is a <span className="font-medium text-foreground">global</span> setting that applies to every client and agent.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12.5px] text-muted-foreground flex-1">
              Warn when suppressed duplicates ≥
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : editing ? (
              <div className="flex flex-col gap-2 items-end">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="h-7 w-20 text-[12.5px] px-2 py-0"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={commit}
                    disabled={saving}
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    ✕
                  </Button>
                </div>
                <Input
                  type="text"
                  placeholder="Your name (for audit log)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-7 w-52 text-[12px] px-2 py-0 text-right"
                />
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground hover:text-primary transition-colors"
                onClick={openEditor}
                title="Click to edit threshold"
              >
                <span>{currentThreshold} events / {windowLabel}</span>
                <Settings2 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* ── Most-recent change, inline ── */}
          {(thresholdHistory?.history?.length ?? 0) > 0 && (() => {
            const latest = thresholdHistory!.history[0];
            const canUndo = latest.oldValue !== null && latest.oldValue !== undefined;
            return (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Last changed:{" "}
                <span className="font-medium text-foreground">
                  {canUndo
                    ? `${latest.oldValue} → ${latest.newValue}`
                    : `set to ${latest.newValue}`}
                </span>{" "}
                by <span className="font-medium text-foreground">{latest.changedBy}</span> on{" "}
                {formatThresholdHistoryDateShort(latest.changedAt)}
                {canUndo && (
                  <button
                    type="button"
                    onClick={() => undoLastChange(latest.oldValue as number)}
                    disabled={saving}
                    title={`Revert threshold back to ${latest.oldValue}`}
                    className="ml-1.5 inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline align-baseline"
                  >
                    {saving ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Undo2 className="w-2.5 h-2.5" />
                    )}
                    Undo
                  </button>
                )}
              </p>
            );
          })()}

          {/* ── Threshold change history ── */}
          {(thresholdHistory?.history?.length ?? 0) > 0 && (
            <div className="mt-3">
              <button
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                <History className="w-3 h-3" />
                <span>
                  {showHistory ? "Hide" : "Show"} change history ({thresholdHistory!.history.length})
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {showHistory && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden mt-2 space-y-1.5 pl-1"
                  >
                    {thresholdHistory!.history.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                      >
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          {h.oldValue !== null && h.oldValue !== undefined ? (
                            <>
                              <span>{h.oldValue}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                              <span>{h.newValue}</span>
                            </>
                          ) : (
                            <span>Set to {h.newValue}</span>
                          )}
                        </span>
                        <span className="flex-1" />
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatThresholdHistoryDate(h.changedAt)}
                        </span>
                        <span className="text-muted-foreground/70">· {h.changedBy}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DedupWindowDaysSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: windowData, isLoading } = useGetDedupWindow({
    query: {
      queryKey: getGetDedupWindowQueryKey(),
      staleTime: 30_000,
    },
  });

  const { data: windowHistory } = useGetDedupWindowHistory({
    query: { queryKey: getGetDedupWindowHistoryQueryKey(), staleTime: 30_000 },
  });

  const { name: actorName, setName: setActorName } = useOpsIdentity();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [unit, setUnit] = useState<DedupWindowSettingUnit>("days");
  const [showHistory, setShowHistory] = useState(false);
  const [nameInput, setNameInput] = useState(actorName);

  const { mutate: saveWindow, isPending: saving } = useUpdateDedupWindow({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Window updated", description: `Counting duplicates over the last ${formatWindowLong(data.windowHours, data.unit)}` });
        queryClient.invalidateQueries({ queryKey: getGetDedupWindowQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDedupWindowHistoryQueryKey() });
        setEditing(false);
      },
      onError: () => {
        toast({ title: "Failed to update window", variant: "destructive" });
      },
    },
  });

  const currentHours = windowData?.windowHours ?? 168;
  const currentUnit = windowData?.unit ?? "days";
  const currentLabel = formatWindowLong(currentHours, currentUnit);

  function openEditor() {
    // Seed the editor with the value in the currently-chosen unit
    setUnit(currentUnit);
    setInput(String(currentUnit === "hours" ? currentHours : currentHours / 24));
    setNameInput(actorName);
    setEditing(true);
  }

  function commit() {
    const val = parseInt(input, 10);
    if (isNaN(val) || val < 1) {
      toast({ title: "Enter a positive number", variant: "destructive" });
      return;
    }
    const max = unit === "hours" ? MAX_DEDUP_WINDOW_HOURS : MAX_DEDUP_WINDOW_DAYS;
    if (val > max) {
      toast({
        title: `Window too long`,
        description: `Keep it to ${max} ${unit} or less (max 365 days).`,
        variant: "destructive",
      });
      return;
    }
    const name = nameInput.trim();
    setActorName(name);
    saveWindow({ data: { value: val, unit, ...(name ? { changedBy: name } : {}) } });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
          <CalendarRange className="w-4 h-4 text-sky-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground leading-tight">
            Duplicate-detection window
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Suppressed duplicates are counted over a <span className="font-medium text-foreground">rolling window</span> when
            deciding whether an agent has a high duplicate rate. Choose <span className="font-medium text-foreground">hours</span> for
            very noisy webhooks (e.g. 6h or 12h) or <span className="font-medium text-foreground">days</span> for low-volume
            agents (e.g. 30 days), up to a maximum of <span className="font-medium text-foreground">365 days</span>. This is a{" "}
            <span className="font-medium text-foreground">global</span> setting that applies to every client and agent.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12.5px] text-muted-foreground flex-1">
              Count duplicates over the last
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : editing ? (
              <div className="flex flex-col gap-2 items-end">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={unit === "hours" ? MAX_DEDUP_WINDOW_HOURS : MAX_DEDUP_WINDOW_DAYS}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="h-7 w-16 text-[12.5px] px-2 py-0"
                    autoFocus
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as DedupWindowSettingUnit)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={commit}
                    disabled={saving}
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    ✕
                  </Button>
                </div>
                <Input
                  type="text"
                  placeholder="Your name (for audit log)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-7 w-52 text-[12px] px-2 py-0 text-right"
                />
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground hover:text-primary transition-colors"
                onClick={openEditor}
                title="Click to edit window"
              >
                <span>{currentLabel}</span>
                <Settings2 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* ── Window change history ── */}
          {(windowHistory?.history?.length ?? 0) > 0 && (
            <div className="mt-3">
              <button
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                <History className="w-3 h-3" />
                <span>
                  {showHistory ? "Hide" : "Show"} change history ({windowHistory!.history.length})
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {showHistory && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden mt-2 space-y-1.5 pl-1"
                  >
                    {windowHistory!.history.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                      >
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          {h.oldValueHours !== null && h.oldValueHours !== undefined ? (
                            <>
                              <span>{formatWindowHistoryValue(h.oldValueHours)}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                              <span>{formatWindowHistoryValue(h.newValueHours)}</span>
                            </>
                          ) : (
                            <span>Set to {formatWindowHistoryValue(h.newValueHours)}</span>
                          )}
                        </span>
                        <span className="flex-1" />
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatThresholdHistoryDate(h.changedAt)}
                        </span>
                        <span className="text-muted-foreground/70">· {h.changedBy}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WebhookTelegramNotificationsSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { name: actorName } = useOpsIdentity();
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading } = useGetWebhookTelegramNotifications({
    query: {
      queryKey: getGetWebhookTelegramNotificationsQueryKey(),
      staleTime: 30_000,
    },
  });

  const { data: notificationsHistory } = useGetWebhookTelegramNotificationsHistory({
    query: {
      queryKey: getGetWebhookTelegramNotificationsHistoryQueryKey(),
      staleTime: 30_000,
    },
  });

  const { mutate: saveEnabled, isPending: saving } = useUpdateWebhookTelegramNotifications({
    mutation: {
      onSuccess: (res) => {
        toast({
          title: res.enabled ? "התראות הופעלו" : "התראות הושתקו",
          description: res.enabled
            ? "הודעת ׳Webhook Triggered׳ תישלח לטלגרם בכל הפעלה"
            : "הודעת ׳Webhook Triggered׳ לא תישלח עוד לטלגרם",
        });
        queryClient.invalidateQueries({ queryKey: getGetWebhookTelegramNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWebhookTelegramNotificationsHistoryQueryKey() });
      },
      onError: () => {
        toast({ title: "עדכון ההתראות נכשל", variant: "destructive" });
      },
    },
  });

  const enabled = data?.enabled ?? true;

  function toggle(next: boolean) {
    const name = actorName.trim();
    saveEnabled({ data: { enabled: next, ...(name ? { changedBy: name } : {}) } });
  }

  return (
    <div dir="rtl" className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground leading-tight">
            התראות טלגרם על הפעלת Webhook
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            כאשר Webhook מפעיל סוכן, נשלחת לצ׳אט התפעול בטלגרם הודעת{" "}
            <span className="font-medium text-foreground">״Webhook Triggered״</span>. ניתן
            לכבות אותה כאן כדי להפסיק את ההצפה. זוהי הגדרה{" "}
            <span className="font-medium text-foreground">גלובלית</span> החלה על כל הלקוחות
            והסוכנים. שאר התראות הטלגרם (פקודות הבוט, התראות fallback של מודל) אינן מושפעות.
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Bell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12.5px] text-muted-foreground flex-1">
              שליחת הודעת ״Webhook Triggered״ לטלגרם
            </span>
            {isLoading ? (
              <Skeleton className="h-5 w-9 rounded-full" />
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-[12px] font-semibold ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {enabled ? "פעיל" : "כבוי"}
                </span>
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                <Switch
                  checked={enabled}
                  onCheckedChange={toggle}
                  disabled={saving}
                  aria-label="התראות טלגרם על הפעלת Webhook"
                />
              </div>
            )}
          </div>

          {/* ── Toggle change history ── */}
          {(notificationsHistory?.history?.length ?? 0) > 0 && (
            <div className="mt-3">
              <button
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                <History className="w-3 h-3" />
                <span>
                  {showHistory ? "הסתר" : "הצג"} היסטוריית שינויים ({notificationsHistory!.history.length})
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {showHistory && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden mt-2 space-y-1.5 pr-1"
                  >
                    {notificationsHistory!.history.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                      >
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          {h.previousEnabled !== null && h.previousEnabled !== undefined ? (
                            <>
                              <span>{h.previousEnabled ? "פעיל" : "כבוי"}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground rotate-180" />
                              <span>{h.enabled ? "פעיל" : "כבוי"}</span>
                            </>
                          ) : (
                            <span>הוגדר ל{h.enabled ? "פעיל" : "כבוי"}</span>
                          )}
                        </span>
                        <span className="flex-1" />
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatThresholdHistoryDate(h.changedAt)}
                        </span>
                        <span className="text-muted-foreground/70">· {h.changedBy}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatsAppDailySetting() {
  const { toast } = useToast();
  const [toPhone, setToPhone]           = useState("");
  const [sendHour, setSendHour]         = useState(8);
  const [enabled, setEnabled]           = useState(false);
  const [guestMsgs, setGuestMsgs]       = useState(false);
  const [configured, setConfigured]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [sending, setSending]     = useState(false);
  const [testing, setTesting]     = useState(false);

  useEffect(() => {
    fetch(`${API}/api/whatsapp/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setToPhone(d.settings.toPhone ?? "");
          setSendHour(d.settings.sendHour ?? 8);
          setEnabled(d.settings.enabled ?? false);
          setGuestMsgs(d.settings.guestMessagesEnabled ?? false);
          setConfigured(d.credentialsConfigured);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/whatsapp/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPhone, sendHour, enabled, guestMessagesEnabled: guestMsgs }),
      });
      const d = await res.json();
      if (d.ok) {
        toast({ title: "הגדרות WhatsApp נשמרו" });
        setEnabled(d.settings.enabled);
      } else {
        toast({ title: "שגיאה בשמירה", description: d.error, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    setSending(true);
    try {
      const res = await fetch(`${API}/api/whatsapp/send-daily`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (d.ok) {
        const r = d.result;
        toast({
          title: "הדוח נשלח!",
          description: `סיכום לבעלים: ${r.ownerSummary ? "✅" : "❌"} · כניסות: ${r.arrivalsSent} · יציאות: ${r.departuresSent}${r.errors?.length ? ` · שגיאות: ${r.errors.join(", ")}` : ""}`,
        });
      } else {
        toast({ title: "שגיאה בשליחה", description: d.error, variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch(`${API}/api/whatsapp/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (d.ok) {
        toast({ title: "הודעת בדיקה נשלחה ✅" });
      } else {
        toast({ title: "שגיאה", description: d.error, variant: "destructive" });
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div dir="rtl" className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground leading-tight">
            דוח יומי — WhatsApp
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            שליחה אוטומטית כל בוקר: ברכת כניסה לאורחים שנכנסים, תזכורת יציאה לעוזבים, וסיכום דוח לבעל הבית.
            מבוסס על גיליון ה-Turnovers.
          </p>

          {!configured && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-[12px] text-amber-800">
                חסרים <span className="font-mono font-semibold">WHATSAPP_TOKEN</span> ו-<span className="font-mono font-semibold">WHATSAPP_PHONE_NUMBER_ID</span> ב-Secrets.
                {" "}<a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer" className="underline font-medium">הוראות הגדרה ←</a>
              </p>
            </div>
          )}

          {loading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-48" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <span className="text-[12.5px] text-muted-foreground w-36 shrink-0">מספר יעד (WhatsApp)</span>
                <Input
                  type="tel"
                  dir="ltr"
                  placeholder="972501234567"
                  value={toPhone}
                  onChange={(e) => setToPhone(e.target.value)}
                  className="h-7 flex-1 text-[12.5px] px-2 py-0 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <span className="text-[12.5px] text-muted-foreground w-36 shrink-0">שעת שליחה (0–23)</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={sendHour}
                  onChange={(e) => setSendHour(Number(e.target.value))}
                  className="h-7 w-20 text-[12.5px] px-2 py-0"
                />
                <span className="text-[11px] text-muted-foreground">שעון ישראל</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <Bell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[12.5px] text-muted-foreground flex-1">שליחה אוטומטית כל בוקר</span>
                <span className={`text-[12px] font-semibold ${enabled ? "text-green-600" : "text-muted-foreground"}`}>
                  {enabled ? "פעיל" : "כבוי"}
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  aria-label="הפעל שליחה אוטומטית"
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[12.5px] text-muted-foreground flex-1">הודעות ישירות לאורחים</span>
                    <span className={`text-[12px] font-semibold ${guestMsgs ? "text-green-600" : "text-muted-foreground"}`}>
                      {guestMsgs ? "פעיל" : "כבוי"}
                    </span>
                    <Switch
                      checked={guestMsgs}
                      onCheckedChange={setGuestMsgs}
                      aria-label="הפעל הודעות לאורחים"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 pr-5">
                    כאשר פעיל — ישלח ברכת כניסה ותזכורת יציאה לטלפונים של האורחים מהגיליון.
                    {!guestMsgs && <span className="font-semibold text-amber-600"> כרגע כבוי — רק הסיכום נשלח לבעלים.</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-[12px]"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span className="mr-1">שמור הגדרות</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-[12px]"
                  onClick={sendNow}
                  disabled={sending || !configured}
                  title={!configured ? "הגדר Secrets קודם" : "שלח את הדוח של היום עכשיו"}
                >
                  {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span className="mr-1">שלח עכשיו</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-[12px] text-muted-foreground"
                  onClick={sendTest}
                  disabled={testing || !configured || !toPhone}
                  title="שלח הודעת בדיקה"
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  בדיקה
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OpsIdentitySetting() {
  const { name, setName } = useOpsIdentity();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(name);

  function openEditor() {
    setInput(name);
    setEditing(true);
  }

  function commit() {
    const next = input.trim();
    setName(next);
    setEditing(false);
    toast({
      title: next ? "Identity saved" : "Identity cleared",
      description: next
        ? `Audit-logged changes will be attributed to ${next}`
        : "Audit-logged changes will default to “ops”",
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
          <UserCircle className="w-4 h-4 text-sky-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground leading-tight">
            Your identity
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Type your name once and every change you make that is recorded in an
            audit trail — like the duplicate-warning threshold — will be
            attributed to you. Stored only in this browser. When left blank,
            changes are logged as <span className="font-medium text-foreground">ops</span>.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <UserCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12.5px] text-muted-foreground flex-1">
              Recorded as
            </span>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="text"
                  placeholder="Your name"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-7 w-52 text-[12.5px] px-2 py-0"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={commit}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={() => setEditing(false)}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground hover:text-primary transition-colors"
                onClick={openEditor}
                title="Click to edit your name"
              >
                <span>{name || "ops"}</span>
                <Settings2 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Globe2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-foreground leading-tight">
            Platform Settings
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Global configuration that applies across all clients and agents.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Audit Log
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <OpsIdentitySetting />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Webhook Triggers
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <DedupThresholdSetting />
        <DedupWindowDaysSetting />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notifications
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <WebhookTelegramNotificationsSetting />
        <WhatsAppDailySetting />
      </div>
    </motion.div>
  );
}
