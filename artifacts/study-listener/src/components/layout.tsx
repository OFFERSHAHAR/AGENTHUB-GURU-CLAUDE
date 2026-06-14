import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { BookOpen, History, Mic } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl transition-opacity hover:opacity-80">
            <BookOpen className="w-6 h-6" />
            <span>Study Listener</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}
            >
              <Mic className="w-4 h-4" />
              הקלטה
            </Link>
            <Link 
              href="/sessions" 
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${location === "/sessions" || location.startsWith("/sessions/") ? "text-primary" : "text-muted-foreground"}`}
            >
              <History className="w-4 h-4" />
              שיעורים קודמים
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
