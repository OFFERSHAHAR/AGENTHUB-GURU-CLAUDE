import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
const NotFound = lazy(() => import("@/pages/not-found"));
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import Dashboard from "@/pages/dashboard";
const AgentsPage = lazy(() => import("@/pages/agents"));
const AgentNew = lazy(() => import("@/pages/agent-new"));
const AgentDetail = lazy(() => import("@/pages/agent-detail"));
const ClientsPage = lazy(() => import("@/pages/clients"));
const ClientNew = lazy(() => import("@/pages/client-new"));
const ClientDetail = lazy(() => import("@/pages/client-detail"));
const OrchestratorPage = lazy(() => import("@/pages/orchestrator"));
const WorkflowsPage = lazy(() => import("@/pages/workflows"));
const WorkflowCanvas = lazy(() => import("@/pages/workflow-canvas"));
const ChatPage = lazy(() => import("@/pages/chat"));
const SpecAgentPage = lazy(() => import("@/pages/spec-agent"));
const LangAgentPage = lazy(() => import("@/pages/lang-agent"));
const ConnectivityAgent = lazy(() => import("@/pages/connectivity-agent"));
const LogsPage = lazy(() => import("@/pages/logs"));
const MaintenanceAgentPage = lazy(() => import("@/pages/maintenance-agent"));
const ClientLivePage = lazy(() => import("@/pages/client-live"));
const OpenSourceHub = lazy(() => import("@/pages/opensource-hub"));
const N8nTemplatesPage = lazy(() => import("@/pages/n8n-templates"));
const WorkflowLibraryPage = lazy(() => import("@/pages/workflow-library"));
const RpaConnectorsPage = lazy(() => import("@/pages/rpa-connectors"));
const PalgatePage = lazy(() => import("@/pages/palgate"));
const AgentSpecsPage = lazy(() => import("@/pages/agent-specs"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const EmailLeadsPage = lazy(() => import("@/pages/email-leads"));
const AorAcademy = lazy(() => import("@/pages/aor-academy"));
const GeverMiniApp = lazy(() => import("@/pages/gever-miniapp"));
const JarvisMiniApp = lazy(() => import("@/pages/jarvis-miniapp"));
const ControlRoomPage = lazy(() => import("@/pages/control-room"));
// Disabled desktop voice assistants — re-enable together with their JSX below.
// const Jarvis = lazy(() => import("@/components/jarvis"));
// const Gabar = lazy(() => import("@/components/gabar"));
import { GlobalSearch } from "@/components/global-search";
import { AuthGate } from "@/components/auth-gate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12, ease: "easeIn" as const } },
};

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Pages are code-split (one chunk each) so the first load doesn't pull the
// whole 2MB app; this shows while a page's chunk downloads.
function PageLoading() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center" dir="rtl">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" aria-label="טוען" />
    </div>
  );
}

function RedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/", { replace: true });
  }, [setLocation]);
  return null;
}

function AppRoutes() {
  const [location] = useLocation();

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="h-full"
        >
          <Suspense fallback={<PageLoading />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/login" component={RedirectHome} />
            <Route path="/dashboard" component={RedirectHome} />
            <Route path="/agents/new" component={AgentNew} />
            <Route path="/agents/:id" component={AgentDetail} />
            <Route path="/agents" component={AgentsPage} />
            <Route path="/clients/new" component={ClientNew} />
            <Route path="/clients/:clientId/chat/:agentId" component={ChatPage} />
            <Route path="/clients/:id/orchestrator" component={OrchestratorPage} />
            <Route path="/clients/:id/live" component={ClientLivePage} />
            <Route path="/clients/:id" component={ClientDetail} />
            <Route path="/clients" component={ClientsPage} />
            <Route path="/workflows/:id" component={WorkflowCanvas} />
            <Route path="/workflows" component={WorkflowsPage} />
            <Route path="/spec-agent" component={SpecAgentPage} />
            <Route path="/lang-agent" component={LangAgentPage} />
            <Route path="/connectivity" component={ConnectivityAgent} />
            <Route path="/logs" component={LogsPage} />
            <Route path="/maintenance" component={MaintenanceAgentPage} />
            <Route path="/opensource" component={OpenSourceHub} />
            <Route path="/n8n-templates" component={N8nTemplatesPage} />
            <Route path="/workflow-library" component={WorkflowLibraryPage} />
            <Route path="/rpa-connectors" component={RpaConnectorsPage} />
            <Route path="/palgate" component={PalgatePage} />
            <Route path="/agent-specs" component={AgentSpecsPage} />
            <Route path="/email-leads" component={EmailLeadsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/control-room" component={ControlRoomPage} />
            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

// // The desktop Jarvis is the command EXECUTOR — it holds the SSE bridge and runs
// // commands arriving from Telegram. It must only mount on the real desktop app,
// // never inside the Telegram Mini App route (otherwise the Mini App would act as
// // a fake executor and could receive/run/report commands itself).
// function DesktopJarvis() {
//   const [location] = useLocation();
//   if (location === "/jarvis" || location === "/gever") return null;
//   return <Jarvis />;
// }

// Global ⌘K / Ctrl+K search — only on the real desktop app, never inside the
// full-screen Telegram Mini Apps or the personal Academy experience.
function DesktopGlobalSearch() {
  const [location] = useLocation();
  if (location === "/jarvis" || location === "/gever" || location === "/aor")
    return null;
  return <GlobalSearch />;
}

// Root router: the full-screen Telegram Mini Apps and the personal Academy
// experience are public surfaces and must bypass the login gate. Everything
// else — the real management interface — sits behind the AuthGate.
function RootRouter() {
  const [location] = useLocation();

  if (location === "/gever") {
    return <Suspense fallback={<PageLoading />}><GeverMiniApp /></Suspense>;
  }
  if (location === "/jarvis") {
    return <Suspense fallback={<PageLoading />}><JarvisMiniApp /></Suspense>;
  }
  if (location === "/aor") {
    return <Suspense fallback={<PageLoading />}><AorAcademy /></Suspense>;
  }

  return (
    <AuthGate>
      <AppRoutes />
      {/* <DesktopJarvis /> */}
      <DesktopGlobalSearch />
      {/* <Gabar /> */}
    </AuthGate>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="agenthub-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={BASE_PATH}>
            <RootRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
