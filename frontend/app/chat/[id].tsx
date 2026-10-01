import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchMessages, sendMessage, type Message } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ToastView, useToast } from "@/src/components/toast";
import { useI18n } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

export default function ConversationScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    fetchMessages(id).then(setMessages).catch(() => setMessages([]));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!id || !text.trim()) return;
    try {
      const item = await sendMessage(id, text.trim());
      setMessages((old) => [...old, item]);
      setText("");
    } catch {
      toast.show(t("conv.failed"));
    }
  };

  if (!user) return null;

  return (
    <View style={styles.screen} testID="conversation-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="chat-back-button" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="arrow-back" size={19} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 11 }}>
          <Text style={styles.headerTitle} testID="conversation-title">{name || t("tabs.chat")}</Text>
          <Text style={styles.headerHint}>{t("conv.partner")}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="translate-with-padding" keyboardVerticalOffset={16}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 14 }}>
          {messages.map((item) => (
            <View key={item.message_id} style={[styles.messageBubble, item.sender_id === user.user_id && styles.messageMine]} testID={`message-${item.message_id}`}>
              {!!item.question_id && (
                <View style={styles.questionChip}>
                  <Ionicons name="help-circle-outline" size={12} color={colors.onBrandTertiary} />
                  <Text style={styles.questionChipText}>{t("conv.questionShare")}</Text>
                </View>
              )}
              <Text style={[styles.messageText, item.sender_id === user.user_id && { color: colors.onBrandTertiary }]}>{item.text}</Text>
              <Text style={[styles.messageTime, item.sender_id === user.user_id && { color: colors.onBrandTertiary, opacity: 0.7 }]}>{item.created_at.slice(11, 16)}</Text>
            </View>
          ))}
          {!messages.length && (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={30} color={colors.muted} />
              <Text style={styles.emptyTitle}>{t("conv.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("conv.emptyText")}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 9 }]}>
          <TextInput testID="message-input" value={text} onChangeText={setText} placeholder={t("conv.placeholder")} placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} />
          <Pressable testID="send-message-button" onPress={send} style={({ pressed }) => [styles.sendButton, pressed && { opacity: 0.75 }]}>
            <Ionicons name="arrow-up" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ToastView message={toast.message} bottom={insets.bottom + 24} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 14, paddingBottom: 9, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: -0.3 },
  headerHint: { color: colors.muted, fontSize: 9, marginTop: 2 },
  messageBubble: { maxWidth: "82%", borderRadius: 16, padding: 10, marginBottom: 7, backgroundColor: colors.surfaceSecondary, alignSelf: "flex-start" },
  messageMine: { alignSelf: "flex-end", backgroundColor: colors.brandTertiary },
  questionChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,107,74,0.14)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 5 },
  questionChipText: { color: colors.onBrandTertiary, fontSize: 9, fontWeight: "800" },
  messageText: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 16 },
  messageTime: { color: colors.muted, fontSize: 8, marginTop: 3 },
  empty: { alignItems: "center", paddingVertical: 44, paddingHorizontal: 24 },
  emptyTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 10 },
  emptyText: { color: colors.muted, textAlign: "center", lineHeight: 17, marginTop: 5, fontSize: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  input: { minHeight: 44, borderRadius: 13, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.onSurface, fontSize: 12 },
  sendButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
