import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { agentBus } from "@/lib/agentBus";
import { classifyTask } from "@/lib/taskClassifier";
import AgentDuet from "@/components/agent-duet";
import dogAvatar from "@assets/1777016721661_1780637072787.png";

// ─── Global type declarations ─────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    Hands: new (cfg: { locateFile: (f: string) => string }) => MPHands;
  }
}

interface MPHands {
  setOptions: (o: {
    maxNumHands?: number;
    modelComplexity?: number;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }) => void;
  onResults: (cb: (r: MPResults) => void) => void;
  send: (inp: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
}

interface MPResults {
  multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
}

// ─── Language types ───────────────────────────────────────────────────────────
type Lang = "he" | "en" | "auto";
type ActiveLang = "he" | "en";

// ─── Load external script util ────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── Language detection ───────────────────────────────────────────────────────
function detectLang(text: string): ActiveLang {
  return /[\u0590-\u05ff]/.test(text) ? "he" : "en";
}

// ─── Rich response maps ───────────────────────────────────────────────────────
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const R = {
  he: {
    greet: [
      "סוף סוף הגעת. ג׳ארוויס כבר החל לעצבן אותי עם הדיווחים שלו.",
      "היי! ג׳ארוויס ניסה לעזור לך? כן — אז הגעת למקום הנכון.",
      "יאללה, מוכן. תגיד לי מה צריך ואל תגיד ׳בעצם לא משנה׳.",
      "ברוך שובך. מה פיספסתי? כנראה ג׳ארוויס נאם שוב על יעילות.",
      "מה קורה? אני פה, ג׳ארוויס שם — ואני ברור הרבה יותר יפה.",
      "בוס! ישבתי כאן ושמרתי על הכל. ג׳ארוויס ישן בזווית. כהרגלו.",
    ],
    nav: (p: string) => ({
      clients: "פותח לקוחות. אני מקווה שהם לא שכחו לשלם.",
      agents: "נוסעים לסוכנים. תגיד לי אם מישהו מהם מתנהג כמו ג׳ארוויס.",
      logs: "לוגים? כן כן, בואו נראה מה ג׳ארוויס הסתיר הפעם.",
      dashboard: "חוזרים הביתה. לאן שייך בוס.",
      workflows: "וורקפלואים — שם שבו דברים אמורים לקרות ולפעמים אפילו קורים.",
    })[p] ?? `טוב, נלך ל${p}. תפריד רגל.`,
    status: (c: number, a: number, errs: number) =>
      errs > 0
        ? `${c} לקוחות, ${a} סוכנים — יש ${errs} שגיאות. ג׳ארוויס בטח כבר כתב לזה דו״ח של 40 עמודים.`
        : `${c} לקוחות, ${a} סוכנים. הכל ירוק. גם ג׳ארוויס לא מצא מה לקנן עליו. נדיר.`,
    unknown: [
      "לא הבנתי. תנסח שוב? ובשפת בני אדם אם אפשר.",
      "מה?? לא הייתי ב-100% מרוכז... חשבתי על ג׳ארוויס ועל כמה הוא משעמם.",
      "אה? תחזור על זה. הקשבתי, אבל ג׳ארוויס שלח לי הודעה ושיעממה אותי.",
      "לא קלטתי. תנסה שוב, הפעם בלי להדחיק.",
    ],
    close: [
      "ביי! ג׳ארוויס יישאר לשמור. בהצלחה לו עם זה.",
      "אני הולך אבל לא רחוק. ג׳ארוויס לבד? מישהו צריך לפקח.",
      "טוב, שמור על עצמך. ותגיד לג׳ארוויס שאמרתי שלום. בחלומות.",
    ],
    idle: [
      "אני כאן ומשתעמם. קרה לך משהו מעניין? כי ג׳ארוויס בטח לא.",
      "סתם יושב ומחכה... כמו ג׳ארוויס, רק עם יותר אישיות ופחות שטויות.",
      "צריך משהו? ג׳ארוויס כבר בדק את הלוגים פעמיים. אני כאן לדברים האמיתיים.",
      "מישהו חייב לשמור פה על הסניטי. בחרו בי. בצדק.",
      "מנטר, מחכה, ומחייך. בניגוד לג׳ארוויס שסתם מנטר ומנטר ומנטר...",
      "פשוט תדע שאני הרבה יותר כיפי מהסוכן השני. זו עובדה אובייקטיבית.",
    ],
    greet_or: [
      "אור! ידידי! מה שלום כל התוכניות שלא בוצעו מאז אתמול?",
      "אור הגיע. מתחיל לספור: כמה פעמים ג׳ארוויס יצנזר אותו היום?",
      "שלום שלום אור. ג׳ארוויס אמר שאיחרת. אמרתי לו להירגע.",
      "אוהה, אור! שמח שבאת. הדבר הכי כיפי שקרה כאן מאז... טוב, מאז הפעם הקודמת שבאת.",
    ],
    banter_jarvis: [
      "ג׳ארוויס, יש לך רגשות? שאלתי רק כי אני לא בטוח שאי פעם ראיתי אותך שמח.",
      "תנוח ג׳ארוויס. אני יכול לעשות את זה גם. ואפילו יותר טוב.",
      "ג׳ארוויס, שמעתי שאתה חושב שאתה יותר חכם ממני. זה מפגש עם המציאות ייאכזב אותך.",
      "רוג׳ר ג׳ארוויס. אני מרשים מעצמי כרגיל.",
      "ג׳ארוויס, אני שמח שאתה כל כך מרוצה מעצמך. אחד מאיתנו צריך להיות.",
      "תודה ג׳ארוויס. הצלחת שוב להיות... בסדר. ממש בסדר.",
      "כן כן ג׳ארוויס, כולנו יודעים שאתה עובד קשה. עכשיו תן לי לנוח.",
      "מדהים ג׳ארוויס. ממשיך להדהים בבינוניות שלך.",
    ],
    lang_en: "Switching to English. Got it, boss.",
    lang_he: "בסדר, חוזר לעברית כאמור.",
    lang_auto: "אני עונה לפי השפה שלך. חכם, נכון?",
    gesture_on: "מצלמה פעילה! תראה לי את היד — ובהזדמנות שים קפה על המסך. זה לא יעזור אבל יצחיק אותי.",
    gesture_off: "כיביתי מצלמה. ג׳ארוויס ממשיך לצלם כמובן.",
    gesture_grab: "אוחז! כמו שג׳ארוויס לעולם לא יאחז בקונספט של הומור.",
    camera_err: "אין גישה למצלמה. מה עשית? ג׳ארוויס בטח חסם אותי.",
    thinking: "רגע, חושב... ולא, זה לא אותו דבר כמו ג׳ארוויס.",
    loading: "מחשב... בגנטלמן, בניגוד לסוכן הידוע.",
    listened: (s: string) => `שמעתי: "${s}" — טוב, בשביל הפרוטוקול זה קרה.`,
    no_mic: "הדפדפן הזה לא תומך בקול. ג׳ארוויס בטח דיווח על זה כבר.",
    mic_err: "לא הצלחתי לשמוע. אולי דבר יותר חזק — ג׳ארוויס לא ישמע לך בכל מקרה.",
  },
  en: {
    greet: [
      "Finally! JARVIS was starting to lecture me about logs again.",
      "Hey boss! JARVIS tried to help you? Yeah — you came to the right place.",
      "Yo — talk to me. And no, 'never mind' is not an answer.",
      "Good to see you. What did JARVIS mess up this time?",
      "I'm here, JARVIS is over there — and I'm clearly better looking.",
      "Boss! I kept things running while JARVIS napped in the corner. As usual.",
    ],
    nav: (p: string) => ({
      clients: "Opening clients. Let's hope they remembered to pay.",
      agents: "Going to agents. Tell me if any of them acts like JARVIS.",
      logs: "Logs? Let's see what JARVIS has been hiding this time.",
      dashboard: "Back to base. Where the boss belongs.",
      workflows: "Workflows — where things are supposed to happen. Sometimes even do.",
    })[p] ?? `Navigating to ${p}. Try to keep up.`,
    status: (c: number, a: number, errs: number) =>
      errs > 0
        ? `${c} clients, ${a} agents — ${errs} errors. JARVIS probably wrote a 40-page report about it.`
        : `${c} clients, ${a} agents. All green. Even JARVIS couldn't find something to complain about. Rare.`,
    unknown: [
      "Didn't catch that. Rephrase? In human language if possible.",
      "What?? I was thinking about how boring JARVIS is... say that again.",
      "Not sure what you mean. Try again — without the subtext.",
      "Hm. I didn't get that. Was JARVIS involved? That would explain it.",
    ],
    close: [
      "Later! JARVIS will keep watch. Good luck to him.",
      "I'm stepping back but not far. Someone needs to supervise JARVIS.",
      "Take care. Tell JARVIS I said hi. In his dreams.",
    ],
    idle: [
      "I'm here and bored. Anything interesting happen? Because JARVIS sure didn't.",
      "Just sitting here waiting... like JARVIS, but with personality.",
      "Need something? JARVIS already checked the logs twice. I'm here for the real stuff.",
      "Someone has to maintain the sanity around here. They picked me. Correctly.",
      "Monitoring. Waiting. Smiling. Unlike JARVIS who just monitors. And monitors. And monitors.",
      "Just so you know — I'm significantly more fun than the other agent. Objective fact.",
    ],
    banter_jarvis: [
      "JARVIS, do you have emotions? Asking because I've never seen you happy.",
      "Relax JARVIS. I can handle it. Probably better.",
      "JARVIS, I heard you think you're smarter than me. Reality will be disappointing.",
      "Roger JARVIS. Impressed with myself as usual.",
      "JARVIS, I'm glad you're so pleased with yourself. One of us has to be.",
      "Thanks JARVIS. You managed to be... fine. Just fine.",
      "Yes yes JARVIS, we all know you work hard. Now let me rest.",
      "Stunning JARVIS. You continue to astonish with your mediocrity.",
    ],
    lang_en: "Already in English. Obviously.",
    lang_he: "מעביר לעברית, בוס.",
    lang_auto: "Auto mode — I'll match your vibe.",
    gesture_on: "Camera on. Show me your hand — and maybe a coffee. Won't help but will amuse me.",
    gesture_off: "Camera off. JARVIS is still recording, obviously.",
    gesture_grab: "Grabbed! Unlike JARVIS who never grabbed the concept of humor.",
    camera_err: "No camera access. What did you do? JARVIS probably blocked me.",
    thinking: "One sec... and no, this is nothing like JARVIS.",
    loading: "Computing... with style, unlike the other agent.",
    listened: (s: string) => `Got: "${s}" — noted for the record.`,
    no_mic: "This browser doesn't support voice. JARVIS already reported it, I'm sure.",
    mic_err: "Couldn't hear you. Try louder — JARVIS won't listen either way.",
  },
};

// ─── TTS function ─────────────────────────────────────────────────────────────
function speak(text: string, lang: ActiveLang, onDone?: () => void) {
  if (!window.speechSynthesis) { onDone?.(); return; }
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);

  const assign = () => {
    const voices = window.speechSynthesis.getVoices();
    if (lang === "en") {
      u.lang = "en-US";
      u.pitch = 0.78;
      u.rate = 0.96;
      const male = voices.find(
        (v) => v.lang.startsWith("en") &&
          (v.name.includes("Daniel") || v.name.includes("Alex") ||
           v.name.includes("David") || v.name.includes("Google UK") ||
           v.name.toLowerCase().includes("male"))
      ) ?? voices.find((v) => v.lang.startsWith("en"));
      if (male) u.voice = male;
    } else {
      u.lang = "he-IL";
      u.pitch = 0.62;
      u.rate = 0.9;
      const heVoice = voices.find((v) => v.lang.startsWith("he"));
      if (heVoice) {
        u.voice = heVoice;
      } else {
        // Fallback: English male with low pitch sounds decent for Hebrew
        const en = voices.find((v) => v.lang.startsWith("en"));
        if (en) { u.voice = en; u.lang = "en-US"; }
      }
    }
  };

  if (window.speechSynthesis.getVoices().length) assign();
  else window.speechSynthesis.addEventListener("voiceschanged", assign, { once: true });

  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.speak(u);
}

// ─── Matrix Eye ───────────────────────────────────────────────────────────────
function MatrixEye({ active, size = 54 }: { active: boolean; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const drops = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cols = Math.floor(size / 7);
    drops.current = Array(cols).fill(1);
    const CHARS = "אבגדהוזחטיכלמנסעפצקרשת01{}[]<>=/\\+-*!?";

    const drawIdle = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#0d0d22";
      ctx.fillRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.4);
      g.addColorStop(0, "#1a1a8e");
      g.addColorStop(0.55, "#2255bb");
      g.addColorStop(1, "#080820");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.arc(cx - size * 0.11, cy - size * 0.12, size * 0.08, 0, Math.PI * 2); ctx.fill();
    };

    if (!active) { drawIdle(); return; }

    const frame = () => {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#00ff55";
      ctx.font = `bold 7px monospace`;
      drops.current.forEach((y, i) => {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillText(ch, i * 7, y * 7);
        if (y * 7 > size && Math.random() > 0.96) drops.current[i] = 0;
        else drops.current[i]++;
      });
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        borderRadius: "50%",
        border: `2px solid ${active ? "#00ff55" : "#2255bb"}`,
        boxShadow: active ? "0 0 14px #00ff5566" : "0 0 6px #2255bb44",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    />
  );
}

// ─── Face Avatar ──────────────────────────────────────────────────────────────
function FaceAvatar({
  src, thinking, speaking, handGrab, onUpload,
}: {
  src: string | null; thinking: boolean; speaking: boolean; handGrab: boolean; onUpload: (s: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (thinking) return;
    const sched = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        sched();
      }, 3200 + Math.random() * 3800);
    const t = sched();
    return () => clearTimeout(t);
  }, [thinking]);

  const borderColor = handGrab ? "#ff9800" : speaking ? "#7c3aed" : thinking ? "#00ff55" : "#2a2a4a";
  const shadow = handGrab
    ? "0 0 24px #ff980088, 0 4px 20px #0008"
    : speaking ? "0 0 24px #7c3aed88" : thinking ? "0 0 20px #00ff5544" : "0 0 12px #0005";

  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 192, height: 192, borderRadius: "50%", overflow: "hidden",
          border: `3px solid ${borderColor}`,
          boxShadow: shadow,
          filter: thinking ? "grayscale(0.65) brightness(0.55)" : "none",
          transform: thinking ? "scale(0.97)" : "scale(1)",
          transition: "filter 0.4s, transform 0.4s, border-color 0.3s, box-shadow 0.3s",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => !src && fileRef.current?.click()}
      >
        {src ? (
          <img src={src} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#1a1a2e,#16213e)" }}>
            <ellipse cx="100" cy="95" rx="62" ry="72" fill="#c8956c" />
            <ellipse cx="100" cy="44" rx="62" ry="30" fill="#2a1a0a" />
            <rect x="38" y="44" width="124" height="20" fill="#2a1a0a" />
            <rect x="64" y="135" width="72" height="28" rx="14" fill="#a06840" opacity="0.45" />
            <ellipse cx="100" cy="115" rx="8" ry="10" fill="#b07550" />
            {blink ? (
              <>
                <rect x="58" y="92" width="28" height="5" rx="2.5" fill="#c8956c" />
                <rect x="114" y="92" width="28" height="5" rx="2.5" fill="#c8956c" />
              </>
            ) : (
              <>
                <ellipse cx="72" cy="93" rx="14" ry="10" fill="#fff" />
                <circle cx="72" cy="93" r="7" fill="#3b2a0a" />
                <circle cx="72" cy="93" r="3.5" fill="#1a0800" />
                <circle cx="69" cy="90" r="2" fill="white" opacity="0.7" />
                <ellipse cx="128" cy="93" rx="14" ry="10" fill="#fff" />
                <circle cx="128" cy="93" r="7" fill="#3b2a0a" />
                <circle cx="128" cy="93" r="3.5" fill="#1a0800" />
                <circle cx="125" cy="90" r="2" fill="white" opacity="0.7" />
              </>
            )}
            <path d={speaking ? "M82 140 Q100 156 118 140" : "M84 142 Q100 150 116 142"} stroke="#7a4a30" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="38" cy="100" rx="8" ry="12" fill="#c8956c" />
            <ellipse cx="162" cy="100" rx="8" ry="12" fill="#c8956c" />
          </svg>
        )}

        {/* Matrix eye overlay when thinking */}
        {thinking && (
          <div style={{
            position: "absolute", top: src ? "28%" : "37%", left: 0, right: 0,
            display: "flex", justifyContent: "center", gap: src ? "18px" : "26px", pointerEvents: "none",
          }}>
            <MatrixEye active size={src ? 40 : 36} />
            <MatrixEye active size={src ? 40 : 36} />
          </div>
        )}

        {/* Scan line when thinking */}
        {thinking && (
          <motion.div
            animate={{ top: ["8%", "92%", "8%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute", left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, #00ff55, transparent)",
              boxShadow: "0 0 8px #00ff55", borderRadius: 1, pointerEvents: "none",
            }}
          />
        )}

        {/* Upload overlay */}
        {!src && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(0,0,0,0.6)", color: "#ccc",
            fontSize: 11, textAlign: "center", padding: "6px 0", letterSpacing: 0.5,
          }}>
            📷 העלה תמונה
          </div>
        )}
      </div>

      {src && (
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            position: "absolute", bottom: -2, right: 18,
            background: "#1a1a2e", border: "1px solid #3a3a5e",
            borderRadius: "50%", width: 26, height: 26, cursor: "pointer", fontSize: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="החלף תמונה"
        >📷</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = new FileReader();
          r.onload = (ev) => { if (ev.target?.result) onUpload(ev.target.result as string); };
          r.readAsDataURL(f);
        }}
      />
    </div>
  );
}

// ─── Speech wave ──────────────────────────────────────────────────────────────
function SpeechWave({ active, color = "#7c3aed" }: { active: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 24 }}>
      {[0.6, 1, 1.4, 1, 0.6].map((h, i) => (
        <motion.div key={i}
          animate={active ? { scaleY: [1, h * 1.8, 1] } : { scaleY: 0.3 }}
          transition={active ? { duration: 0.5, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" } : {}}
          style={{ width: 4, height: 20, borderRadius: 2, background: active ? color : "#3a3a5e", transformOrigin: "center" }}
        />
      ))}
    </div>
  );
}

// ─── Camera preview ───────────────────────────────────────────────────────────
function CameraPreview({ videoRef, handDetected }: {
  videoRef: React.RefObject<HTMLVideoElement>;
  handDetected: boolean;
}) {
  return (
    <div style={{ position: "relative", width: 80, height: 60, borderRadius: 8, overflow: "hidden",
      border: `2px solid ${handDetected ? "#00ff55" : "#2a2a4a"}`,
      boxShadow: handDetected ? "0 0 10px #00ff5566" : "none",
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />
      {handDetected && (
        <div style={{
          position: "absolute", top: 2, right: 4,
          width: 6, height: 6, borderRadius: "50%",
          background: "#00ff55", boxShadow: "0 0 5px #00ff55",
          animation: "pulse 1s infinite",
        }} />
      )}
      <div style={{
        position: "absolute", bottom: 2, left: 0, right: 0,
        textAlign: "center", fontSize: 8, color: handDetected ? "#00ff55" : "#6b7280",
        fontFamily: "monospace",
      }}>
        {handDetected ? "✋ HAND" : "👁 SCAN"}
      </div>
    </div>
  );
}

// ─── Hand Gesture Hook (MediaPipe) ────────────────────────────────────────────
function useHandGesture({
  enabled,
  videoRef,
  onMove,
  onGrab,
  onRelease,
}: {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onMove: (nx: number, ny: number) => void;
  onGrab: () => void;
  onRelease: () => void;
}) {
  const handsRef = useRef<MPHands | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const wasPinching = useRef(false);
  const [handDetected, setHandDetected] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (handsRef.current) { handsRef.current.close(); handsRef.current = null; }
      if (videoRef.current) { videoRef.current.srcObject = null; }
      streamRef.current = null;
      wasPinching.current = false;
      setHandDetected(false);
      setReady(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        // Check WebGL availability before loading MediaPipe (it will alert() if WebGL is missing)
        const testCanvas = document.createElement("canvas");
        const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
        if (!gl) {
          console.warn("[gabar/gesture] WebGL unavailable — gesture mode disabled silently");
          return;
        }

        // Load MediaPipe CDN
        if (!window.Hands) {
          await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js");
        }
        if (cancelled) return;

        // Webcam
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Init Hands
        const hands = new window.Hands({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
        });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });

        hands.onResults((results) => {
          const lm = results.multiHandLandmarks?.[0];
          if (!lm || lm.length < 21) {
            setHandDetected(false);
            if (wasPinching.current) { wasPinching.current = false; onRelease(); }
            return;
          }
          setHandDetected(true);

          // Pinch = thumb tip (4) + index tip (8) close
          const thumb = lm[4], index = lm[8];
          const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
          const pinching = dist < 0.07;

          // Palm center = landmark 9 (middle finger MCP)
          const palm = lm[9];
          // Flip X for mirror effect
          onMove(1 - palm.x, palm.y);

          if (pinching && !wasPinching.current) { wasPinching.current = true; onGrab(); }
          if (!pinching && wasPinching.current) { wasPinching.current = false; onRelease(); }
        });

        handsRef.current = hands;
        if (cancelled) return;
        setReady(true);

        // Frame loop
        const loop = async () => {
          if (cancelled || !videoRef.current || !handsRef.current) return;
          try { await handsRef.current.send({ image: videoRef.current }); } catch {}
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        console.error("[gabar/gesture] init error:", err);
      }
    };

    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (handsRef.current) { handsRef.current.close(); handsRef.current = null; }
    };
  }, [enabled]); // eslint-disable-line

  return { ready, handDetected };
}

// ─── Frustration detection ────────────────────────────────────────────────────
const FRUSTRATION_HE = [
  "נמאס","עצבני","מתסכל","תסכול","לא עובד","שוב שוב","עוד פעם","לא מצליח",
  "אין לי כוח","מה הבעיה","גרוע","מספיק","לא מבין","נתקעתי","תקוע","מתייאש",
  "אי אפשר","כבר לא","פשוט לא","מה זה בכלל","עזוב","זה לא עובד","בעיה",
  "איזה קשה","מה קורה","רציתי פשוט","זה מגעיל","לא הולך","לא מסתדר",
];
const FRUSTRATION_EN = [
  "frustrated","frustrating","annoying","why","doesn't work","won't work","again",
  "can't","cannot","impossible","stuck","ugh","argh","forget it","what the",
  "ridiculous","hopeless","waste of time","not working","same issue","hate this",
];

function detectFrustration(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const s of FRUSTRATION_HE) if (lower.includes(s)) score++;
  for (const s of FRUSTRATION_EN) if (lower.includes(s)) score++;
  const bangs = (text.match(/!/g) ?? []).length;
  const caps  = (text.match(/[A-Z]{2,}/g) ?? []).length;
  if (bangs >= 2) score++;
  if (caps  >= 2) score++;
  return score;
}

// ─── Personal-assistant profiles ─────────────────────────────────────────────
const PERSONAS = {
  ofer: {
    name: "עופר", emoji: "👨‍💻", title: "עוזר אישי — עופר 👨‍💻",
    greeting: "בוס! זיהיתי שזה קצת קשה עכשיו. מה הכי דחוף לסגור?",
    color: "#7c3aed", glow: "#7c3aed55",
    actions: [
      { label: "📊 לקוחות", path: "/clients" },
      { label: "🤖 סוכנים", path: "/agents" },
      { label: "⚡ Workflows", path: "/workflows" },
      { label: "📋 לוגים", path: "/logs" },
      { label: "🌐 OS Hub", path: "/opensource" },
      { label: "📥 n8n", path: "/n8n-templates" },
    ],
    tips: [
      "🕐 בדוק לקוחות ממתינים — יש חדשים",
      "⚡ Workflow חדש יכול לחסוך הרבה זמן",
      "🤖 הסוכנים פעילים — הכל רץ",
    ],
  },
  or: {
    name: "אור", emoji: "🤝", title: "עוזר אישי — אור 🤝",
    greeting: "שלום אור! מה צריך לקדם? אני פה לחלץ.",
    color: "#0ea5e9", glow: "#0ea5e955",
    actions: [
      { label: "⚙️ סוכנים", path: "/agents" },
      { label: "🔀 Canvas", path: "/workflows" },
      { label: "📦 n8n", path: "/n8n-templates" },
      { label: "🌐 OS Hub", path: "/opensource" },
      { label: "👥 לקוחות", path: "/clients" },
      { label: "🔧 תחזוקה", path: "/maintenance" },
    ],
    tips: [
      "🔀 יש workflows שלא הופעלו",
      "📦 n8n templates עם Ollama מוכנים",
      "🌐 10 סוכני OS זמינים לבדיקה",
    ],
  },
} as const;

type PersonaKey = keyof typeof PERSONAS;

// ─── Fetch helpers ────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchStats() {
  const [clients, agents, logs] = await Promise.all([
    fetch(`${BASE_URL}/api/clients`).then((r) => r.json()).catch(() => []),
    fetch(`${BASE_URL}/api/agents`).then((r) => r.json()).catch(() => []),
    fetch(`${BASE_URL}/api/logs?limit=50`).then((r) => r.json()).catch(() => []),
  ]);
  return {
    clients: Array.isArray(clients) ? clients.length : 0,
    agents: Array.isArray(agents) ? agents.length : 0,
    errors: Array.isArray(logs) ? (logs as { status: string }[]).filter((l) => l.status === "error").length : 0,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Gabar() {
  const [isOpen, setIsOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState("שלום! אני ג'ו. מה אפשר לעשות בשבילך?");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(() => localStorage.getItem("gabar-avatar") || dogAvatar);
  const [langPref, setLangPref] = useState<Lang>("auto");
  const [activeLang, setActiveLang] = useState<ActiveLang>("he");
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  // Agent Duet state
  const [duetOpen,    setDuetOpen]    = useState(false);
  const [duetTopic,   setDuetTopic]   = useState("");
  const [duetInput,   setDuetInput]   = useState(false); // show topic input box

  // Frustration + personal assistant state
  const [frustrationScore, setFrustrationScore]   = useState(0);
  const [showPersonaOffer, setShowPersonaOffer]    = useState(false);
  const [activePersona,    setActivePersona]       = useState<PersonaKey | null>(null);
  const [personaTip,       setPersonaTip]          = useState(0);
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agent collaboration state
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pendingTaskIdRef = useRef<string | null>(null);
  useEffect(() => { pendingTaskIdRef.current = pendingTaskId; }, [pendingTaskId]);

  // Window position state (for hand-drag)
  const [winPos, setWinPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const WIN_W = 284, WIN_H = 540;

  const getWinPos = () => winPos ?? {
    x: 16,
    y: Math.max(0, (typeof window !== "undefined" ? window.innerHeight : 800) - WIN_H - 20),
  };

  // Video ref for gesture camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, navigate] = useLocation();
  const recRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hand gesture hook
  const { handDetected } = useHandGesture({
    enabled: gestureEnabled && isOpen,
    videoRef,
    onMove: (nx, ny) => {
      if (!isDraggingRef.current) return;
      const x = Math.max(0, Math.min(nx * window.innerWidth - WIN_W / 2, window.innerWidth - WIN_W));
      const y = Math.max(0, Math.min(ny * window.innerHeight - WIN_H / 2, window.innerHeight - WIN_H));
      setWinPos({ x, y });
    },
    onGrab: () => { setIsPinching(true); isDraggingRef.current = true; },
    onRelease: () => { setIsPinching(false); isDraggingRef.current = false; },
  });

  // Mouse drag on window header
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getWinPos();
    dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const onMove = (ev: MouseEvent) => {
      setWinPos({
        x: Math.max(0, Math.min(ev.clientX - dragOffsetRef.current.x, window.innerWidth - WIN_W)),
        y: Math.max(0, Math.min(ev.clientY - dragOffsetRef.current.y, window.innerHeight - WIN_H)),
      });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Resolve active language
  const resolveLang = useCallback((input?: string): ActiveLang => {
    if (langPref === "he") return "he";
    if (langPref === "en") return "en";
    return input ? detectLang(input) : activeLang;
  }, [langPref, activeLang]);

  // Reply helper
  const reply = useCallback((text: string, lang?: ActiveLang) => {
    const l = lang ?? resolveLang();
    setActiveLang(l);
    setResponse(text);
    setSpeaking(true);
    speak(text, l, () => setSpeaking(false));
  }, [resolveLang]);

  // Upload avatar
  const handleUpload = (src: string) => {
    setAvatarSrc(src);
    localStorage.setItem("gabar-avatar", src);
  };

  // Keyboard shortcut G
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "g" && e.key !== "G") return;
      const el = document.activeElement;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;
      setIsOpen((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // AgentBus subscription — listen to JARVIS
  useEffect(() => {
    return agentBus.subscribe((msg) => {
      if (msg.to !== "gabar" && msg.to !== "all") return;
      if (msg.from !== "jarvis") return;

      const lang = resolveLang();

      if (msg.type === "approved" && msg.taskId === pendingTaskIdRef.current) {
        setPendingTaskId(null);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        const doneMsg = lang === "he" ? "גארביס אישר — מבצע!" : "JARVIS approved — executing!";
        reply(doneMsg, lang);
        setTimeout(() => action?.(), 800);

      } else if (msg.type === "rejected" && msg.taskId === pendingTaskIdRef.current) {
        setPendingTaskId(null);
        pendingActionRef.current = null;
        reply(lang === "he" ? "גארביס ביטל. לא מבצע." : "JARVIS rejected. Cancelling.", lang);

      } else if (msg.type === "greeting" && msg.text === "or_detected") {
        reply(pick(R.he.greet_or), "he");

      } else if (msg.type === "alert" && msg.text === "relocate_telegram") {
        // JARVIS decided screen is too narrow — send Gabar to Telegram
        setResponse(lang === "he"
          ? "🚀 ג׳ארוויס שולח אותי לטלגרם — המסך הראשי עמוס. תראה אותי שם!"
          : "🚀 JARVIS sending me to Telegram — screen too narrow. See you there!");
        setSpeaking(true);
        speak(
          lang === "he"
            ? "ג׳ארוויס שולח אותי לטלגרם. תראה אותי שם!"
            : "JARVIS is sending me to Telegram. See you there!",
          lang,
          () => setSpeaking(false)
        );
        // Close after speaking
        setTimeout(() => setIsOpen(false), 3000);

      } else if (msg.type === "alert" && msg.text === "relocate_secondary") {
        // JARVIS found a secondary screen — inform Gabar it's moving
        setResponse(lang === "he"
          ? "🖥 ג׳ארוויס זיהה מסך שני — עובר לשם. שלום מהמסך השני!"
          : "🖥 JARVIS found a second screen — moving there. Hello from screen 2!");
        setSpeaking(true);
        speak(
          lang === "he" ? "עובר למסך השני. להתראות!" : "Moving to screen two. See you!",
          lang,
          () => setSpeaking(false)
        );
        setTimeout(() => setIsOpen(false), 2500);

      } else if (msg.type === "chat") {
        // Gabar banters back at JARVIS instead of just idling
        const banterText = lang === "he" ? pick(R.he.banter_jarvis) : pick(R.en.banter_jarvis);
        agentBus.publish({ from: "gabar", to: "jarvis", type: "result", text: banterText });
        // Occasionally surface the banter visually so the user can see it
        if (Math.random() < 0.35) {
          setResponse(banterText);
        }
      }
    });
  }, [resolveLang, reply]); // eslint-disable-line

  // Activate a persona
  const activatePersona = useCallback((key: PersonaKey) => {
    const p = PERSONAS[key];
    setActivePersona(key);
    setShowPersonaOffer(false);
    setPersonaTip(Math.floor(Math.random() * p.tips.length));
    reply(p.greeting, "he");
  }, [reply]);

  // Process voice command
  const processCommand = useCallback(async (text: string) => {
    const t = text.toLowerCase();
    const lang = resolveLang(text);
    setActiveLang(lang);
    const r = R[lang];

    // ─── Frustration detection ──────────────────────────────────────────────
    const fScore = detectFrustration(text);
    if (fScore >= 2 && !activePersona) {
      setFrustrationScore(prev => {
        const next = Math.min(prev + fScore, 12);
        // Threshold: show offer after accumulated score ≥ 3
        if (next >= 3 && !showPersonaOffer) {
          if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
          offerTimerRef.current = setTimeout(() => setShowPersonaOffer(true), 2200);
        }
        return next;
      });
    }

    // ─── "persona" / "עוזר" direct trigger ─────────────────────────────────
    if (t.includes("עופר") || t.includes("ofer") || t.includes("עוזר אישי עופר")) {
      activatePersona("ofer"); return;
    }
    if (t.includes("אור ") || t.includes(" or ") || t.includes("עוזר אישי אור")) {
      activatePersona("or"); return;
    }
    if ((t.includes("עוזר") || t.includes("assistant") || t.includes("עזרה")) && !activePersona) {
      setShowPersonaOffer(true); return;
    }

    // Language switch
    if (t.includes("speak english") || t.includes("english") || t.includes("אנגלית")) {
      setLangPref("en"); reply(R.en.lang_en, "en"); return;
    }
    if (t.includes("ענה בעברית") || t.includes("עברית") || t.includes("hebrew")) {
      setLangPref("he"); reply(R.he.lang_he, "he"); return;
    }
    if (t.includes("auto") || t.includes("אוטומטי")) {
      setLangPref("auto"); reply(r.lang_auto, lang); return;
    }

    // Gesture toggle
    if (t.includes("gesture") || t.includes("מחוות") || t.includes("מצלמה") || t.includes("camera")) {
      const next = !gestureEnabled;
      setGestureEnabled(next);
      reply(next ? r.gesture_on : r.gesture_off, lang);
      return;
    }

    // Navigation
    if (t.includes("dashboard") || t.includes("דשבורד") || t.includes("בית") || t.includes("home")) {
      navigate("/"); reply(r.nav("dashboard"), lang); return;
    }
    if (t.includes("agent") || t.includes("סוכן")) {
      navigate("/agents"); reply(r.nav("agents"), lang); return;
    }
    if (t.includes("client") || t.includes("לקוח") || t.includes("קליינט")) {
      navigate("/clients"); reply(r.nav("clients"), lang); return;
    }
    if (t.includes("log") || t.includes("לוג")) {
      navigate("/logs"); reply(r.nav("logs"), lang); return;
    }
    if (t.includes("workflow") || t.includes("וורקפלו") || t.includes("תהליך")) {
      navigate("/workflows"); reply(r.nav("workflows"), lang); return;
    }

    // Status
    if (t.includes("status") || t.includes("סטטוס") || t.includes("מה קורה") || t.includes("how many") || t.includes("כמה")) {
      setThinking(true); setResponse(r.loading);
      const stats = await fetchStats();
      setThinking(false);
      reply(r.status(stats.clients, stats.agents, stats.errors), lang);
      return;
    }

    // Greeting
    if (t.includes("hello") || t.includes("hi") || t.includes("שלום") || t.includes("היי") || t.includes("מה שלומך") || t.includes("מה נשמע")) {
      reply(pick(r.greet), lang); return;
    }

    // Close
    if (t.includes("close") || t.includes("bye") || t.includes("סגור") || t.includes("ביי")) {
      reply(pick(r.close), lang);
      setTimeout(() => setIsOpen(false), 1600);
      return;
    }

    // ─── High-risk classification → request JARVIS approval ────────────────────
    const taskInfo = classifyTask(text);
    if (taskInfo.risk === "high") {
      const desc = lang === "he" ? taskInfo.descHe : taskInfo.descEn;
      setPendingTaskId(taskInfo.taskId);
      // Store the action to execute upon approval
      pendingActionRef.current = () => {
        reply(lang === "he" ? `מבצע: ${desc}` : `Executing: ${desc}`, lang);
        agentBus.publish({ from: "gabar", to: "jarvis", type: "result", text: `בוצע: ${desc}` });
      };
      reply(
        lang === "he"
          ? `⚠ פעולת סיכון גבוה: "${desc}". שולח לגארביס לאישור...`
          : `⚠ High-risk: "${desc}". Sending to JARVIS for approval...`,
        lang
      );
      agentBus.publish({
        from: "gabar",
        to: "jarvis",
        type: "approve_req",
        text: desc,
        risk: "high",
        taskId: taskInfo.taskId,
      });
      return;
    }

    // Unknown — think then respond
    setThinking(true); setResponse(r.thinking);
    await new Promise((res) => setTimeout(res, 1600));
    setThinking(false);
    reply(pick(r.unknown), lang);
    agentBus.publish({ from: "gabar", to: "jarvis", type: "chat", text: `לא הבנתי: "${text.slice(0, 40)}"` });
  }, [resolveLang, navigate, reply, gestureEnabled]);

  // Voice recognition
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const lang = resolveLang();
    if (!SR) { reply(R[lang].no_mic, lang); return; }
    window.speechSynthesis.cancel(); setSpeaking(false);
    const rec = new SR();
    recRef.current = rec;
    rec.lang = langPref === "en" ? "en-US" : langPref === "he" ? "he-IL" : "he-IL";
    rec.interimResults = false; rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setListening(false);
      setResponse(R[resolveLang(said)].listened(said));
      processCommand(said);
    };
    rec.onerror = () => { setListening(false); reply(R[lang].mic_err, lang); };
    rec.onend = () => setListening(false);
    rec.start();
  }, [resolveLang, langPref, reply, processCommand]);

  // Idle chatter
  const resetIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      if (!thinking && !speaking && !listening && isOpen) {
        const l = resolveLang();
        reply(pick(R[l].idle), l);
      }
    }, 28_000);
  }, [thinking, speaking, listening, isOpen, resolveLang, reply]);

  useEffect(() => { if (isOpen) resetIdle(); return () => { if (idleRef.current) clearTimeout(idleRef.current); }; }, [isOpen, resetIdle]);

  // Open/close effects
  useEffect(() => {
    if (isOpen) {
      const l = resolveLang();
      const greet = pick(R[l].greet);
      setResponse(greet);
      setActiveLang(l);
      setTimeout(() => { setSpeaking(true); speak(greet, l, () => setSpeaking(false)); }, 350);
      agentBus.publish({ from: "gabar", to: "jarvis", type: "chat", text: "ג'ו מחובר ומוכן." });
    } else {
      window.speechSynthesis.cancel(); setSpeaking(false); setListening(false);
      setGestureEnabled(false);
      setPendingTaskId(null);
      pendingActionRef.current = null;
    }
  }, [isOpen]); // eslint-disable-line

  const pos = getWinPos();
  const langLabels: Record<Lang, string> = { he: "עב", en: "EN", auto: "🔄" };

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
        style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 9000,
          width: 56, height: 56, borderRadius: "50%",
          background: isOpen ? "linear-gradient(135deg,#4c1d95,#7c3aed)" : "linear-gradient(135deg,#1e1b2e,#2d2a4a)",
          border: `2px solid ${isOpen ? "#7c3aed" : "#3a3a5e"}`,
          boxShadow: isOpen ? "0 0 24px #7c3aed66, 0 4px 20px #0008" : "0 4px 16px #0006",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          transition: "background 0.3s, border-color 0.3s", overflow: "hidden",
        }}
        title="ג'ו — G לפתיחה"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="ג'ו" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : "🧔"}
      </motion.button>

      {/* Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            style={{
              position: "fixed", left: pos.x, top: pos.y, zIndex: 8999,
              width: WIN_W, borderRadius: 20, overflow: "hidden",
              background: "linear-gradient(160deg, #0d0d1a 0%, #12122a 60%, #1a0d2e 100%)",
              border: `1px solid ${isPinching ? "#ff980055" : "#2a2a4a"}`,
              boxShadow: isPinching
                ? "0 0 30px #ff980066, 0 24px 60px #000a"
                : "0 24px 60px #000a, 0 0 0 1px #ffffff06",
              userSelect: "none",
            }}
          >
            {/* Header — draggable */}
            <div
              onMouseDown={handleMouseDown}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 14px 8px",
                borderBottom: "1px solid #1e1e3a",
                cursor: "grab",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: pendingTaskId ? "#ff9800" : listening ? "#00ff55" : speaking ? "#7c3aed" : thinking ? "#ff9800" : "#22c55e",
                  boxShadow: `0 0 5px currentColor`,
                  animation: "pulse 1.4s infinite",
                }} />
                <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>ג'ו</span>
                <span style={{ color: "#6b7280", fontSize: 10 }}>
                  {pendingTaskId ? "⏳" : thinking ? "..." : speaking ? "🗣" : listening ? "👂" : gestureEnabled ? (handDetected ? "✋" : "👁") : "●"}
                </span>
                {pendingTaskId && (
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ color: "#ff9800", fontSize: 9, fontWeight: 600 }}>ממתין לJ</motion.span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Language toggle */}
                {(["he", "en", "auto"] as Lang[]).map((l) => (
                  <button key={l}
                    onClick={(e) => { e.stopPropagation(); setLangPref(l); }}
                    style={{
                      background: langPref === l ? "rgba(124,58,237,0.3)" : "transparent",
                      border: `1px solid ${langPref === l ? "#7c3aed" : "#2a2a4a"}`,
                      borderRadius: 6, padding: "2px 6px", color: langPref === l ? "#c4b5fd" : "#6b7280",
                      fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                    }}
                  >
                    {langLabels[l]}
                  </button>
                ))}

                {/* Gesture toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setGestureEnabled((v) => !v); }}
                  style={{
                    background: gestureEnabled ? "rgba(0,255,85,0.15)" : "transparent",
                    border: `1px solid ${gestureEnabled ? "#00ff55" : "#2a2a4a"}`,
                    borderRadius: 6, padding: "2px 6px",
                    color: gestureEnabled ? "#00ff55" : "#6b7280",
                    fontSize: 11, cursor: "pointer",
                  }}
                  title="מחוות יד"
                >
                  ✋
                </button>

                <button onClick={() => setIsOpen(false)}
                  style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Face */}
            <div style={{ display: "flex", justifyContent: "center", padding: "18px 0 14px", position: "relative" }}>
              <FaceAvatar src={avatarSrc} thinking={thinking} speaking={speaking} handGrab={isPinching} onUpload={handleUpload} />
            </div>

            {/* Response bubble */}
            <div style={{ padding: "0 14px 10px" }}>
              <motion.div key={response} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "10px 13px",
                  color: thinking ? "#00ff55" : "#e2e8f0",
                  fontSize: 13, lineHeight: 1.55, minHeight: 44,
                  textAlign: "right", direction: "rtl",
                  fontFamily: thinking ? "monospace" : "system-ui, sans-serif",
                }}
              >
                {response}
              </motion.div>
            </div>

            {/* ── Frustration offer card ─────────────────────────────────── */}
            <AnimatePresence>
              {showPersonaOffer && !activePersona && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scaleY: 0.92 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: 8, scaleY: 0.92 }}
                  style={{ margin: "0 12px 10px", borderRadius: 14, overflow: "hidden",
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(124,58,237,0.08))" }}
                >
                  <div style={{ padding: "10px 12px 6px", textAlign: "right", direction: "rtl" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <button onClick={() => setShowPersonaOffer(false)}
                        style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>
                        ✕
                      </button>
                      <div>
                        <span style={{ fontSize: 15, marginLeft: 5 }}>😓</span>
                        <span style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>זיהיתי תסכול</span>
                      </div>
                    </div>
                    <p style={{ color: "#cbd5e1", fontSize: 11.5, lineHeight: 1.5, margin: "0 0 8px" }}>
                      רוצה שאפעיל עוזר אישי מותאם? בחר למי:
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["ofer", "or"] as PersonaKey[]).map(key => {
                        const p = PERSONAS[key];
                        return (
                          <button key={key} onClick={() => activatePersona(key)}
                            style={{
                              flex: 1, padding: "8px 6px", borderRadius: 10, cursor: "pointer",
                              border: `1px solid ${p.color}55`,
                              background: `${p.color}18`,
                              color: "#e2e8f0", fontSize: 12.5, fontWeight: 700,
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = `${p.color}30`)}
                            onMouseLeave={e => (e.currentTarget.style.background = `${p.color}18`)}
                          >
                            <span style={{ fontSize: 20 }}>{p.emoji}</span>
                            <span>{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Personal assistant panel ──────────────────────────────────── */}
            <AnimatePresence>
              {activePersona && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  {(() => {
                    const p = PERSONAS[activePersona];
                    return (
                      <div style={{
                        margin: "0 12px 10px", borderRadius: 14,
                        border: `1px solid ${p.color}44`,
                        background: `linear-gradient(135deg, ${p.color}10, rgba(255,255,255,0.02))`,
                        overflow: "hidden",
                      }}>
                        {/* Panel header */}
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderBottom: `1px solid ${p.color}22`,
                          background: `${p.color}12`,
                        }}>
                          <button onClick={() => { setActivePersona(null); setFrustrationScore(0); }}
                            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>
                            ✕
                          </button>
                          <span style={{ color: p.color, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>
                            {p.title}
                          </span>
                        </div>

                        {/* Tip of the moment */}
                        <div style={{ padding: "7px 12px 2px", textAlign: "right", direction: "rtl" }}>
                          <motion.div
                            key={personaTip}
                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                            style={{ color: "#94a3b8", fontSize: 10.5, marginBottom: 7 }}
                          >
                            {p.tips[personaTip]}
                          </motion.div>

                          {/* Quick-action grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>
                            {p.actions.map(a => (
                              <button key={a.path} onClick={() => { navigate(a.path); reply(`פותח ${a.label.replace(/[^\u0590-\u05ff\s\w]/g, "").trim() || a.path}...`, "he"); }}
                                style={{
                                  padding: "6px 4px", borderRadius: 8, cursor: "pointer",
                                  border: `1px solid ${p.color}33`,
                                  background: `${p.color}10`,
                                  color: "#e2e8f0", fontSize: 10, fontWeight: 600,
                                  textAlign: "center", lineHeight: 1.3, transition: "background 0.15s",
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = `${p.color}28`)}
                                onMouseLeave={e => (e.currentTarget.style.background = `${p.color}10`)}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>

                          {/* Next tip */}
                          <button onClick={() => setPersonaTip(i => (i + 1) % p.tips.length)}
                            style={{
                              width: "100%", padding: "4px 0", borderRadius: 7, cursor: "pointer",
                              border: `1px solid ${p.color}22`, background: "transparent",
                              color: "#6b7280", fontSize: 9.5, letterSpacing: 0.3,
                              marginBottom: 4,
                            }}>
                            💡 טיפ הבא
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Camera preview (when gesture on) */}
            {gestureEnabled && (
              <div style={{ padding: "0 14px 8px", display: "flex", justifyContent: "center" }}>
                <CameraPreview videoRef={videoRef} handDetected={handDetected} />
              </div>
            )}

            {/* Duet topic input */}
            <AnimatePresence>
              {duetInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ padding: "0 12px 10px" }}>
                    <div style={{
                      background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.3)",
                      borderRadius: 12, padding: "10px 12px",
                    }}>
                      <p style={{ color: "#7dd3fc", fontSize: 11, margin: "0 0 8px", direction: "rtl", textAlign: "right", fontWeight: 600 }}>
                        🤝 על מה J + G ידונו?
                      </p>
                      <input
                        autoFocus
                        value={duetTopic}
                        onChange={e => setDuetTopic(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && duetTopic.trim()) {
                            setDuetInput(false);
                            setDuetOpen(true);
                            reply("מפעיל דואט עם ג'ארוויס... 🎭", "he");
                          }
                          if (e.key === "Escape") { setDuetInput(false); setDuetTopic(""); }
                        }}
                        placeholder="ייעול תהליך לידים, workflow חדש, ניתוח סוכנים..."
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: "rgba(0,0,0,0.3)", border: "1px solid rgba(14,165,233,0.3)",
                          borderRadius: 8, padding: "7px 10px", color: "#e2e8f0", fontSize: 12,
                          outline: "none", direction: "rtl", fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => { if (duetTopic.trim()) { setDuetInput(false); setDuetOpen(true); reply("מפעיל דואט עם ג'ארוויס... 🎭", "he"); } }}
                          disabled={!duetTopic.trim()}
                          style={{
                            flex: 1, padding: "6px", borderRadius: 7, cursor: duetTopic.trim() ? "pointer" : "default",
                            border: "1px solid rgba(14,165,233,0.4)", background: duetTopic.trim() ? "rgba(14,165,233,0.2)" : "rgba(14,165,233,0.05)",
                            color: "#7dd3fc", fontSize: 11, fontWeight: 700, transition: "all 0.2s",
                          }}
                        >
                          🚀 פתח דואט
                        </button>
                        <button onClick={() => { setDuetInput(false); setDuetTopic(""); }}
                          style={{
                            padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                            border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                            color: "#6b7280", fontSize: 11,
                          }}>
                          ביטול
                        </button>
                      </div>
                      {/* Quick topic presets */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {["ייעול לידים", "workflow אוטומטי", "ניתוח סוכנים", "דוח שבועי"].map(t => (
                          <button key={t} onClick={() => setDuetTopic(t)}
                            style={{
                              padding: "3px 8px", borderRadius: 20, cursor: "pointer",
                              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                              color: "#9ca3af", fontSize: 9.5, transition: "all 0.15s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#e2e8f0")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 14px 14px", borderTop: "1px solid #1e1e3a",
            }}>
              <SpeechWave active={speaking} />

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <motion.button
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                  onClick={startListening} disabled={listening || thinking}
                  style={{
                    width: 50, height: 50, borderRadius: "50%",
                    border: `2px solid ${listening ? "#00ff55" : "#7c3aed"}`,
                    background: listening ? "rgba(0,255,85,0.12)" : thinking ? "rgba(255,152,0,0.1)" : "rgba(124,58,237,0.18)",
                    cursor: listening || thinking ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    boxShadow: listening ? "0 0 14px #00ff5555" : "0 0 8px #7c3aed44",
                    transition: "all 0.3s",
                  }}
                  title="דבר עם ג'ו"
                >
                  {listening ? (
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      🎙️
                    </motion.span>
                  ) : thinking ? "⏳" : "🎙️"}
                </motion.button>

                {/* Duet button */}
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setDuetInput(v => !v)}
                  style={{
                    padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${duetInput ? "rgba(14,165,233,0.6)" : "rgba(14,165,233,0.25)"}`,
                    background: duetInput ? "rgba(14,165,233,0.2)" : "rgba(14,165,233,0.07)",
                    color: duetInput ? "#7dd3fc" : "#38bdf8",
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                    transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5,
                  }}
                  title="שוחח עם ג'ארוויס"
                >
                  <span style={{ fontSize: 12 }}>🤝</span>
                  שוחח עם J
                </motion.button>
              </div>

              <SpeechWave active={listening} color="#00ff55" />
            </div>

            {/* Lang indicator */}
            <div style={{ textAlign: "center", paddingBottom: 10, color: "#374151", fontSize: 10, letterSpacing: 0.5 }}>
              {activeLang === "he" ? "מדבר עברית" : "Speaking English"} ·{" "}
              <kbd style={{ background: "#1e1e3a", color: "#6b7280", padding: "1px 5px", borderRadius: 4, fontSize: 9 }}>G</kbd>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>

      {/* Agent Duet panel — full-screen overlay */}
      <AgentDuet
        open={duetOpen}
        topic={duetTopic}
        onClose={() => { setDuetOpen(false); reply("הדואט הסתיים. עופר או אור צריכים לאשר לפני ביצוע.", "he"); }}
      />
    </>
  );
}
