import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Compact label for the dedup window, honoring the chosen unit — e.g. "12h" or "7d".
export function formatWindowShort(windowHours: number, unit: "hours" | "days"): string {
  if (unit === "hours") return `${windowHours}h`;
  const days = windowHours / 24;
  return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
}

// Human phrase for the dedup window — e.g. "12 hours" or "7 days".
export function formatWindowLong(windowHours: number, unit: "hours" | "days"): string {
  if (unit === "hours") return `${windowHours} hour${windowHours !== 1 ? "s" : ""}`;
  const days = windowHours / 24;
  const rounded = Number.isInteger(days) ? days : Number(days.toFixed(1));
  return `${rounded} day${rounded !== 1 ? "s" : ""}`;
}
