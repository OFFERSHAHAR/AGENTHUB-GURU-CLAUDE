import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import JSZip from "jszip";
import { Download, FileText, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateStudySession, getListStudySessionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function Results() {
  const [, setLocation] = useLocation();
  const [sessionData, setSessionData] = useState<any>(null);
  const createSessionMutation = useCreateStudySession();
  const queryClient = useQueryClient();

  useEffect(() => {
    const dataStr = localStorage.getItem("currentSession");
    if (!dataStr) {
      setLocation("/");
      return;
    }
    
    try {
      const data = JSON.parse(dataStr);
      setSessionData(data);
      
      // Auto-log to AgentHub if not already logged
      if (!data.logged) {
        createSessionMutation.mutate(
          { 
            data: {
              subject: data.subject,
              transcript: data.transcript,
              summary: data.summary,
              homework: data.homework,
              durationMs: data.durationMs,
              inputTokens: 0,
              outputTokens: 0,
              estimatedCostUsd: 0
            }
          },
          {
            onSuccess: () => {
              // Update local storage to indicate it's logged
              localStorage.setItem("currentSession", JSON.stringify({ ...data, logged: true }));
              queryClient.invalidateQueries({ queryKey: getListStudySessionsQueryKey() });
            }
          }
        );
      }
    } catch (e) {
      setLocation("/");
    }
  }, [setLocation, createSessionMutation, queryClient]);

  const downloadZip = async () => {
    if (!sessionData) return;
    
    const zip = new JSZip();
    const dateStr = new Date().toISOString().slice(0,10);
    
    zip.file(`סיכום_${dateStr}.md`, sessionData.summary);
    zip.file(`שיעורי_בית_${dateStr}.md`, sessionData.homework);
    
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const safeName = sessionData.subject.replace(/[^a-zA-Z\u0590-\u05FF0-9 ]/g, "").trim() || "שיעור";
    a.download = `תיקיית_למידה_${safeName}_${dateStr}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!sessionData) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">תיקיית למידה מוכנה</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            הסיכום של השיעור בנושא <span className="font-semibold text-foreground">{sessionData.subject}</span> מוכן.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-new-recording">
            הקלטה חדשה
          </Button>
          <Button onClick={downloadZip} className="shadow-sm" data-testid="button-download-zip">
            <Download className="w-4 h-4 ml-2" />
            הורד תיקייה
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border shadow-sm flex flex-col h-[600px]">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
              <FileText className="w-5 h-5" />
              סיכום השיעור
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 overflow-y-auto flex-1 prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap">{sessionData.summary}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm flex flex-col h-[600px]">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
              <CheckCircle2 className="w-5 h-5" />
              שיעורי בית
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 overflow-y-auto flex-1 prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap">{sessionData.homework}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
