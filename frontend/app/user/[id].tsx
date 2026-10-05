import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { deleteModeratedQuestion, fetchModeration, fetchUserProfile, setUserSuspension, toggleFollow, type ModerationSummary, type Question, type User } from "@/src/api";
import { useAuth } from "@/src/auth";
import { categoryIcon } from "@/src/categories";
import { FadeSlideIn } from "@/src/components/fade-slide-in";
import { CreatorRankCard } from "@/src/components/creator-rank-card";
import { ToastView, useToast } from "@/src/components/toast";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { rankFor, rankName } from "@/src/ranks";
import { makeStyles, useTheme } from "@/src/theme";

export default function PublicProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [moderation, setModeration] = useState<ModerationSummary | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchUserProfile(String(id))
      .then((res) => {
        if (!active) return;
        setProfile(res.user);
        setQuestions(res.questions);
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!me?.is_admin || !id) return;
    fetchModeration(String(id)).then((summary) => { setModeration(summary); setQuestions(summary.questions); }).catch(() => setModeration(null));
  }, [id, me?.is_admin]);

  const rank = profile ? rankFor(profile.points) : null;
  const isSelf = !!me && !!profile && me.user_id === profile.user_id;
  const canModerate = !!me?.is_admin && !isSelf && !profile?.is_admin;

  const onToggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    try {
      const res = await toggleFollow(profile.user_id);
      setProfile((p) => (p ? { ...p, is_following: res.following, followers_count: res.followers_count } : p));
    } catch {
      toast.show(t("auth.error"));
    } finally {
      setFollowBusy(false);
    }
  };

  const toggleSuspension = () => {
    if (!profile || !moderation) return;
    const suspended = moderation.user.account_status === "suspended";
    Alert.alert(t("admin.moderation"), suspended ? t("admin.unsuspend") : t("admin.suspendConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: suspended ? t("admin.unsuspend") : t("admin.suspend"), style: "destructive", onPress: async () => {
        try { const result = await setUserSuspension(profile.user_id, !suspended); setModeration((old) => old ? { ...old, user: { ...old.user, account_status: result.account_status } } : old); }
        catch { toast.show(t("auth.error")); }
      } },
    ]);
  };
  const deleteForModeration = (question: Question) => Alert.alert(t("admin.deleteQuestion"), t("admin.deleteConfirm"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("admin.deleteQuestion"), style: "destructive", onPress: async () => {
      if (!profile) return;
      try { await deleteModeratedQuestion(profile.user_id, question.question_id); setQuestions((old) => old.filter((item) => item.question_id !== question.question_id)); setModeration((old) => old ? { ...old, user: { ...old.user, questions_count: Math.max(0, old.user.questions_count - 1) } } : old); }
      catch { toast.show(t("auth.error")); }
    } },
  ]);

  return (
    <View style={styles.screen} testID="public-profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable testID="public-profile-back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{profile?.username ? `@${profile.username}` : ""}</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
      ) : notFound || !profile || !rank ? (
        <Text style={styles.emptyText}>{t("profile.notFound")}</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 26 }]}>
          <FadeSlideIn><View style={styles.profileTop}>
            <UserAvatar avatar={profile.avatar} name={profile.name} size={74} radius={25} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}>
              <Text style={styles.profileName} testID="public-profile-name">{profile.name}</Text>
              {!!profile.verified && <Ionicons name="checkmark-circle" size={14} color={colors.brandPrimary} />}
            </View>
            {!!profile.username && <Text style={styles.profileUsername}>@{profile.username}</Text>}
            {!!profile.bio && <Text style={styles.bio} testID="public-profile-bio">{profile.bio}</Text>}
            {!profile.is_admin && (
              <View style={[styles.rankChip, { borderColor: rank.color }]}>
                <View style={[styles.rankChipIcon, { backgroundColor: rank.color }]}>
                  <Ionicons name={rank.icon} size={11} color="#FFFFFF" />
                </View>
                <Text style={[styles.rankChipText, { color: rank.color }]}>{rankName(rank, lang)}</Text>
              </View>
            )}
            {!isSelf && (
              <Pressable
                testID="follow-button"
                onPress={onToggleFollow}
                disabled={followBusy}
                style={({ pressed }) => [styles.followButton, profile.is_following ? styles.followingButton : styles.followActive, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name={profile.is_following ? "checkmark" : "person-add"} size={14} color={profile.is_following ? colors.onSurface : colors.onBrandPrimary} />
                <Text style={[styles.followText, { color: profile.is_following ? colors.onSurface : colors.onBrandPrimary }]}>{profile.is_following ? t("profile.unfollow") : t("profile.follow")}</Text>
              </Pressable>
            )}
            <View style={styles.profileStats}>
              <View style={styles.profileStat}><Text style={styles.profileStatNumber} testID="public-followers-count">{profile.followers_count ?? 0}</Text><Text style={styles.profileStatLabel}>{t("profile.followers")}</Text></View>
              <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{profile.following_count ?? 0}</Text><Text style={styles.profileStatLabel}>{t("profile.following")}</Text></View>
              <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{questions.length}</Text><Text style={styles.profileStatLabel}>{t("profile.tabShared")}</Text></View>
            </View>
            {!profile.is_admin && <CreatorRankCard count={profile.questions_count ?? questions.length} />}
            {canModerate && moderation && <View testID="admin-moderation-panel" style={styles.moderationPanel}>
              <Text style={styles.moderationTitle}>{t("admin.moderation")}</Text>
              <Text style={styles.moderationMeta}>ID: {moderation.user.user_id}</Text>
              <Text style={styles.moderationMeta}>{moderation.user.role} · {moderation.user.questions_count} soru · {moderation.user.account_status === "suspended" ? t("admin.suspended") : t("admin.active")}</Text>
              <Pressable testID="admin-suspension-button" onPress={toggleSuspension} style={styles.moderationButton}><Text style={styles.moderationButtonText}>{moderation.user.account_status === "suspended" ? t("admin.unsuspend") : t("admin.suspend")}</Text></Pressable>
            </View>}
          </View></FadeSlideIn>

          <View style={styles.tabBar}>
            <View style={[styles.tabButton, styles.tabButtonActive]}>
              <Ionicons name="grid-outline" size={16} color={colors.onSurface} />
              <Text style={[styles.tabText, { color: colors.onSurface }]}>{t("profile.userHint")}</Text>
            </View>
          </View>

          {questions.length ? (
            <View style={styles.grid} testID="public-profile-grid">
              {questions.map((q, index) => (
                <FadeSlideIn key={q.question_id} delay={index * 40} style={styles.tileWrap}>
                  <View style={styles.tile} testID={`question-tile-${q.question_id}`}>
                    <View style={styles.tileHead}>
                      <View style={styles.tileCat}>
                        <Ionicons name={categoryIcon(q.category)} size={10} color={colors.onBrandTertiary} />
                        <Text style={styles.tileCatText} numberOfLines={1}>{q.category}</Text>
                      {canModerate && <Pressable testID={`admin-delete-question-${q.question_id}`} onPress={() => deleteForModeration(q)} style={styles.adminDelete}><Ionicons name="trash-outline" size={14} color={colors.error} /></Pressable>}</View>
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
            <Text style={styles.emptyText}>{t("profile.noSharedOther")}</Text>
          )}
        </ScrollView>
      )}
      <ToastView message={toast.message} bottom={insets.bottom + 24} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 18 },
  profileTop: { alignItems: "center", paddingVertical: 12 },
  profileName: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  profileUsername: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 3 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8, paddingHorizontal: 20 },
  followButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 9, marginTop: 12, minWidth: 150 },
  followActive: { backgroundColor: colors.brandPrimary },
  followingButton: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  followText: { fontSize: 12, fontWeight: "900" },
  rankChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 6, marginTop: 10 },
  rankChipIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankChipText: { fontSize: 10, fontWeight: "900" },
  moderationPanel: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 13, marginTop: 14 },
  moderationTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900" },
  moderationMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  moderationButton: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: colors.error, alignItems: "center", justifyContent: "center", marginTop: 10 },
  moderationButtonText: { color: colors.error, fontSize: 11, fontWeight: "900" },
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
  adminDelete: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: -7, marginRight: -7 },
  tileCat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, maxWidth: "100%" },
  tileCatText: { color: colors.onBrandTertiary, fontSize: 9, fontWeight: "800", flexShrink: 1 },
  tileText: { color: colors.onSurface, fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 9, flex: 1 },
  tileFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  tileDiff: { color: colors.muted, fontSize: 9, fontWeight: "800", textTransform: "capitalize" },
  tileMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  tileMetaText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  emptyText: { color: colors.muted, lineHeight: 18, fontSize: 11, marginTop: 24, textAlign: "center", paddingHorizontal: 20 },
}));
