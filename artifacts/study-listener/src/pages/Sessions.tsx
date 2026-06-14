import { Link } from "wouter";
import { format } from "date-fns";
import { Clock, Book, ChevronLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useListStudySessions } from "@workspace/api-client-react";

export function Sessions() {
  const { data: sessions, isLoading, error } = useListStudySessions();

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    return `${minutes} דקות`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">שיעורים קודמים</h1>
        <p className="text-muted-foreground">היסטוריית השיעורים והסיכומים שלך.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-destructive bg-destructive/10 rounded-lg">
          שגיאה בטעינת השיעורים. נסה לרענן את העמוד.
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl bg-muted/10">
          <Book className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">אין שיעורים מוקלטים עדיין</h3>
          <p className="text-muted-foreground mb-6">התחל האזנה חדשה כדי לראות את הסיכומים כאן!</p>
          <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
            הקלטה חדשה
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="border-border shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-primary/30">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                      {session.subject || "ללא נושא"}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(session.durationMs)}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(session.createdAt), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
