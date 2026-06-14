import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Copy, Check, Zap, Bot, Building2, BarChart3, Mail,
  MessageSquare, ShoppingCart, Users, FileText, Bell, Calendar,
  TrendingUp, Shield, RefreshCw, Globe2, Layers, ChevronDown,
  ChevronRight, Play, Star, Clock, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Workflow definitions ──────────────────────────────────────────────────────

interface WorkflowStep {
  id: string;
  label: string;
  type: "trigger" | "ai" | "condition" | "action" | "notification" | "data";
  description: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  category: "מכירות" | "שיווק" | "שירות לקוחות" | "פיננסים" | "HR" | "תפעול" | "תוכן";
  icon: React.ReactNode;
  color: string;
  bg: string;
  complexity: "פשוט" | "בינוני" | "מתקדם";
  estimatedSetup: string;
  roi: string;
  tags: string[];
  steps: WorkflowStep[];
  customizationPoints: string[];
}

const WORKFLOWS: WorkflowTemplate[] = [
  {
    id: "lead-fast-track",
    name: "Lead Fast-Track Pipeline",
    nameHe: "🚀 מסלול מהיר לליד חם",
    description: "ליד נכנס → AI מסווג עוצמה → ליד חם מקבל מענה תוך 2 דקות, ליד קר נכנס לנירצ'ר אוטומטי.",
    category: "מכירות",
    icon: <Zap className="w-5 h-5" />,
    color: "#ef4444",
    bg: "#fef2f2",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "חיסכון 8 שעות/שבוע",
    tags: ["ליד", "מכירות", "AI סיווג"],
    steps: [
      { id: "s1", label: "ליד נכנס מטופס/CRM", type: "trigger", description: "webhook מהאתר, Facebook Lead Ads, או Typeform" },
      { id: "s2", label: "AI מנתח עוצמת הליד", type: "ai", description: "מנתח תקציב, תפקיד, חברה וכוונת רכישה — מחזיר ציון 1-10" },
      { id: "s3", label: "פיצול: חם / קר / פסול", type: "condition", description: "ציון 7+ = חם | 4-6 = קר | 1-3 = פסול" },
      { id: "s4", label: "ליד חם → מנהל מכירות", type: "notification", description: "WhatsApp + אימייל + CRM עם סיכום AI" },
      { id: "s5", label: "ליד קר → רצף נירצ'ר", type: "action", description: "5 אימיילים אוטומטיים על פני 30 יום" },
      { id: "s6", label: "עדכון CRM + לוג", type: "data", description: "שמירה ב-HubSpot/Pipedrive עם כל הנתונים" },
    ],
    customizationPoints: ["סף ציון לליד חם", "ערוצי התראה (WA/Email/Slack)", "תוכן רצף הנירצ'ר", "שדות CRM לעדכון"],
  },
  {
    id: "daily-report",
    name: "Daily Business Intelligence Report",
    nameHe: "📊 דוח BI יומי אוטומטי",
    description: "כל בוקר ב-08:00 — אוסף נתונים מ-CRM, אנליטיקס ומכירות, מסכם עם AI ושולח לניהול.",
    category: "תפעול",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "#6366f1",
    bg: "#eef2ff",
    complexity: "מתקדם",
    estimatedSetup: "3 שעות",
    roi: "חיסכון 5 שעות/שבוע",
    tags: ["BI", "דוחות", "ניהול"],
    steps: [
      { id: "s1", label: "Cron — 08:00 כל יום", type: "trigger", description: "מתחיל בדיוק ב-08:00 בכל יום עבודה" },
      { id: "s2", label: "שליפת נתוני מכירות", type: "data", description: "API ל-CRM: עסקאות אמש, pipeline, ציפיות חודש" },
      { id: "s3", label: "שליפת נתוני אנליטיקס", type: "data", description: "Google Analytics: תנועה, המרות, מקורות" },
      { id: "s4", label: "שליפת נתוני תמיכה", type: "data", description: "כרטיסים פתוחים, זמן מענה ממוצע, CSAT" },
      { id: "s5", label: "AI מסכם ומנתח", type: "ai", description: "מייצר narrative insights, מזהה חריגות, ממליץ actions" },
      { id: "s6", label: "שליחה ל-Slack + אימייל", type: "notification", description: "Slack #management-updates + אימייל לCEO" },
    ],
    customizationPoints: ["שעת שליחה", "מקורות נתונים", "נמענים", "פורמט הדוח (PDF/Markdown/HTML)"],
  },
  {
    id: "churn-prevention",
    name: "Customer Churn Prevention",
    nameHe: "🛡️ מניעת נטישת לקוחות",
    description: "מזהה לקוחות בסיכון נטישה לפי patterns התנהגות, מפעיל retention playbook אוטומטי.",
    category: "שירות לקוחות",
    icon: <Shield className="w-5 h-5" />,
    color: "#f59e0b",
    bg: "#fffbeb",
    complexity: "מתקדם",
    estimatedSetup: "4 שעות",
    roi: "שמירת 15-30% לקוחות בסיכון",
    tags: ["retention", "לקוחות", "AI ניבוי"],
    steps: [
      { id: "s1", label: "Cron שבועי — ניתוח לקוחות", type: "trigger", description: "כל יום ראשון בבוקר" },
      { id: "s2", label: "שליפת מדדי שימוש", type: "data", description: "Login frequency, feature usage, support tickets" },
      { id: "s3", label: "AI מחשב churn score", type: "ai", description: "ניתוח patterns: ירידה בשימוש, תלונות, אי-חידוש" },
      { id: "s4", label: "זיהוי לקוחות HIGH RISK", type: "condition", description: "score > 70% → רשימת סיכון" },
      { id: "s5", label: "AI מייצר retention offer", type: "ai", description: "הצעה מותאמת אישית לפי ערך לקוח והיסטוריה" },
      { id: "s6", label: "CSM מקבל briefing + task", type: "notification", description: "Slack + CRM task עם הצעת ה-offer" },
    ],
    customizationPoints: ["מדדי סיכון (הגדרה)", "סף churn score", "סוגי הצעות retention", "הקצאת CSM"],
  },
  {
    id: "support-ticket-router",
    name: "Intelligent Support Ticket Router",
    nameHe: "🎧 נתב כרטיסי תמיכה חכם",
    description: "כרטיס תמיכה נכנס → AI מסווג urgency+category → מנתב לנציג הנכון → SLA אוטומטי.",
    category: "שירות לקוחות",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#0ea5e9",
    bg: "#f0f9ff",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "קיצור זמן מענה ב-60%",
    tags: ["תמיכה", "ניתוב", "SLA"],
    steps: [
      { id: "s1", label: "כרטיס נכנס (email/form)", type: "trigger", description: "Zendesk/Freshdesk webhook או IMAP" },
      { id: "s2", label: "AI מסווג: category + urgency", type: "ai", description: "Bug/Billing/Feature/General × Critical/High/Normal/Low" },
      { id: "s3", label: "האם בוט יכול לפתור?", type: "condition", description: "FAQ matching — אם כן, מענה אוטומטי מיידי" },
      { id: "s4", label: "ניתוב לנציג המתאים", type: "action", description: "לפי category → נציג מתמחה + התראת Slack" },
      { id: "s5", label: "הגדרת SLA אוטומטי", type: "data", description: "Critical: 1h | High: 4h | Normal: 24h | Low: 72h" },
      { id: "s6", label: "אישור ללקוח", type: "notification", description: "אימייל אוטומטי עם מספר כרטיס + זמן מענה צפוי" },
    ],
    customizationPoints: ["קטגוריות תמיכה", "כללי ניתוב", "SLA לכל רמה", "תוכן מייל אישור"],
  },
  {
    id: "content-calendar",
    name: "Content Calendar Automation",
    nameHe: "📅 אוטומציית לוח תוכן",
    description: "לוח תוכן ב-Notion/Google Sheets → AI כותב → Canva/עיצוב → פרסום אוטומטי בזמן קבוע.",
    category: "תוכן",
    icon: <Calendar className="w-5 h-5" />,
    color: "#8b5cf6",
    bg: "#f5f3ff",
    complexity: "מתקדם",
    estimatedSetup: "3 שעות",
    roi: "חיסכון 10 שעות/שבוע",
    tags: ["תוכן", "רשתות חברתיות", "אוטומציה"],
    steps: [
      { id: "s1", label: "Cron — שליפת לוח תוכן", type: "trigger", description: "כל יום ב-07:00, שולף פריטים מ-Notion/Sheets" },
      { id: "s2", label: "AI כותב טקסט לכל פלטפורמה", type: "ai", description: "LinkedIn / Twitter / Instagram / Facebook — tone שונה" },
      { id: "s3", label: "בדיקת גרפיקה קיימת", type: "condition", description: "אם יש תמונה בלוח — משתמש בה | אחרת — Unsplash" },
      { id: "s4", label: "אישור אנושי (optional)", type: "action", description: "שליחה ל-Slack לאישור לפני פרסום" },
      { id: "s5", label: "פרסום אוטומטי", type: "action", description: "LinkedIn API + Buffer/Later + Facebook Graph" },
      { id: "s6", label: "עדכון לוח + מדדים", type: "data", description: "סטטוס 'Published' + קישור לפוסט בלוח" },
    ],
    customizationPoints: ["מקור לוח תוכן", "פלטפורמות פרסום", "Tone of voice", "שעת פרסום לכל פלטפורמה"],
  },
  {
    id: "invoice-payment-tracker",
    name: "Invoice & Payment Tracker",
    nameHe: "💰 מעקב חשבוניות ותשלומים",
    description: "יוצר חשבוניות, שולח תזכורות אוטומטיות לפני ואחרי מועד פרעון, מזהה חריגות.",
    category: "פיננסים",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "#10b981",
    bg: "#ecfdf5",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "קיצור DSO ב-40%",
    tags: ["חשבוניות", "תשלומים", "פיננסים"],
    steps: [
      { id: "s1", label: "חשבונית חדשה נוצרת", type: "trigger", description: "webhook מ-QuickBooks/Xero/חשבשבת" },
      { id: "s2", label: "שמירה ב-tracking DB", type: "data", description: "due date, amount, client, status" },
      { id: "s3", label: "7 ימים לפני פרעון", type: "trigger", description: "Cron check יומי — מזהה קרובות לפרעון" },
      { id: "s4", label: "AI כותב תזכורת מותאמת", type: "ai", description: "טון לפי היסטוריה: לקוח טוב = עדין, מאחר = נחרץ" },
      { id: "s5", label: "שליחה — אימייל + WhatsApp", type: "notification", description: "תזכורת 7 ימים לפני + ביום הפרעון + שבוע אחרי" },
      { id: "s6", label: "עדכון סטטוס + דוח", type: "data", description: "Paid/Overdue/Partial — דוח שבועי לCFO" },
    ],
    customizationPoints: ["מועדי תזכורת", "טון לפי לקוח", "ערוצי שליחה", "חיבור לאפליקציית הנהלת חשבונות"],
  },
  {
    id: "employee-onboarding",
    name: "Employee Onboarding Workflow",
    nameHe: "👥 תהליך קליטת עובד מלא",
    description: "עובד חדש מאושר → מעביר ציוד, מגדיר הרשאות, שולח מדריך אישי, מתזמן meetings.",
    category: "HR",
    icon: <Users className="w-5 h-5" />,
    color: "#f43f5e",
    bg: "#fff1f2",
    complexity: "מתקדם",
    estimatedSetup: "4 שעות",
    roi: "קיצור זמן קליטה ב-70%",
    tags: ["HR", "קליטה", "אוטומציה"],
    steps: [
      { id: "s1", label: "אישור גיוס ב-HRIS", type: "trigger", description: "webhook מ-BambooHR/HiBob/Workday" },
      { id: "s2", label: "יצירת חשבונות + הרשאות", type: "action", description: "Google Workspace, Slack, GitHub, Jira — אוטומטי" },
      { id: "s3", label: "AI מייצר מדריך קליטה", type: "ai", description: "מותאם לתפקיד, מחלקה וטכנולוגיות שימוש" },
      { id: "s4", label: "תיזמון meetings", type: "action", description: "1:1 עם מנהל, היכרות עם צוות, סשן IT — Calendar" },
      { id: "s5", label: "שליחת ציוד + מידע", type: "notification", description: "אימייל עם מדריך, מדבקות, קוד Wifi, badges" },
      { id: "s6", label: "תזכורות 30/60/90 יום", type: "action", description: "Follow-up אוטומטי למנהל לגבי milestone" },
    ],
    customizationPoints: ["מערכות לגישה", "תוכן מדריך הקליטה", "Meeting schedule", "ציוד לשליחה"],
  },
  {
    id: "email-campaign-manager",
    name: "Email Campaign Manager",
    nameHe: "📬 מנהל קמפיין אימיילים",
    description: "AI כותב אימיילים, מבצע A/B testing, שולח בזמן האופטימלי, מנתח ביצועים ומכוון.",
    category: "שיווק",
    icon: <Mail className="w-5 h-5" />,
    color: "#6366f1",
    bg: "#eef2ff",
    complexity: "מתקדם",
    estimatedSetup: "3 שעות",
    roi: "שיפור open rate ב-35%",
    tags: ["אימייל", "שיווק", "A/B Testing"],
    steps: [
      { id: "s1", label: "הגדרת קמפיין חדש", type: "trigger", description: "webhook מ-dashboard או Notion CMS" },
      { id: "s2", label: "AI כותב 2 גרסאות (A/B)", type: "ai", description: "Subject lines + body שונים לכל segment" },
      { id: "s3", label: "סגמנטציה של רשימה", type: "data", description: "לפי industry, stage, behavior, location" },
      { id: "s4", label: "שליחה בזמן אופטימלי", type: "action", description: "ML-based send time optimization לפי timezone" },
      { id: "s5", label: "מדידת ביצועים (24h)", type: "data", description: "Open rate, CTR, Unsubscribe, Conversions" },
      { id: "s6", label: "AI מסכם + ממליץ לגרסה הבאה", type: "ai", description: "מה עבד, מה לא, איך לשפר" },
    ],
    customizationPoints: ["מקור הרשימה", "קריטריוני סגמנטציה", "Tone of voice", "זמני שליחה מועדפים"],
  },
  {
    id: "social-monitor",
    name: "Brand Social Media Monitor",
    nameHe: "📡 ניטור מותג ברשתות חברתיות",
    description: "מנטר mentions של המותג ברשתות, מנתח sentiment, מגיב לשליליים ומדווח יומי.",
    category: "שיווק",
    icon: <Globe2 className="w-5 h-5" />,
    color: "#ec4899",
    bg: "#fdf2f8",
    complexity: "מתקדם",
    estimatedSetup: "3 שעות",
    roi: "הגנה על מוניטין + engagement x3",
    tags: ["brand", "מוניטין", "sentiment"],
    steps: [
      { id: "s1", label: "Cron כל שעה — scraping", type: "trigger", description: "Twitter/X, LinkedIn, Facebook, Google Reviews" },
      { id: "s2", label: "AI ניתוח sentiment", type: "ai", description: "Positive / Negative / Neutral + score + emotions" },
      { id: "s3", label: "תגובה לשליליים בZמן אמת", type: "condition", description: "אם negative + mentions >= 3 → alert מיידי" },
      { id: "s4", label: "AI מייצר תגובה מוצעת", type: "ai", description: "תגובה אמפתית, מקצועית, מותאמת לפלטפורמה" },
      { id: "s5", label: "אישור + פרסום", type: "action", description: "Slack לאישור → פרסום דרך API" },
      { id: "s6", label: "דוח יומי sentiment", type: "notification", description: "סיכום: mentions, avg score, top issues, trends" },
    ],
    customizationPoints: ["מילות מפתח לניטור", "פלטפורמות", "סף התראה", "Tone תגובות"],
  },
  {
    id: "sales-pipeline",
    name: "Sales Pipeline Manager",
    nameHe: "📈 מנהל Pipeline מכירות",
    description: "מנהל pipeline אוטומטי — מזיז עסקאות, שולח תזכורות, מנתח stuck deals ומייצר תחזיות.",
    category: "מכירות",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "#10b981",
    bg: "#ecfdf5",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "שיפור win rate ב-25%",
    tags: ["pipeline", "CRM", "תחזיות"],
    steps: [
      { id: "s1", label: "פעילות ב-CRM מזה 5 ימים", type: "trigger", description: "CRM webhook: עסקה ללא עדכון 5+ ימים" },
      { id: "s2", label: "AI מנתח stick deal", type: "ai", description: "מזהה חסם: תקציב? טכני? מחיר? מתחרה?" },
      { id: "s3", label: "המלצת next best action", type: "ai", description: "phone call? demo? discount? case study?" },
      { id: "s4", label: "תזכורת לנציג מכירות", type: "notification", description: "Slack + CRM task עם ניתוח + המלצה" },
      { id: "s5", label: "תחזית שבועית", type: "data", description: "Cron שבועי: Win/Loss/At-Risk לפי stage" },
      { id: "s6", label: "דוח לניהול", type: "notification", description: "pipeline forecast: צפי הכנסה + עסקאות בסיכון" },
    ],
    customizationPoints: ["ספי זמן לכל stage", "קריטריוני stuck deal", "המלצות next action", "נמעני דוחות"],
  },
  {
    id: "nps-survey",
    name: "Customer NPS Survey Automation",
    nameHe: "⭐ אוטומציית סקר NPS",
    description: "שולח סקרי NPS אוטומטיים, אוסף תשובות, מנתח טרנדים ומפעיל followup לפי ציון.",
    category: "שירות לקוחות",
    icon: <Star className="w-5 h-5" />,
    color: "#f59e0b",
    bg: "#fffbeb",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "שיפור NPS ב-15+ נקודות",
    tags: ["NPS", "שביעות רצון", "משוב"],
    steps: [
      { id: "s1", label: "30 ימים אחרי Purchase", type: "trigger", description: "Cron יומי: מזהה לקוחות 30 יום אחרי onboarding" },
      { id: "s2", label: "שליחת סקר NPS", type: "action", description: "אימייל פשוט: 0-10 + שאלה פתוחה" },
      { id: "s3", label: "קבלת תשובה", type: "trigger", description: "webhook מהטופס" },
      { id: "s4", label: "פיצול לפי ציון", type: "condition", description: "Promoter (9-10) | Passive (7-8) | Detractor (0-6)" },
      { id: "s5", label: "AI מנתח feedback פתוח", type: "ai", description: "מזהה themes, issues, feature requests" },
      { id: "s6", label: "פעולה לפי segment", type: "action", description: "Promoter→referral ask | Detractor→CSM call+recovery" },
    ],
    customizationPoints: ["מועד שליחה (ימים אחרי event)", "שאלות סקר", "סף Promoter/Detractor", "recovery offer"],
  },
  {
    id: "contract-renewal",
    name: "Contract Renewal Reminder",
    nameHe: "📋 תזכורות חידוש חוזים",
    description: "מנטר תאריכי חידוש חוזים, שולח התראות ל-CSM ולקוח בזמן הנכון, עוקב אחרי סטטוס.",
    category: "מכירות",
    icon: <FileText className="w-5 h-5" />,
    color: "#7c3aed",
    bg: "#f5f3ff",
    complexity: "פשוט",
    estimatedSetup: "1 שעה",
    roi: "העלאת retention ב-20%",
    tags: ["חוזים", "חידוש", "CSM"],
    steps: [
      { id: "s1", label: "Cron יומי — בדיקת חוזים", type: "trigger", description: "DB query: חוזים שמסתיימים ב-90/60/30/7 ימים" },
      { id: "s2", label: "AI מכין renewal pitch", type: "ai", description: "מותאם לערך לקוח, שימוש, ו-upsell opportunities" },
      { id: "s3", label: "90 ימים — התראה ל-CSM", type: "notification", description: "Slack: 'הגיע הזמן להתחיל שיחת חידוש'" },
      { id: "s4", label: "30 ימים — מייל ללקוח", type: "notification", description: "מייל אישי עם highlights + הצעת חידוש" },
      { id: "s5", label: "7 ימים — followup מוצע", type: "ai", description: "AI מכין call script לשיחה עם הלקוח" },
      { id: "s6", label: "עדכון CRM סטטוס", type: "data", description: "Renewed/At-Risk/Churned — דוח לניהול" },
    ],
    customizationPoints: ["ספי ימים להתראה", "תוכן ה-pitch", "הגדרת upsell", "ערוצי תקשורת"],
  },
  {
    id: "product-feedback",
    name: "Product Feedback Analyzer",
    nameHe: "🔬 מנתח משוב מוצר",
    description: "אוסף משוב מ-Intercom/email/סקרים, מסווג לפי feature area, מזהה patterns ומדווח ל-Product.",
    category: "תוכן",
    icon: <Layers className="w-5 h-5" />,
    color: "#0ea5e9",
    bg: "#f0f9ff",
    complexity: "מתקדם",
    estimatedSetup: "3 שעות",
    roi: "קיצור זמן product discovery ב-50%",
    tags: ["מוצר", "משוב", "ניתוח"],
    steps: [
      { id: "s1", label: "איסוף מכל הערוצים", type: "trigger", description: "Intercom, Typeform, Zendesk, App Store, email" },
      { id: "s2", label: "AI מסווג לפי feature area", type: "ai", description: "UX / Performance / Billing / Onboarding / API / Mobile" },
      { id: "s3", label: "ניתוח sentiment + urgency", type: "ai", description: "כמה כואב? כמה רוצים? מה ה-impact?" },
      { id: "s4", label: "אגרגציה שבועית", type: "data", description: "תדירות לפי נושא, trending issues, user segments" },
      { id: "s5", label: "AI מייצר תמצית ל-PM", type: "ai", description: "Top 5 pain points + quotes + suggested priorities" },
      { id: "s6", label: "שליחה ל-Notion + Jira", type: "action", description: "יצירת features/bugs ב-backlog אוטומטי" },
    ],
    customizationPoints: ["ערוצי קלט", "קטגוריות מוצר", "סף urgency", "שדות ב-Jira"],
  },
  {
    id: "referral-program",
    name: "Referral Program Manager",
    nameHe: "🤝 מנהל תוכנית הפניות",
    description: "מנהל תוכנית הפניות מקצה לקצה: tracking, rewards אוטומטי, קומוניקציה וניתוח ROI.",
    category: "שיווק",
    icon: <Users className="w-5 h-5" />,
    color: "#22c55e",
    bg: "#f0fdf4",
    complexity: "מתקדם",
    estimatedSetup: "4 שעות",
    roi: "CAC נמוך ב-60% מהפניות",
    tags: ["הפניות", "growth", "שיווק"],
    steps: [
      { id: "s1", label: "לקוח מצטרף לתוכנית", type: "trigger", description: "form/CTA → יצירת referral code ייחודי" },
      { id: "s2", label: "AI מייצר referral kit", type: "ai", description: "אימייל מותאם, הודעת WhatsApp, פוסט LinkedIn" },
      { id: "s3", label: "המופנה נרשם", type: "trigger", description: "webhook tracking המרה מ-referral code" },
      { id: "s4", label: "אישור + reward אוטומטי", type: "action", description: "voucher/credit/gift card — שליחה אוטומטית" },
      { id: "s5", label: "תזכורת חודשית למפנה", type: "notification", description: "update: כמה נרשמו, כמה reward צברת" },
      { id: "s6", label: "דוח ROI חודשי", type: "data", description: "הפניות → לידים → לקוחות → Revenue מיוחס" },
    ],
    customizationPoints: ["סוג ה-reward", "כללי הזכאות", "תוכן ה-kit", "tracking parameters"],
  },
  {
    id: "inventory-alert",
    name: "Inventory Alert System",
    nameHe: "📦 מערכת התראות מלאי",
    description: "מנטר רמות מלאי, מתריע על חוסרים, מייצר הזמנות חוזרות אוטומטיות ומנתח צריכה.",
    category: "תפעול",
    icon: <Bell className="w-5 h-5" />,
    color: "#f97316",
    bg: "#fff7ed",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "ביטול stockouts, חיסכון 15% ב-overstock",
    tags: ["מלאי", "תפעול", "הזמנות"],
    steps: [
      { id: "s1", label: "Cron כל 4 שעות", type: "trigger", description: "שליפה מ-ERP/WMS/Shopify inventory" },
      { id: "s2", label: "בדיקה מול reorder point", type: "condition", description: "כל SKU: current stock vs. reorder threshold" },
      { id: "s3", label: "חישוב כמות להזמנה", type: "data", description: "EOQ (Economic Order Quantity) + lead time" },
      { id: "s4", label: "AI מנתח demand forecast", type: "ai", description: "עונתיות, טרנדים, events מיוחדים → כמות מומלצת" },
      { id: "s5", label: "יצירת הזמנת רכש", type: "action", description: "PO אוטומטי לספק + אישור במייל" },
      { id: "s6", label: "דשבורד מלאי + alerts", type: "notification", description: "Slack: critical stock | שבועי: status report" },
    ],
    customizationPoints: ["reorder points לפי SKU", "ספקים וAPI שלהם", "lead times", "קריטריוני demand forecast"],
  },
  {
    id: "revenue-attribution",
    name: "Revenue Attribution Tracker",
    nameHe: "💎 ייחוס הכנסות מדוייק",
    description: "עוקב אחרי כל ערוץ שיווקי, מייחס revenue לפי multi-touch attribution ומייצר דוח ROI.",
    category: "פיננסים",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "#6366f1",
    bg: "#eef2ff",
    complexity: "מתקדם",
    estimatedSetup: "5 שעות",
    roi: "אופטימיזציה של תקציב שיווק +30%",
    tags: ["attribution", "ROI", "שיווק"],
    steps: [
      { id: "s1", label: "איסוף touchpoints", type: "trigger", description: "GA4, Facebook Ads, LinkedIn, Email, Organic" },
      { id: "s2", label: "מיפוי journey לכל לקוח", type: "data", description: "first touch → last touch → all touchpoints" },
      { id: "s3", label: "Linear attribution calculation", type: "data", description: "כל touchpoint מקבל חלק יחסי מה-Revenue" },
      { id: "s4", label: "AI מזהה high-value journeys", type: "ai", description: "אילו שילובי ערוצים מביאים לקוחות הכי טובים?" },
      { id: "s5", label: "המלצת תקציב לערוצים", type: "ai", description: "double-down על ערוצים עובדים, קיצוץ בשאר" },
      { id: "s6", label: "דוח ROI שבועי לCMO", type: "notification", description: "Tableau/Data Studio dashboard + אימייל executive" },
    ],
    customizationPoints: ["מודל attribution (linear/first/last/data-driven)", "ערוצים לעקוב", "window attribution", "פילטרי לקוחות"],
  },
  {
    id: "multi-channel-inbox",
    name: "Multi-Channel Inbox Manager",
    nameHe: "📥 תיבת דואר רב-ערוצית",
    description: "מאחד email+WhatsApp+Telegram+Messenger לתיבה אחת, AI מסווג ומנתב — zero missed messages.",
    category: "שירות לקוחות",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#0088cc",
    bg: "#e6f4ff",
    complexity: "מתקדם",
    estimatedSetup: "4 שעות",
    roi: "אפס הודעות שנשכחות",
    tags: ["omnichannel", "inbox", "תמיכה"],
    steps: [
      { id: "s1", label: "קבלה מכל הערוצים", type: "trigger", description: "Email IMAP + WhatsApp API + Telegram Bot + Messenger" },
      { id: "s2", label: "נרמול לפורמט אחיד", type: "data", description: "{ channel, sender, message, timestamp, threadId }" },
      { id: "s3", label: "AI מסווג urgency + category", type: "ai", description: "Critical / Normal / Low × Sales / Support / PR / Spam" },
      { id: "s4", label: "dedup + threading", type: "data", description: "מזהה אותו אדם ממספר ערוצים — מאחד thread" },
      { id: "s5", label: "ניתוב לנציג הנכון", type: "action", description: "Slack #sales | #support | #pr — עם כל ה-context" },
      { id: "s6", label: "SLA tracking", type: "data", description: "מעקב זמן מענה, reminder אם עבר SLA" },
    ],
    customizationPoints: ["ערוצי קלט", "קריטריוני urgency", "כללי ניתוב", "SLA לכל category"],
  },
  {
    id: "ecommerce-abandonment",
    name: "E-Commerce Cart Recovery",
    nameHe: "🛒 שחזור עגלות נטושות",
    description: "מזהה נטישת עגלה, שולח רצף אוטומטי של 3 הודעות עם AI personalization ו-discount אוטומטי.",
    category: "מכירות",
    icon: <ShoppingCart className="w-5 h-5" />,
    color: "#f59e0b",
    bg: "#fffbeb",
    complexity: "בינוני",
    estimatedSetup: "2 שעות",
    roi: "החזרת 15-20% עגלות נטושות",
    tags: ["ecommerce", "conversion", "נטישה"],
    steps: [
      { id: "s1", label: "נטישת עגלה (Shopify/WooCommerce)", type: "trigger", description: "webhook: cart abandoned > 30 דקות" },
      { id: "s2", label: "AI מנתח את העגלה", type: "ai", description: "מוצרים, ערך, היסטוריית לקוח, מחיר מתחרה" },
      { id: "s3", label: "שליחה 1 — 1 שעה אחרי", type: "notification", description: "תזכורת חמה: 'שכחת משהו?' + תמונות מוצרים" },
      { id: "s4", label: "שליחה 2 — 24 שעות", type: "notification", description: "Social proof + ביקורות + 'נשאר רק X במלאי'" },
      { id: "s5", label: "שליחה 3 — 72 שעות + discount", type: "ai", description: "AI מחשב discount אופטימלי (5-15% לפי margin)" },
      { id: "s6", label: "עדכון Campaign Analytics", type: "data", description: "Recovered / Lost — revenue מיוחס לאוטומציה" },
    ],
    customizationPoints: ["timing לכל הודעה", "discount רמות", "ערוץ שליחה (email/SMS/WA)", "segment exclusions"],
  },
  {
    id: "competitor-price-monitor",
    name: "Competitor Price Intelligence",
    nameHe: "🔍 ריגול מחירי מתחרים",
    description: "סורק מחירי מתחרים כל יום, מזהה שינויים, מייצר המלצת תמחור ומתריע על opportunities.",
    category: "מכירות",
    icon: <RefreshCw className="w-5 h-5" />,
    color: "#ef4444",
    bg: "#fef2f2",
    complexity: "מתקדם",
    estimatedSetup: "3 שעות",
    roi: "תמחור תחרותי אוטומטי",
    tags: ["מחירים", "מתחרים", "תמחור"],
    steps: [
      { id: "s1", label: "Cron יומי — scraping", type: "trigger", description: "רשימת URL מתחרים לפי מוצר/קטגוריה" },
      { id: "s2", label: "Web scraping מחירים", type: "data", description: "Puppeteer/Playwright: price, availability, promotions" },
      { id: "s3", label: "השוואה ל-price DB", type: "data", description: "מה השתנה ממאמש? כמה %?" },
      { id: "s4", label: "AI ניתוח הזדמנויות", type: "ai", description: "מחיר מתחרה עלה → pricing opportunity? ירד → threat?" },
      { id: "s5", label: "המלצת מחיר + reasoning", type: "ai", description: "מחיר מומלץ לכל SKU + הסבר עסקי" },
      { id: "s6", label: "דוח יומי לteam + Slack alert", type: "notification", description: "שינויים משמעותיים → alert מיידי | שאר → דוח יומי" },
    ],
    customizationPoints: ["רשימת מתחרים ו-URLs", "מוצרים לניטור", "% שינוי לalert", "כללי תמחור אוטומטי"],
  },
  {
    id: "lead-scoring-ai",
    name: "AI Lead Scoring Engine",
    nameHe: "🧠 מנוע ציון לידים AI",
    description: "מנוע ML לציון לידים לפי 20+ סיגנלים — behavior, firmographic, engagement — מתעדכן אוטומטי.",
    category: "מכירות",
    icon: <Bot className="w-5 h-5" />,
    color: "#8b5cf6",
    bg: "#f5f3ff",
    complexity: "מתקדם",
    estimatedSetup: "5 שעות",
    roi: "שיפור SQL rate ב-40%",
    tags: ["lead scoring", "ML", "מכירות"],
    steps: [
      { id: "s1", label: "כל פעילות ליד → event", type: "trigger", description: "Page visit, email open, demo request, pricing page" },
      { id: "s2", label: "צבירת signals", type: "data", description: "Behavioral + Firmographic + Engagement signals" },
      { id: "s3", label: "AI מחשב composite score", type: "ai", description: "Weighted scoring: each signal category + recency decay" },
      { id: "s4", label: "עדכון score ב-CRM", type: "data", description: "real-time score update + score history" },
      { id: "s5", label: "Alert לנציג כשscore קפץ", type: "notification", description: "+20 נקודות ב-24h → 'ליד מתחמם!' + context" },
      { id: "s6", label: "שבועית: calibration AI", type: "ai", description: "עדכון weights לפי win/loss data → model improves" },
    ],
    customizationPoints: ["משקל כל signal", "ספים לפעולה", "גורמים דמוגרפיים", "מחזור כיוון מחדש"],
  },
];

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  "מכירות":       { color: "#ef4444", bg: "#fef2f2" },
  "שיווק":        { color: "#8b5cf6", bg: "#f5f3ff" },
  "שירות לקוחות": { color: "#0ea5e9", bg: "#f0f9ff" },
  "פיננסים":      { color: "#10b981", bg: "#ecfdf5" },
  "HR":           { color: "#f43f5e", bg: "#fff1f2" },
  "תפעול":        { color: "#f97316", bg: "#fff7ed" },
  "תוכן":         { color: "#6366f1", bg: "#eef2ff" },
};

const COMPLEXITY_META: Record<string, { color: string; bg: string; border: string }> = {
  "פשוט":   { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
  "בינוני": { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  "מתקדם":  { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
};

const STEP_ICONS: Record<WorkflowStep["type"], React.ReactNode> = {
  trigger:      <Zap className="w-3 h-3" />,
  ai:           <Bot className="w-3 h-3" />,
  condition:    <ChevronRight className="w-3 h-3" />,
  action:       <Play className="w-3 h-3" />,
  notification: <Bell className="w-3 h-3" />,
  data:         <BarChart3 className="w-3 h-3" />,
};

const STEP_COLORS: Record<WorkflowStep["type"], string> = {
  trigger:      "#6366f1",
  ai:           "#8b5cf6",
  condition:    "#f59e0b",
  action:       "#10b981",
  notification: "#0ea5e9",
  data:         "#64748b",
};

// ─── Workflow Card ─────────────────────────────────────────────────────────────
function WorkflowCard({ wf, onDeploy }: { wf: WorkflowTemplate; onDeploy: (wf: WorkflowTemplate) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const cx = COMPLEXITY_META[wf.complexity];
  const catCx = CATEGORY_COLORS[wf.category] ?? { color: "#6366f1", bg: "#eef2ff" };

  const handleCopySpec = async () => {
    const spec = JSON.stringify({
      name: wf.nameHe,
      description: wf.description,
      steps: wf.steps.map(s => ({ step: s.label, type: s.type, details: s.description })),
      customizationPoints: wf.customizationPoints,
    }, null, 2);
    await navigator.clipboard.writeText(spec);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "📋 Copied workflow spec", description: "Paste into any AI or n8n" });
  };

  const handleDownload = () => {
    const spec = JSON.stringify({
      name: wf.nameHe,
      nameEn: wf.name,
      description: wf.description,
      category: wf.category,
      complexity: wf.complexity,
      estimatedSetup: wf.estimatedSetup,
      roi: wf.roi,
      tags: wf.tags,
      steps: wf.steps,
      customizationPoints: wf.customizationPoints,
    }, null, 2);
    const blob = new Blob([spec], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow_${wf.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `📥 הורד: workflow_${wf.id}.json` });
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${wf.color}, ${wf.color}66)` }} />

      <div className="p-5 flex flex-col gap-3.5 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: catCx.bg, color: wf.color }}>
            {wf.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h3 className="font-bold text-[14px] text-foreground leading-tight">{wf.nameHe}</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                style={{ color: cx.color, background: cx.bg, borderColor: cx.border }}>
                {wf.complexity}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{wf.name}</p>
          </div>
        </div>

        {/* Category + meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: catCx.bg, color: catCx.color }}>
            {wf.category}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-2.5 h-2.5" />{wf.estimatedSetup}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
            <TrendingUp className="w-2.5 h-2.5" />{wf.roi}
          </span>
        </div>

        {/* Description */}
        <p className="text-[12.5px] text-muted-foreground leading-relaxed" dir="rtl">{wf.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {wf.tags.map(t => (
            <span key={t} className="text-[9.5px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
              #{t}
            </span>
          ))}
        </div>

        {/* Steps accordion */}
        <button onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Layers className="w-3 h-3" />
          {wf.steps.length} שלבים
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-1.5">
              {wf.steps.map((step, i) => (
                <div key={step.id} className="flex items-start gap-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-bold text-muted-foreground w-3">{i + 1}</span>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: STEP_COLORS[step.type] + "18", color: STEP_COLORS[step.type] }}>
                      {STEP_ICONS[step.type]}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-foreground leading-tight">{step.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{step.description}</div>
                  </div>
                </div>
              ))}

              {/* Customization points */}
              <div className="mt-3 p-2.5 rounded-lg bg-violet-50 border border-violet-100">
                <div className="text-[10px] font-bold text-violet-700 mb-1.5">🎛️ נקודות התאמה אישית</div>
                {wf.customizationPoints.map(p => (
                  <div key={p} className="text-[10px] text-violet-600 flex items-start gap-1.5 mb-0.5">
                    <span className="shrink-0 mt-0.5">•</span>{p}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="border-t border-border p-4 flex gap-2">
        <Button onClick={() => onDeploy(wf)} size="sm"
          className="flex-1 h-8 rounded-lg text-xs gap-1.5"
          style={{ background: wf.color }}>
          <Play className="w-3.5 h-3.5" />
          הפעל ב-AgentHub
        </Button>
        <Button onClick={handleDownload} variant="outline" size="sm" className="h-8 rounded-lg text-xs px-3 gap-1">
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button onClick={handleCopySpec} variant="outline" size="sm" className="h-8 rounded-lg text-xs px-3 gap-1">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function WorkflowLibraryPage() {
  const [categoryFilter, setCategoryFilter] = useState("הכל");
  const [complexityFilter, setComplexityFilter] = useState("הכל");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createWorkflow = useMutation({
    mutationFn: async (wf: WorkflowTemplate) => {
      const nodes = wf.steps.map((step, i) => ({
        id: `node-${i}`,
        type: step.type,
        label: step.label,
        description: step.description,
        position: { x: i * 220, y: 200 },
      }));
      const edges = wf.steps.slice(0, -1).map((_, i) => ({
        id: `edge-${i}`,
        source: `node-${i}`,
        target: `node-${i + 1}`,
      }));
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wf.nameHe, status: "active", nodes: JSON.stringify(nodes), edges: JSON.stringify(edges) }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      return res.json();
    },
    onSuccess: (_, wf) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: `✅ Workflow נוצר: ${wf.nameHe}`, description: "זמין תחת Workflows ← View All" });
    },
    onError: () => toast({ title: "שגיאה ביצירת workflow", variant: "destructive" }),
  });

  const categories = ["הכל", ...Array.from(new Set(WORKFLOWS.map(w => w.category)))];
  const complexities = ["הכל", "פשוט", "בינוני", "מתקדם"];

  const filtered = WORKFLOWS.filter(w => {
    if (categoryFilter !== "הכל" && w.category !== categoryFilter) return false;
    if (complexityFilter !== "הכל" && w.complexity !== complexityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return w.nameHe.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl p-8"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #064e3b 100%)" }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 15% 50%, #6366f1 0%, transparent 40%), radial-gradient(circle at 85% 30%, #10b981 0%, transparent 40%)"
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-semibold uppercase tracking-widest">
              100% Customizable — Ready to Deploy
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Workflow Library — ספריית תהליכים עסקיים
          </h1>
          <p className="text-slate-300 text-[13px] max-w-2xl leading-relaxed">
            {WORKFLOWS.length} workflows מוכנים לשימוש. כל workflow ניתן להתאמה מלאה ללקוח שלך —
            מפעיל ישירות ב-AgentHub בלחיצה אחת, או מוריד כ-JSON לייבוא ל-n8n.
          </p>
          <div className="flex gap-6 mt-5">
            {[
              { v: WORKFLOWS.length, l: "Workflows" },
              { v: "7", l: "קטגוריות" },
              { v: "100%", l: "ניתן להתאמה" },
              { v: "1-click", l: "Deploy" },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-xl font-bold text-white">{s.v}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חפש workflow לפי שם, תיאור או תגית..."
            dir="rtl"
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Category */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border overflow-x-auto">
            {categories.map(cat => {
              const catCx = cat !== "הכל" ? CATEGORY_COLORS[cat] : null;
              return (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap
                    ${categoryFilter === cat ? "bg-white shadow-sm text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
                  style={categoryFilter === cat && catCx ? { color: catCx.color } : undefined}>
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Complexity */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border">
            {complexities.map(c => {
              const ccx = c !== "הכל" ? COMPLEXITY_META[c] : null;
              return (
                <button key={c} onClick={() => setComplexityFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                    ${complexityFilter === c ? "bg-white shadow-sm text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
                  style={complexityFilter === c && ccx ? { color: ccx.color } : undefined}>
                  {c}
                </button>
              );
            })}
          </div>

          <div className="ml-auto text-[11px] text-muted-foreground">
            {filtered.length} workflows
          </div>
        </div>
      </div>

      {/* Grid */}
      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <AnimatePresence>
          {filtered.map(wf => (
            <WorkflowCard key={wf.id} wf={wf}
              onDeploy={(w) => createWorkflow.mutate(w)} />
          ))}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">לא נמצאו workflows לפי הסינון הנוכחי</p>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="font-bold text-[13px] mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          מקרא סוגי שלבים
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.entries(STEP_ICONS) as [WorkflowStep["type"], React.ReactNode][]).map(([type, icon]) => (
            <div key={type} className="flex items-center gap-2 text-[11px]">
              <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: STEP_COLORS[type] + "18", color: STEP_COLORS[type] }}>
                {icon}
              </div>
              <span className="text-muted-foreground capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
