import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import Dashboard from "@/pages/dashboard";
import AgentsPage from "@/pages/agents";
import AgentNew from "@/pages/agent-new";
import AgentDetail from "@/pages/agent-detail";
import ClientsPage from "@/pages/clients";
import ClientNew from "@/pages/client-new";
import ClientDetail from "@/pages/client-detail";
import OrchestratorPage from "@/pages/orchestrator";
import WorkflowsPage from "@/pages/workflows";
import WorkflowCanvas from "@/pages/workflow-canvas";
import ChatPage from "@/pages/chat";
import SpecAgentPage from "@/pages/spec-agent";
import LangAgentPage from "@/pages/lang-agent";
import ConnectivityAgent from "@/pages/connectivity-agent";
import LogsPage from "@/pages/logs";
import MaintenanceAgentPage from "@/pages/maintenance-agent";
import ClientLivePage from "@/pages/client-live";
import OpenSourceHub from "@/pages/opensource-hub";
import N8nTemplatesPage from "@/pages/n8n-templates";
import WorkflowLibraryPage from "@/pages/workflow-library";
import RpaConnectorsPage from "@/pages/rpa-connectors";
import PalgatePage from "@/pages/palgate";
import AgentSpecsPage from "@/pages/agent-specs";
import SettingsPage from "@/pages/settings";
import EmailLeadsPage from "@/pages/email-leads";
import AorAcademy from "@/pages/aor-academy";
import GeverMiniApp from "@/pages/gever-miniapp";
import JarvisMiniApp from "@/pages/jarvis-miniapp";
import ControlRoomPage from "@/pages/control-room";
import Jarvis from "@/components/jarvis";
import Gabar from "@/components/gabar";
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
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

// The desktop Jarvis is the command EXECUTOR — it holds the SSE bridge and runs
// commands arriving from Telegram. It must only mount on the real desktop app,
// never inside the Telegram Mini App route (otherwise the Mini App would act as
// a fake executor and could receive/run/report commands itself).
function DesktopJarvis() {
  const [location] = useLocation();
  if (location === "/jarvis" || location === "/gever") return null;
  return <Jarvis />;
}

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
    return <GeverMiniApp />;
  }
  if (location === "/jarvis") {
    return <JarvisMiniApp />;
  }
  if (location === "/aor") {
    return <AorAcademy />;
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
