import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Retail", "Manufacturing",
  "Education", "Real Estate", "Legal", "Media", "Logistics", "Other",
];
const STATUSES = [
  { value: "active", label: "Active", color: "#10b981" },
  { value: "trial", label: "Trial", color: "#f59e0b" },
  { value: "inactive", label: "Inactive", color: "#9ca3af" },
];

export default function ClientNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createClient = useCreateClient();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("Technology");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  const canSubmit = name && industry && contactEmail && !createClient.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createClient.mutate(
      { data: { name, industry, contactEmail, status, notes } },
      {
        onSuccess: (client) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: "Client onboarded", description: `"${client.name}" is now active.` });
          setLocation(`/clients/${client.id}`);
        },
        onError: () => {
          toast({ title: "Failed to onboard client", variant: "destructive" });
        },
      }
    );
  };

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clients">
          <motion.button
            whileTap={{ scale: 0.94 }}
            className="w-8 h-8 rounded-lg border border-border bg-white card-shadow flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Onboard Client</h1>
          <p className="text-muted-foreground text-sm">Add a new enterprise client to AgentHub.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Preview */}
        {name && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-border card-shadow p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
              {initials || "?"}
            </div>
            <div>
              <div className="font-semibold text-[14px]">{name}</div>
              {industry && <div className="text-[12px] text-muted-foreground mt-0.5">{industry}</div>}
            </div>
          </motion.div>
        )}

        <div className="bg-white rounded-xl border border-border card-shadow p-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Company Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corporation"
              className="h-10 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Industry *
              </Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!industry && <p className="text-[11px] text-destructive mt-1">בחר תחום פעילות כדי לפתוח לקוח.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Contact Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="ops@acmecorp.com"
              className="h-10 rounded-lg"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any relevant context about this client, requirements, or special considerations…"
              rows={3}
              className="rounded-lg resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button type="submit" disabled={!canSubmit} title={!industry ? "בחר תחום פעילות" : undefined} className="w-full h-10 rounded-lg font-semibold gap-2">
              {createClient.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Onboarding…</>
              ) : (
                "Onboard Client"
              )}
            </Button>
          </motion.div>
          <Link href="/clients">
            <Button type="button" variant="outline" className="h-10 rounded-lg">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
