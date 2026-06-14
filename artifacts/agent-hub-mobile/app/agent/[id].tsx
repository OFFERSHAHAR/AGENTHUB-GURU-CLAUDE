import { Feather } from "@expo/vector-icons";
import {
  getListAgentsQueryOptions,
  type Agent,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  Card,
  CategoryBadge,
  ErrorState,
  LoadingState,
  SectionTitle,
  StatusPill,
  fontFamily,
} from "@/components/ui";
import { categoryStyle } from "@/constants/categories";
import { useColors } from "@/hooks/useColors";

export default function AgentDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const agentId = Number(id);

  const query = useQuery(getListAgentsQueryOptions());
  const agent: Agent | undefined = query.data?.find((a) => a.id === agentId);
  const st = agent ? categoryStyle(agent.category) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: agent?.name ?? "Agent" }} />
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !agent ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <View style={styles.headerTop}>
              <View style={[styles.icon, { backgroundColor: st?.bg }]}>
                <Feather name={st?.icon ?? "cpu"} size={24} color={st?.color} />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[styles.name, { color: c.foreground }]}>{agent.name}</Text>
                <View style={styles.metaRow}>
                  <CategoryBadge category={agent.category} />
                  <StatusPill status={agent.status} />
                </View>
              </View>
            </View>
            {agent.description ? (
              <Text style={[styles.desc, { color: c.mutedForeground }]}>
                {agent.description}
              </Text>
            ) : null}
          </Card>

          <View style={styles.statsRow}>
            <Stat label="Deployments" value={String(agent.deployedCount)} c={c} />
            {agent.model ? <Stat label="Model" value={agent.model} c={c} /> : null}
            {agent.memoryType ? <Stat label="Memory" value={agent.memoryType} c={c} /> : null}
          </View>

          {agent.capabilities && agent.capabilities.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle title="Capabilities" count={agent.capabilities.length} />
              <View style={styles.tags}>
                {agent.capabilities.map((cap) => (
                  <View
                    key={cap}
                    style={[styles.tag, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                  >
                    <Text style={[styles.tagText, { color: c.secondaryForeground }]}>{cap}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Card style={styles.statCard}>
      <Text style={[styles.statValue, { color: c.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 60 : 40,
    gap: 14,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fontFamily.bold, fontSize: 20, letterSpacing: -0.4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  desc: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 16,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, padding: 14, gap: 4 },
  statValue: { fontFamily: fontFamily.bold, fontSize: 17, textTransform: "capitalize" },
  statLabel: { fontFamily: fontFamily.medium, fontSize: 12 },
  section: { gap: 0 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { fontFamily: fontFamily.medium, fontSize: 13 },
});
