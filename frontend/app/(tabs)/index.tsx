import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  addComment,
  answerQuestion,
  fetchComments,
  fetchFeed,
  fetchPeople,
  fetchUnreadCount,
  fileUrl,
  sendMessage,
  toggleSave,
  type Comment,
  type Person,
  type Question,
} from "@/src/api";
import { useAuth } from "@/src/auth";
import { ToastView, useToast } from "@/src/components/toast";
import { categoryIcon } from "@/src/categories";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { formatPoints, rankFor, rankName } from "@/src/ranks";
import { makeStyles, useTheme } from "@/src/theme";

type AnswerResult = { index: number; correct: boolean; correctIndex?: number; explanation?: string };

export default function FeedScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [viewport, setViewport] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [answered, setAnswered] = useState<Record<string, AnswerResult>>({});
  const [answeredCount, setAnsweredCount] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [active, setActive] = useState<Question | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [note, setNote] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Doğru cevap puan bildirimi: aşağıdan yukarı kayar, 3 sn durur, kaybolur.
  const popupOffset = useSharedValue(140);
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupSub, setPopupSub] = useState("");
  const popupStyle = useAnimatedStyle(() => ({ transform: [{ translateY: popupOffset.value }] }));

  const showPointsPopup = useCallback((title: string, sub: string) => {
    setPopupTitle(title);
    setPopupSub(sub);
    popupOffset.value = withTiming(0, { duration: 320 });
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(() => {
      popupOffset.value = withTiming(140, { duration: 320 });
    }, 3000);
  }, [popupOffset]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      setQuestions(await fetchFeed());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    load(loadedOnce.current);
    loadedOnce.current = true;
    // Fetch unread notification count
    fetchUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, [load]));

  const answer = async (question: Question, index: number) => {
    if (answered[question.question_id]) return;
    if (user?.is_guest && answeredCount >= 5) { setGateOpen(true); return; }
    try {
      const result = await answerQuestion(question.question_id, index);
      await Haptics.notificationAsync(result.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      setAnswered((old) => ({ ...old, [question.question_id]: { index, correct: result.correct, correctIndex: result.correct_index, explanation: result.explanation } }));
      setUser(result.user);
      if (typeof result.answered_count === "number") {
        setAnsweredCount(result.answered_count);
        if (user?.is_guest && result.answered_count >= 5) setTimeout(() => setGateOpen(true), 900);
      }
      if (result.correct && !user?.is_admin) {
        const sub = t("feed.popupProgress", { done: result.point_progress, rate: result.point_rate, total: formatPoints(result.user.points) });
        showPointsPopup(result.earned > 0 ? `+${result.earned} ${t("common.points")}` : t("common.correct"), sub);
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t("feed.answerFailed"));
    }
  };

  const goRegister = async () => {
    setGateOpen(false);
    await logout();
    router.replace("/login");
  };

  const save = async (question: Question) => {
    try {
      const result = await toggleSave(question.question_id);
      setQuestions((old) => old.map((item) => (item.question_id === question.question_id ? { ...item, saved: result.saved, saves_count: Math.max(0, item.saves_count + (result.saved ? 1 : -1)) } : item)));
      toast.show(result.saved ? t("feed.saved") : t("feed.unsaved"));
    } catch {
      toast.show(t("feed.loginToSave"));
    }
  };

  const openComments = async (question: Question) => {
    setActive(question);
    setShareOpen(false);
    try {
      setComments(await fetchComments(question.question_id));
    } catch {
      setComments([]);
    }
  };

  const postComment = async () => {
    if (!active || !commentText.trim()) return;
    try {
      const item = await addComment(active.question_id, commentText.trim());
      setComments((old) => [item, ...old]);
      setCommentText("");
      setQuestions((old) => old.map((q) => (q.question_id === active.question_id ? { ...q, comments_count: q.comments_count + 1 } : q)));
    } catch {
      toast.show(t("feed.commentFailed"));
    }
  };

  const openShare = async (question: Question) => {
    setActive(question);
    setShareOpen(true);
    try {
      setPeople(await fetchPeople());
    } catch {
      setPeople([]);
    }
  };

  const shareTo = async (person: Person) => {
    if (!active) return;
    try {
      await sendMessage(person.user_id, note.trim() || t("feed.lookAtThis", { text: active.text }), active.question_id);
      setQuestions((old) => old.map((q) => (q.question_id === active.question_id ? { ...q, shares_count: q.shares_count + 1 } : q)));
      setShareOpen(false);
      setActive(null);
      setNote("");
      toast.show(t("feed.shared", { name: person.name }));
    } catch {
      toast.show(t("feed.shareFailed"));
    }
  };

  if (!user) return null;
  const rank = rankFor(user.points);

  return (
    <View
      style={styles.screen}
      testID="feed-screen"
      onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
    >
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandSecondary} size="large" />
          <Text style={styles.loadingText}>{t("feed.loading")}</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.onSurfaceInverse} />
          <Text style={styles.emptyTitle}>{t("feed.errorTitle")}</Text>
          <Text style={styles.emptyText}>{t("feed.errorSub")}</Text>
          <Pressable testID="feed-retry-button" onPress={() => load()} style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.75 }]}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && questions.length === 0 && (
        <View style={styles.centered}>
          <Ionicons name="sparkles-outline" size={36} color={colors.onSurfaceInverse} />
          <Text style={styles.emptyTitle}>{t("feed.emptyTitle")}</Text>
          <Text style={styles.emptyText}>{t("feed.emptySub")}</Text>
          <Pressable testID="feed-create-first-button" onPress={() => router.push("/(tabs)/create")} style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.75 }]}>
            <Text style={styles.retryText}>{t("tabs.create")}</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && viewport > 0 && questions.length > 0 && (
        <FlatList
          data={questions}
          keyExtractor={(item) => item.question_id}
          pagingEnabled
          snapToInterval={viewport}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: viewport, offset: viewport * index, index })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.onSurfaceInverse} />}
          renderItem={({ item }) => (
            <QuizCard
              question={item}
              result={answered[item.question_id]}
              height={viewport}
              bottomChrome={bottomChrome}
              onAnswer={(index) => answer(item, index)}
              onSave={() => save(item)}
              onComments={() => openComments(item)}
              onShare={() => openShare(item)}
            />
          )}
        />
      )}

      <LinearGradient colors={["rgba(18,14,11,0.5)", "rgba(18,14,11,0)"]} style={[styles.headerScrim, { height: insets.top + 84 }]} pointerEvents="none" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none" testID="feed-header">
        {user.is_admin ? <View /> : (
        <Pressable testID="rank-badge" onPress={() => router.navigate("/(tabs)/ranks")} style={({ pressed }) => [styles.rankBadge, pressed && { opacity: 0.85 }]}>
          <View style={[styles.rankIconRing, { borderColor: rank.color }]}>
            <View style={[styles.rankIcon, { backgroundColor: rank.color }]}>
              <Ionicons name={rank.icon} size={12} color="#FFFFFF" />
            </View>
          </View>
          <View>
            <Text style={styles.rankName}>{rankName(rank, lang)}</Text>
            <View style={styles.rankPointsRow}>
              <Ionicons name="sparkles" size={8} color={colors.brandSecondary} />
              <Text style={styles.rankPoints}>{formatPoints(user.points)} {t("common.points")}</Text>
            </View>
          </View>
        </Pressable>
        )}
        <Pressable testID="feed-notifications-button" onPress={() => router.push("/notifications")} style={({ pressed }) => [styles.headerIconButton, pressed && { opacity: 0.75 }]}>
          <Ionicons name="notifications-outline" size={18} color={colors.onSurfaceInverse} />
          {unreadCount > 0 && (
            <View style={[styles.notifBadge, { backgroundColor: colors.brandPrimary }]}>
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Animated.View
        testID="points-popup"
        pointerEvents="none"
        style={[styles.pointsPopup, popupStyle, { bottom: bottomChrome + 16, backgroundColor: colors.surface }]}
      >
        <View style={[styles.pointsPopupIcon, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={16} color={colors.onSuccess} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pointsPopupTitle}>{popupTitle}</Text>
          <Text style={styles.pointsPopupSub}>{popupSub}</Text>
        </View>
      </Animated.View>

      <Modal visible={!!active && !shareOpen} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setActive(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.sheet} testID="comments-sheet">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{t("feed.comments")}</Text>
              <ScrollView style={{ flexGrow: 0 }}>
                {comments.length ? comments.map((item) => (
                  <View key={item.comment_id} style={styles.commentRow}>
                    <Text style={styles.commentAuthor}>{item.user_name}</Text>
                    <Text style={styles.commentText}>{item.text}</Text>
                  </View>
                )) : <Text style={styles.emptySheetText}>{t("feed.firstComment")}</Text>}
              </ScrollView>
              <View style={styles.rowInput}>
                <TextInput testID="comment-input" value={commentText} onChangeText={setCommentText} placeholder={t("feed.commentPlaceholder")} placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
                <Pressable testID="comment-send-button" onPress={postComment} style={styles.sendButton}>
                  <Ionicons name="arrow-up" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setShareOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.sheet} testID="share-sheet">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{t("feed.shareTitle")}</Text>
              <TextInput testID="share-note-input" value={note} onChangeText={setNote} placeholder={t("feed.shareNote")} placeholderTextColor={colors.muted} style={styles.input} />
              <ScrollView style={{ flexGrow: 0 }}>
                {people.length ? people.map((person) => (
                  <Pressable key={person.user_id} testID={`share-person-${person.user_id}`} onPress={() => shareTo(person)} style={({ pressed }) => [styles.personRow, pressed && { opacity: 0.7 }]}>
                    <UserAvatar avatar={person.avatar} name={person.name} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <Text style={styles.personMeta}>{person.bio || t("chat.newPartner")}</Text>
                    </View>
                    <Ionicons name="send-outline" size={17} color={colors.brandPrimary} />
                  </Pressable>
                )) : (
                  <View style={styles.emptySheet}>
                    <Ionicons name="people-outline" size={28} color={colors.muted} />
                    <Text style={styles.emptySheetText}>{t("feed.noPeople")}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={gateOpen} transparent animationType="fade" onRequestClose={() => setGateOpen(false)}>
        <View style={styles.gateBackdrop}>
          <View style={styles.gateCard} testID="guest-gate">
            <View style={styles.gateIcon}>
              <Ionicons name="rocket" size={26} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.gateTitle}>{t("guest.gateTitle")}</Text>
            <Text style={styles.gateText}>{t("guest.gateText")}</Text>
            <Pressable testID="guest-gate-register" onPress={goRegister} style={({ pressed }) => [styles.gateButton, pressed && { opacity: 0.8 }]}>
              <Text style={styles.gateButtonText}>{t("guest.register")}</Text>
            </Pressable>
            <Pressable testID="guest-gate-later" onPress={() => setGateOpen(false)} style={styles.gateLater}>
              <Text style={styles.gateLaterText}>{t("guest.later")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ToastView message={toast.message} bottom={bottomChrome + 24} />
    </View>
  );
}

function CardBackground({ background }: { background?: string | null }) {
  const { scheme } = useTheme();
  const [uri, setUri] = useState<string | null>(background && background.startsWith("http") ? background : null);

  useEffect(() => {
    let mounted = true;
    if (background && !background.startsWith("http")) {
      fileUrl(background).then((resolved) => { if (mounted) setUri(resolved); }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [background]);

  if (uri) {
    return (
      <>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(18,14,11,0.58)" }]} />
      </>
    );
  }
  // Varsayılan soru arka planı: her temaya özel sabit tonlar (marka sabiti, iki temada da okunabilir).
  const defaults = scheme === "dark"
    ? (["#0C0907", "#1E0F08", "#7A2A12"] as const)
    : (["#1F1C18", "#3D3832", "#FF6B4A"] as const);
  return <LinearGradient colors={[...defaults]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />;
}

function OptionButton({ option, index, result, onPress }: { option: string; index: number; result?: AnswerResult; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);

  const isSelected = result?.index === index;
  const isRevealedCorrect = !!result && !result.correct && result.correctIndex === index;

  useEffect(() => {
    if (!result) return;
    if (isSelected && result.correct) {
      scale.value = withSequence(withTiming(1.05, { duration: 130 }), withSpring(1, { damping: 11, stiffness: 220 }));
      glow.value = withSequence(withTiming(1, { duration: 160 }), withDelay(450, withTiming(0, { duration: 380 })));
    } else if (isSelected && !result.correct) {
      shake.value = withSequence(
        withTiming(-6, { duration: 55 }),
        withTiming(6, { duration: 55 }),
        withTiming(-4, { duration: 55 }),
        withTiming(4, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
    } else if (isRevealedCorrect) {
      scale.value = withDelay(240, withSequence(withTiming(1.04, { duration: 150 }), withSpring(1, { damping: 12 })));
    }
  }, [result, isSelected, isRevealedCorrect, scale, shake, glow]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shake.value }],
    shadowOpacity: 0.2 + glow.value * 0.5,
    shadowRadius: 8 + glow.value * 10,
    elevation: 4 + glow.value * 6,
  }));

  return (
    <Animated.View style={[styles.optionAnim, { shadowColor: colors.success }, animStyle]}>
      <Pressable
        testID={`feed-option-${index}`}
        onPress={onPress}
        style={[
          styles.option,
          isSelected && (result?.correct ? styles.optionSelected : styles.optionWrong),
          isRevealedCorrect && styles.optionReveal,
        ]}
      >
        <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{String.fromCharCode(65 + index)}</Text></View>
        <Text style={styles.optionText} numberOfLines={3}>{option}</Text>
        {isSelected && <Ionicons name={result?.correct ? "checkmark-circle" : "close-circle"} color={colors.onSurfaceInverse} size={17} />}
        {isRevealedCorrect && <Ionicons name="checkmark-circle" color={colors.onSurfaceInverse} size={17} />}
      </Pressable>
    </Animated.View>
  );
}

function FeedbackBox({ result, explanation }: { result: AnswerResult; explanation: string }) {
  const styles = useStyles();
  const { t } = useI18n();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withSpring(0, { damping: 14 });
  }, [opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[styles.feedback, animStyle]} testID="answer-feedback">
      <Text style={styles.feedbackTitle}>{result.correct ? t("common.correct") : t("common.wrong")}</Text>
      <Text style={styles.feedbackText}>{result.explanation || explanation}</Text>
    </Animated.View>
  );
}

function QuizCard({
  question,
  result,
  height,
  bottomChrome,
  onAnswer,
  onSave,
  onComments,
  onShare,
}: {
  question: Question;
  result?: AnswerResult;
  height: number;
  bottomChrome: number;
  onAnswer: (index: number) => void;
  onSave: () => void;
  onComments: () => void;
  onShare: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <View style={{ height }} testID={`quiz-card-${question.question_id}`}>
      <CardBackground background={question.background} />
      <View style={styles.patternOne} />
      <View style={styles.patternTwo} />

      <View style={styles.quizBody}>
        <View style={styles.badgeRow}>
          <View style={styles.categoryPill}>
            <Ionicons name={categoryIcon(question.category)} size={10} color={colors.onBrandTertiary} />
            <Text style={styles.category}>{question.category}</Text>
          </View>
          <Text style={styles.difficulty}>{t(`diff.${question.difficulty}`)}</Text>
        </View>
        <Text style={styles.quizQuestion}>{question.text}</Text>
        <View style={styles.optionsWrap}>
          {question.options.map((option, index) => (
            <OptionButton key={index} option={option} index={index} result={result} onPress={() => onAnswer(index)} />
          ))}
        </View>
        {result && <FeedbackBox result={result} explanation={question.explanation} />}
      </View>

      <Pressable
        testID={`author-block-${question.question_id}`}
        onPress={() => router.push(`/user/${question.author_id}`)}
        style={({ pressed }) => [styles.authorBlock, { bottom: bottomChrome + 14 }, pressed && { opacity: 0.7 }]}
      >
        <UserAvatar avatar={question.author_avatar} name={question.author_name} size={36} radius={13} />
        <View style={{ justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.authorName}>{question.author_name}</Text>
            {!!question.author_verified && <Ionicons name="checkmark-circle" size={11} color={colors.brandPrimary} testID="verified-badge" />}
          </View>
          {!!question.author_username && <Text style={styles.authorUsername}>@{question.author_username}</Text>}
        </View>
      </Pressable>

      <View style={[styles.actionRail, { bottom: bottomChrome + 90 }]} pointerEvents="box-none">
        <Pressable testID="comments-button" onPress={onComments} style={({ pressed }) => [styles.railButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.onSurfaceInverse} />
        </Pressable>
        <Text style={styles.railLabel}>{question.comments_count}</Text>
        <Pressable testID="share-button" onPress={onShare} style={({ pressed }) => [styles.railButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="paper-plane-outline" size={19} color={colors.onSurfaceInverse} />
        </Pressable>
        <Text style={styles.railLabel}>{question.shares_count}</Text>
        <Pressable testID="save-button" onPress={onSave} style={({ pressed }) => [styles.railButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name={question.saved ? "bookmark" : "bookmark-outline"} size={20} color={question.saved ? colors.brandSecondary : colors.onSurfaceInverse} />
        </Pressable>
        <Text style={styles.railLabel}>{question.saves_count}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceInverse },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 10, color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 11 },
  emptyTitle: { color: colors.onSurfaceInverse, fontSize: 13, fontWeight: "800", marginTop: 10 },
  emptyText: { color: colors.onSurfaceInverse, opacity: 0.65, textAlign: "center", lineHeight: 17, marginTop: 5, fontSize: 10 },
  retryButton: { marginTop: 14, minHeight: 44, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  retryText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 11 },
  headerScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  header: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rankBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(18,14,11,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12 },
  rankIconRing: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  rankIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rankName: { color: colors.onSurfaceInverse, fontSize: 11, fontWeight: "800" },
  rankPointsRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  rankPoints: { color: colors.onSurfaceInverse, opacity: 0.78, fontSize: 9, fontWeight: "700" },
  headerIconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(18,14,11,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  notifBadge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  notifBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  pointsPopup: { position: "absolute", left: 16, right: 16, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  pointsPopupIcon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pointsPopupTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },
  pointsPopupSub: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 2 },
  patternOne: { position: "absolute", width: 200, height: 200, borderRadius: 100, top: -70, right: -60, backgroundColor: colors.brandSecondary, opacity: 0.35 },
  patternTwo: { position: "absolute", width: 150, height: 150, borderRadius: 75, top: "38%", left: -75, backgroundColor: colors.info, opacity: 0.2 },
  quizBody: { flex: 1, justifyContent: "center", paddingLeft: 16, paddingRight: 62 },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  category: { color: colors.onBrandTertiary, paddingRight: 9, paddingVertical: 5, fontSize: 10, fontWeight: "800" },
  difficulty: { color: colors.onSurfaceInverse, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: "800" },
  quizQuestion: { color: colors.onSurfaceInverse, fontSize: 15, lineHeight: 21, fontWeight: "800", letterSpacing: -0.2, marginBottom: 12 },
  optionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionAnim: { flexBasis: "47%", flexGrow: 1, shadowOffset: { width: 0, height: 3 } },
  option: { minHeight: 46, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
  optionWrong: { backgroundColor: colors.error, borderColor: colors.error },
  optionReveal: { backgroundColor: "rgba(45,157,120,0.55)", borderColor: colors.success, borderWidth: 2 },
  optionLetter: { width: 22, height: 22, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginRight: 7 },
  optionLetterText: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: 10 },
  optionText: { color: colors.onSurfaceInverse, flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  feedback: { marginTop: 12, borderRadius: 13, padding: 11, backgroundColor: "rgba(255,255,255,0.14)" },
  feedbackTitle: { color: colors.onSurfaceInverse, fontWeight: "800", fontSize: 11 },
  feedbackText: { color: colors.onSurfaceInverse, opacity: 0.84, fontSize: 10, lineHeight: 15, marginTop: 2 },
  authorBlock: { position: "absolute", left: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  authorAvatar: { width: 36, height: 36, borderRadius: 13 },
  authorAvatarFallback: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  authorAvatarText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "900" },
  authorName: { color: colors.onSurfaceInverse, fontSize: 11, fontWeight: "800" },
  authorUsername: { color: colors.onSurfaceInverse, opacity: 0.65, fontSize: 8, fontWeight: "700", marginTop: 1 },
  actionRail: { position: "absolute", right: 10, alignItems: "center", gap: 3 },
  categoryPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brandTertiary, borderRadius: 999, paddingLeft: 9, paddingRight: 2 },
  railButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  railLabel: { color: colors.onSurfaceInverse, fontSize: 9, fontWeight: "800", marginBottom: 7 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(31,28,24,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 24, maxHeight: 520 },
  sheetHandle: { width: 36, height: 4, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 13 },
  sheetTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", marginBottom: 11 },
  commentRow: { borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 10 },
  commentAuthor: { color: colors.onSurface, fontWeight: "800", fontSize: 10 },
  commentText: { color: colors.onSurfaceSecondary, fontSize: 11, marginTop: 3, lineHeight: 16 },
  emptySheet: { alignItems: "center", paddingVertical: 24, gap: 7 },
  emptySheetText: { color: colors.muted, textAlign: "center", lineHeight: 17, fontSize: 10 },
  rowInput: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  input: { minHeight: 46, borderRadius: 13, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.onSurface, fontSize: 12, marginBottom: 9 },
  flexInput: { flex: 1, marginBottom: 0 },
  sendButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  personRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 15, padding: 11, marginBottom: 7, borderWidth: 1, borderColor: colors.border, gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "900" },
  personName: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" },
  personMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  gateBackdrop: { flex: 1, backgroundColor: "rgba(18,14,11,0.72)", justifyContent: "center", alignItems: "center", padding: 28 },
  gateCard: { width: "100%", backgroundColor: colors.surface, borderRadius: 24, padding: 22, alignItems: "center" },
  gateIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  gateTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  gateText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginBottom: 18 },
  gateButton: { alignSelf: "stretch", minHeight: 50, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  gateButtonText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "900" },
  gateLater: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  gateLaterText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
}));
