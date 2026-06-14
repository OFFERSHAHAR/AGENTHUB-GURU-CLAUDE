import { Link } from "wouter";
import { useState } from "react";
import { useListClients, useDeleteClient, getListClientsQueryKey, useGetTriggerStatsSummary, getGetTriggerStatsSummaryQueryKey, useListAgents } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ChevronRight, Building2, Bot, AlertTriangle, MessageSquare, Mail, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTriggerStream } from "@/hooks/use-trigger-stream";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrentUser } from "@/components/auth-gate";

const STATUS_META: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  active: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#10b981", label: "Active" },
  trial: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b", label: "Trial" },
  inactive: { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", dot: "#9ca3af", label: "Inactive" },
};

function ClientRowSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-border card-shadow p-5 flex items-center gap-4">
      <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

type OwnerFilter = "mine" | "all" | "eli" | "aor";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const { data: clients, isLoading } = useListClients();
  const { data: triggerStats } = useGetTriggerStatsSummary();
  const { data: agents } = useListAgents();
  const deleteClient = useDeleteClient();

  const charAgentId = (agents ?? []).find((a: any) => {
    try { return (JSON.parse(a.tags || "[]") as string[]).includes("lead-characterization"); }
    catch { return false; }
  })?.id ?? null;
  const [onlyDedup, setOnlyDedup] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");

  // Live updates: refresh the list and dedup badges the moment any trigger fires.
  useTriggerStream(() => {
    queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTriggerStatsSummaryQueryKey() });
  });

  const dedupByClient = new Map(
    (triggerStats?.affectedClients ?? []).map((c) => [c.clientId, c.count]),
  );

  const affectedCount = (clients ?? []).filter((c) => dedupByClient.has(c.id)).length;
  const specDrafts = (clients ?? []).filter((c: any) => c.source === "telegram-spec");
  const emailLeads = (clients ?? []).filter((c: any) => c.source === "email-lead");
  const regularClients = (clients ?? []).filter(
    (c: any) => c.source !== "telegram-spec" && c.source !== "email-lead"
  );

  const ownerFilteredClients = regularClients.filter((c: any) => {
    if (ownerFilter === "all") return true;
    if (ownerFilter === "mine") return c.ownerUser === currentUser?.username || !c.ownerUser;
    return c.ownerUser === ownerFilter || (!c.ownerUser && ownerFilter === "eli");
  });

  const visibleClients = ownerFilteredClients.filter(
    (c) => !onlyDedup || dedupByClient.has(c.id),
  );

  const eliCount = regularClients.filter((c: any) => c.ownerUser === "eli" || !c.ownerUser).length;
  const aorCount = regularClients.filter((c: any) => c.ownerUser === "aor").length;

  const handleDelete = (id: number, name: string) => {
    deleteClient.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: `"${name}" removed` });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enterprise clients and their AI agent deployments.
          </p>
        </div>
        <Link href="/clients/new">
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button className="gap-2 h-9 rounded-lg font-medium shadow-sm">
              <Plus className="w-4 h-4" />
              Onboard Client
            </Button>
          </motion.div>
        </Link>
      </div>

      {/* ── Owner filter tabs ── */}
      {!isLoading && regularClients.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {([
            { key: "all", label: "הכל", count: regularClients.length },
            { key: "eli", label: "אלי", count: eliCount },
            { key: "aor", label: "אור", count: aorCount },
          ] as { key: OwnerFilter; label: string; count: number }[]).map(({ key, label, count }) => {
            const active = ownerFilter === key;
            return (
              <button
                key={key}
                onClick={() => setOwnerFilter(key)}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors"
                style={
                  active
                    ? { background: key === "aor" ? "#e0f2fe" : key === "eli" ? "rgba(124,58,237,0.1)" : "#f1f5f9", color: key === "aor" ? "#0369a1" : key === "eli" ? "#7c3aed" : "#334155", borderColor: key === "aor" ? "#7dd3fc" : key === "eli" ? "rgba(124,58,237,0.3)" : "#cbd5e1" }
                    : { background: "white", color: "#94a3b8", borderColor: "#e2e8f0" }
                }
              >
                {label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(0,0,0,0.06)" }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Email leads ── */}
      {!isLoading && emailLeads.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-100">
            <Mail className="w-4 h-4 text-emerald-600" />
            <span className="text-[13px] font-semibold text-emerald-800">לידים ממייל</span>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-700 font-bold">{emailLeads.length}</span>
          </div>
          <div className="divide-y divide-emerald-100">
            {emailLeads.map((lead: any) => {
              const initials = lead.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <Link key={lead.id} href={charAgentId ? `/clients/${lead.id}/chat/${charAgentId}` : `/clients/${lead.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-100/60 transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-emerald-900 truncate">{lead.name}</div>
                    <div className="text-[11px] text-emerald-600 mt-0.5 truncate">
                      {lead.contactEmail} · {lead.industry}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-200 border border-emerald-300 text-emerald-800 font-semibold flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      פתח שיחת איפיון
                    </span>
                    <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Spec drafts from Telegram ── */}
      {!isLoading && specDrafts.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-100">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            <span className="text-[13px] font-semibold text-violet-800">טיוטות מסוכן האיפיון</span>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-violet-200 text-violet-700 font-bold">{specDrafts.length}</span>
          </div>
          <div className="divide-y divide-violet-100">
            {specDrafts.map((draft: any) => (
              <Link key={draft.id} href={`/clients/${draft.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-violet-100/60 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-violet-200 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                  {draft.name?.slice(0, 2) ?? "ט"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-violet-900 truncate">{draft.name}</div>
                  <div className="text-[11px] text-violet-500 mt-0.5">ממתין לאישור · מטלגרם</div>
                </div>
                <ChevronRight className="w-4 h-4 text-violet-400 group-hover:text-violet-600 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isLoading && (clients?.length ?? 0) > 0 && affectedCount > 0 ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setOnlyDedup((v) => !v)}
          aria-pressed={onlyDedup}
          className="flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors"
          style={
            onlyDedup
              ? { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" }
              : { background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }
          }
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {onlyDedup ? "Showing high dedup rate only" : "Show only high dedup rate"}
          <span className="px-1.5 py-0.5 rounded-full bg-white/70 text-[11px] font-bold">
            {affectedCount} affected
          </span>
        </motion.button>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <ClientRowSkeleton key={i} />)}
        </div>
      ) : clients?.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <Building2 className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
          <div className="font-semibold text-foreground">No clients yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            Onboard your first enterprise client to get started.
          </div>
          <Link href="/clients/new">
            <Button className="mt-5 gap-2 rounded-lg">
              <Plus className="w-4 h-4" />Onboard Client
            </Button>
          </Link>
        </div>
      ) : visibleClients.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
          <div className="font-semibold text-foreground">No flagged clients</div>
          <div className="text-sm text-muted-foreground mt-1">
            No clients currently have a high duplicate rate.
          </div>
          <Button variant="outline" className="mt-5 rounded-lg" onClick={() => setOnlyDedup(false)}>
            Show all clients
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence>
            {visibleClients.map((client, i) => {
              const sm = STATUS_META[client.status] || STATUS_META.inactive;
              const initials = client.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
              const dedupCount = dedupByClient.get(client.id);
              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="group bg-white rounded-xl border border-border card-shadow hover:card-shadow-md transition-all duration-200"
                >
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-4 p-4 pr-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-[14px] text-foreground">{client.name}</span>
                        <span
                          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                          style={{ background: sm.bg, color: sm.text, borderColor: sm.border }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
                          {sm.label}
                        </span>
                        {dedupCount ? (
                          <span
                            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{ background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }}
                            title={`${dedupCount} integration${dedupCount !== 1 ? "s" : ""} with a high duplicate rate`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            High dedup rate
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[12px] text-muted-foreground">{client.industry}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-[12px] text-muted-foreground">{client.contactEmail}</span>
                      </div>
                    </div>

                    {/* Agent count */}
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                      <span>{client.agentCount} agent{client.agentCount !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 pl-2">
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={(e) => { e.preventDefault(); handleDelete(client.id, client.name); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 group-hover:text-primary transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
