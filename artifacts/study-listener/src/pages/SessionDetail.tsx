import { useParams, Link } from "wouter";
import JSZip from "jszip";
import { Download, FileText, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetStudySession, getGetStudySessionQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";

export function SessionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data: sessionData, isLoading, error } = useGetStudySession(id, {
    query: { enabled: !!id, queryKey: getGetStudySessionQueryKey(id) }
  });

  const downloadZip = async () => {
    if (!sessionData) return;
    
    const zip = new JSZip();
    const dateStr = format(new Date(sessionData.createdAt), "yyyy-MM-dd");
    
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="text-center py-20 text-destructive bg-destructive/10 rounded-lg">
        שגיאה בטעינת השיעור. אולי הוא לא קיים.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/sessions" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ChevronRight className="w-4 h-4 ml-1" />
        חזרה לשיעורים
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{sessionData.subject}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            הוקלט ב-{format(new Date(sessionData.createdAt), "dd/MM/yyyy בשעה HH:mm")}
          </p>
        </div>
        <Button onClick={downloadZip} className="shadow-sm" data-testid="button-download-zip-past">
          <Download className="w-4 h-4 ml-2" />
          הורד תיקייה
        </Button>
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
