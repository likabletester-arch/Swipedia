import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchPeople, type Person, type Question } from "@/src/api";
import { categoryIcon } from "@/src/categories";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

export function SearchPanel({ questions, onClose }: { questions: Question[]; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    fetchPeople().then(setPeople).catch(() => setPeople([]));
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
          <Text style={styles.hint}>{t("search.hint")}</Text>
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

const useStyles = makeStyles((colors) => StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 14, paddingHorizontal: 14, height: 48, marginRight: 46, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "600", padding: 0 },
  hint: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 40 },
  section: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  userName: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  userBio: { color: colors.muted, fontSize: 11, marginTop: 2 },
  qRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  qIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  qText: { color: colors.onSurface, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  qMeta: { color: colors.muted, fontSize: 10, fontWeight: "600", marginTop: 3 },
}));
