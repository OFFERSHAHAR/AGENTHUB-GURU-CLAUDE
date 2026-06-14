import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamily } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

const WEB_TOP_INSET = 67;

export function GradientHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? WEB_TOP_INSET : insets.top + 8;
  return (
    <LinearGradient
      colors={[c.brandFrom, c.brandTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { paddingTop: topPad }]}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? WEB_TOP_INSET : insets.top + 8;
  return (
    <View style={[styles.plain, { paddingTop: topPad, backgroundColor: c.background }]}>
      <Text style={[styles.plainTitle, { color: c.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.plainSubtitle, { color: c.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: { fontFamily: fontFamily.bold, fontSize: 26, color: "#ffffff", letterSpacing: -0.6 },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 3,
  },
  plain: { paddingHorizontal: 20, paddingBottom: 14 },
  plainTitle: { fontFamily: fontFamily.bold, fontSize: 28, letterSpacing: -0.6 },
  plainSubtitle: { fontFamily: fontFamily.medium, fontSize: 13, marginTop: 2 },
});
