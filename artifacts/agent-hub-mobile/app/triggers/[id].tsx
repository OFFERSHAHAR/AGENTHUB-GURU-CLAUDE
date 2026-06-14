import {
  getGetClientQueryOptions,
  getGetAssignmentTriggerQueryKey,
  getListClientAssignmentsQueryKey,
  getListClientAssignmentsQueryOptions,
  type Assignment,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { TriggerCard } from "@/components/TriggerCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
  fontFamily,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useTriggerStream, type TriggerStreamEvent } from "@/hooks/useTriggerStream";

export default function ClientTriggersScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);

  const client = useQuery(getGetClientQueryOptions(clientId));
  const assignments = useQuery(getListClientAssignmentsQueryOptions(clientId));

  const list = (assignments.data ?? []).filter((a: Assignment) => a.agent);

  // Live updates: on web the SSE stream pushes events instantly; on native the
  // per-card polling is the fallback. Invalidate the affected trigger + the
  // assignment list whenever a frame arrives for this client.
  const onEvent = useCallback(
    (ev: TriggerStreamEvent) => {
      if (ev.clientId !== clientId) return;
      queryClient.invalidateQueries({
        queryKey: getGetAssignmentTriggerQueryKey(ev.assignmentId),
      });
      queryClient.invalidateQueries({
        queryKey: getListClientAssignmentsQueryKey(clientId),
      });
    },
    [clientId, queryClient],
  );
  useTriggerStream(onEvent);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: "Triggers" }} />
      {client.isError ? (
        <ErrorState onRetry={() => client.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item: Assignment) => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={list.length > 0}
          refreshing={assignments.isRefetching}
          onRefresh={() => assignments.refetch()}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.title, { color: c.foreground }]}>
                {client.data?.name ?? "Client"}
              </Text>
              <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
                Monitor and fire automation triggers
              </Text>
              <View style={{ marginTop: 18 }}>
                <SectionTitle title="Agent triggers" count={list.length} />
              </View>
            </View>
          }
          renderItem={({ item }) => <TriggerCard assignment={item} clientId={clientId} />}
          ListEmptyComponent={
            assignments.isLoading || client.isLoading ? (
              <LoadingState />
            ) : (
              <EmptyState
                icon="zap"
                title="No triggers"
                message="This client has no deployed agents to trigger yet."
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 60 : 40,
    flexGrow: 1,
  },
  title: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.4 },
  subtitle: { fontFamily: fontFamily.medium, fontSize: 13.5, marginTop: 3 },
});
