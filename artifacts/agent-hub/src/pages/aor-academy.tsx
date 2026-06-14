import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle, Lock,
  Star, Zap, Trophy, Target, BookOpen, Lightbulb,
  ArrowLeft, Play, ExternalLink, RotateCcw, Flame,
  Brain, Bot, Rocket, Users, TrendingUp, DollarSign,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lesson {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  duration: string;
  xp: number;
  content: LessonContent[];
  mission: Mission;
}

interface LessonContent {
  type: "explain" | "analogy" | "steps" | "tip" | "glossary";
  heading?: string;
  text?: string;
  items?: string[];
  terms?: { word: string; plain: string }[];
}

interface Mission {
  title: string;
  steps: string[];
  link?: { label: string; href: string };
}

interface Module {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  lessons: Lesson[];
}

// ─── Curriculum ───────────────────────────────────────────────────────────────
const MODULES: Module[] = [
  {
    id: "foundations",
    emoji: "🧠",
    title: "בסיס: מה בעצם קורה כאן?",
    subtitle: "הבנת AI סוכנים בלי מילות מפתח מוצלבות",
    color: "#6366f1",
    bg: "#eef2ff",
    lessons: [
      {
        id: "what-is-ai",
        emoji: "🤖",
        title: "מה זה סוכן AI?",
        subtitle: "ומה ההבדל בינו לבין ChatGPT רגיל",
        duration: "10 דק'",
        xp: 50,
        content: [
          {
            type: "analogy",
            heading: "📍 תחשוב על זה כך:",
            text: "ChatGPT רגיל זה כמו לשאול חבר חכם שאלה — הוא עונה, וזהו. סוכן AI זה כמו לשכור עובד — הוא לא רק עונה, הוא עושה. הוא פותח מייל, שולח הודעה, מחפש מידע ברשת, ממלא טופס — הכל לבד."
          },
          {
            type: "explain",
            heading: "💡 במילים פשוטות:",
            text: "סוכן AI הוא תוכנה שמקבלת מטרה ומתחילה לעשות פעולות כדי להגיע אליה. בלי שמישהו יגיד לה צעד-צעד מה לעשות. היא מחליטה לבד."
          },
          {
            type: "steps",
            heading: "🔄 איך הוא עובד?",
            items: [
              "מקבל משימה: 'מצא לי 10 לידים בתחום הנדל\"ן בתל אביב'",
              "חושב מה צריך לעשות (לחפש ב-LinkedIn, באתרי נדל\"ן וכו')",
              "עושה את הפעולות בפועל",
              "מחזיר תוצאה מוכנה",
            ]
          },
          {
            type: "glossary",
            heading: "📖 מילון מהיר",
            terms: [
              { word: "Agent / סוכן", plain: "תוכנית AI שפועלת באופן עצמאי כדי להשלים משימה" },
              { word: "LLM", plain: "המוח של הסוכן — מודל שפה גדול (כמו GPT או Claude)" },
              { word: "Tool / כלי", plain: "יכולת שהסוכן יכול להשתמש בה, כמו גישה לאינטרנט" },
            ]
          },
          {
            type: "tip",
            heading: "🎯 בשורה אחת:",
            text: "סוכן AI = עובד דיגיטלי שפועל 24/7, לא מתעייף, ולא מבקש העלאה."
          }
        ],
        mission: {
          title: "🎯 המשימה שלך",
          steps: [
            "פתח את AgentHub (אתה כבר שם!)",
            "לחץ על 'Agent Repo' בתפריט השמאלי",
            "תסתכל על רשימת הסוכנים שיש כבר",
            "בחר אחד ולחץ עליו — קרא את התיאור שלו",
          ],
          link: { label: "🤖 לך לסוכנים →", href: "/agents" }
        }
      },
      {
        id: "agenthub-tour",
        emoji: "🗺️",
        title: "סיור ב-AgentHub",
        subtitle: "מה יש פה ולמה כל דבר שם",
        duration: "12 דק'",
        xp: 60,
        content: [
          {
            type: "explain",
            heading: "🏠 מה זה AgentHub?",
            text: "AgentHub היא הפלטפורמה שבה אתה ועופר מנהלים את כל הסוכנים, הלקוחות, ה-workflows ושאר הפעולות. תחשוב עליה כ-מטה שליטה של עסק ה-AI שלכם."
          },
          {
            type: "steps",
            heading: "📍 מה יש בתפריט:",
            items: [
              "Dashboard — סקירה כללית: מה קורה עכשיו",
              "Agent Repo — ארסנל הסוכנים שבניתם",
              "Clients — הלקוחות שמשלמים לכם",
              "Workflows — תהליכים אוטומטיים",
              "n8n Templates — אוטומציות מוכנות להורדה",
              "Workflow Library — 20 תהליכים עסקיים מוכנים",
            ]
          },
          {
            type: "analogy",
            heading: "💼 האנלוגיה:",
            text: "אם AgentHub זה המשרד שלכם — הסוכנים הם העובדים, הלקוחות הם הלקוחות, והworkflows הם הנהלים שכולם פועלים לפיהם."
          },
          {
            type: "tip",
            heading: "⚡ טיפ מהיר:",
            text: "JARVIS (הכפתור הכחול בפינה ימין-תחתון) ו-GABAR (שמאל) הם הסוכנים שעוזרים לך ולעופר לעבוד — פשוט לחץ ושאל!"
          }
        ],
        mission: {
          title: "🎯 המשימה שלך",
          steps: [
            "לחץ על Dashboard בתפריט",
            "תסתכל על הסטטיסטיקות — כמה סוכנים? כמה לקוחות?",
            "לחץ על Clients — תסתכל מה יש שם",
            "חזור לכאן וסמן 'סיימתי'!",
          ],
          link: { label: "📊 לדשבורד →", href: "/" }
        }
      },
    ]
  },
  {
    id: "first-project",
    emoji: "🚀",
    title: "פרויקט ראשון — צ'אטבוט לעסק",
    subtitle: "מבוקר לפגישה ראשונה עם לקוח",
    color: "#10b981",
    bg: "#ecfdf5",
    lessons: [
      {
        id: "client-needs",
        emoji: "🎙️",
        title: "מה הלקוח בעצם רוצה?",
        subtitle: "איך לגלות את הכאב האמיתי",
        duration: "15 דק'",
        xp: 75,
        content: [
          {
            type: "explain",
            heading: "🤔 הסוד הגדול של מכירות:",
            text: "אף לקוח לא רוצה 'סוכן AI'. הוא רוצה לחסוך זמן, להרוויח יותר כסף, או לא לעשות משהו שהוא שונא לעשות. אתה צריך לגלות מה הכאב שלו — ואז להסביר איך אתה פותר אותו."
          },
          {
            type: "steps",
            heading: "🗣️ שאלות שאתה חייב לשאול בפגישה:",
            items: [
              "'מה לוקח לך הכי הרבה זמן כל יום?'",
              "'יש משהו שאתה עושה ידנית שאפשר לעשות אוטומטי?'",
              "'מה הייתה המדהמה הכי גדולה שלך אם זה היה עצמאי?'",
              "'כמה שעות בשבוע אתה מבזבז על [הבעיה]?'",
            ]
          },
          {
            type: "analogy",
            heading: "🔑 האנלוגיה:",
            text: "רופא לא אומר 'אני מכיר דיקור סיני, מחשב לחץ דם, וניתוחים'. הוא שואל 'איפה כואב לך?' — ואז מציע פתרון. תהיה רופא, לא קטלוג מוצרים."
          },
          {
            type: "tip",
            heading: "💰 מה הכי נמכר:",
            text: "עסקים קטנים הכי כואב להם: מענה על שאלות לקוחות (כל הזמן), מעקב אחרי לידים שנשכחים, ומשימות חוזרות שמכניסות לשגרה. אלה הפתרונות שקל למכור!"
          }
        ],
        mission: {
          title: "🎯 תרגיל למחר",
          steps: [
            "בחר עסק שאתה מכיר (חבר, קרוב משפחה, חנות שאתה הולך אליה)",
            "שאל אותו: 'מה הכי מעצבן אותך בעבודה יומיומית?'",
            "כתוב את התשובה — שתף עם עופר",
            "ניסחו יחד פתרון פשוט",
          ]
        }
      },
      {
        id: "build-chatbot",
        emoji: "⚙️",
        title: "בונים צ'אטבוט ראשון",
        subtitle: "בלי קוד, בלי פחד",
        duration: "20 דק'",
        xp: 100,
        content: [
          {
            type: "explain",
            heading: "🏗️ איך בונים צ'אטבוט?",
            text: "עם n8n ו-Ollama אתה יכול לבנות צ'אטבוט מקצועי בלי לכתוב שורת קוד אחת. n8n זה כמו 'לגו' לאוטומציות — אתה מחבר בלוקים יחד ומקבל תהליך עובד."
          },
          {
            type: "glossary",
            heading: "📖 מילים שתשמע:",
            terms: [
              { word: "n8n", plain: "תוכנת אוטומציה — כמו Zapier אבל מקומי ובחינם" },
              { word: "Ollama", plain: "הדרך להריץ מודלי AI על המחשב שלך — ללא עלות" },
              { word: "Webhook", plain: "כתובת URL שמאזינה להודעות — כמו פעמון דלת דיגיטלי" },
              { word: "Node", plain: "צעד אחד ב-n8n — כמו 'בלוק' אחד בלגו" },
            ]
          },
          {
            type: "steps",
            heading: "🔧 השלבים לצ'אטבוט פשוט:",
            items: [
              "הורד את הטמפלט 'בוט תמיכה' מדף n8n Templates",
              "פתח n8n אצלך → Workflows → Import from File",
              "שנה את ה-system prompt לעסק הספציפי",
              "הפעל! תשאל אותו שאלה ותראה שהוא עונה",
            ]
          },
          {
            type: "tip",
            heading: "🎯 system prompt זה הלב של הסוכן:",
            text: "ה-system prompt זה ההוראות שאתה נותן לסוכן — מה הוא יודע, איך הוא מדבר, ומה הוא לא אומר. ככל שאתה יותר מפורט שם — הסוכן יותר טוב. זה הבידול שלכם!"
          }
        ],
        mission: {
          title: "🎯 המשימה: הורד + הפעל",
          steps: [
            "לחץ על הקישור למטה כדי לראות את הטמפלטים",
            "מצא את 'בוט תמיכה' — לחץ 'הורד JSON'",
            "ייבא ל-n8n שלך",
            "שנה את ה-system prompt לעסק שבחרת",
            "שלח הודעה ראשונה — צלם Screenshot ושתף עם עופר!",
          ],
          link: { label: "📋 לדף הטמפלטים →", href: "/n8n-templates" }
        }
      }
    ]
  },
  {
    id: "money",
    emoji: "💰",
    title: "כסף — כמה לגבות ואיך",
    subtitle: "תמחור, שיטות עבודה, ואיך לא לפחד לבקש",
    color: "#f59e0b",
    bg: "#fffbeb",
    lessons: [
      {
        id: "pricing",
        emoji: "💵",
        title: "כמה לגבות?",
        subtitle: "שלוש שיטות תמחור שעובדות",
        duration: "15 דק'",
        xp: 80,
        content: [
          {
            type: "explain",
            heading: "❓ השאלה הכי נפוצה:",
            text: "כל מי שמתחיל שואל 'כמה לבקש?' — והתשובה היא: תלוי כמה אתה חוסך ללקוח. אם הסוכן שלך חוסך 10 שעות בשבוע ללקוח, ושעה שלו שווה 100₪ — הוא חוסך 1,000₪ לשבוע = 4,000₪ לחודש. אתה יכול לבקש 1,500₪ לחודש ועדיין הוא מרוויח x2.5."
          },
          {
            type: "steps",
            heading: "💼 שלוש שיטות תמחור:",
            items: [
              "🔨 פרויקט חד-פעמי: 'אני בונה לך את הסוכן — 3,000-15,000₪'",
              "📅 תחזוקה חודשית: 'אני מנהל ומשפר — 500-2,000₪/חודש'",
              "🤝 שיתוף הצלחה: 'אני לוקח X% מהחיסכון שנוצר' (מתקדם)",
            ]
          },
          {
            type: "analogy",
            heading: "🏠 האנלוגיה:",
            text: "חשמלאי לא מתמחר לפי כמה זמן לקח לו — הוא מתמחר לפי הערך שנוצר. תדאג שתמיד יהיה ברור ללקוח כמה כסף/זמן הוא חוסך."
          },
          {
            type: "tip",
            heading: "🚀 טיפ של זהב:",
            text: "תמיד התחל עם פרויקט קטן יחסית (2,000-5,000₪) שמסיים הצלחה ברורה. אחרי שהלקוח רואה תוצאות — הוא מבקש עוד."
          }
        ],
        mission: {
          title: "🎯 תרגיל: חשב עסקה",
          steps: [
            "חשוב על עסק ספציפי (מכירת רכבים, מסעדה, קליניקה...)",
            "כמה שעות בשבוע הם מבזבזים על תשובות ללקוחות?",
            "חשב: שעות × תשלום שעתי = חיסכון חודשי",
            "כמה תבקש? (כ-30-40% מהחיסכון)",
            "כתוב את החישוב ושתף עם עופר — לשכלל יחד",
          ]
        }
      }
    ]
  },
  {
    id: "automation",
    emoji: "⚡",
    title: "אוטומציות — להרוויח בשינה",
    subtitle: "workflows שעובדים גם כשאתה ישן",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    lessons: [
      {
        id: "what-is-workflow",
        emoji: "🔗",
        title: "מה זה Workflow?",
        subtitle: "הסבר בלי קוד",
        duration: "10 דק'",
        xp: 70,
        content: [
          {
            type: "analogy",
            heading: "🏭 האנלוגיה הכי פשוטה:",
            text: "תחשוב על workflow כמו מתכון. יש חומרים (input), יש שלבים, ויש תוצאה (output). הבדל אחד: המתכון הזה מכין את עצמו. אתה מגדיר אותו פעם אחת — הוא רץ לבד לנצח."
          },
          {
            type: "steps",
            heading: "📋 דוגמה מהחיים:",
            items: [
              "לקוח ממלא טופס באתר (זה ה-Trigger — הגורם המפעיל)",
              "AI מנתח את הפרטים שלו ומחשב כמה הוא 'חם'",
              "אם חם → WhatsApp מיידי למנהל מכירות",
              "אם קר → נכנס לרצף אוטומטי של 5 אימיילים",
              "הכל ללא מגע יד אדם",
            ]
          },
          {
            type: "explain",
            heading: "💡 מה זה שווה?",
            text: "עסק שמקבל 100 לידים בחודש — עם workflow כזה כל ליד מטופל בשניות. בלעדיו? מישהו צריך לשבת ולבדוק כל אחד. זה שעות עבודה שנחסכות."
          },
          {
            type: "tip",
            heading: "⚡ הכלי שלכם:",
            text: "בדף 'Workflow Library' יש 20 workflows מוכנים לשימוש. כל אחד כבר תוכנן, כולל הסבר על מה הוא עושה ואיפה אפשר לשנות אותו ללקוח ספציפי."
          }
        ],
        mission: {
          title: "🎯 חקור workflow אחד",
          steps: [
            "לך לדף 'Workflow Library'",
            "בחר workflow שנשמע מעניין לך",
            "פתח את השלבים (לחץ על '6 שלבים')",
            "קרא את כל השלבים בקול — בן מה אתה מבין?",
            "חזור ותסביר לעופר במילים שלך מה הוא עושה",
          ],
          link: { label: "⚡ לספריית Workflows →", href: "/workflow-library" }
        }
      }
    ]
  },
  {
    id: "real-client",
    emoji: "🎯",
    title: "לקוח ראשון — מציאה וסגירה",
    subtitle: "מהיכרות ראשונה לחתימה על חוזה",
    color: "#ec4899",
    bg: "#fdf2f8",
    lessons: [
      {
        id: "find-client",
        emoji: "🔍",
        title: "איפה מוצאים לקוח ראשון?",
        subtitle: "שלוש שיטות שעובדות",
        duration: "12 דק'",
        xp: 90,
        content: [
          {
            type: "explain",
            heading: "📍 האמת:",
            text: "הלקוח הראשון בדרך כלל לא מגיע מ-LinkedIn או פרסום. הוא מגיע מהסביבה הקרובה שלך. מישהו שכבר סומך עליך."
          },
          {
            type: "steps",
            heading: "🎯 שלוש שיטות שעובדות:",
            items: [
              "🤝 מעגל חברים ומשפחה: 'יש לך חבר שמנהל עסק? אני יכול לבנות לו משהו לחינם ולהוכיח ערך'",
              "🏢 עסקים מקומיים: מסעדה, קליניקה, חנות — תכנס ותדבר עם הבעלים",
              "💻 פייסבוק/וואטסאפ: קבוצות של בעלי עסקים — תשאל 'מי מתמודד עם X?'",
            ]
          },
          {
            type: "analogy",
            heading: "🌊 תחשוב על זה כמו דייג:",
            text: "הדייג המתחיל לא הולך לאוקיינוס — הוא מתחיל בבריכה שהוא מכיר. הלקוח הראשון שלך צריך להיות במקום שאתה כבר מכיר."
          },
          {
            type: "tip",
            heading: "💡 טיפ קריטי:",
            text: "הצע לעשות פרויקט ראשון ב-50% הנחה או אפילו בחינם — תמורת testimonial ורשות להשתמש בסיפור ההצלחה. ההוכחה שווה יותר מהכסף בהתחלה."
          }
        ],
        mission: {
          title: "🎯 המשימה הגדולה",
          steps: [
            "כתוב רשימה של 10 אנשים שמנהלים עסק (גם קטן)",
            "בחר 3 שהכי קרובים אליך",
            "שלח להם הודעה: 'היי, אני מתחיל לעסוק ב-AI לעסקים — אפשר לדבר 15 דקות?'",
            "תאם פגישה עם אחד מהם",
            "תדווח לעופר — הוא יעזור לך להתכונן!",
          ]
        }
      }
    ]
  }
];

// ─── Storage helpers ───────────────────────────────────────────────────────────
const STORAGE_KEY = "aor_academy_progress";

interface Progress {
  completedLessons: string[];
  totalXp: number;
  lastActive: string;
  streak: number;
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { completedLessons: [], totalXp: 0, lastActive: new Date().toDateString(), streak: 1 };
  } catch {
    return { completedLessons: [], totalXp: 0, lastActive: new Date().toDateString(), streak: 1 };
  }
}

function saveProgress(p: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// ─── Lesson content renderer ──────────────────────────────────────────────────
function ContentBlock({ block }: { block: LessonContent }) {
  const COLOR_MAP: Record<LessonContent["type"], { border: string; bg: string; icon: string }> = {
    explain:  { border: "#6366f1", bg: "#eef2ff", icon: "💡" },
    analogy:  { border: "#f59e0b", bg: "#fffbeb", icon: "🔗" },
    steps:    { border: "#10b981", bg: "#ecfdf5", icon: "📋" },
    tip:      { border: "#ec4899", bg: "#fdf2f8", icon: "🎯" },
    glossary: { border: "#0ea5e9", bg: "#f0f9ff", icon: "📖" },
  };
  const cx = COLOR_MAP[block.type];

  return (
    <div className="rounded-xl border-l-4 p-4" style={{ borderColor: cx.border, background: cx.bg }}>
      {block.heading && (
        <div className="font-bold text-[13.5px] mb-2" style={{ color: cx.border }}>
          {block.heading}
        </div>
      )}
      {block.text && (
        <p className="text-[13px] text-gray-700 leading-relaxed" dir="rtl">{block.text}</p>
      )}
      {block.items && (
        <ul className="space-y-1.5 mt-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700" dir="rtl">
              <span className="text-[11px] font-bold mt-0.5" style={{ color: cx.border }}>{i + 1}.</span>
              {item}
            </li>
          ))}
        </ul>
      )}
      {block.terms && (
        <div className="space-y-2 mt-1">
          {block.terms.map(t => (
            <div key={t.word} dir="rtl">
              <span className="font-bold text-[13px]" style={{ color: cx.border }}>{t.word}</span>
              <span className="text-[12.5px] text-gray-600"> — {t.plain}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lesson Card ──────────────────────────────────────────────────────────────
function LessonCard({
  lesson, moduleColor, isCompleted, isLocked, onComplete
}: {
  lesson: Lesson;
  moduleColor: string;
  isCompleted: boolean;
  isLocked: boolean;
  onComplete: (id: string, xp: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [missionDone, setMissionDone] = useState(false);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${isLocked ? "opacity-50" : "shadow-sm"}`}
      style={{ borderColor: isCompleted ? "#a7f3d0" : "#e2e8f0" }}>
      {/* Header */}
      <button
        onClick={() => !isLocked && setOpen(v => !v)}
        disabled={isLocked}
        className="w-full flex items-center gap-3 p-4 bg-white hover:bg-slate-50 transition-colors text-right"
      >
        <div className="text-2xl shrink-0">{lesson.emoji}</div>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 justify-end">
            {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {isLocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
            <h4 className="font-bold text-[14px] text-gray-900">{lesson.title}</h4>
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">{lesson.subtitle}</p>
          <div className="flex items-center gap-3 justify-end mt-1.5">
            <span className="text-[10.5px] text-gray-400">{lesson.duration}</span>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: moduleColor + "22", color: moduleColor }}>
              +{lesson.xp} XP
            </span>
          </div>
        </div>
        {!isLocked && (
          <div className="shrink-0">
            {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {open && !isLocked && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="p-5 bg-gray-50 border-t border-gray-100 space-y-4">
              {/* Content blocks */}
              {lesson.content.map((block, i) => (
                <ContentBlock key={i} block={block} />
              ))}

              {/* Mission */}
              <div className="rounded-xl border-2 p-4 mt-2" style={{ borderColor: moduleColor + "66", background: moduleColor + "0a" }}>
                <h5 className="font-bold text-[14px] mb-3" style={{ color: moduleColor }} dir="rtl">
                  {lesson.mission.title}
                </h5>
                <ol className="space-y-2">
                  {lesson.mission.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700" dir="rtl">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 text-white"
                        style={{ background: moduleColor }}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                {lesson.mission.link && (
                  <Link href={lesson.mission.link.href}
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: moduleColor }}>
                    {lesson.mission.link.label}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* Complete button */}
              {!isCompleted && (
                <button
                  onClick={() => { setMissionDone(true); onComplete(lesson.id, lesson.xp); }}
                  disabled={missionDone}
                  className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-all active:scale-95"
                  style={{ background: isCompleted || missionDone ? "#10b981" : moduleColor }}>
                  {missionDone ? "✅ מעולה! XP נצבר!" : "✅ סיימתי — קדמה!"}
                </button>
              )}
              {isCompleted && (
                <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 font-bold text-[13px]">
                  <CheckCircle2 className="w-4 h-4" />
                  שיעור הושלם! +{lesson.xp} XP
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────
const LEVELS = [
  { name: "מתחיל", min: 0, max: 200, emoji: "🌱" },
  { name: "סקרן", min: 200, max: 450, emoji: "🔍" },
  { name: "בונה", min: 450, max: 800, emoji: "🔨" },
  { name: "שותף", min: 800, max: 1200, emoji: "🤝" },
  { name: "מומחה", min: 1200, max: 2000, emoji: "⭐" },
  { name: "Pro", min: 2000, max: 3000, emoji: "🚀" },
];

function getLevel(xp: number) {
  return LEVELS.findLast(l => xp >= l.min) ?? LEVELS[0];
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AorAcademy() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => { saveProgress(progress); }, [progress]);

  const allLessons = MODULES.flatMap(m => m.lessons);
  const totalXpPossible = allLessons.reduce((s, l) => s + l.xp, 0);
  const level = getLevel(progress.totalXp);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const xpToNext = nextLevel ? nextLevel.min - progress.totalXp : 0;
  const levelProgress = nextLevel
    ? ((progress.totalXp - level.min) / (nextLevel.min - level.min)) * 100
    : 100;

  const handleComplete = (lessonId: string, xp: number) => {
    setProgress(prev => {
      if (prev.completedLessons.includes(lessonId)) return prev;
      return { ...prev, completedLessons: [...prev.completedLessons, lessonId], totalXp: prev.totalXp + xp };
    });
  };

  const handleReset = () => {
    if (confirm("לאפס את כל ההתקדמות? זה ימחק את כל ה-XP שלך.")) {
      const fresh = { completedLessons: [], totalXp: 0, lastActive: new Date().toDateString(), streak: 1 };
      setProgress(fresh);
      saveProgress(fresh);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0c4a6e 100%)" }}>
      {/* Back */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-[13px] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          AgentHub
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-[13px]">{level.emoji} {level.name}</span>
          <span className="text-indigo-300 text-[12px]">{progress.totalXp} XP</span>
        </div>
        <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16 pt-8 space-y-8">

        {/* Hero Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl border-4 border-indigo-400/30"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            ✨
          </div>
          <div>
            <h1 className="text-3xl font-black text-white mb-1">שלום אור! 👋</h1>
            <p className="text-indigo-300 text-[15px] leading-relaxed">
              זה המקום שלך ללמוד, לבנות, ולהתחיל להרוויח מ-AI.<br />
              <span className="text-slate-400 text-[13px]">הכל פשוט, הכל בעברית, הכל קשור למציאות.</span>
            </p>
          </div>
        </motion.div>

        {/* XP + Level Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(99,102,241,0.2)" }}>
                {level.emoji}
              </div>
              <div>
                <div className="text-white font-bold text-[16px]">{level.name}</div>
                <div className="text-indigo-300 text-[12px]">
                  {nextLevel ? `עוד ${xpToNext} XP ל-${nextLevel.emoji} ${nextLevel.name}` : "הגעת לשיא! 🏆"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-black text-[22px]">{progress.totalXp}</div>
              <div className="text-slate-400 text-[11px]">מתוך {totalXpPossible} XP</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <BookOpen className="w-4 h-4" />, value: progress.completedLessons.length, label: "שיעורים" },
              { icon: <Flame className="w-4 h-4" />, value: progress.streak, label: "ימים רצף" },
              { icon: <Trophy className="w-4 h-4" />, value: Math.round((progress.completedLessons.length / allLessons.length) * 100) + "%", label: "השלמה" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="text-indigo-400 flex justify-center mb-1">{s.icon}</div>
                <div className="text-white font-bold text-[18px]">{s.value}</div>
                <div className="text-slate-400 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick tools */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}>
          <h2 className="text-white font-bold text-[15px] mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            כלים שלך — תגע, תנסה, תשאל
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "📋", label: "טמפלטים n8n", sub: "21 אוטומציות להורדה", href: "/n8n-templates", color: "#6366f1" },
              { emoji: "⚡", label: "Workflow Library", sub: "20 תהליכים מוכנים", href: "/workflow-library", color: "#10b981" },
              { emoji: "🤖", label: "סוכני AI", sub: "הארסנל שלנו", href: "/agents", color: "#0ea5e9" },
              { emoji: "🌍", label: "Open Source Hub", sub: "סוכני על בחינם", href: "/opensource", color: "#f59e0b" },
            ].map(tool => (
              <Link key={tool.href} href={tool.href}
                className="flex items-center gap-3 p-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: tool.color + "18", border: `1px solid ${tool.color}33` }}>
                <span className="text-2xl shrink-0">{tool.emoji}</span>
                <div>
                  <div className="font-bold text-[13px] text-white">{tool.label}</div>
                  <div className="text-[11px]" style={{ color: tool.color + "bb" }}>{tool.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Modules */}
        <div className="space-y-5">
          <h2 className="text-white font-bold text-[15px] flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400" />
            מסלול הלמידה שלך
          </h2>

          {MODULES.map((mod, modIdx) => {
            const modLessons = mod.lessons;
            const completedCount = modLessons.filter(l => progress.completedLessons.includes(l.id)).length;
            const prevModComplete = modIdx === 0
              ? true
              : MODULES[modIdx - 1].lessons.every(l => progress.completedLessons.includes(l.id));
            const isOpen = activeModule === mod.id;

            return (
              <motion.div key={mod.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + modIdx * 0.05 } }}
                className={`rounded-2xl overflow-hidden ${!prevModComplete && modIdx > 0 ? "opacity-60" : ""}`}
                style={{ border: `1px solid ${mod.color}44` }}>

                {/* Module header */}
                <button
                  onClick={() => setActiveModule(isOpen ? null : mod.id)}
                  disabled={!prevModComplete && modIdx > 0}
                  className="w-full flex items-center gap-4 p-4 text-right transition-all"
                  style={{ background: isOpen ? mod.color + "20" : "rgba(255,255,255,0.04)" }}>
                  <span className="text-3xl shrink-0">{mod.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 justify-end">
                      {!prevModComplete && modIdx > 0 && <Lock className="w-3.5 h-3.5 text-gray-500" />}
                      <h3 className="font-bold text-[15px] text-white">{mod.title}</h3>
                    </div>
                    <p className="text-[12px] mt-0.5" style={{ color: mod.color + "bb" }}>{mod.subtitle}</p>
                    <div className="flex items-center gap-2 justify-end mt-2">
                      <div className="h-1.5 rounded-full overflow-hidden w-24" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(completedCount / modLessons.length) * 100}%`, background: mod.color }} />
                      </div>
                      <span className="text-[11px] text-slate-400">{completedCount}/{modLessons.length}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {/* Lessons */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <div className="p-4 space-y-3" style={{ background: "rgba(0,0,0,0.25)" }}>
                        {modLessons.map((lesson, lessonIdx) => {
                          const prevDone = lessonIdx === 0
                            ? true
                            : progress.completedLessons.includes(modLessons[lessonIdx - 1].id);
                          return (
                            <LessonCard key={lesson.id} lesson={lesson}
                              moduleColor={mod.color}
                              isCompleted={progress.completedLessons.includes(lesson.id)}
                              isLocked={!prevDone}
                              onComplete={handleComplete} />
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Inspiration footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.5 } }}
          className="rounded-2xl p-6 text-center space-y-3"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <div className="text-3xl">🚀</div>
          <h3 className="text-white font-bold text-[16px]">כל מומחה היה מתחיל פעם</h3>
          <p className="text-slate-400 text-[13px] leading-relaxed" dir="rtl">
            עופר ואתה בונים משהו אמיתי כאן. כל שיעור שאתה עושה, כל לקוח שתמצא, כל אוטומציה שתבנה — זה קדמה אמיתית. אתה לא לומד בשביל בחינה, אתה לומד בשביל להרוויח.
          </p>
          <div className="flex items-center justify-center gap-6 pt-2">
            {[
              { icon: <DollarSign className="w-4 h-4" />, text: "כסף אמיתי", color: "#10b981" },
              { icon: <Users className="w-4 h-4" />, text: "לקוחות אמיתיים", color: "#6366f1" },
              { icon: <Rocket className="w-4 h-4" />, text: "גדלים ביחד", color: "#f59e0b" },
            ].map(i => (
              <div key={i.text} className="flex items-center gap-1.5 text-[12px]" style={{ color: i.color }}>
                {i.icon} {i.text}
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
