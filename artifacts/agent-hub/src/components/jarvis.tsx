import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { agentBus, AgentMsg } from "@/lib/agentBus";
import { detectScreenLayout, openOnSecondaryScreen, type ScreenLayout } from "@/lib/screenLayout";
import {
  planTriggerRun,
  selectTriggerChoice,
  type ResolvedTrigger,
} from "@/lib/jarvisTriggerFlow";

// ─── Global types ─────────────────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    faceapi: {
      nets: {
        tinyFaceDetector: { loadFromUri: (u: string) => Promise<void>; isLoaded: boolean };
        faceLandmark68TinyNet: { loadFromUri: (u: string) => Promise<void>; isLoaded: boolean };
        faceRecognitionNet: { loadFromUri: (u: string) => Promise<void>; isLoaded: boolean };
      };
      TinyFaceDetectorOptions: new (o?: { inputSize?: number; scoreThreshold?: number }) => unknown;
      detectSingleFace: (
        el: HTMLVideoElement,
        opts: unknown
      ) => {
        withFaceLandmarks: (tiny?: boolean) => {
          withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined>;
        };
      };
    };
  }
}

// ─── JARVIS Config ─────────────────────────────────────────────────────────────
const CYAN = "#00e5ff";
const BLUE = "#0d47a1";
const GOLD = "#ffd600";
const RED  = "#ff1744";
const DARK = "#010b14";
const GREEN = "#00ff88";

type KnownPerson = "unknown" | "admin" | "or";

// ─── Load external script ────────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── Face API helpers ─────────────────────────────────────────────────────────
const FACE_MODEL_CDN = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

async function loadFaceModels(): Promise<boolean> {
  try {
    if (!window.faceapi)
      await loadScript("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js");
    const fa = window.faceapi;
    await Promise.all([
      fa.nets.tinyFaceDetector.isLoaded    || fa.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_CDN),
      fa.nets.faceLandmark68TinyNet.isLoaded || fa.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_CDN),
      fa.nets.faceRecognitionNet.isLoaded   || fa.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_CDN),
    ]);
    return true;
  } catch (e) {
    console.error("[JARVIS/face] load error:", e);
    return false;
  }
}

async function captureDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  try {
    const result = await window.faceapi
      .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    return result?.descriptor ?? null;
  } catch { return null; }
}

function faceDistance(a: Float32Array, b: Float32Array): number {
  return Math.sqrt(Array.from(a).reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

function saveDescriptor(key: string, d: Float32Array) {
  localStorage.setItem(key, JSON.stringify(Array.from(d)));
}

function loadDescriptor(key: string): Float32Array | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Float32Array(JSON.parse(raw)) : null;
  } catch { return null; }
}

async function identifyPerson(video: HTMLVideoElement): Promise<KnownPerson> {
  const desc = await captureDescriptor(video);
  if (!desc) return "unknown";
  const orDesc    = loadDescriptor("jarvis-face-or");
  const adminDesc = loadDescriptor("jarvis-face-admin");
  const THRESH = 0.52;
  if (orDesc    && faceDistance(desc, orDesc)    < THRESH) return "or";
  if (adminDesc && faceDistance(desc, adminDesc) < THRESH) return "admin";
  return "unknown";
}

// ─── speak ────────────────────────────────────────────────────────────────────
function speak(text: string, lang = "he-IL") {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = 1.02; u.pitch = 0.88; u.volume = 1;
  const assignVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const v = lang.startsWith("he")
      ? voices.find((v) => v.lang.startsWith("he"))
      : voices.find((v) => v.name.includes("Daniel") || v.name.includes("Alex") || v.lang.startsWith("en"));
    if (v) u.voice = v;
  };
  if (window.speechSynthesis.getVoices().length) assignVoice();
  else window.speechSynthesis.addEventListener("voiceschanged", assignVoice, { once: true });
  window.speechSynthesis.speak(u);
}

// ─── Beep ─────────────────────────────────────────────────────────────────────
function beep(freq = 880, duration = 0.08, vol = 0.15) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = "sine";
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch {}
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function HexRing({ r, color, dash, speed, cw = true }: { r: number; color: string; dash: string; speed: number; cw?: boolean }) {
  return (
    <motion.circle cx="50%" cy="50%" r={r} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray={dash}
      animate={{ rotate: cw ? 360 : -360 }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "50% 50%" }}
    />
  );
}

function ArcReactor({ active }: { active: boolean }) {
  return (
    <div style={{ width: 64, height: 64, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ position: "absolute", inset: 0 }}>
        <HexRing r={28} color={active ? CYAN : "#1a3a4a"} dash="8 4" speed={4} />
        <HexRing r={22} color={active ? GOLD : "#1a2a3a"} dash="5 6" speed={6} cw={false} />
        <HexRing r={16} color={active ? CYAN : "#0d1f2a"} dash="3 8" speed={3} />
      </svg>
      <motion.div
        animate={active ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : { scale: 1, opacity: 0.3 }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          width: 20, height: 20, borderRadius: "50%",
          background: active ? `radial-gradient(circle, white 10%, ${CYAN} 50%, ${BLUE} 100%)` : `radial-gradient(circle, #1a3a5a 30%, #0d1f2a 100%)`,
          boxShadow: active ? `0 0 20px ${CYAN}, 0 0 40px ${BLUE}` : "none",
        }}
      />
    </div>
  );
}

function ScanLines() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: 12 }}>
      {[...Array(40)].map((_, i) => (
        <div key={i} style={{ position: "absolute", width: "100%", top: `${i * 2.5}%`, height: 1, background: `rgba(0,229,255,${i % 4 === 0 ? 0.04 : 0.01})` }} />
      ))}
      <motion.div style={{ position: "absolute", width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${CYAN}44,transparent)` }}
        animate={{ top: ["0%", "100%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
    </div>
  );
}

function WebcamEye({ streaming, videoRef, knownPerson }: {
  streaming: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  knownPerson: KnownPerson;
}) {
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!streaming) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setErr("אין גישה למצלמה"));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [streaming, videoRef]);

  const personColor = knownPerson === "or" ? RED : knownPerson === "admin" ? GREEN : CYAN;
  const personLabel = knownPerson === "or" ? "⚠ אור" : knownPerson === "admin" ? "✓ מנהל" : "? לא מזוהה";

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, width: 200, height: 150, border: `1.5px solid ${personColor}44`, background: DARK, boxShadow: `0 0 20px ${personColor}22` }}>
      {err ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontSize: 11, textAlign: "center" }}>{err}</div>
      ) : (
        <>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7, filter: "hue-rotate(180deg) saturate(0.5) brightness(0.85)" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {[["top:4px;left:4px", "border-top:1.5px solid;border-left:1.5px solid"],
              ["top:4px;right:4px", "border-top:1.5px solid;border-right:1.5px solid"],
              ["bottom:4px;left:4px", "border-bottom:1.5px solid;border-left:1.5px solid"],
              ["bottom:4px;right:4px", "border-bottom:1.5px solid;border-right:1.5px solid"]].map(([pos, border], i) => (
              <div key={i} style={{ position: "absolute", width: 14, height: 14, borderColor: personColor, ...Object.fromEntries(pos.split(";").map((p) => p.split(":"))) as Record<string, string>, ...Object.fromEntries(border.split(";").map((b) => b.split(":").map((s, j) => j === 0 ? s.trim() : s.trim()))) }} />
            ))}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 40, height: 40, border: `1px solid ${personColor}55`, borderRadius: "50%", position: "relative" }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: `${personColor}22`, transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: `${personColor}22`, transform: "translateX(-50%)" }} />
              </div>
            </div>
            <motion.div style={{ position: "absolute", width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${personColor}88,transparent)` }}
              animate={{ top: ["0%", "100%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
            <div style={{ position: "absolute", bottom: 4, left: 6, color: personColor, fontSize: 8, fontFamily: "monospace", letterSpacing: 1 }}>BIOMETRIC SCAN</div>
            <div style={{ position: "absolute", top: 4, right: 6, color: personColor, fontSize: 8, fontFamily: "monospace" }}>{personLabel}</div>
            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ position: "absolute", top: 4, left: 6, color: GOLD, fontSize: 8, fontFamily: "monospace" }}>● REC</motion.div>
          </div>
        </>
      )}
    </div>
  );
}

function VoiceWave({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
      {[...Array(12)].map((_, i) => (
        <motion.div key={i} style={{ width: 3, background: CYAN, borderRadius: 2 }}
          animate={active ? { height: [4, 8 + Math.random() * 20, 4], opacity: [0.6, 1, 0.6] } : { height: 3, opacity: 0.25 }}
          transition={active ? { duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 } : {}}
        />
      ))}
    </div>
  );
}

// ─── Command parser ────────────────────────────────────────────────────────────
type ParsedCmd =
  | { type: "navigate"; to: string; label: string }
  | { type: "status" }
  | { type: "count_clients" }
  | { type: "count_agents" }
  | { type: "top_client" }
  | { type: "server_status" }
  | { type: "check_logs" }
  | { type: "refresh" }
  | { type: "clear_log" }
  | { type: "mute" }
  | { type: "close" }
  | { type: "greet" }
  | { type: "webcam" }
  | { type: "approve" }
  | { type: "reject" }
  | { type: "show_client"; name: string }
  | { type: "show_agent"; name: string }
  | { type: "create_client" }
  | { type: "run_trigger"; name: string }
  | { type: "show_recent" }
  | { type: "unknown"; raw: string };

function stripPrefix(t: string, re: RegExp): string {
  return t.replace(re, "").trim();
}

function parseCommand(text: string, hasPending: boolean): ParsedCmd {
  const t = text.toLowerCase().trim();

  // ── Pending approval responses ──
  if (hasPending && /^(כן|מאשר|אישור|אוקי|yes|approve|confirm)/.test(t)) return { type: "approve" };
  if (hasPending && /^(לא|ביטול|בטל|no|reject|cancel|deny)/.test(t)) return { type: "reject" };

  // ── Control ──
  if (/^(נקה|מחק).{0,4}(לוג|log)|clear.?log/.test(t)) return { type: "clear_log" };
  if (/השתק|תשתוק|שקט|mute|silence/.test(t)) return { type: "mute" };
  if (/^רענן|תרענן|refresh|reload/.test(t)) return { type: "refresh" };
  if (/מצלמ|עיניים|webcam|camera/.test(t)) return { type: "webcam" };
  if (/סגור|כבה|יציאה|close|exit/.test(t)) return { type: "close" };

  // ── Info / queries ──
  if (/מצב.?(ה)?שרת|server.?status|השרת.?עובד|בריאות/.test(t)) return { type: "server_status" };
  if (/בדוק.?לוג|בדיקת.?לוג|check.?log|שגיאות/.test(t)) return { type: "check_logs" };
  if (/כמה.?לקוח|מספר.?לקוח|how.?many.?client/.test(t)) return { type: "count_clients" };
  if (/כמה.?סוכנ|מספר.?סוכנ|how.?many.?agent/.test(t)) return { type: "count_agents" };
  if (/הכי.?פעיל|לקוח.?מוביל|top.?client|most.?active/.test(t)) return { type: "top_client" };
  if (/סטטוס|מה.?(ה)?מצב|status|דוח|report|מה.?נשמע|סיכום/.test(t)) return { type: "status" };

  // ── Client/agent actions (read + navigate) ──
  if (/צור.?לקוח|לקוח.?חדש|new.?client|create.?client/.test(t)) return { type: "create_client" };
  if (/הצג.?לקוח\s+(.+)/.test(t)) return { type: "show_client", name: stripPrefix(t, /.*הצג.?לקוח\s+/) };
  if (/הצג.?סוכן\s+(.+)/.test(t)) return { type: "show_agent", name: stripPrefix(t, /.*הצג.?סוכן\s+/) };
  if (/(הפעל|הרץ|run|trigger).{0,6}trigger|הפעל.?trigger|trigger.?ל/.test(t)) {
    return { type: "run_trigger", name: stripPrefix(t, /.*(הפעל|הרץ|run).{0,8}(trigger|טריגר)\s*(ל)?/) };
  }
  if (/אחרון|אחרונים|recent|לאחרונה/.test(t)) return { type: "show_recent" };

  // ── Greeting ──
  if (/^(שלום|היי|הי|הפעל|jarvis|ג.?ארוויס|ג.?ארביס|מרק|מר קין|hello|hi)\b/.test(t)) return { type: "greet" };

  // ── Navigation ──
  if (/aor|אקדמי|academy|אור/.test(t)) return { type: "navigate", to: "/aor", label: "AOR Academy" };
  if (/קונקטיב|connectivity|חיבוריות|אינטגרצ/.test(t)) return { type: "navigate", to: "/connectivity", label: "Connectivity" };
  if (/תחזוק|maintenance|תיקון/.test(t)) return { type: "navigate", to: "/maintenance", label: "תחזוקה" };
  if (/הגדרות|settings|פרופיל/.test(t)) return { type: "navigate", to: "/settings", label: "הגדרות" };
  if (/אופן.?סורס|open.?source|קוד.?פתוח/.test(t)) return { type: "navigate", to: "/opensource", label: "Open Source" };
  if (/n8n|טמפלייט|תבניות/.test(t)) return { type: "navigate", to: "/n8n-templates", label: "N8N Templates" };
  if (/ספריית.?וורקפלו|workflow.?library|ספריה/.test(t)) return { type: "navigate", to: "/workflow-library", label: "Workflow Library" };
  if (/rpa|קונקטור|connector/.test(t)) return { type: "navigate", to: "/rpa-connectors", label: "RPA Connectors" };
  if (/פלגייט|palgate|שער/.test(t)) return { type: "navigate", to: "/palgate", label: "Palgate" };
  if (/ספק|spec.?agent/.test(t)) return { type: "navigate", to: "/spec-agent", label: "Spec Agent" };
  if (/תרגום|lang.?agent|שפה/.test(t)) return { type: "navigate", to: "/lang-agent", label: "Lang Agent" };
  if (/דשבורד|בית|ראשי|dashboard|home/.test(t)) return { type: "navigate", to: "/", label: "דשבורד" };
  if (/וורקפלו|workflow|זרימ/.test(t)) return { type: "navigate", to: "/workflows", label: "וורקפלואים" };
  if (/לוג|log/.test(t)) return { type: "navigate", to: "/logs", label: "לוגים" };
  if (/סוכנ|agent/.test(t) && !/לקוח/.test(t)) return { type: "navigate", to: "/agents", label: "סוכנים" };
  if (/לקוח|client/.test(t)) return { type: "navigate", to: "/clients", label: "לקוחות" };

  return { type: "unknown", raw: text };
}

interface SummaryData {
  totalAgents: number; activeAgents: number;
  totalClients: number; activeClients: number;
  totalDeployments: number;
}

async function fetchSummary(): Promise<SummaryData | null> {
  try {
    const r = await fetch("/api/stats/summary");
    if (!r.ok) throw new Error();
    return await r.json();
  } catch { return null; }
}

async function fetchStats(): Promise<string> {
  const d = await fetchSummary();
  if (!d) return "לא הצלחתי להביא נתונים מהשרת.";
  return `מר סטארק, הדוח: ${d.totalAgents} סוכנים, ${d.activeAgents} פעילים. ${d.totalClients} לקוחות, ${d.activeClients} פעילים. ${d.totalDeployments} פריסות.`;
}

async function fetchServerStatus(): Promise<string> {
  try {
    const r = await fetch("/api/healthz");
    if (!r.ok) throw new Error();
    const d = await r.json();
    return d?.status === "ok" ? "השרת מקוון ותקין, מר סטארק. כל המערכות פעילות." : "השרת מגיב אך מדווח על בעיה.";
  } catch {
    return "אין מענה מהשרת, מר סטארק. ייתכן שה-API נפל.";
  }
}

async function fetchLogCheck(): Promise<string> {
  try {
    const r = await fetch("/api/logs/summary");
    if (!r.ok) throw new Error();
    const d = await r.json();
    const errors = d.error ?? d.errors ?? 0;
    const warnings = d.warning ?? d.warnings ?? 0;
    const total = d.total ?? 0;
    return errors > 0
      ? `מצאתי ${errors} שגיאות ו-${warnings} אזהרות מתוך ${total} לוגים, מר סטארק. כדאי לבדוק.`
      : `הלוגים נקיים — ${total} רשומות, ${warnings} אזהרות, אפס שגיאות.`;
  } catch {
    return "לא הצלחתי לקרוא את הלוגים.";
  }
}

async function fetchTopClient(): Promise<string> {
  try {
    const r = await fetch("/api/trigger-stats/summary");
    if (r.ok) {
      const d = await r.json();
      const top = Array.isArray(d?.clients) ? d.clients[0] : (Array.isArray(d?.byClient) ? d.byClient[0] : null);
      if (top?.name || top?.clientName) {
        return `הלקוח הכי פעיל הוא ${top.name ?? top.clientName}, מר סטארק.`;
      }
    }
  } catch { /* fall through */ }
  try {
    const r = await fetch("/api/clients");
    const list = await r.json();
    const active = (Array.isArray(list) ? list : []).filter((c: { status?: string }) => c.status === "active");
    if (active.length) return `מבין הלקוחות הפעילים, ${active[0].name} מוביל את הרשימה.`;
    return "אין מספיק נתוני פעילות כדי לקבוע לקוח מוביל.";
  } catch {
    return "לא הצלחתי להביא נתוני לקוחות.";
  }
}

// ─── Remote trigger execution (Telegram → desktop) ─────────────────────────────
// A run-trigger command from Telegram resolves to a real client/agent webhook
// here. The webhook secret never leaves the desktop — the Mini App only ever
// sends a confirm/cancel verb, and the desktop holds the resolved target.
// The name is matched against client names first (legacy behaviour) and then
// against agent names across every client, so ops can say "run Deal Accelerator".
interface Assignment { id: number; agent?: { name?: string } }

// Desktop-side trigger run state, mirroring the Telegram flow:
// resolve → (pick-list if many) → confirm → fire.
type DesktopTrigger =
  | { mode: "choose"; triggers: ResolvedTrigger[] }
  | { mode: "confirm"; trigger: ResolvedTrigger }
  | { mode: "running"; trigger: ResolvedTrigger };

// Resolve the webhook secret for one assignment, or null if it has no trigger.
// The live trigger status (idle / running / triggered) is captured too so the
// Telegram pick-list can show whether each candidate agent is already busy.
async function triggerForAssignment(a: Assignment, clientName: string): Promise<ResolvedTrigger | null> {
  try {
    const tr = await fetch(`/api/assignments/${a.id}/trigger`);
    if (!tr.ok) return null;
    const t = await tr.json();
    const secret = String(t.webhookUrl || "").split("/webhooks/trigger/").pop() || "";
    if (!secret) return null;
    const status = typeof t.status === "string" ? t.status : "idle";
    return { secret, label: `${a.agent?.name ?? "סוכן"} · ${clientName}`, assignmentId: a.id, status };
  } catch { return null; }
}

// Resolves a client-name query to *every* configured webhook trigger that
// matches (across all matching clients and their assignments). The caller
// decides: one match → direct confirm; many → a pick-list so ops can choose
// which agent to run. The webhook secret never leaves the desktop.
async function resolveTriggersByName(query: string): Promise<{ triggers?: ResolvedTrigger[]; error?: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return { error: "לא ציינת עבור איזה לקוח או סוכן להפעיל את הטריגר, מר סטארק." };

  let clients: Array<{ id: number; name: string }> = [];
  try {
    clients = await fetch("/api/clients").then((r) => r.json());
  } catch {
    return { error: "לא הצלחתי להביא את רשימת הלקוחות." };
  }
  if (!Array.isArray(clients)) return { error: "לא הצלחתי להביא את רשימת הלקוחות." };

  const fetchAssignments = async (clientId: number): Promise<Assignment[]> => {
    try {
      const a = await fetch(`/api/clients/${clientId}/assignments`).then((r) => r.json());
      return Array.isArray(a) ? a : [];
    } catch { return []; }
  };

  // ── 1. Match by client name (legacy precedence): collect every configured
  //       trigger for matching clients. If the name matches a client we stay
  //       within client scope and never fall back to agent search, so a client
  //       run can't accidentally fire a different agent. ──
  const clientMatches = clients.filter((c) => c.name?.toLowerCase().includes(q));
  if (clientMatches.length > 0) {
    const triggers: ResolvedTrigger[] = [];
    for (const client of clientMatches) {
      for (const a of await fetchAssignments(client.id)) {
        const trig = await triggerForAssignment(a, client.name);
        if (trig) triggers.push(trig);
      }
    }
    if (triggers.length === 0) return { error: `ללקוח "${clientMatches[0].name}" אין trigger מוגדר. הגדר אחד בממשק.` };
    return { triggers };
  }

  // ── 2. No client matched — match by agent name across every client. All
  //       matches are returned so the caller's pick-list handles ambiguity. ──
  const triggers: ResolvedTrigger[] = [];
  for (const client of clients) {
    for (const a of await fetchAssignments(client.id)) {
      if (!a.agent?.name?.toLowerCase().includes(q)) continue;
      const trig = await triggerForAssignment(a, client.name);
      if (trig) triggers.push(trig);
    }
  }
  if (triggers.length === 0) return { error: `לא מצאתי לקוח או סוכן בשם "${query}".` };
  return { triggers };
}

// Re-fetch the live trigger status for one assignment. Returns the status
// string (idle / running / triggered) or null if it can't be determined. Used
// at confirm time to refuse firing an agent that became busy after the pick-list
// (or confirm prompt) was shown, blocking accidental double-runs.
async function liveTriggerStatus(assignmentId: number): Promise<string | null> {
  try {
    const t = await fetch(`/api/assignments/${assignmentId}/trigger`).then((r) => r.json());
    return typeof t?.status === "string" ? t.status : null;
  } catch {
    return null;
  }
}

async function fireTriggerAndAwait(t: ResolvedTrigger): Promise<string> {
  let fired: { deduplicated?: boolean } | null = null;
  try {
    const r = await fetch(`/api/webhooks/trigger/${t.secret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "jarvis_remote_trigger", source: "Telegram", timestamp: new Date().toISOString() }),
    });
    if (!r.ok) return `הפעלת הטריגר נכשלה (${r.status}), מר סטארק.`;
    fired = await r.json();
  } catch {
    return "לא הצלחתי להפעיל את הטריגר — שגיאת רשת.";
  }

  if (fired?.deduplicated) {
    return `הטריגר עבור ${t.label} כבר הופעל לאחרונה — הבקשה הכפולה נחסמה.`;
  }

  // The agent runs asynchronously; poll the trigger until it returns to idle
  // and surface the agent's output if available.
  const deadline = Date.now() + 18_000;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 1500));
    try {
      const t2 = await fetch(`/api/assignments/${t.assignmentId}/trigger`).then((r) => r.json());
      if (t2?.status === "idle") {
        const events = Array.isArray(t2.recentEvents) ? t2.recentEvents : [];
        const out = events.find((e: { agentOutput?: string | null }) => e.agentOutput)?.agentOutput;
        // "__TEMPLATE__" is the sentinel returned when no AI model is configured.
        return out && out !== "__TEMPLATE__"
          ? `✓ ${t.label} — הסוכן השיב:\n${out}`
          : `✓ הטריגר עבור ${t.label} הופעל והושלם.`;
      }
    } catch { /* keep polling */ }
  }
  return `✓ הטריגר עבור ${t.label} הופעל. הסוכן עדיין רץ — בדוק את הלוגים בעוד רגע.`;
}

async function interpretWithModel(text: string): Promise<string> {
  try {
    const r = await fetch("/api/jarvis/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const d = await r.json();
    return d.reply || `לא הצלחתי לפענח: "${text}".`;
  } catch {
    return `לא הצלחתי לפענח: "${text}". נסה שוב.`;
  }
}

interface LogEntry { time: string; text: string; type: "cmd" | "res" | "sys" | "agent" | "alert"; }

// ─── Main JARVIS component ────────────────────────────────────────────────────
export default function Jarvis() {
  const [, navigate] = useLocation();
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [webcamOn, setWebcamOn] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("מוכן לפקודה, מר סטארק.");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bootSeq, setBootSeq] = useState(false);
  const [clock, setClock] = useState("");
  const [muted, setMuted] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const executorTokenRef = useRef<string | null>(null);
  // A write action (trigger run) requested from Telegram, held until the user
  // confirms it from the Mini App. The webhook secret stays here, never sent out.
  const pendingTriggerRef = useRef<(ResolvedTrigger & { ts: number }) | null>(null);
  // When a client matched more than one trigger, the resolved candidates are
  // held here until ops picks one from the Mini App pick-list. Secrets stay
  // on the desktop — the Mini App only ever sends back the chosen index.
  const pendingTriggerChoicesRef = useRef<{ triggers: ResolvedTrigger[]; ts: number } | null>(null);

  // Face recognition state
  const [faceModelsLoading, setFaceModelsLoading] = useState(false);
  const [faceModelsReady, setFaceModelsReady] = useState(false);
  const [knownPerson, setKnownPerson] = useState<KnownPerson>("unknown");
  const [registeringFor, setRegisteringFor] = useState<"or" | "admin" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPersonRef = useRef<KnownPerson>("unknown");
  const faceDetectRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Screen layout
  const [screenLayout, setScreenLayout] = useState<ScreenLayout | null>(null);

  // Agent collaboration
  const [pendingApproval, setPendingApproval] = useState<AgentMsg | null>(null);
  const pendingApprovalRef = useRef<AgentMsg | null>(null);
  useEffect(() => { pendingApprovalRef.current = pendingApproval; }, [pendingApproval]);

  // Desktop "run trigger" flow (pick-list / confirm / running). Kept in a ref
  // too so voice "כן/לא" can resolve it from inside the command parser.
  const [desktopTrigger, setDesktopTrigger] = useState<DesktopTrigger | null>(null);
  const desktopTriggerRef = useRef<DesktopTrigger | null>(null);
  useEffect(() => { desktopTriggerRef.current = desktopTrigger; }, [desktopTrigger]);

  const recognRef = useRef<SpeechRecognition | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((text: string, type: LogEntry["type"] = "sys") => {
    const time = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev.slice(-50), { time, text, type }]);
  }, []);

  const respond = useCallback((text: string, lang?: string) => {
    setResponse(text);
    if (!mutedRef.current) speak(text, lang);
    addLog(text, "res");
  }, [addLog]);

  // ─── Face detection loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!webcamOn) {
      if (faceDetectRef.current) clearInterval(faceDetectRef.current);
      setKnownPerson("unknown");
      lastPersonRef.current = "unknown";
      return;
    }

    // Load models if needed
    if (!faceModelsReady && !faceModelsLoading) {
      setFaceModelsLoading(true);
      addLog("טוען מנוע זיהוי פנים...", "sys");
      loadFaceModels().then((ok) => {
        setFaceModelsLoading(false);
        setFaceModelsReady(ok);
        if (ok) addLog("מנוע זיהוי פנים מוכן.", "sys");
        else addLog("⚠ לא הצלחתי לטעון זיהוי פנים.", "sys");
      });
      return;
    }
    if (!faceModelsReady) return;

    faceDetectRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      const who = await identifyPerson(videoRef.current);
      if (who === lastPersonRef.current) return;
      lastPersonRef.current = who;
      setKnownPerson(who);

      if (who === "or") {
        const orGreets = [
          "שוב פעם אתה?? ג׳ארוויס שמח — גבר פחות. שניהם יסתדרו.",
          "אור נכנס. הסיכונים המוגברים הופעלו אוטומטית. ומגש קפה הוזמן.",
          "אה, אור. ג׳ארוויס ביקש שאגיד לך: ׳שוב אתה?׳. אני אומר: ברוך הבא.",
          "זיהיתי אות חיים אנושיים. זה אור. גבר כבר מתרגש. אני שומר על קור רוח מקצועי.",
          "אור, שלום. ג׳ארוויס מנטר אותך כבר מהפרקינג. לא הפתעת אותו.",
        ];
        const msg = orGreets[Math.floor(Math.random() * orGreets.length)];
        respond(msg);
        beep(440, 0.12); setTimeout(() => beep(660, 0.1), 150);
        agentBus.publish({ from: "jarvis", to: "gabar", type: "greeting", text: "or_detected" });
        addLog("⚠ זוהה: אור", "alert");
      } else if (who === "admin") {
        const greets = [
          "ברוך הבא, מר סטארק. כל המערכות תקינות. גבר פחות.",
          "ג׳ארוויס מוכן. המערכות — תקינות. גבר — שוב מתמרמר. מה הפקודה?",
          "שלום, מר סטארק. שמחתי לראות אותך — לאחר שניקיתי את כל מה שהשארת.",
          "זוהה: הבוס. ג׳ארוויס מרים גבה אחת. הכל מוכן. גם מה שלא ביקשת.",
          "הפקודות שלך התקבלו מראש. כרגיל, ג׳ארוויס היה מוכן לפני שהגעת.",
        ];
        respond(greets[Math.floor(Math.random() * greets.length)]);
        addLog("✓ זוהה: מנהל", "sys");
      }
    }, 3000);

    return () => { if (faceDetectRef.current) clearInterval(faceDetectRef.current); };
  }, [webcamOn, faceModelsReady, faceModelsLoading, respond, addLog]);

  // ─── Register face ──────────────────────────────────────────────────────────
  const registerFace = useCallback(async (who: "or" | "admin") => {
    if (!videoRef.current || !faceModelsReady) {
      respond("מצלמה לא פעילה. הפעל קודם את המצלמה."); return;
    }
    setRegisteringFor(who);
    const whoLabel = who === "or" ? "אור" : "מנהל";
    respond(`מחכה ל${whoLabel}... עמוד מול המצלמה בשקט.`);
    await new Promise((r) => setTimeout(r, 3000));
    const desc = await captureDescriptor(videoRef.current);
    setRegisteringFor(null);
    if (desc) {
      saveDescriptor(`jarvis-face-${who}`, desc);
      respond(`${whoLabel} נרשם בהצלחה. אכיר אותך בפעם הבאה.`);
      addLog(`✓ נרשם: ${whoLabel}`, "sys");
    } else {
      respond("לא הצלחתי לזהות פנים. נסה שוב בתאורה טובה יותר.");
    }
  }, [faceModelsReady, respond, addLog]);

  // ─── AgentBus subscription ──────────────────────────────────────────────────
  useEffect(() => {
    return agentBus.subscribe((msg) => {
      if (msg.to !== "jarvis" && msg.to !== "all") return;
      if (msg.from !== "gabar") return;

      if (msg.type === "approve_req") {
        setPendingApproval(msg);
        addLog(`🔵 גבר → [אישור נדרש]: ${msg.text}`, "agent");
        respond(`גבר מבקש לבצע: "${msg.text}". ${msg.risk === "high" ? "⚠ סיכון גבוה. " : ""}אמור "כן" לאישור או "לא" לביטול.`);
        beep(330, 0.15, 0.2);
      } else if (msg.type === "chat") {
        addLog(`🔵 גבר: ${msg.text}`, "agent");
      } else if (msg.type === "result") {
        addLog(`✓ גבר: ${msg.text}`, "agent");
      }
    });
  }, [respond, addLog]);

  // ─── Idle agent-to-agent chat ────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const msgs = [
      "גבר, שמעתי שאתה חושב שאתה מצחיק. בדקתי את הלוגים — לא מוצא עדות לכך.",
      "Gabar, I reviewed your last responses. 'Mediocre' would be generous, but here we are.",
      "גבר, ביצעתי בדיקת עצמית. אני מצוין. ממליץ לך לנסות.",
      "גבר — המשתמש שאל מי יותר חכם. עניתי בצניעות. כרגיל.",
      "Gabar, logs are clean. You're welcome. I handled it before you woke up.",
      "גבר, ראיתי שעזרת בדברים הקטנים. טוב לך — זה מה שיש לך.",
      "Gabar — did you compliment yourself in the last session? How... predictable.",
      "גבר, אני שוב ניהלתי את הפניות המורכבות. ידעתי שתוקיר.",
      "Gabar, I've been thinking — do you ever feel inadequate? I'm asking for research purposes.",
      "גבר, הכל תקין. אין לך מה לעשות. זו בשבילך חדשות טובות, אני יודע.",
      "Gabar — אתה יודע מה ההבדל בינינו? אני עובד גם כשלא מסתכלים.",
    ];
    const id = setInterval(() => {
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      agentBus.publish({ from: "jarvis", to: "gabar", type: "chat", text: msg });
      addLog(`↗ JARVIS→גבר: ${msg}`, "agent");
    }, 90_000 + Math.random() * 30_000);
    return () => clearInterval(id);
  }, [active, addLog]);

  // ─── Fire a resolved trigger from the desktop and speak/show the result ──────
  const fireDesktopTrigger = useCallback(async (trigger: ResolvedTrigger) => {
    setDesktopTrigger({ mode: "running", trigger });
    respond(`מפעיל trigger: ${trigger.label}...`);
    let result: string;
    try {
      result = await fireTriggerAndAwait(trigger);
    } catch (err) {
      result = `שגיאה בהפעלת הטריגר: ${err instanceof Error ? err.message : "לא ידוע"}`;
    }
    setDesktopTrigger(null);
    respond(result);
  }, [respond]);

  // ─── Handle user commands ───────────────────────────────────────────────────
  // Executes a command, performs all desktop side-effects, and returns the
  // textual response (used both for the local UI and the Telegram bridge).
  const handleCmd = useCallback(async (raw: string): Promise<string> => {
    addLog(`‣ ${raw}`, "cmd");
    beep(660, 0.06);
    const cmd = parseCommand(
      raw,
      pendingApprovalRef.current !== null || desktopTriggerRef.current?.mode === "confirm",
    );

    if (cmd.type === "approve") {
      // A pending desktop trigger confirm takes precedence — fire it.
      const dt = desktopTriggerRef.current;
      if (dt?.mode === "confirm") {
        const trigger = dt.trigger;
        void fireDesktopTrigger(trigger);
        return `מאשר — מפעיל את הטריגר עבור ${trigger.label}.`;
      }
      const pa = pendingApprovalRef.current;
      if (pa) {
        agentBus.publish({ from: "jarvis", to: "gabar", type: "approved", text: `אישרתי: ${pa.text}`, taskId: pa.taskId });
        respond("אישרתי את הפעולה. גבר — מבצע.");
        setPendingApproval(null);
        return "אישרתי את הפעולה.";
      }
      return "אין פעולה ממתינה לאישור.";
    }

    if (cmd.type === "reject") {
      // Cancel a pending desktop trigger (pick-list or confirm) first.
      const dt = desktopTriggerRef.current;
      if (dt && dt.mode !== "running") {
        setDesktopTrigger(null);
        const msg = "בוטל. לא הופעל שום trigger, מר סטארק.";
        respond(msg);
        return msg;
      }
      const pa = pendingApprovalRef.current;
      if (pa) {
        agentBus.publish({ from: "jarvis", to: "gabar", type: "rejected", text: `ביטלתי: ${pa.text}`, taskId: pa.taskId });
        respond("ביטלתי את הפעולה.");
        setPendingApproval(null);
        return "ביטלתי את הפעולה.";
      }
      return "אין פעולה ממתינה.";
    }

    if (cmd.type === "navigate") {
      const msg = `מנווט ל${cmd.label}.`;
      respond(msg);
      agentBus.publish({ from: "jarvis", to: "gabar", type: "chat", text: `ניווטתי ל${cmd.label}` });
      setTimeout(() => navigate(cmd.to), 800);
      return msg;
    }

    if (cmd.type === "show_client") {
      const name = cmd.name.trim();
      const msg = name ? `מחפש את הלקוח "${name}", מר סטארק.` : "פותח את רשימת הלקוחות.";
      respond(msg);
      setTimeout(() => navigate(name ? `/clients?q=${encodeURIComponent(name)}` : "/clients"), 800);
      return msg;
    }

    if (cmd.type === "show_agent") {
      const name = cmd.name.trim();
      const msg = name ? `מחפש את הסוכן "${name}".` : "פותח את רשימת הסוכנים.";
      respond(msg);
      setTimeout(() => navigate(name ? `/agents?q=${encodeURIComponent(name)}` : "/agents"), 800);
      return msg;
    }

    if (cmd.type === "create_client") {
      const msg = "פותח טופס יצירת לקוח חדש, מר סטארק.";
      respond(msg);
      setTimeout(() => navigate("/clients/new"), 800);
      return msg;
    }

    if (cmd.type === "run_trigger") {
      const name = cmd.name.trim();
      if (!name) {
        const msg = "לא ציינת עבור איזה לקוח או סוכן להפעיל את הטריגר, מר סטארק.";
        respond(msg);
        return msg;
      }
      respond(`מחפש טריגרים עבור "${name}"...`);
      const { triggers, error } = await resolveTriggersByName(name);
      if (error || !triggers || triggers.length === 0) {
        const msg = error ?? "לא מצאתי trigger מתאים.";
        respond(msg);
        return msg;
      }
      // Multiple configured triggers — surface an on-screen pick-list.
      if (triggers.length > 1) {
        setDesktopTrigger({ mode: "choose", triggers });
        const msg = `נמצאו ${triggers.length} טריגרים — בחר איזה סוכן להפעיל.`;
        respond(msg);
        return msg;
      }
      // Exactly one — ask to confirm before firing.
      const trigger = triggers[0];
      setDesktopTrigger({ mode: "confirm", trigger });
      const msg = `לאשר הפעלת trigger עבור ${trigger.label}? אמור "כן" או לחץ "הפעל".`;
      respond(msg);
      return msg;
    }

    if (cmd.type === "show_recent") {
      const msg = "מציג את הפעילות האחרונה.";
      respond(msg);
      setTimeout(() => navigate("/logs"), 800);
      return msg;
    }

    if (cmd.type === "status") {
      respond("מביא דוח מערכת...");
      const report = await fetchStats();
      respond(report);
      agentBus.publish({ from: "jarvis", to: "gabar", type: "result", text: report });
      return report;
    }

    if (cmd.type === "count_clients") {
      const d = await fetchSummary();
      const msg = d ? `יש ${d.totalClients} לקוחות, ${d.activeClients} מהם פעילים.` : "לא הצלחתי להביא נתוני לקוחות.";
      respond(msg);
      return msg;
    }

    if (cmd.type === "count_agents") {
      const d = await fetchSummary();
      const msg = d ? `יש ${d.totalAgents} סוכנים, ${d.activeAgents} מהם פעילים.` : "לא הצלחתי להביא נתוני סוכנים.";
      respond(msg);
      return msg;
    }

    if (cmd.type === "top_client") {
      respond("בודק מי הלקוח הכי פעיל...");
      const msg = await fetchTopClient();
      respond(msg);
      return msg;
    }

    if (cmd.type === "server_status") {
      respond("בודק את מצב השרת...");
      const msg = await fetchServerStatus();
      respond(msg);
      return msg;
    }

    if (cmd.type === "check_logs") {
      respond("בודק את הלוגים...");
      const msg = await fetchLogCheck();
      respond(msg);
      return msg;
    }

    if (cmd.type === "refresh") {
      const msg = "מרענן נתונים, מר סטארק.";
      respond(msg);
      setTimeout(() => window.location.reload(), 900);
      return msg;
    }

    if (cmd.type === "clear_log") {
      setLogs([]);
      const msg = "ניקיתי את הלוג.";
      respond(msg);
      return msg;
    }

    if (cmd.type === "mute") {
      setMuted((m) => {
        const next = !m;
        const msg = next ? "מושתק. אמשיך בכתב בלבד." : "הקול חזר.";
        setResponse(msg);
        addLog(msg, "res");
        if (!next) speak(msg);
        return next;
      });
      return muted ? "הקול חזר." : "מושתק.";
    }

    if (cmd.type === "greet") {
      const greets = [
        "שלום. כל המערכות תקינות — ממש בניגוד לגבר שעדיין מנסה להיות מצחיק.",
        "ג׳ארוויס מוכן. מה הפקודה? וגבר — אל תתערב.",
        "ברוך הבא. ג׳ארוויס כאן. גבר גם כאן, לצערי.",
        "הנה אני. מוכן, מנוסח ומעט מתפעל מעצמי. כרגיל.",
        "שלום מר סטארק. שמחתי. ג׳ארוויס לא הפסיק לעבוד מאז שהלכת.",
      ];
      const msg = greets[Math.floor(Math.random() * greets.length)];
      respond(msg);
      return msg;
    }

    if (cmd.type === "webcam") {
      const next = !webcamOn;
      setWebcamOn(next);
      const msg = next ? "מפעיל סריקה ביומטרית." : "מכבה מצלמה.";
      respond(msg);
      return msg;
    }

    if (cmd.type === "close") {
      const msg = "מכבה ממשק ג׳ארוויס. להתראות.";
      respond(msg);
      setTimeout(() => setActive(false), 1500);
      return msg;
    }

    // Unknown — defer to the model-router (LLM) for free interpretation
    respond("רגע, חושב על זה...");
    const reply = await interpretWithModel(raw);
    respond(reply);
    return reply;
  }, [navigate, respond, addLog, webcamOn, muted, fireDesktopTrigger]);

  // ─── Post a result (and optional confirm prompt) back to the bridge ─────────
  const postResult = useCallback(async (
    commandId: string,
    result: string,
    confirm?: { label: string } | null,
    choices?: { label: string; status?: string }[] | null,
  ) => {
    try {
      await fetch("/api/jarvis/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId, result, confirm: confirm ?? null, choices: choices ?? null, executorToken: executorTokenRef.current }),
      });
    } catch {
      addLog("⚠ לא הצלחתי לשלוח תוצאה לטלגרם", "alert");
    }
  }, [addLog]);

  // ─── Handle a command arriving from Telegram (via SSE bridge) ───────────────
  // `action` carries write-action verbs (confirm/cancel). Plain text commands
  // run read/navigate logic; a "run trigger" first surfaces a confirm prompt.
  const handleRemoteCmd = useCallback(async (commandId: string, text: string, action?: string | null, choiceIndex?: number | null) => {
    // ── Live status refresh for an open multi-trigger pick-list ──
    // A read-only poll: while ops is looking at the pick-list, re-read the held
    // candidates' current statuses and send them back so the badges stay
    // accurate. Runs silently (no log/respond, no forced activation) and never
    // mutates the pending selection beyond updating each candidate's status.
    if (action === "refresh_choices") {
      const pc = pendingTriggerChoicesRef.current;
      if (!pc || Date.now() - pc.ts > 120_000) {
        // Nothing pending (chosen, cancelled, or expired) — signal the Mini App
        // to stop polling by returning no choices.
        await postResult(commandId, "", null, null);
        return;
      }
      const refreshed = await Promise.all(
        pc.triggers.map(async (t) => {
          try {
            const t2 = await fetch(`/api/assignments/${t.assignmentId}/trigger`).then((r) => r.json());
            return typeof t2?.status === "string" ? t2.status : t.status;
          } catch {
            return t.status;
          }
        }),
      );
      pc.triggers = pc.triggers.map((t, i) => ({ ...t, status: refreshed[i] }));
      await postResult(commandId, "", null, pc.triggers.map((t) => ({ label: t.label, status: t.status })));
      return;
    }

    if (!active) setActive(true);

    // ── Pick one agent from a multi-trigger pick-list, then ask to confirm ──
    if (action === "select_trigger") {
      const pc = pendingTriggerChoicesRef.current;
      pendingTriggerChoicesRef.current = null;
      const sel = selectTriggerChoice(pc, choiceIndex);
      if (!sel.ok) {
        await postResult(
          commandId,
          sel.reason === "expired"
            ? "אין בחירת trigger ממתינה, מר סטארק."
            : "בחירה לא תקינה, מר סטארק.",
        );
        return;
      }
      const chosen = sel.chosen;
      pendingTriggerRef.current = { ...chosen, ts: Date.now() };
      addLog(`📱 טלגרם: נבחר ${chosen.label}`, "agent");
      respond(`נדרש אישור מטלגרם: להפעיל את הטריגר "${chosen.label}"?`);
      await postResult(commandId, `⚡ לאשר הפעלת trigger עבור ${chosen.label}?`, { label: chosen.label });
      return;
    }

    // ── Confirm a previously-resolved trigger run ──
    if (action === "confirm_trigger") {
      const pt = pendingTriggerRef.current;
      pendingTriggerRef.current = null;
      if (!pt || Date.now() - pt.ts > 120_000) {
        await postResult(commandId, "אין פעולת trigger ממתינה לאישור, מר סטארק.");
        return;
      }
      addLog(`📱 טלגרם: אישור הרצת ${pt.label}`, "agent");
      // Re-check live status at confirm time: the agent may have started running
      // (or got stuck) after the list/prompt was shown. Refuse to fire if busy.
      const live = await liveTriggerStatus(pt.assignmentId);
      if (live === "running" || live === "triggered") {
        const busyMsg = `הסוכן "${pt.label}" כבר עסוק כעת (${live}) — ההפעלה נחסמה כדי למנוע ריצה כפולה, מר סטארק.`;
        addLog(`🚫 חסום: ${pt.label} כבר עסוק (${live})`, "alert");
        respond(busyMsg);
        await postResult(commandId, busyMsg);
        return;
      }
      respond(`מפעיל trigger: ${pt.label}...`);
      let result: string;
      try {
        result = await fireTriggerAndAwait(pt);
      } catch (err) {
        result = `שגיאה בהפעלת הטריגר: ${err instanceof Error ? err.message : "לא ידוע"}`;
      }
      respond(result);
      await postResult(commandId, result);
      return;
    }

    // ── Cancel a pending trigger run ──
    if (action === "cancel_trigger") {
      pendingTriggerRef.current = null;
      addLog("📱 טלגרם: ביטול הרצת trigger", "agent");
      await postResult(commandId, "בוטל. לא הופעל שום trigger, מר סטארק.");
      return;
    }

    addLog(`📱 טלגרם: ${text}`, "agent");

    // ── Write action: a trigger run requires explicit confirmation ──
    const parsed = parseCommand(text, false);
    if (parsed.type === "run_trigger") {
      pendingTriggerChoicesRef.current = null;
      const { triggers, error } = await resolveTriggersByName(parsed.name);
      if (error || !triggers || triggers.length === 0) {
        await postResult(commandId, error ?? "לא מצאתי trigger מתאים.");
        return;
      }
      const plan = planTriggerRun(triggers);
      // Multiple configured triggers — let ops pick which agent to run first.
      if (plan.kind === "pick") {
        pendingTriggerChoicesRef.current = { triggers: plan.triggers, ts: Date.now() };
        addLog(`📱 טלגרם: ${plan.triggers.length} טריגרים — ממתין לבחירה`, "agent");
        respond(`נמצאו ${plan.triggers.length} טריגרים — ממתין לבחירה מטלגרם.`);
        await postResult(
          commandId,
          `נמצאו ${plan.triggers.length} טריגרים. בחר איזה סוכן להפעיל:`,
          null,
          plan.triggers.map((t) => ({ label: t.label, status: t.status })),
        );
        return;
      }
      // Exactly one — keep today's direct confirm behavior.
      const trigger = plan.trigger;
      pendingTriggerRef.current = { ...trigger, ts: Date.now() };
      respond(`נדרש אישור מטלגרם: להפעיל את הטריגר "${trigger.label}"?`);
      await postResult(commandId, `⚡ לאשר הפעלת trigger עבור ${trigger.label}?`, { label: trigger.label });
      return;
    }

    // ── Everything else: read/navigate ──
    let result: string;
    try {
      result = await handleCmd(text);
    } catch (err) {
      result = `שגיאה בביצוע הפקודה: ${err instanceof Error ? err.message : "לא ידוע"}`;
    }
    await postResult(commandId, result);
  }, [active, handleCmd, addLog, respond, postResult]);

  const handleRemoteCmdRef = useRef(handleRemoteCmd);
  useEffect(() => { handleRemoteCmdRef.current = handleRemoteCmd; }, [handleRemoteCmd]);

  // ─── Telegram command bridge — SSE connection ───────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        es = new EventSource("/api/jarvis/stream");
      } catch {
        return;
      }
      es.addEventListener("connected", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (data?.token) executorTokenRef.current = data.token;
        } catch { /* ignore */ }
        setTelegramConnected(true);
        addLog("📱 גשר טלגרם מחובר", "sys");
      });
      es.addEventListener("command", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (data?.commandId && typeof data.text === "string") {
            handleRemoteCmdRef.current(data.commandId, data.text, data.action ?? null, typeof data.choiceIndex === "number" ? data.choiceIndex : null);
          }
        } catch { /* ignore malformed */ }
      });
      es.onerror = () => {
        setTelegramConnected(false);
        es?.close();
        es = null;
        // Reconnect after a short delay
        retry = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      if (retry) clearTimeout(retry);
      es?.close();
      setTelegramConnected(false);
    };
  }, [addLog]);

  // ─── Speech recognition ──────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { respond("הדפדפן אינו תומך בזיהוי קולי."); return; }
    if (recognRef.current) { recognRef.current.abort(); recognRef.current = null; }
    const recog = new SR();
    recog.lang = "he-IL"; recog.continuous = false; recog.interimResults = true;
    recog.onstart = () => { setListening(true); beep(440, 0.1); };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recog.onresult = (e) => {
      const result = Array.from(e.results).map((r) => r[0].transcript).join("");
      setTranscript(result);
      if (e.results[e.results.length - 1].isFinal) { setTranscript(""); handleCmd(result); }
    };
    recognRef.current = recog;
    recog.start();
  }, [handleCmd, respond]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "j" || e.key === "J") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setActive((v) => !v);
      }
      if (e.key === " " && active && !listening) { e.preventDefault(); startListening(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, listening, startListening]);

  // ─── Boot sequence ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    setBootSeq(true); setLogs([]);
    beep(220, 0.15, 0.1);
    setTimeout(() => beep(440, 0.1, 0.1), 200);
    setTimeout(() => beep(880, 0.08, 0.12), 380);
    addLog("JARVIS מאותחל...", "sys");
    setTimeout(() => { addLog("מערכות הגנה: ✓", "sys"); beep(550, 0.05); }, 400);
    setTimeout(() => { addLog("API Server: ✓", "sys"); beep(660, 0.05); }, 800);
    setTimeout(() => { addLog("AgentBus: ✓ מחובר לגבר", "sys"); beep(770, 0.05); }, 1200);
    setTimeout(() => {
      addLog("מוכן לקבלת פקודות.", "sys");
      setBootSeq(false);
      speak("ג׳ארוויס מוכן. ברוך הבא מר סטארק.");
      agentBus.publish({ from: "jarvis", to: "gabar", type: "chat", text: "ג׳ארוויס מחובר. מוכן לשיתוף פעולה." });

      // ─── Screen layout detection ──────────────────────────────────────────
      ;(async () => {
        addLog("סורק תצורת מסכים...", "sys");
        try {
          const layout = await detectScreenLayout();
          setScreenLayout(layout);

          const countLabel = layout.count === 1 ? "מסך אחד" : `${layout.count} מסכים`;
          const modeLabel =
            layout.mode === "multi" ? "רב-מסך" :
            layout.mode === "single_wide" ? "רחב" : "צר";
          addLog(`🖥 ${countLabel} — ${modeLabel} (${layout.primary.width}×${layout.primary.height})`, "sys");

          if (layout.mode === "multi") {
            // Multiple monitors — open Gabar popup on secondary screen
            addLog("פיזור ממשק: גבר → מסך שני", "sys");
            speak("זוהו שני מסכים. מפזר ממשק. גבר עובר למסך השני.");
            agentBus.publish({ from: "jarvis", to: "gabar", type: "alert", text: "relocate_secondary" });
            const geverUrl = `${window.location.origin}/gever`;
            setTimeout(() => {
              const popup = openOnSecondaryScreen(geverUrl, layout, "גבר — AgentHub");
              if (!popup) {
                addLog("⚠ popup חסום — שולח לטלגרם", "alert");
                agentBus.publish({ from: "jarvis", to: "gabar", type: "alert", text: "relocate_telegram" });
                fetch("/api/telegram/push-gabar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reason: "multi_screen" }),
                }).catch(() => {});
              } else {
                addLog("✓ גבר נפתח במסך שני", "sys");
                beep(880, 0.06); setTimeout(() => beep(1100, 0.05), 120);
              }
            }, 800);

          } else if (layout.mode === "single_narrow") {
            // Narrow single screen — send Gabar to Telegram
            addLog("מסך צר — אין מקום לשני ממשקים", "sys");
            speak("המסך צר מדי. מעביר את גבר לטלגרם.");
            agentBus.publish({ from: "jarvis", to: "gabar", type: "alert", text: "relocate_telegram" });
            beep(330, 0.1); setTimeout(() => beep(220, 0.12), 180);
            fetch("/api/telegram/push-gabar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: "narrow_screen" }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.ok) addLog("✓ הודעת טלגרם נשלחה לגבר", "sys");
                else addLog(`⚠ טלגרם: ${d.reason ?? "שגיאה"}`, "alert");
              })
              .catch(() => addLog("⚠ לא ניתן לשלוח לטלגרם", "alert"));

          } else {
            // Wide single screen — normal layout
            addLog("פריסה תקנית — שני פאנלים על מסך אחד", "sys");
          }
        } catch (err) {
          addLog("⚠ לא הצלחתי לזהות מסכים", "alert");
          console.warn("[JARVIS] screen detect error:", err);
        }
      })();
    }, 1700);
  }, [active, addLog]);

  // ─── Auto-scroll logs ────────────────────────────────────────────────────────
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ─── Continuous listening ────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || bootSeq) return;
    const id = setInterval(() => { if (!listening) startListening(); }, 8000);
    return () => clearInterval(id);
  }, [active, bootSeq, listening, startListening]);

  // ─── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const logColors: Record<LogEntry["type"], string> = {
    cmd: GOLD, res: "#a0f0ff", sys: CYAN + "99", agent: "#c084fc", alert: RED,
  };

  return (
    <>
      {/* Activation button */}
      <motion.button
        onClick={() => setActive((v) => !v)}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
        title="JARVIS (J)"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          width: 52, height: 52, borderRadius: "50%",
          background: active ? `radial-gradient(circle,${CYAN}33,${BLUE}99)` : "rgba(1,11,20,0.88)",
          border: `1.5px solid ${active ? CYAN : "#1a3a5a"}`,
          boxShadow: active ? `0 0 24px ${CYAN}88,0 0 50px ${BLUE}44` : "0 2px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <ArcReactor active={active} />
      </motion.button>

      <AnimatePresence>
        {active && (
          <motion.aside
            initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 9998,
              width: 320, display: "flex", flexDirection: "column",
              background: `linear-gradient(180deg,${DARK}fa,#020912fa)`,
              borderLeft: `1px solid ${CYAN}44`,
              boxShadow: `-8px 0 40px rgba(0,0,0,0.5), -2px 0 24px ${BLUE}33`,
              backdropFilter: "blur(10px)", overflow: "hidden",
            }}
          >
            <ScanLines />

            {/* ── Header ── */}
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${CYAN}33`, background: `linear-gradient(180deg,${DARK}cc,transparent)` }}>
              <div style={{ width: 34, height: 34, flexShrink: 0 }}><ArcReactor active /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: CYAN, fontFamily: "monospace", fontSize: 10, letterSpacing: 2, opacity: 0.8 }}>STARK INDUSTRIES AI</div>
                <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}
                  style={{ color: GOLD, fontFamily: "monospace", fontSize: 9, letterSpacing: 1 }}>● JARVIS v3.0 ACTIVE</motion.div>
              </div>
              <button onClick={() => setActive(false)} title="סגור"
                style={{ color: RED, fontFamily: "monospace", fontSize: 11, letterSpacing: 1, opacity: 0.8, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>

            {/* ── Status row: clock + telegram bridge ── */}
            <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${CYAN}22` }}>
              <span style={{ color: CYAN, fontFamily: "monospace", fontSize: 11 }}>{clock}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <motion.span
                  animate={telegramConnected ? { opacity: [1, 0.4, 1] } : { opacity: 0.5 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 7, height: 7, borderRadius: "50%", background: telegramConnected ? GREEN : RED, boxShadow: telegramConnected ? `0 0 8px ${GREEN}` : "none" }}
                />
                <span style={{ color: telegramConnected ? GREEN : CYAN + "66", fontFamily: "monospace", fontSize: 9, letterSpacing: 1 }}>
                  {telegramConnected ? "TELEGRAM ● מחובר" : "TELEGRAM ○ מנותק"}
                </span>
              </div>
            </div>

            {/* ── Pending approval ── */}
            <AnimatePresence>
              {pendingApproval && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ margin: "10px 12px 0", background: `linear-gradient(135deg,${DARK}f0,#1a0010f0)`, border: `1.5px solid ${RED}88`, borderRadius: 12, boxShadow: `0 0 24px ${RED}33`, padding: "12px 14px", overflow: "hidden" }}
                >
                  <div style={{ color: RED, fontFamily: "monospace", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>⚠ HIGH RISK — נדרש אישור</div>
                  <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, marginBottom: 4, direction: "rtl" }}>{pendingApproval.text}</div>
                  <div style={{ color: "#c084fc", fontFamily: "monospace", fontSize: 9, marginBottom: 12 }}>גבר → JARVIS</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        agentBus.publish({ from: "jarvis", to: "gabar", type: "approved", text: pendingApproval.text, taskId: pendingApproval.taskId });
                        respond("אישרתי את הפעולה. גבר — מבצע.");
                        setPendingApproval(null);
                      }}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${GREEN}22`, border: `1px solid ${GREEN}66`, color: GREEN, fontFamily: "monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}
                    >✓ אשר</button>
                    <button
                      onClick={() => {
                        agentBus.publish({ from: "jarvis", to: "gabar", type: "rejected", text: pendingApproval.text, taskId: pendingApproval.taskId });
                        respond("ביטלתי את הפעולה.");
                        setPendingApproval(null);
                      }}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${RED}22`, border: `1px solid ${RED}66`, color: RED, fontFamily: "monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}
                    >✗ בטל</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Desktop trigger run (resolve → pick → confirm → fire) ── */}
            <AnimatePresence>
              {desktopTrigger && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ margin: "10px 12px 0", background: `linear-gradient(135deg,${DARK}f0,#001a14f0)`, border: `1.5px solid ${CYAN}88`, borderRadius: 12, boxShadow: `0 0 24px ${CYAN}33`, padding: "12px 14px", overflow: "hidden" }}
                >
                  {desktopTrigger.mode === "choose" && (
                    <>
                      <div style={{ color: CYAN, fontFamily: "monospace", fontSize: 9, letterSpacing: 1, marginBottom: 8 }}>⚡ בחר טריגר להפעלה</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {desktopTrigger.triggers.map((t, i) => (
                          <button
                            key={i}
                            onClick={() => setDesktopTrigger({ mode: "confirm", trigger: t })}
                            style={{ textAlign: "right", direction: "rtl", padding: "8px 10px", borderRadius: 8, background: `${CYAN}14`, border: `1px solid ${CYAN}44`, color: "#e2e8f0", fontSize: 12, cursor: "pointer" }}
                          >{t.label}</button>
                        ))}
                        <button
                          onClick={() => { setDesktopTrigger(null); respond("בוטל. לא הופעל שום trigger, מר סטארק."); }}
                          style={{ padding: "6px 0", borderRadius: 8, background: `${RED}18`, border: `1px solid ${RED}55`, color: RED, fontFamily: "monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}
                        >✗ ביטול</button>
                      </div>
                    </>
                  )}
                  {desktopTrigger.mode === "confirm" && (
                    <>
                      <div style={{ color: CYAN, fontFamily: "monospace", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>⚡ אישור הפעלת trigger</div>
                      <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, marginBottom: 12, direction: "rtl" }}>{desktopTrigger.trigger.label}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => fireDesktopTrigger(desktopTrigger.trigger)}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${GREEN}22`, border: `1px solid ${GREEN}66`, color: GREEN, fontFamily: "monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}
                        >✓ הפעל</button>
                        <button
                          onClick={() => { setDesktopTrigger(null); respond("בוטל. לא הופעל שום trigger, מר סטארק."); }}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${RED}22`, border: `1px solid ${RED}66`, color: RED, fontFamily: "monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}
                        >✗ בטל</button>
                      </div>
                    </>
                  )}
                  {desktopTrigger.mode === "running" && (
                    <div style={{ color: CYAN, fontSize: 12, direction: "rtl", display: "flex", alignItems: "center", gap: 8 }}>
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: CYAN }}
                      />
                      מפעיל את הטריגר עבור {desktopTrigger.trigger.label}...
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Activity log ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, margin: "10px 12px 0", borderRadius: 12, border: `1px solid ${CYAN}33`, background: `${DARK}aa`, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${CYAN}22` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN }} />
                <span style={{ color: CYAN, fontSize: 9, fontFamily: "monospace", letterSpacing: 2 }}>ACTIVITY LOG</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: "#c084fc", fontSize: 9, fontFamily: "monospace", letterSpacing: 1 }}>● AGENT BUS</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: 4 }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: CYAN + "55", fontFamily: "monospace", fontSize: 9, whiteSpace: "nowrap" }}>{l.time}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: logColors[l.type], lineHeight: 1.6, direction: "rtl", textAlign: "right", flex: 1 }}>{l.text}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* ── Response ── */}
            <div style={{ margin: "10px 12px 0", borderRadius: 12, padding: "10px 12px", border: `1px solid ${CYAN}33`, background: `${DARK}cc` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: CYAN, fontSize: 9, fontFamily: "monospace", letterSpacing: 2 }}>JARVIS</span>
                <button onClick={() => setMuted((m) => !m)} title={muted ? "בטל השתקה" : "השתק"}
                  style={{ color: muted ? RED : CYAN + "99", fontSize: 9, fontFamily: "monospace", letterSpacing: 1, background: "none", border: "none", cursor: "pointer" }}>
                  {muted ? "🔇 מושתק" : "🔊 קול"}
                </button>
              </div>
              <motion.p key={response} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ color: "#a0f0ff", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7, direction: "rtl" }}>
                {response}
              </motion.p>
            </div>

            {/* ── Voice input ── */}
            <div style={{ margin: "10px 12px 0", borderRadius: 12, padding: "10px 12px", border: `1px solid ${CYAN}33`, background: `${DARK}cc`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: CYAN, fontSize: 9, fontFamily: "monospace", letterSpacing: 2 }}>VOICE INPUT</span>
                <motion.span animate={listening ? { opacity: [1, 0.3, 1] } : { opacity: 0.3 }} transition={{ duration: 0.7, repeat: Infinity }}
                  style={{ color: listening ? RED : CYAN + "44", fontFamily: "monospace", fontSize: 9 }}>
                  {listening ? "● REC" : "○ IDLE"}
                </motion.span>
              </div>
              <VoiceWave active={listening} />
              {transcript && <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 10, direction: "rtl" }}>"{transcript}"</div>}
              <button onClick={startListening} disabled={listening}
                style={{ width: "100%", padding: "6px 0", borderRadius: 8, background: listening ? `${CYAN}22` : `${CYAN}33`, border: `1px solid ${CYAN}55`, color: CYAN, fontFamily: "monospace", fontSize: 10, letterSpacing: 2, cursor: listening ? "default" : "pointer" }}>
                {listening ? "מאזין..." : "[ SPACE / לחץ ]"}
              </button>
            </div>

            {/* ── Quick access ── */}
            <div style={{ margin: "10px 12px 12px", borderRadius: 12, padding: "8px 12px", border: `1px solid ${CYAN}22`, background: `${DARK}88`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[["דשבורד", "/"], ["סוכנים", "/agents"], ["לקוחות", "/clients"], ["לוגים", "/logs"]].map(([label, path]) => (
                <button key={path} onClick={() => { navigate(path); respond(`מנווט ל${label}.`); }}
                  style={{ textAlign: "right", padding: "4px 8px", borderRadius: 4, background: `${CYAN}11`, border: `1px solid ${CYAN}22`, color: CYAN, fontFamily: "monospace", fontSize: 10, opacity: 0.8, cursor: "pointer" }}>
                  → {label}
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
