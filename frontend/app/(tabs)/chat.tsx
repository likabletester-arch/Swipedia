import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchConversations, fetchPeople, type Conversation, type Person } from "@/src/api";
import { UserAvatar } from "@/src/components/user-avatar";
import { useI18n } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function ChatInboxScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [people, setPeople] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextPeople, nextConversations] = await Promise.all([fetchPeople(), fetchConversations()]);
      setPeople(nextPeople);
      setConversations(nextConversations);
    } catch {
      setPeople([]);
      setConversations([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openChat = (id: string, name: string) => router.push({ pathname: "/chat/[id]", params: { id, name } });

  return (
    <View style={styles.screen} testID="chat-inbox-screen">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.headerTitle}>{t("chat.title")}</Text>
          <Text style={styles.headerHint}>{t("chat.hint")}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomChrome + 26 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {conversations.map((item) => {
          const person = people.find((p) => item.participants.includes(p.user_id));
          return (
            <Pressable key={item.participants.join("-")} testID={`conversation-row-${item.other_name}`} onPress={() => person && openChat(person.user_id, person.name)} style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.75 }]}>
              <UserAvatar avatar={person?.avatar} name={item.other_name || "?"} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listName}>{item.other_name}</Text>
                <Text style={styles.listMeta} numberOfLines={1}>{item.last_message}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          );
        })}

        <Text style={styles.sectionLabel}>{t("chat.partners")}</Text>
        {people.map((person) => (
          <Pressable key={person.user_id} testID={`person-row-${person.user_id}`} onPress={() => openChat(person.user_id, person.name)} style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.75 }]}>
            <UserAvatar avatar={person.avatar} name={person.name} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listName}>{person.name}</Text>
              <Text style={styles.listMeta} numberOfLines={1}>{person.bio || t("chat.newPartner")}</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={16} color={colors.brandPrimary} />
          </Pressable>
        ))}

        {!people.length && !conversations.length && (
          <View style={styles.empty} testID="chat-empty-state">
            <Ionicons name="people-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyTitle}>{t("chat.emptyTitle")}</Text>
            <Text style={styles.emptyText}>{t("chat.emptyText")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 18, paddingBottom: 10 },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  headerHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  listContent: { paddingHorizontal: 18 },
  sectionLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "800", marginBottom: 9, marginTop: 13 },
  listCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 17, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "900" },
  listName: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" },
  listMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 44, paddingHorizontal: 24 },
  emptyTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 10 },
  emptyText: { color: colors.muted, textAlign: "center", lineHeight: 17, marginTop: 5, fontSize: 10 },
}));
