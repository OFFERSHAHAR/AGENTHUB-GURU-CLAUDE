// ─── Task risk classifier ─────────────────────────────────────────────────────

export type RiskLevel = "low" | "high";

export interface TaskInfo {
  risk: RiskLevel;
  action: string;
  descHe: string;
  descEn: string;
  taskId: string;
}

const HIGH_RISK_RULES: {
  pattern: RegExp;
  action: string;
  descHe: string;
  descEn: string;
}[] = [
  {
    pattern: /מח[קכ]|delete|הסר|remove|למחוק/i,
    action: "delete",
    descHe: "מחיקת נתונים",
    descEn: "Delete data",
  },
  {
    pattern: /צור לקוח|create.?client|הוסף לקוח|לקוח חדש|new client/i,
    action: "create_client",
    descHe: "יצירת לקוח חדש",
    descEn: "Create new client",
  },
  {
    pattern: /שלח.?טלגרם|send.?telegram|הודעה לטלגרם|telegram message/i,
    action: "send_telegram",
    descHe: "שליחת הודעת טלגרם",
    descEn: "Send Telegram message",
  },
  {
    pattern: /עדכן.?לקוח|update.?client|שנה.?לקוח/i,
    action: "update_client",
    descHe: "עדכון פרטי לקוח",
    descEn: "Update client details",
  },
  {
    pattern: /מח[קכ].?סוכן|delete.?agent|הסר.?סוכן/i,
    action: "delete_agent",
    descHe: "מחיקת סוכן",
    descEn: "Delete agent",
  },
  {
    pattern: /צור.?סוכן|create.?agent|הוסף.?סוכן|new.?agent/i,
    action: "create_agent",
    descHe: "יצירת סוכן חדש",
    descEn: "Create new agent",
  },
  {
    pattern: /אפס|reset|נקה הכל|clear all/i,
    action: "reset",
    descHe: "איפוס מערכת",
    descEn: "System reset",
  },
  {
    pattern: /שנה.?הגדרות|change.?settings|update.?settings/i,
    action: "change_settings",
    descHe: "שינוי הגדרות",
    descEn: "Change settings",
  },
  {
    pattern: /הפעל.?webhook|set.?webhook|webhook/i,
    action: "set_webhook",
    descHe: "הגדרת Webhook",
    descEn: "Configure webhook",
  },
];

export function classifyTask(text: string): TaskInfo {
  for (const rule of HIGH_RISK_RULES) {
    if (rule.pattern.test(text)) {
      return {
        risk: "high",
        action: rule.action,
        descHe: rule.descHe,
        descEn: rule.descEn,
        taskId: Math.random().toString(36).slice(2),
      };
    }
  }
  return {
    risk: "low",
    action: "general",
    descHe: text.slice(0, 60),
    descEn: text.slice(0, 60),
    taskId: Math.random().toString(36).slice(2),
  };
}
