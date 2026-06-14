import { Feather } from "@expo/vector-icons";
import {
  getGetAssignmentTriggerQueryKey,
  getListClientAssignmentsQueryKey,
  useCreateAssignmentTrigger,
  useFireWebhookTrigger,
  useGetAssignmentTrigger,
  useToggleAutomation,
  type Assignment,
  type TriggerEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, fontFamily } from "@/components/ui";
import { categoryStyle } from "@/constants/categories";
import { useColors } from "@/hooks/useColors";

/** Status pill styling — indigo brand identity for the active states. */
const STATUS_META: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  idle: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8", label: "Waiting" },
  triggered: { bg: "#eef0ff", text: "#4b32d6", dot: "#5b3cf6", label: "Triggered" },
  running: { bg: "#ecfdf5", text: "#065f46", dot: "#10b981", label: "Running" },
  deduplicated: { bg: "#f8fafc", text: "#94a3b8", dot: "#cbd5e1", label: "Duplicate" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  return (
    <View style={[styles.pill, { backgroundColor: meta.bg, borderColor: meta.dot + "44" }]}>
      <View style={[styles.pillDot, { backgroundColor: meta.dot }]} />
      <Text style={[styles.pillText, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

/** A single recent-activity row. Expands to reveal the agent's response text. */
function EventItem({ ev }: { ev: TriggerEvent }) {
  const c = useColors();
  const meta = STATUS_META[ev.agentStatus] ?? STATUS_META.idle;
  const output = ev.agentOutput ?? null;
  const [open, setOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const LIMIT = 280;
  const isLong = !!output && output.length > LIMIT;
  const shown = output && !showFull && isLong ? output.slice(0, LIMIT) + "…" : output;

  if (!output) {
    return (
      <View style={[styles.event, { backgroundColor: c.muted, borderColor: c.border }]}>
        <View style={[styles.eventDot, { backgroundColor: meta.dot }]} />
        <Text style={[styles.eventLabel, { color: meta.text }]}>{meta.label}</Text>
        <Text style={[styles.eventTime, { color: c.mutedForeground }]} numberOfLines={1}>
          {formatTime(ev.firedAt)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.eventCol, { backgroundColor: c.muted, borderColor: c.border }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.eventRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.eventDot, { backgroundColor: meta.dot }]} />
        <Text style={[styles.eventLabel, { color: meta.text }]}>{meta.label}</Text>
        <Text style={[styles.eventTime, { color: c.mutedForeground }]} numberOfLines={1}>
          {formatTime(ev.firedAt)}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color={c.mutedForeground}
          style={{ marginLeft: 6 }}
        />
      </Pressable>

      {open ? (
        <View style={styles.outputWrap}>
          <View style={styles.outputHeader}>
            <Feather name="message-square" size={11} color={c.primary} />
            <Text style={[styles.outputHeaderText, { color: c.primary }]}>Agent response</Text>
          </View>
          <Text style={[styles.outputText, { color: c.foreground }]}>{shown}</Text>
          {isLong ? (
            <Pressable onPress={() => setShowFull((s) => !s)} hitSlop={6}>
              <Text style={[styles.outputMore, { color: c.primary }]}>
                {showFull ? "Show less" : "Show more"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TriggerCard({
  assignment,
  clientId,
}: {
  assignment: Assignment;
  clientId: number;
}) {
  const c = useColors();
  const queryClient = useQueryClient();
  const agent = assignment.agent;
  const [copied, setCopied] = useState(false);

  const { data: trigger, isLoading, isError } = useGetAssignmentTrigger(assignment.id, {
    query: {
      queryKey: getGetAssignmentTriggerQueryKey(assignment.id),
      retry: false,
      // Poll fast while active, slower from idle so external fires are still
      // detected on native (where the SSE stream isn't available).
      refetchInterval: (q) => {
        const status = (q.state.data as { status?: string } | undefined)?.status;
        return status === "triggered" || status === "running" ? 4000 : 20000;
      },
    },
  });

  const createTrigger = useCreateAssignmentTrigger();
  const fireTrigger = useFireWebhookTrigger();
  const toggleAutomation = useToggleAutomation();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetAssignmentTriggerQueryKey(assignment.id) });
    queryClient.invalidateQueries({ queryKey: getListClientAssignmentsQueryKey(clientId) });
  };

  const haptic = (type: "light" | "success" | "error" = "light") => {
    if (Platform.OS === "web") return;
    if (type === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.selectionAsync();
  };

  const handleCreate = () => {
    haptic("light");
    createTrigger.mutate({ id: assignment.id }, { onSuccess: invalidate });
  };

  const handleRegenerate = () => {
    haptic("light");
    Alert.alert(
      "Regenerate webhook URL?",
      "This creates a new secret URL. The current one will stop working immediately, and anything using it must be updated.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => {
            createTrigger.mutate(
              { id: assignment.id },
              {
                onSuccess: () => {
                  invalidate();
                  haptic("success");
                },
                onError: () => haptic("error"),
              },
            );
          },
        },
      ],
    );
  };

  const handleCopy = async () => {
    if (!trigger?.webhookUrl) return;
    await Clipboard.setStringAsync(trigger.webhookUrl);
    haptic("success");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFire = () => {
    if (!trigger?.webhookUrl) return;
    const secret = trigger.webhookUrl.split("/webhooks/trigger/").pop() ?? "";
    if (!secret) return;
    haptic("light");
    fireTrigger.mutate(
      {
        secret,
        data: {
          event: "test_trigger",
          source: "AgentHub Mobile",
          timestamp: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          haptic("success");
        },
        onError: () => {
          invalidate();
          haptic("error");
        },
      },
    );
  };

  const handleToggleAutomation = () => {
    haptic("light");
    toggleAutomation.mutate(
      { id: assignment.id, data: { enabled: !assignment.automationEnabled } },
      { onSuccess: invalidate },
    );
  };

  const cat = categoryStyle(agent?.category ?? "");
  const isFiring =
    fireTrigger.isPending ||
    trigger?.status === "triggered" ||
    trigger?.status === "running";

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: cat.bg }]}>
          <Feather name={cat.icon} size={16} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
            {agent?.name ?? "Agent"}
          </Text>
          <Text style={[styles.category, { color: c.mutedForeground }]} numberOfLines={1}>
            {agent?.category ?? "—"}
          </Text>
        </View>
        {trigger ? <StatusPill status={trigger.status} /> : null}
      </View>

      {isLoading ? (
        <Text style={[styles.muted, { color: c.mutedForeground }]}>Loading…</Text>
      ) : isError || !trigger ? (
        <View style={styles.noTrigger}>
          <Text style={[styles.muted, { color: c.mutedForeground, flex: 1 }]}>
            No trigger configured
          </Text>
          <Pressable
            onPress={handleCreate}
            disabled={createTrigger.isPending}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              { backgroundColor: c.primary, opacity: pressed || createTrigger.isPending ? 0.7 : 1 },
            ]}
          >
            <Feather name="zap" size={13} color={c.primaryForeground} />
            <Text style={[styles.btnText, { color: c.primaryForeground }]}>Create</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Webhook URL */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: c.mutedForeground }]}>WEBHOOK URL</Text>
            <View style={styles.urlRow}>
              <View style={[styles.urlBox, { backgroundColor: c.muted, borderColor: c.border }]}>
                <Text style={[styles.url, { color: c.foreground }]} numberOfLines={1}>
                  {trigger.webhookUrl}
                </Text>
              </View>
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather
                  name={copied ? "check" : "copy"}
                  size={15}
                  color={copied ? c.success : c.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleFire}
              disabled={isFiring}
              style={({ pressed }) => [
                styles.btn,
                styles.btnFlex,
                { backgroundColor: c.primary, opacity: pressed || isFiring ? 0.7 : 1 },
              ]}
            >
              <Feather name="play" size={13} color={c.primaryForeground} />
              <Text style={[styles.btnText, { color: c.primaryForeground }]}>
                {isFiring ? "Running…" : "Fire now"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleToggleAutomation}
              disabled={toggleAutomation.isPending}
              style={({ pressed }) => [
                styles.btn,
                styles.btnFlex,
                styles.btnOutline,
                {
                  borderColor: assignment.automationEnabled ? c.primary : c.border,
                  backgroundColor: assignment.automationEnabled ? c.accent : c.card,
                  opacity: pressed || toggleAutomation.isPending ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="power"
                size={13}
                color={assignment.automationEnabled ? c.accentForeground : c.mutedForeground}
              />
              <Text
                style={[
                  styles.btnText,
                  { color: assignment.automationEnabled ? c.accentForeground : c.mutedForeground },
                ]}
              >
                {assignment.automationEnabled ? "Auto on" : "Auto off"}
              </Text>
            </Pressable>
          </View>

          {/* Regenerate URL */}
          <Pressable
            onPress={handleRegenerate}
            disabled={createTrigger.isPending}
            style={({ pressed }) => [
              styles.btn,
              styles.btnOutline,
              { borderColor: c.border, backgroundColor: c.card, opacity: pressed || createTrigger.isPending ? 0.7 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={13} color={c.mutedForeground} />
            <Text style={[styles.btnText, { color: c.mutedForeground }]}>
              {createTrigger.isPending ? "Regenerating…" : "Regenerate URL"}
            </Text>
          </Pressable>

          {/* Recent events */}
          {trigger.recentEvents.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>RECENT ACTIVITY</Text>
              <View style={{ gap: 6 }}>
                {trigger.recentEvents.slice(0, 4).map((ev: TriggerEvent) => (
                  <EventItem key={ev.id} ev={ev} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fontFamily.semibold, fontSize: 14.5 },
  category: { fontFamily: fontFamily.medium, fontSize: 12, marginTop: 1 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fontFamily.semibold, fontSize: 11 },

  muted: { fontFamily: fontFamily.medium, fontSize: 13 },
  noTrigger: { flexDirection: "row", alignItems: "center", gap: 10 },

  section: { gap: 7 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },

  urlRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  urlBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  url: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnFlex: { flex: 1 },
  btnPrimary: {},
  btnOutline: { borderWidth: 1 },
  btnText: { fontFamily: fontFamily.semibold, fontSize: 13 },

  event: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  eventDot: { width: 6, height: 6, borderRadius: 3 },
  eventLabel: { fontFamily: fontFamily.semibold, fontSize: 11.5 },
  eventTime: { fontFamily: fontFamily.regular, fontSize: 11, marginLeft: "auto" },

  eventCol: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 7,
  },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  outputWrap: { gap: 5 },
  outputHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  outputHeaderText: { fontFamily: fontFamily.semibold, fontSize: 11 },
  outputText: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17 },
  outputMore: { fontFamily: fontFamily.semibold, fontSize: 11 },
});
