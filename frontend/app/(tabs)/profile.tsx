import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteQuestion, fetchMyQuestions, fetchSavedQuestions, type Question } from "@/src/api";
import { useAuth } from "@/src/auth";
import { categoryIcon } from "@/src/categories";
import { FadeSlideIn } from "@/src/components/fade-slide-in";
import { CreatorRankCard } from "@/src/components/creator-rank-card";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { formatPoints, rankFor, rankName } from "@/src/ranks";
import { makeStyles, useTheme } from "@/src/theme";

type Tab = "shared" | "saved";

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { user, logout } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [tab, setTab] = useState<Tab>("shared");
  const [shared, setShared] = useState<Question[]>([]);
  const [saved, setSaved] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchMyQuestions().catch(() => []), fetchSavedQuestions().catch(() => [])])
      .then(([mine, savedList]) => {
        if (!active) return;
        setShared(mine);
        setSaved(savedList);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (!user) return null;
  const rank = rankFor(user.points);
  const items = tab === "shared" ? shared : saved;

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };
  const confirmDelete = (question: Question) => Alert.alert("Soruyu sil", "Bu işlem geri alınamaz.", [
    { text: "İptal", style: "cancel" },
    { text: "Sil", style: "destructive", onPress: async () => {
      try { await deleteQuestion(question.question_id); setShared((old) => old.filter((item) => item.question_id !== question.question_id)); }
      catch { Alert.alert("Hata", "Soru silinemedi."); }
    } },
  ]);
  const openDeleteMenu = (question: Question) => Alert.alert("", "", [
    { text: "Soruyu Sil", style: "destructive", onPress: () => confirmDelete(question) },
    { text: "İptal", style: "cancel" },
  ]);

  return (
    <View style={styles.screen} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.headerTitle}>{t("profile.title")}</Text>
          <Text style={styles.headerHint}>{t("profile.hint")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 9 }}>
          <Pressable testID="logout-icon-button" onPress={onLogout} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
            <Ionicons name="log-out-outline" size={19} color={colors.error} />
          </Pressable>
          <Pressable testID="settings-button" onPress={() => router.push("/settings")} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
            <Ionicons name="settings-outline" size={19} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: bottomChrome + 26 }]}>
        <FadeSlideIn><View style={styles.profileTop}>
          <UserAvatar avatar={user.avatar} name={user.name} size={74} radius={25} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}>
            <Text style={styles.profileName} testID="profile-name">{user.name}</Text>
            {!!user.verified && <Ionicons name="checkmark-circle" size={14} color={colors.brandPrimary} testID="profile-verified-badge" />}
          </View>
          {!!user.username && <Text style={styles.profileUsername} testID="profile-username">@{user.username}</Text>}
          {!!user.bio && <Text style={styles.bio} testID="profile-bio">{user.bio}</Text>}
          {!user.is_admin && (
            <Pressable testID="profile-rank-chip" onPress={() => router.navigate("/(tabs)/ranks")} style={[styles.rankChip, { borderColor: rank.color }]}>
              <View style={[styles.rankChipIcon, { backgroundColor: rank.color }]}>
                <Ionicons name={rank.icon} size={11} color="#FFFFFF" />
              </View>
              <Text style={[styles.rankChipText, { color: rank.color }]}>{rankName(rank, lang)}</Text>
            </Pressable>
          )}
          <View style={styles.followRow}>
            <View style={styles.followCell}><Text style={styles.followNum} testID="profile-followers-count">{user.followers_count ?? 0}</Text><Text style={styles.followLbl}>{t("profile.followers")}</Text></View>
            <View style={styles.followDivider} />
            <View style={styles.followCell}><Text style={styles.followNum}>{user.following_count ?? 0}</Text><Text style={styles.followLbl}>{t("profile.following")}</Text></View>
          </View>
          {!user.is_admin && <CreatorRankCard count={Math.max(user.questions_count ?? 0, shared.length)} />}
          <View style={[styles.profileStats, user.is_admin && { marginTop: 14 }]}>
            {!user.is_admin && (
              <View style={styles.profileStat}><Text style={styles.profileStatNumber} testID="profile-points">{formatPoints(user.points)}</Text><Text style={styles.profileStatLabel}>{t("profile.points")}</Text></View>
            )}
            <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{user.correct_count}</Text><Text style={styles.profileStatLabel}>{t("profile.corrects")}</Text></View>
            <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{user.saved_count}</Text><Text style={styles.profileStatLabel}>{t("profile.saved")}</Text></View>
          </View>
        </View></FadeSlideIn>

        {/* Instagram tarzı orta bar */}
        <View style={styles.tabBar}>
          <Pressable testID="profile-tab-shared" onPress={() => setTab("shared")} style={[styles.tabButton, tab === "shared" && styles.tabButtonActive]}>
            <Ionicons name="grid-outline" size={16} color={tab === "shared" ? colors.onSurface : colors.muted} />
            <Text style={[styles.tabText, { color: tab === "shared" ? colors.onSurface : colors.muted }]}>{t("profile.tabShared")}</Text>
          </Pressable>
          <Pressable testID="profile-tab-saved" onPress={() => setTab("saved")} style={[styles.tabButton, tab === "saved" && styles.tabButtonActive]}>
            <Ionicons name="bookmark-outline" size={16} color={tab === "saved" ? colors.onSurface : colors.muted} />
            <Text style={[styles.tabText, { color: tab === "saved" ? colors.onSurface : colors.muted }]}>{t("profile.tabSaved")}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 28 }} />
        ) : items.length ? (
          <View style={styles.grid} testID={`profile-grid-${tab}`}>
            {items.map((q, index) => (
              <FadeSlideIn key={q.question_id} delay={index * 40} style={styles.tileWrap}>
                <View style={styles.tile} testID={`question-tile-${q.question_id}`}>
                  <View style={styles.tileHead}>
                    <View style={styles.tileCat}>
                      <Ionicons name={categoryIcon(q.category)} size={10} color={colors.onBrandTertiary} />
                      <Text style={styles.tileCatText} numberOfLines={1}>{q.category}</Text>
                    </View>
                    {tab === "shared" && <Pressable testID={`question-menu-${q.question_id}`} onPress={() => openDeleteMenu(q)} style={styles.questionMenu}><Ionicons name="ellipsis-horizontal" size={16} color={colors.muted} /></Pressable>}
                  </View>
                  <Text style={styles.tileText} numberOfLines={4}>{q.text}</Text>
                  <View style={styles.tileFoot}>
                    <Text style={styles.tileDiff}>{t(`diff.${q.difficulty}`)}</Text>
                    <View style={styles.tileMeta}>
                      <Ionicons name="bookmark" size={10} color={colors.muted} />
                      <Text style={styles.tileMetaText}>{q.saves_count}</Text>
                    </View>
                  </View>
                </View>
              </FadeSlideIn>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>{tab === "shared" ? t("profile.noShared") : t("profile.noSaved")}</Text>
        )}
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
  profileName: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  profileUsername: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 3 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8, paddingHorizontal: 20 },
  followRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12 },
  followCell: { alignItems: "center" },
  followNum: { color: colors.onSurface, fontSize: 15, fontWeight: "900" },
  followLbl: { color: colors.muted, fontSize: 9, fontWeight: "700", marginTop: 1 },
  followDivider: { width: 1, height: 24, backgroundColor: colors.divider },
  rankChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 6, marginTop: 10 },
  rankChipIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankChipText: { fontSize: 10, fontWeight: "900" },
  profileStats: { flexDirection: "row", width: "100%", marginTop: 16, gap: 9 },
  profileStat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 15, paddingVertical: 11, alignItems: "center" },
  profileStatNumber: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  profileStatLabel: { color: colors.muted, fontSize: 9, marginTop: 2 },
  tabBar: { flexDirection: "row", marginTop: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tabButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabButtonActive: { borderBottomColor: colors.onSurface },
  tabText: { fontSize: 12, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 14 },
  tileWrap: { width: "48.5%", marginBottom: 11 },
  tile: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, minHeight: 128, justifyContent: "space-between" },
  tileHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questionMenu: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginTop: -6, marginRight: -6 },
  tileCat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, maxWidth: "100%" },
  tileCatText: { color: colors.onBrandTertiary, fontSize: 9, fontWeight: "800", flexShrink: 1 },
  tileText: { color: colors.onSurface, fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 9, flex: 1 },
  tileFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  tileDiff: { color: colors.muted, fontSize: 9, fontWeight: "800", textTransform: "capitalize" },
  tileMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  tileMetaText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  emptyText: { color: colors.muted, lineHeight: 18, fontSize: 11, marginTop: 24, textAlign: "center", paddingHorizontal: 20 },
}));
