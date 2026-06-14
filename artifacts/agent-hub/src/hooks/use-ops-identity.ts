import { useCallback, useEffect, useState } from "react";

/**
 * Shared, app-wide "ops identity": the name the current operator types once and
 * which is then attributed to every audit-logged action (e.g. the `changedBy`
 * field on the duplicate-warning threshold history). Persisted in localStorage
 * under a single key so it survives reloads and stays in sync across tabs and
 * across components within the same tab.
 */
const OPS_IDENTITY_KEY = "agenthub:dedupActorName";
const OPS_IDENTITY_EVENT = "agenthub:ops-identity-change";

export function readOpsIdentity(): string {
  try {
    return localStorage.getItem(OPS_IDENTITY_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeOpsIdentity(name: string): void {
  try {
    if (name) {
      localStorage.setItem(OPS_IDENTITY_KEY, name);
    } else {
      localStorage.removeItem(OPS_IDENTITY_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function useOpsIdentity() {
  const [name, setNameState] = useState(() => readOpsIdentity());

  useEffect(() => {
    function sync() {
      setNameState(readOpsIdentity());
    }
    window.addEventListener("storage", sync);
    window.addEventListener(OPS_IDENTITY_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(OPS_IDENTITY_EVENT, sync);
    };
  }, []);

  const setName = useCallback((next: string) => {
    const trimmed = next.trim();
    writeOpsIdentity(trimmed);
    setNameState(trimmed);
    window.dispatchEvent(new Event(OPS_IDENTITY_EVENT));
  }, []);

  return { name, setName };
}
