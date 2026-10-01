import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { FadeSlideIn } from "@/src/components/fade-slide-in";
import { useI18n } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { formatPoints, nextRank, RANKS, rankFor, rankName } from "@/src/ranks";
import { makeStyles, useTheme } from "@/src/theme";

export default function RanksScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  if (!user) return null;
  const current = rankFor(user.points);
  const upcoming = nextRank(user.points);
  const progress = upcoming ? Math.min(1, (user.points - current.min) / (upcoming.min - current.min)) : 1;

  return (
    <View style={styles.screen} testID="ranks-screen">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>{t("ranks.title")}</Text>
        <Text style={styles.headerHint}>{t("ranks.hint")}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 26 }]}>
        <FadeSlideIn><View style={styles.currentCard} testID="current-rank-card">
          <View style={[styles.currentIcon, { backgroundColor: current.color }]}>
            <Ionicons name={current.icon} size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.currentName}>{rankName(current, lang)}</Text>
          <Text style={styles.currentSub}>{formatPoints(user.points)} {t("common.points")}</Text>
          {upcoming ? (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: upcoming.color }]} />
              </View>
              <Text style={styles.progressText}>{t("ranks.next", { rank: rankName(upcoming, lang), points: formatPoints(Math.max(0, upcoming.min - user.points)) })}</Text>
            </>
          ) : (
            <Text style={styles.progressText}>{t("ranks.top")}</Text>
          )}
        </View></FadeSlideIn>

        {RANKS.map((rank, index) => {
          const unlocked = user.points >= rank.min;
          const isCurrent = rank.key === current.key;
          const isLast = index === RANKS.length - 1;
          return (
            <FadeSlideIn key={rank.key} delay={120 + index * 80}><View style={styles.timelineRow} testID={`rank-row-${rank.key}`}>
              <View style={styles.timelineLeft}>
                <View style={[styles.node, unlocked ? { backgroundColor: rank.color } : { backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.borderStrong }]}>
                  <Ionicons name={rank.icon} size={17} color={unlocked ? "#FFFFFF" : colors.muted} />
                </View>
                {!isLast && <View style={[styles.connector, { backgroundColor: unlocked && user.points >= RANKS[index + 1].min ? RANKS[index + 1].color : colors.divider }]} />}
              </View>
              <View style={[styles.rankCard, isCurrent && { borderColor: rank.color }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankTitle}>{rankName(rank, lang)}</Text>
                  <Text style={styles.rankRate}>{t("ranks.rate", { rate: rank.rate })}</Text>
                </View>
                {isCurrent && (
                  <View style={[styles.hereChip, { backgroundColor: rank.color }]}>
                    <Text style={styles.hereChipText}>{t("ranks.here")}</Text>
                  </View>
                )}
                <Text style={styles.rankRange}>{rank.range} {t("common.points")}</Text>
              </View>
            </View></FadeSlideIn>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 18, paddingBottom: 10 },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  headerHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  content: { paddingHorizontal: 18 },
  currentCard: { backgroundColor: colors.surfaceInverse, borderRadius: 22, padding: 18, alignItems: "center", marginBottom: 20 },
  currentIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  currentName: { color: colors.onSurfaceInverse, fontSize: 16, fontWeight: "900", marginTop: 10 },
  currentSub: { color: colors.onSurfaceInverse, opacity: 0.65, fontSize: 10, fontWeight: "700", marginTop: 3 },
  progressTrack: { width: "100%", height: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.14)", marginTop: 14, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 6 },
  progressText: { color: colors.onSurfaceInverse, opacity: 0.75, fontSize: 10, fontWeight: "700", marginTop: 8 },
  timelineRow: { flexDirection: "row" },
  timelineLeft: { alignItems: "center", width: 44 },
  node: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  connector: { width: 3, flex: 1, borderRadius: 2, marginVertical: 4 },
  rankCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 17, padding: 13, marginBottom: 14, marginLeft: 10, borderWidth: 2, borderColor: "transparent" },
  rankTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },
  rankRate: { color: colors.muted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  hereChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  hereChipText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  rankRange: { color: colors.muted, fontSize: 9, fontWeight: "800" },
}));
