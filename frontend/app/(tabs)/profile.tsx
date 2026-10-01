import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchLeaderboard, type Leader } from "@/src/api";
import { useAuth } from "@/src/auth";
import { FadeSlideIn } from "@/src/components/fade-slide-in";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { formatPoints, rankFor, rankName } from "@/src/ranks";
import { makeStyles, useTheme } from "@/src/theme";

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { user, logout } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    fetchLeaderboard().then(setLeaders).catch(() => setLeaders([]));
  }, []);

  if (!user) return null;
  const rank = rankFor(user.points);

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.screen} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.headerTitle}>{t("profile.title")}</Text>
          <Text style={styles.headerHint}>{t("profile.hint")}</Text>
        </View>
        <Pressable testID="settings-button" onPress={() => router.push("/settings")} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="settings-outline" size={19} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: bottomChrome + 26 }]}>
        <FadeSlideIn><View style={styles.profileTop}>
          <UserAvatar avatar={user.avatar} name={user.name} size={68} radius={23} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={styles.profileName} testID="profile-name">{user.name}</Text>
            {!!user.verified && <Ionicons name="checkmark-circle" size={14} color={colors.brandPrimary} testID="profile-verified-badge" />}
          </View>
          {!!user.username && <Text style={styles.profileUsername} testID="profile-username">@{user.username}</Text>}
          <Pressable testID="profile-rank-chip" onPress={() => router.navigate("/(tabs)/ranks")} style={[styles.rankChip, { borderColor: rank.color }]}>
            <View style={[styles.rankChipIcon, { backgroundColor: rank.color }]}>
              <Ionicons name={rank.icon} size={11} color="#FFFFFF" />
            </View>
            <Text style={[styles.rankChipText, { color: rank.color }]}>{rankName(rank, lang)}</Text>
          </Pressable>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}><Text style={styles.profileStatNumber} testID="profile-points">{formatPoints(user.points)}</Text><Text style={styles.profileStatLabel}>{t("profile.points")}</Text></View>
            <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{user.correct_count}</Text><Text style={styles.profileStatLabel}>{t("profile.corrects")}</Text></View>
            <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{user.saved_count}</Text><Text style={styles.profileStatLabel}>{t("profile.saved")}</Text></View>
          </View>
        </View></FadeSlideIn>

        <FadeSlideIn delay={90}><View style={styles.statCard} testID="points-card">
          <Text style={styles.statEyebrow}>{t("profile.lab")}</Text>
          <Text style={styles.statBig}>{formatPoints(user.points)} {t("common.points")}</Text>
          <Text style={styles.statSub}>{user.point_progress}/{user.point_rate} · {t("profile.rateInfo", { rate: user.point_rate })}</Text>
          <View style={styles.statRow}>
            <View style={styles.miniStat}><Text style={styles.miniNumber}>{user.correct_count}</Text><Text style={styles.miniLabel}>{t("profile.totalCorrect")}</Text></View>
            <View style={styles.miniStat}><Text style={styles.miniNumber}>{user.point_rate - user.point_progress}</Text><Text style={styles.miniLabel}>{t("profile.toBonus")}</Text></View>
          </View>
        </View></FadeSlideIn>

        <Text style={styles.sectionLabel}>{t("profile.leaderboard")}</Text>
        {leaders.length ? leaders.map((leader) => (
          <View style={styles.listCard} key={leader.user_id} testID={`leader-row-${leader.rank}`}>
            <Text style={styles.rankNumber}>#{leader.rank}</Text>
            <UserAvatar avatar={undefined} name={leader.name} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listName}>{leader.name}</Text>
              <Text style={styles.listMeta}>{leader.correct_count} {t("profile.corrects").toLowerCase()}</Text>
            </View>
            <Text style={styles.points}>{formatPoints(leader.points)} p</Text>
          </View>
        )) : <Text style={styles.emptyText}>{t("profile.leaderboardEmpty")}</Text>}

        <Pressable testID="logout-button" onPress={onLogout} style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.75 }]}>
          <Ionicons name="log-out-outline" size={17} color={colors.error} />
          <Text style={styles.logoutText}>{t("profile.logout")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  headerHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 18 },
  profileTop: { alignItems: "center", paddingVertical: 12 },
  profileAvatar: { width: 68, height: 68, borderRadius: 23, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  profileInitial: { color: colors.onBrandTertiary, fontSize: 26, fontWeight: "900" },
  profileName: { color: colors.onSurface, fontSize: 16, fontWeight: "900", marginTop: 10 },
  profileUsername: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 3 },
  rankChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 6, marginTop: 10 },
  rankChipIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankChipText: { fontSize: 10, fontWeight: "900" },
  profileStats: { flexDirection: "row", width: "100%", marginTop: 16, gap: 9 },
  profileStat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 15, paddingVertical: 11, alignItems: "center" },
  profileStatNumber: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  profileStatLabel: { color: colors.muted, fontSize: 9, marginTop: 2 },
  statCard: { backgroundColor: colors.surfaceInverse, borderRadius: 22, padding: 17, marginBottom: 14, marginTop: 5 },
  statEyebrow: { color: colors.brandSecondary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  statBig: { color: colors.onSurfaceInverse, fontSize: 24, fontWeight: "900", marginTop: 3 },
  statSub: { color: colors.onSurfaceInverse, opacity: 0.68, fontSize: 10, marginTop: 3 },
  statRow: { flexDirection: "row", gap: 9, marginTop: 14 },
  miniStat: { flex: 1, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", padding: 10 },
  miniNumber: { color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "900" },
  miniLabel: { color: colors.onSurfaceInverse, opacity: 0.65, fontSize: 9, marginTop: 2 },
  sectionLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "800", marginBottom: 9, marginTop: 6 },
  listCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 17, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 9 },
  rankNumber: { color: colors.brandPrimary, fontSize: 13, fontWeight: "900", width: 28 },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "900" },
  listName: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" },
  listMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  points: { color: colors.brandPrimary, fontWeight: "900", fontSize: 12 },
  emptyText: { color: colors.muted, lineHeight: 17, fontSize: 10, marginTop: 3 },
  logoutButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 16 },
  logoutText: { color: colors.error, fontSize: 12, fontWeight: "800" },
}));
