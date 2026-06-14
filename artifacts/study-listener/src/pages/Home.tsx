import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Mic, Monitor, Square, Loader2, BookOpen, AlertCircle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStudySummarize } from "@workspace/api-client-react";

type AudioSource = "microphone" | "system";

const transcribeChunk = async (audioBlob: Blob): Promise<string> => {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api/study/transcribe`, {
    method: "POST",
    headers: { "Content-Type": audioBlob.type || "audio/webm" },
    body: audioBlob,
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.text || "";
};

export function Home() {
  const [, setLocation] = useLocation();
  const [isRecording, setIsRecording] = useState(false);
  const [subject, setSubject] = useState("");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSource>("microphone");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);

  const summarizeMutation = useStudySummarize();

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getAudioStream = async (): Promise<MediaStream> => {
    if (audioSource === "microphone") {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    // System audio via getDisplayMedia
    // The user will see a browser popup to share a tab/window — they must tick "Share tab audio"
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
      video: true, // video is required by most browsers for getDisplayMedia
    });

    // Stop all video tracks — we only care about audio
    displayStream.getVideoTracks().forEach((t) => t.stop());

    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      throw new Error("no_audio");
    }

    return displayStream;
  };

  const startRecording = async () => {
    if (!subject.trim()) {
      setError("נא להזין את נושא השיעור לפני תחילת ההקלטה.");
      return;
    }

    setError(null);
    try {
      const stream = await getAudioStream();
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const text = await transcribeChunk(event.data);
          if (text) {
            setTranscript((prev) => (prev ? prev + " " + text : text));
          }
        }
      };

      // Stop recording automatically if the user closes the share dialog (system audio)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            stopRecording();
          }
        };
      });

      mediaRecorder.start(10000); // 10-second chunks
      setIsRecording(true);
      startTimeRef.current = Date.now();

      durationIntervalRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err: any) {
      if (err?.message === "no_audio") {
        setError(
          'לא נבחר אודיו. בחלון השיתוף של הדפדפן יש לסמן את "שיתוף אודיו של הכרטיסייה" ולבחור את הכרטיסייה עם הזום.'
        );
      } else if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError(
          audioSource === "microphone"
            ? "גישה למיקרופון נדחתה. בדפדפן: לחץ על סמל המנעול בשורת הכתובת ← הרשה מיקרופון."
            : "שיתוף המסך בוטל. לחץ שוב על התחל ובחר את הכרטיסייה עם הזום."
        );
      } else if (err?.name === "NotFoundError") {
        setError("לא נמצא מכשיר מיקרופון. חבר מיקרופון ונסה שוב.");
      } else {
        setError("לא ניתן לגשת לאודיו. ודא שהדפדפן תומך בתכונה זו.");
      }
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    const durationMs = Date.now() - startTimeRef.current;

    summarizeMutation.mutate(
      { data: { transcript, subject } },
      {
        onSuccess: (result) => {
          const sessionData = {
            subject,
            transcript,
            summary: result.summary,
            homework: result.homework,
            durationMs,
          };
          localStorage.setItem("currentSession", JSON.stringify(sessionData));
          setLocation("/results");
        },
        onError: () => {
          setError("אירעה שגיאה בסיכום השיעור. נסה שוב.");
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight">האזנה לשיעור</h1>
        <p className="text-muted-foreground">המזכיר האישי שלך לשיעורי הזום. הזן נושא והתחל להקליט.</p>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="leading-relaxed">{error}</AlertDescription>
            </Alert>
          )}

          {/* Audio source selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Radio className="w-4 h-4" />
              מקור אודיו
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isRecording || summarizeMutation.isPending}
                onClick={() => { setAudioSource("microphone"); setError(null); }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right ${
                  audioSource === "microphone"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Mic className="w-5 h-5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">מיקרופון</div>
                  <div className="text-xs opacity-70">הקלטה מהמיקרופון</div>
                </div>
              </button>

              <button
                type="button"
                disabled={isRecording || summarizeMutation.isPending}
                onClick={() => { setAudioSource("system"); setError(null); }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right ${
                  audioSource === "system"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Monitor className="w-5 h-5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">צליל מהמחשב</div>
                  <div className="text-xs opacity-70">זום, Teams, YouTube</div>
                </div>
              </button>
            </div>

            {audioSource === "system" && !isRecording && (
              <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
                💡 <strong>איך זה עובד:</strong> לחיצה על "התחל הקלטה" תפתח חלון בחירת כרטיסייה של הדפדפן.
                בחר את הכרטיסייה עם הזום/Teams, וודא שסימנת ✓ <strong>"שיתוף אודיו של הכרטיסייה"</strong> לפני אישור.
              </p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium text-foreground">
              נושא השיעור
            </label>
            <Input
              id="subject"
              placeholder="מתמטיקה, ביולוגיה, היסטוריה..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isRecording || summarizeMutation.isPending}
              data-testid="input-subject"
              className="text-lg py-6 bg-muted/50 border-muted focus-visible:ring-primary"
            />
          </div>

          {/* Recording controls */}
          <div className="flex flex-col items-center justify-center py-8 space-y-6 border-2 border-dashed border-border rounded-xl bg-muted/20">
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl font-mono text-primary font-medium tracking-wider">
                {formatTime(duration)}
              </span>
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {isRecording ? (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                    </span>
                    {audioSource === "system" ? "מאזין לצליל המחשב..." : "מאזין..."}
                  </>
                ) : summarizeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    מסכם שיעור...
                  </>
                ) : (
                  "מוכן להאזנה"
                )}
              </span>
            </div>

            {isRecording ? (
              <Button
                size="lg"
                variant="destructive"
                onClick={stopRecording}
                className="w-48 h-14 rounded-full shadow-md hover:shadow-lg transition-all"
                data-testid="button-stop-recording"
              >
                <Square className="w-5 h-5 ml-2 fill-current" />
                סיום הקלטה
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={startRecording}
                disabled={summarizeMutation.isPending}
                className="w-48 h-14 rounded-full shadow-md hover:shadow-lg transition-all"
                data-testid="button-start-recording"
              >
                {summarizeMutation.isPending ? (
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                ) : audioSource === "system" ? (
                  <Monitor className="w-5 h-5 ml-2" />
                ) : (
                  <Mic className="w-5 h-5 ml-2" />
                )}
                {summarizeMutation.isPending ? "מעבד..." : "התחל הקלטה"}
              </Button>
            )}
          </div>

          {transcript && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                תמלול חי
              </label>
              <div className="p-4 bg-muted/30 rounded-lg min-h-[150px] max-h-[300px] overflow-y-auto text-sm leading-relaxed border border-border/50 text-foreground/90">
                {transcript}
                {isRecording && <span className="inline-block w-2 h-4 ml-1 bg-primary/50 animate-pulse" />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
