import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useListAgents,
  useListClients,
  type Agent,
  type Client,
} from "@workspace/api-client-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Bot, Building2 } from "lucide-react";

const GLOBAL_SEARCH_EVENT = "open-global-search";

export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_EVENT));
}

function matches(haystack: (string | null | undefined)[], needle: string) {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return haystack.some((h) => h && h.toLowerCase().includes(q));
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  // Cached data — these hooks are already used elsewhere so results are
  // typically served straight from the react-query cache.
  const { data: agents } = useListAgents({});
  const { data: clients } = useListClients();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(GLOBAL_SEARCH_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(GLOBAL_SEARCH_EVENT, onOpenEvent);
    };
  }, []);

  // Reset the query each time the palette opens for a clean slate.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filteredAgents = useMemo<Agent[]>(() => {
    const list = agents ?? [];
    return list
      .filter((a) =>
        matches(
          [a.name, a.description, a.category, ...(a.capabilities ?? [])],
          query
        )
      )
      .slice(0, 8);
  }, [agents, query]);

  const filteredClients = useMemo<Client[]>(() => {
    const list = clients ?? [];
    return list
      .filter((c) => matches([c.name, c.industry, c.contactEmail], query))
      .slice(0, 8);
  }, [clients, query]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      {/* cmdk's own fuzzy filter is disabled; we match across rich fields
          (descriptions, capabilities, industries…) ourselves above. */}
      <CommandInput
        placeholder="Search agents and clients…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matching agents or clients.</CommandEmpty>

        {filteredAgents.length > 0 && (
          <CommandGroup heading="Agents">
            {filteredAgents.map((agent) => (
              <CommandItem
                key={`agent-${agent.id}`}
                value={`agent-${agent.id}`}
                onSelect={() => go(`/agents/${agent.id}`)}
                className="gap-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
                  {agent.iconEmoji || <Bot className="h-4 w-4 text-primary" />}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{agent.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {agent.category}
                    {agent.description ? ` · ${agent.description}` : ""}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredClients.length > 0 && (
          <CommandGroup heading="Clients">
            {filteredClients.map((client) => (
              <CommandItem
                key={`client-${client.id}`}
                value={`client-${client.id}`}
                onSelect={() => go(`/clients/${client.id}`)}
                className="gap-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{client.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {client.industry}
                    {client.contactEmail ? ` · ${client.contactEmail}` : ""}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
