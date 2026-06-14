import { Feather } from "@expo/vector-icons";
import {
  getGetStatsSummaryQueryOptions,
  getListRecentActivityQueryOptions,
  type ActivityEvent,
  type AgentCategory,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { GradientHeader } from "@/components/Header";
import {
  Card,
  ErrorState,
  LoadingState,
  SectionTitle,
  StatCard,
  fontFamily,
} from "@/components/ui";
import { categoryStyle } from "@/constants/categories";
import { useColors } from "@/hooks/useColors";

export default function DashboardScreen() {
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);

  const stats = useQuery(getGetStatsSummaryQueryOptions());
  const activity = useQuery(getListRecentActivityQueryOptions({ limit: 6 }));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([stats.refetch(), activity.refetch()]);
    setRefreshing(false);
  };

  const s = stats.data;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <GradientHeader title="AgentHub" subtitle="Fleet overview" />
      {stats.isLoading ? (
        <LoadingState />
      ) : stats.isError ? (
        <ErrorState onRetry={() => stats.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        >
          <View style={styles.statRow}>
            <StatCard
              icon="cpu"
              label="Agents"
              value={s?.totalAgents ?? 0}
              sub={`${s?.activeAgents ?? 0} active`}
              tint={c.primary}
            />
            <StatCard
              icon="users"
              label="Clients"
              value={s?.totalClients ?? 0}
              sub={`${s?.activeClients ?? 0} active`}
              tint="#0ea5e9"
            />
            <StatCard
              icon="git-branch"
              label="Deployments"
              value={s?.totalDeployments ?? 0}
              sub="live"
              tint="#10b981"
            />
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Agents by category"
              count={s?.categoryCounts?.length ?? 0}
            />
            {s?.categoryCounts && s.categoryCounts.length > 0 ? (
              <Card style={{ padding: 6 }}>
                {s.categoryCounts.map((cat: AgentCategory, i: number) => {
                  const st = categoryStyle(cat.category);
                  const isLast = i === s.categoryCounts.length - 1;
                  return (
                    <View
                      key={cat.category}
                      style={[
                        styles.catRow,
                        !isLast && { borderBottomWidth: 1, borderBottomColor: c.border },
                      ]}
                    >
                      <View style={[styles.catIcon, { backgroundColor: st.bg }]}>
                        <Feather name={st.icon} size={16} color={st.color} />
                      </View>
                      <Text style={[styles.catName, { color: c.foreground }]}>
                        {cat.category}
                      </Text>
                      <Text style={[styles.catCount, { color: st.color }]}>{cat.count}</Text>
                    </View>
                  );
                })}
              </Card>
            ) : (
              <Card>
                <Text style={[styles.emptyInline, { color: c.mutedForeground }]}>
                  No categories yet.
                </Text>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <SectionTitle title="Recent activity" />
            <Card style={{ padding: 6 }}>
              {activity.isLoading ? (
                <View style={{ padding: 18 }}>
                  <LoadingState />
                </View>
              ) : activity.data && activity.data.length > 0 ? (
                activity.data.map((ev: ActivityEvent, i: number) => {
                  const isLast = i === activity.data!.length - 1;
                  return (
                    <View
                      key={ev.id ?? i}
                      style={[
                        styles.actRow,
                        !isLast && { borderBottomWidth: 1, borderBottomColor: c.border },
                      ]}
                    >
                      <View style={[styles.actDot, { backgroundColor: c.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.actText, { color: c.foreground }]}
                          numberOfLines={2}
                        >
                          {ev.message ?? ev.type ?? "Activity"}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.emptyInline, { color: c.mutedForeground }]}>
                  No recent activity.
                </Text>
              )}
            </Card>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 120 : 40,
    gap: 8,
  },
  statRow: { flexDirection: "row", gap: 10 },
  section: { marginTop: 18 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  catIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  catName: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, textTransform: "capitalize" },
  catCount: { fontFamily: fontFamily.bold, fontSize: 15 },
  actRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 10 },
  actDot: { width: 7, height: 7, borderRadius: 4 },
  actText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  emptyInline: { fontFamily: fontFamily.regular, fontSize: 13, padding: 14, textAlign: "center" },
});
