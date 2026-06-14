import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bot, Building2, Sparkles, GitBranch, FlaskConical,
  Languages, ScrollText, GitMerge, Wrench, Globe2, PackageOpen, Library,
  GraduationCap, DoorOpen, Settings, Search, FileText, LogOut, Zap, Mail, Menu, X, MonitorDot,
} from "lucide-react";
import { useCurrentUser } from "@/components/auth-gate";
import { openGlobalSearch } from "@/components/global-search";

const API_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

const NAV_SECTIONS = [
  {
    label: "Core",
    items: [
      { href: "/",          label: "Dashboard",    icon: LayoutDashboard },
      { href: "/agents",    label: "Agent Repo",   icon: Bot },
      { href: "/clients",   label: "Clients",      icon: Building2 },
      { href: "/workflows", label: "Workflows",    icon: GitBranch },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/agent-specs",   label: "Agent Specs",   icon: FileText },
      { href: "/spec-agent",    label: "Spec Agent",    icon: FlaskConical },
      { href: "/lang-agent",    label: "Lang Agent",    icon: Languages },
      { href: "/connectivity",  label: "Connectivity",  icon: GitMerge },
      { href: "/opensource",    label: "Open Source",   icon: Globe2 },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/n8n-templates",    label: "n8n Templates",  icon: PackageOpen },
      { href: "/workflow-library", label: "Workflow Lib",   icon: Library },
      { href: "/rpa-connectors",   label: "RPA Connectors", icon: Zap },
      { href: "/palgate",          label: "PalGate",        icon: DoorOpen },
      { href: "/email-leads",      label: "Email Leads",    icon: Mail },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/control-room", label: "Control Room", icon: MonitorDot },
      { href: "/logs",        label: "Logs",        icon: ScrollText },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/settings",    label: "Settings",    icon: Settings },
    ],
  },
  {
    label: "Academy",
    items: [
      { href: "/aor", label: "✨ אור Academy", icon: GraduationCap },
    ],
  },
];

const PAGE_TITLES: [string, string][] = [
  ["/agents/new", "New Agent"],
  ["/clients/new", "Onboard Client"],
  ["/live", "לוח מחוונים חי"],
  ["/orchestrator", "Orchestrator"],
  ["/agents/", "Agent Profile"],
  ["/clients/", "Client Workspace"],
  ["/workflows/", "Workflow Canvas"],
  ["/agents", "Agent Repository"],
  ["/clients", "Clients"],
  ["/workflows", "Workflows"],
  ["/agent-specs", "Agent Specs"],
  ["/spec-agent", "Spec Agent"],
  ["/lang-agent", "Lang Agent"],
  ["/connectivity", "Connectivity"],
  ["/logs", "Logs"],
  ["/opensource", "Open Source Hub"],
  ["/n8n-templates", "n8n Templates"],
  ["/workflow-library", "Workflow Library"],
  ["/maintenance", "Maintenance"],
  ["/palgate", "PalGate"],
  ["/settings", "Settings"],
  ["/control-room", "חדר בקרה"],
  ["/aor", "אור Academy"],
  ["/rpa-connectors", "RPA Connectors"],
  ["/email-leads", "Email Lead Classifier"],
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = useCurrentUser();

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Close sidebar on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    window.location.reload();
  }

  function getPageTitle(): string {
    if (location === "/") return "Dashboard";
    for (const [prefix, title] of PAGE_TITLES) {
      if (location.includes(prefix)) return title;
    }
    return "AgentHub";
  }

  function isActive(href: string): boolean {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Background orb — violet glow top-right */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)" }}
      />
      {/* Background orb — cyan glow bottom-left */}
      <div
        className="pointer-events-none absolute -bottom-20 -left-12 w-40 h-40 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)" }}
      />

      {/* ── Logo ── */}
      <div
        className="h-[60px] shrink-0 flex items-center px-4 relative z-10"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5 flex-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #0ea5e9 100%)",
              boxShadow: "0 0 12px rgba(124,58,237,0.45)",
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-[14px] text-white tracking-tight">AgentHub</span>
            <span
              className="text-[9.5px] font-semibold tracking-widest uppercase mt-0.5"
              style={{
                background: "linear-gradient(90deg, #a78bfa, #38bdf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI Ops
            </span>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          type="button"
          className="md:hidden ml-auto p-1.5 rounded-lg"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onClick={() => setSidebarOpen(false)}
          aria-label="סגור תפריט"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2.5 space-y-4 relative z-10">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pb-1.5">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                {section.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 group"
                    style={
                      active
                        ? {
                            background: "rgba(139,92,246,0.18)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(139,92,246,0.24)",
                            color: "rgba(255,255,255,0.95)",
                          }
                        : { color: "rgba(255,255,255,0.45)" }
                    }
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
                      }
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full"
                        style={{
                          background: "linear-gradient(to bottom, #a78bfa, #60a5fa)",
                          boxShadow: "0 0 6px rgba(167,139,250,0.6)",
                        }}
                      />
                    )}
                    <item.icon
                      className="w-[14px] h-[14px] shrink-0 transition-colors"
                      style={{ color: active ? "#a78bfa" : "rgba(255,255,255,0.3)" }}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User ── */}
      <div
        className="p-3 shrink-0 relative z-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="relative shrink-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] text-white"
              style={{
                background: currentUser?.username === "or"
                  ? "linear-gradient(135deg, #0ea5e9, #06b6d4)"
                  : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: currentUser?.username === "or"
                  ? "0 0 8px rgba(14,165,233,0.4)"
                  : "0 0 8px rgba(124,58,237,0.4)",
              }}
            >
              {currentUser?.displayName?.charAt(0) ?? "A"}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px]"
              style={{ background: "#22c55e", borderColor: "#0b1020" }}
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[12px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.85)" }}>
              {currentUser?.displayName ?? "Admin"}
            </span>
            <span className="text-[9.5px] leading-tight mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
              All systems active
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="התנתק"
            className="shrink-0 p-1.5 rounded-lg transition-all duration-150 disabled:opacity-40"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#f87171";
              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)";
              (e.currentTarget as HTMLElement).style.background = "";
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">

      {/* ── Mobile backdrop ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={[
          "w-[220px] shrink-0 flex flex-col relative overflow-hidden",
          "transition-transform duration-300 ease-in-out",
          // Mobile: fixed overlay, slide in/out
          "fixed inset-y-0 left-0 z-40",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible
          "md:relative md:translate-x-0 md:flex",
        ].join(" ")}
        style={{
          background: "linear-gradient(170deg, #101828 0%, #0b1020 60%, #0c0e1e 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Topbar ── */}
        <header
          className="h-[60px] shrink-0 flex items-center px-4 md:px-7 justify-between gap-3"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              className="md:hidden p-1.5 -ml-1 rounded-lg text-foreground/60 hover:text-foreground hover:bg-black/06 transition-colors shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="פתח תפריט"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Accent bar — desktop only */}
            <div
              className="hidden md:block w-[3px] h-5 rounded-full shrink-0"
              style={{ background: "linear-gradient(to bottom, #7c3aed, #38bdf8)" }}
            />
            <h2 className="text-[15px] font-bold text-foreground tracking-tight truncate">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <button
              type="button"
              onClick={openGlobalSearch}
              className="flex items-center gap-2 rounded-xl border px-2.5 md:px-3 py-1.5 text-[12px] text-muted-foreground transition-all duration-150 hover:text-foreground"
              style={{ background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.08)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Search…</span>
              <kbd
                className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border px-1.5 py-0.5 font-mono text-[10px] font-medium"
                style={{ background: "white", borderColor: "rgba(0,0,0,0.1)", color: "#94a3b8" }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Live status */}
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 md:px-3 py-1.5 border"
              style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full live-dot shrink-0"
                style={{ background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.6)" }}
              />
              <span className="text-[11px] font-semibold hidden xs:inline" style={{ color: "#059669" }}>Live</span>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
