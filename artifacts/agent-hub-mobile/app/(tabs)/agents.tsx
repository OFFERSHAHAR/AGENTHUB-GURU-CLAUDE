import {
  getListAgentsQueryOptions,
  type Agent,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Platform, ScrollView, StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/Header";
import {
  AgentRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  SearchBar,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function AgentsScreen() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const query = useQuery(getListAgentsQueryOptions());
  const agents = query.data ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => a.category && set.add(a.category));
    return ["all", ...Array.from(set).sort()];
  }, [agents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      const matchCat = category === "all" || a.category === category;
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [agents, search, category]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Agents" subtitle={`${agents.length} in your fleet`} />
      <View style={styles.controls}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search agents…" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {categories.map((cat) => (
            <FilterChip
              key={cat}
              label={cat === "all" ? "All" : cat}
              active={category === cat}
              onPress={() => setCategory(cat)}
            />
          ))}
        </ScrollView>
      </View>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: Agent) => String(item.id)}
          renderItem={({ item }) => (
            <AgentRow agent={item} onPress={() => router.push(`/agent/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={filtered.length > 0}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="No agents found"
              message="Try a different search or category filter."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: 16, gap: 12 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 16 },
  list: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 120 : 40,
    flexGrow: 1,
  },
});
