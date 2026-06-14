import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { categoryStyle } from "@/constants/categories";
import { useColors } from "@/hooks/useColors";

const F = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius + 4 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------- StatCard */

export function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: number | string;
  sub?: string;
  tint: string;
}) {
  const c = useColors();
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint + "1f" }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <Text style={[styles.statValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{label}</Text>
      {sub ? (
        <Text style={[styles.statSub, { color: tint }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------- CategoryBadge */

export function CategoryBadge({
  category,
  showIcon = true,
}: {
  category: string;
  showIcon?: boolean;
}) {
  const { color, bg, icon } = categoryStyle(category);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {showIcon ? <Feather name={icon} size={11} color={color} /> : null}
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {category || "Uncategorized"}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------ StatusDot */

export function StatusPill({ status }: { status: string }) {
  const c = useColors();
  const active = status?.toLowerCase() === "active";
  const color = active ? c.success : c.mutedForeground;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{status || "unknown"}</Text>
    </View>
  );
}

/* ------------------------------------------------------------- SearchBar */

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
}) {
  const c = useColors();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius + 2 },
      ]}
    >
      <Feather name="search" size={17} color={c.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        style={[styles.searchInput, { color: c.foreground }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange("")} hitSlop={10}>
          <Feather name="x-circle" size={17} color={c.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- FilterChip */

export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.card,
          borderColor: active ? c.primary : c.border,
          borderRadius: c.radius + 6,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? c.primaryForeground : c.secondaryForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Rows */

interface AgentLike {
  name: string;
  category: string;
  status: string;
  deployedCount?: number;
}

export function AgentRow({
  agent,
  onPress,
  rightLabel,
}: {
  agent: AgentLike;
  onPress?: () => void;
  rightLabel?: string;
}) {
  const c = useColors();
  const { color, bg, icon } = categoryStyle(agent.category);
  return (
    <Pressable
      onPress={() => {
        if (onPress && Platform.OS !== "web") Haptics.selectionAsync();
        onPress?.();
      }}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: c.radius + 4,
          opacity: pressed && onPress ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: c.foreground }]} numberOfLines={1}>
          {agent.name}
        </Text>
        <View style={styles.rowMeta}>
          <CategoryBadge category={agent.category} showIcon={false} />
          <StatusPill status={agent.status} />
        </View>
      </View>
      <View style={styles.rowRight}>
        {rightLabel ? (
          <Text style={[styles.rowRightLabel, { color: c.mutedForeground }]}>
            {rightLabel}
          </Text>
        ) : typeof agent.deployedCount === "number" ? (
          <View style={styles.deployCount}>
            <Feather name="git-branch" size={12} color={c.mutedForeground} />
            <Text style={[styles.rowRightLabel, { color: c.mutedForeground }]}>
              {agent.deployedCount}
            </Text>
          </View>
        ) : null}
        {onPress ? (
          <Feather name="chevron-right" size={18} color={c.mutedForeground} />
        ) : null}
      </View>
    </Pressable>
  );
}

export function ClientRow({
  name,
  industry,
  status,
  agentCount,
  onPress,
}: {
  name: string;
  industry: string;
  status: string;
  agentCount: number;
  onPress: () => void;
}) {
  const c = useColors();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: c.radius + 4,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: c.accent }]}>
        <Text style={[styles.avatarText, { color: c.accentForeground }]}>
          {initials || "?"}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: c.foreground }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.subtle, { color: c.mutedForeground }]} numberOfLines={1}>
            {industry || "—"}
          </Text>
          <StatusPill status={status} />
        </View>
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.countPill, { backgroundColor: c.secondary }]}>
          <Feather name="cpu" size={12} color={c.secondaryForeground} />
          <Text style={[styles.countPillText, { color: c.secondaryForeground }]}>
            {agentCount}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={c.mutedForeground} />
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- States */

export function LoadingState() {
  const c = useColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  message,
}: {
  icon?: React.ComponentProps<typeof Feather>["name"];
  title: string;
  message?: string;
}) {
  const c = useColors();
  return (
    <View style={styles.center}>
      <View style={[styles.stateIcon, { backgroundColor: c.secondary }]}>
        <Feather name={icon} size={26} color={c.mutedForeground} />
      </View>
      <Text style={[styles.stateTitle, { color: c.foreground }]}>{title}</Text>
      {message ? (
        <Text style={[styles.stateMsg, { color: c.mutedForeground }]}>{message}</Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const c = useColors();
  return (
    <View style={styles.center}>
      <View style={[styles.stateIcon, { backgroundColor: "#fee2e2" }]}>
        <Feather name="alert-triangle" size={26} color={c.destructive} />
      </View>
      <Text style={[styles.stateTitle, { color: c.foreground }]}>Couldn't load data</Text>
      <Text style={[styles.stateMsg, { color: c.mutedForeground }]}>
        Check your connection and try again.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryBtn,
          { backgroundColor: c.primary, borderRadius: c.radius, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Feather name="refresh-cw" size={15} color={c.primaryForeground} />
        <Text style={[styles.retryText, { color: c.primaryForeground }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

/* ----------------------------------------------------------- SectionTitle */

export function SectionTitle({ title, count }: { title: string; count?: number }) {
  const c = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: c.foreground }]}>{title}</Text>
      {typeof count === "number" ? (
        <Text style={[styles.sectionCount, { color: c.mutedForeground }]}>{count}</Text>
      ) : null}
    </View>
  );
}

export const fontFamily = F;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)" as unknown as undefined }
      : {
          shadowColor: "#0f172a",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }),
  },
  statCard: { flex: 1, padding: 14, gap: 2 },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: { fontFamily: F.bold, fontSize: 24, letterSpacing: -0.5 },
  statLabel: { fontFamily: F.medium, fontSize: 12 },
  statSub: { fontFamily: F.semibold, fontSize: 11, marginTop: 2 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    alignSelf: "flex-start",
    maxWidth: 150,
  },
  badgeText: { fontFamily: F.semibold, fontSize: 11 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: F.medium, fontSize: 11, textTransform: "capitalize" },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, height: "100%" },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  chipText: { fontFamily: F.semibold, fontSize: 13 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: F.bold, fontSize: 15 },
  rowBody: { flex: 1, gap: 6 },
  rowTitle: { fontFamily: F.semibold, fontSize: 15 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  subtle: { fontFamily: F.regular, fontSize: 12, flexShrink: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowRightLabel: { fontFamily: F.semibold, fontSize: 13 },
  deployCount: { flexDirection: "row", alignItems: "center", gap: 4 },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countPillText: { fontFamily: F.bold, fontSize: 13 },

  center: { alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: { fontFamily: F.semibold, fontSize: 16 },
  stateMsg: { fontFamily: F.regular, fontSize: 13, textAlign: "center", lineHeight: 19 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 6,
  },
  retryText: { fontFamily: F.semibold, fontSize: 14 },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: F.bold, fontSize: 17, letterSpacing: -0.3 },
  sectionCount: { fontFamily: F.semibold, fontSize: 14 },
});
