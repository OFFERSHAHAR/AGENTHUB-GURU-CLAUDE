import {
  getListClientsQueryOptions,
  type Client,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Platform, StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/Header";
import {
  ClientRow,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchBar,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function ClientsScreen() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const query = useQuery(getListClientsQueryOptions());
  const clients = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (cl) =>
        cl.name.toLowerCase().includes(q) ||
        (cl.industry ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Clients" subtitle={`${clients.length} accounts`} />
      <View style={styles.controls}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search clients…" />
      </View>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: Client) => String(item.id)}
          renderItem={({ item }) => (
            <ClientRow
              name={item.name}
              industry={item.industry}
              status={item.status}
              agentCount={item.agentCount}
              onPress={() => router.push(`/client/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={filtered.length > 0}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="No clients found"
              message="Try a different search term."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: 16 },
  list: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 120 : 40,
    flexGrow: 1,
  },
});
