import { useEffect } from "react";

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}) {
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    localStorage.removeItem("agent-hub-ui-theme");
  }, []);

  return <>{children}</>;
}
