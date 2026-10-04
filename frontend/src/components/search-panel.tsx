import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchFeed, fetchPeople, fileUrl, type Person, type Question } from "@/src/api";
import { categoryIcon } from "@/src/categories";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

export function SearchPanel({ questions, onClose, onQuestionOpen }: { questions: Question[]; onClose: () => void; onQuestionOpen: (question: Question) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [discover, setDiscover] = useState<Question[]>([]);

  useEffect(() => {
    fetchPeople().then(setPeople).catch(() => setPeople([]));
    fetchFeed(12).then(setDiscover).catch(() => setDiscover([]));
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  const q = query.trim().toLowerCase();
  const userResults = useMemo(() => (q ? people.filter((p) => p.name?.toLowerCase().includes(q) || p.bio?.toLowerCase().includes(q)).slice(0, 20) : []), [q, people]);
  const questionResults = useMemo(() => (q ? questions.filter((item) => item.text?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q)).slice(0, 30) : []), [q, questions]);

  const goUser = (userId: string) => { onClose(); router.push(`/user/${userId}`); };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]} testID="search-panel">
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder={t("search.inputPlaceholder")}
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {!q ? (
          <View testID="search-discover-section">
            <Text style={styles.discoverTitle}>{t("discover.title")}</Text>
            <Text style={styles.discoverSub}>{t("discover.subtitle")}</Text>
            {discover.length ? discover.map((item) => <DiscoverCard key={item.question_id} question={item} onPress={() => onQuestionOpen(item)} />) : (
              <View testID="search-discover-empty" style={styles.discoverEmpty}>
                <Ionicons name="sparkles-outline" size={28} color={colors.muted} />
                <Text style={styles.hint}>{t("discover.empty")}</Text>
              </View>
            )}
          </View>
        ) : userResults.length === 0 && questionResults.length === 0 ? (
          <Text style={styles.hint}>{t("search.empty")}</Text>
        ) : (
          <>
            {userResults.length > 0 && (
              <>
                <Text style={styles.section}>{t("search.users")}</Text>
                {userResults.map((p) => (
                  <TouchableOpacity key={p.user_id} testID={`search-user-${p.user_id}`} onPress={() => goUser(p.user_id)} style={styles.userRow}>
                    <UserAvatar avatar={p.avatar} name={p.name} size={40} radius={14} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName} numberOfLines={1}>{p.name}</Text>
                      {!!p.bio && <Text style={styles.userBio} numberOfLines={1}>{p.bio}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </TouchableOpacity>
                ))}
              </>
            )}
            {questionResults.length > 0 && (
              <>
                <Text style={styles.section}>{t("search.questions")}</Text>
                {questionResults.map((item) => (
                  <TouchableOpacity key={item.question_id} testID={`search-question-${item.question_id}`} onPress={() => goUser(item.author_id)} style={styles.qRow}>
                    <View style={[styles.qIcon, { backgroundColor: colors.brandTertiary }]}>
                      <Ionicons name={categoryIcon(item.category)} size={14} color={colors.onBrandTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qText} numberOfLines={2}>{item.text}</Text>
                      <Text style={styles.qMeta} numberOfLines={1}>{item.category} · {item.author_name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DiscoverCard({ question, onPress }: { question: Question; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    let alive = true;
    if (!question.background) return;
    const load = question.background.startsWith("http") ? Promise.resolve(question.background) : fileUrl(question.background);
    load.then((value) => { if (alive) setUri(value); }).catch(() => { if (alive) setUri(null); });
    return () => { alive = false; };
  }, [question.background]);

  return (
    <Pressable testID={`discover-card-${question.question_id}`} onPress={onPress} style={({ pressed }) => [styles.discoverCard, { aspectRatio: ratio }, pressed && { opacity: 0.9 }]}> 
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} onLoad={(event) => {
        const source = event.source;
        if (source?.width && source?.height) setRatio(source.width / source.height);
      }} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]} />}
      <LinearGradient colors={["transparent", "rgba(18,14,11,0.76)"]} locations={[0.42, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.discoverCopy}>
        <Text style={styles.discoverCategory}>{question.category}</Text>
        <Text style={styles.discoverQuestion} numberOfLines={4}>{question.text}</Text>
        <Text style={styles.discoverAuthor} numberOfLines={1}>{question.author_name}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 14, paddingHorizontal: 14, height: 48, marginRight: 46, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "600", padding: 0 },
  hint: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 40 },
  discoverTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900", marginTop: 24 },
  discoverSub: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 16 },
  discoverCard: { width: "100%", borderRadius: 18, overflow: "hidden", backgroundColor: colors.surfaceSecondary, marginBottom: 14, justifyContent: "flex-end", borderWidth: 1, borderColor: colors.border },
  discoverCopy: { padding: 16 },
  discoverCategory: { color: colors.brandSecondary, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 5 },
  discoverQuestion: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", lineHeight: 22, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  discoverAuthor: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "700", marginTop: 7 },
  discoverEmpty: { alignItems: "center", paddingVertical: 38 },
  section: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  userName: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  userBio: { color: colors.muted, fontSize: 11, marginTop: 2 },
  qRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  qIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  qText: { color: colors.onSurface, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  qMeta: { color: colors.muted, fontSize: 10, fontWeight: "600", marginTop: 3 },
}));
