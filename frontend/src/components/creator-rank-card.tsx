import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { creatorRankFor, creatorRankName } from "@/src/creator-ranks";
import { useI18n } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

export function CreatorRankCard({ count }: { count: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const info = creatorRankFor(count);
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(info.progress, { duration: 650 });
  }, [info.progress, fill]);

  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.card} testID="creator-rank-card">
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: info.rank.color }]}>
          <Ionicons name={info.rank.icon} size={13} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t("creator.title")}</Text>
          <Text style={[styles.rankName, { color: info.hasRank ? info.rank.color : colors.muted }]} testID="creator-rank-name">
            {info.hasRank ? creatorRankName(info.rank, lang) : creatorRankName(info.rank, lang)}
          </Text>
        </View>
        <Text style={styles.count}>{info.count}</Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: info.rank.color }, barStyle]} />
      </View>

      <Text style={styles.sub}>
        {!info.hasRank
          ? t("creator.locked")
          : info.isMax
            ? t("creator.max")
            : `${info.count} / ${info.nextTarget! - 1} · ${t("creator.toNext", { n: (info.nextTarget! - info.count) })}`}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  card: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 14, marginTop: 14, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  label: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  rankName: { fontSize: 14, fontWeight: "900", marginTop: 1 },
  count: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  track: { height: 9, borderRadius: 999, backgroundColor: colors.divider, overflow: "hidden", marginTop: 12 },
  fill: { height: "100%", borderRadius: 999 },
  sub: { color: colors.muted, fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 9 },
}));
