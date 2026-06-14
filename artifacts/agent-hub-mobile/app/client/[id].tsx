import { Feather } from "@expo/vector-icons";
import {
  getGetClientQueryOptions,
  getListClientAssignmentsQueryOptions,
  type Assignment,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AgentRow,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
  StatusPill,
  fontFamily,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function ClientDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);

  const client = useQuery(getGetClientQueryOptions(clientId));
  const assignments = useQuery(getListClientAssignmentsQueryOptions(clientId));

  const list = assignments.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: client.data?.name ?? "Client",
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: "/triggers/[id]", params: { id: String(clientId) } })}
              hitSlop={10}
              style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="zap" size={16} color={c.primary} />
              <Text style={[styles.headerBtnText, { color: c.primary }]}>Triggers</Text>
            </Pressable>
          ),
        }}
      />
      {client.isLoading ? (
        <LoadingState />
      ) : client.isError ? (
        <ErrorState onRetry={() => client.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item: Assignment) => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={list.length > 0}
          refreshing={assignments.isRefetching}
          onRefresh={() => assignments.refetch()}
          ListHeaderComponent={
            <View style={{ marginBottom: 18 }}>
              <Card>
                <View style={styles.headerTop}>
                  <View style={[styles.bigAvatar, { backgroundColor: c.accent }]}>
                    <Feather name="briefcase" size={22} color={c.accentForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: c.foreground }]}>
                      {client.data?.name}
                    </Text>
                    <Text style={[styles.industry, { color: c.mutedForeground }]}>
                      {client.data?.industry || "—"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.metaRow, { borderTopColor: c.border }]}>
                  <Meta label="Status">
                    <StatusPill status={client.data?.status ?? "unknown"} />
                  </Meta>
                  <Meta label="Agents">
                    <Text style={[styles.metaValue, { color: c.foreground }]}>
                      {client.data?.agentCount ?? 0}
                    </Text>
                  </Meta>
                  {client.data?.tier ? (
                    <Meta label="Tier">
                      <Text
                        style={[styles.metaValue, { color: c.foreground, textTransform: "capitalize" }]}
                      >
                        {client.data.tier}
                      </Text>
                    </Meta>
                  ) : null}
                </View>
              </Card>
              <View style={{ marginTop: 18 }}>
                <SectionTitle title="Assigned agents" count={list.length} />
              </View>
            </View>
          }
          renderItem={({ item }) =>
            item.agent ? (
              <AgentRow
                agent={item.agent}
                onPress={() => router.push(`/agent/${item.agentId}`)}
                rightLabel={item.automationEnabled ? "Auto" : undefined}
              />
            ) : null
          }
          ListEmptyComponent={
            assignments.isLoading ? (
              <LoadingState />
            ) : (
              <EmptyState
                icon="cpu"
                title="No agents assigned"
                message="This client has no deployed agents yet."
              />
            )
          }
        />
      )}
    </View>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaLabel, { color: c.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 60 : 40,
    flexGrow: 1,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  bigAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fontFamily.bold, fontSize: 19, letterSpacing: -0.4 },
  industry: { fontFamily: fontFamily.medium, fontSize: 13, marginTop: 2 },
  metaRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  meta: { gap: 5 },
  metaLabel: { fontFamily: fontFamily.medium, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { fontFamily: fontFamily.bold, fontSize: 15 },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Platform.OS === "web" ? 8 : 0,
  },
  headerBtnText: { fontFamily: fontFamily.semibold, fontSize: 15 },
});
