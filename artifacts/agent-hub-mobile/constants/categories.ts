import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type FeatherName = ComponentProps<typeof Feather>["name"];

export interface CategoryStyle {
  color: string;
  bg: string;
  icon: FeatherName;
}

/**
 * Known category styles mirror the web dashboard's CATEGORY_COLORS map so the
 * mobile fleet view stays visually consistent with the desktop platform.
 */
const KNOWN: Record<string, CategoryStyle> = {
  sales: { color: "#6366f1", bg: "#eef2ff", icon: "trending-up" },
  support: { color: "#0ea5e9", bg: "#e0f2fe", icon: "life-buoy" },
  analytics: { color: "#10b981", bg: "#d1fae5", icon: "bar-chart-2" },
  content: { color: "#f59e0b", bg: "#fef3c7", icon: "edit-3" },
  finance: { color: "#ec4899", bg: "#fce7f3", icon: "dollar-sign" },
  marketing: { color: "#f43f5e", bg: "#ffe4e6", icon: "speaker" },
  operations: { color: "#14b8a6", bg: "#ccfbf1", icon: "settings" },
};

const FALLBACK: CategoryStyle[] = [
  { color: "#6366f1", bg: "#eef2ff", icon: "cpu" },
  { color: "#0ea5e9", bg: "#e0f2fe", icon: "cpu" },
  { color: "#10b981", bg: "#d1fae5", icon: "cpu" },
  { color: "#f59e0b", bg: "#fef3c7", icon: "cpu" },
  { color: "#ec4899", bg: "#fce7f3", icon: "cpu" },
  { color: "#8b5cf6", bg: "#f3e8ff", icon: "cpu" },
];

export function categoryStyle(category: string | null | undefined): CategoryStyle {
  const key = (category ?? "").toLowerCase().trim();
  if (KNOWN[key]) return KNOWN[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK[hash % FALLBACK.length];
}
