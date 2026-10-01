import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { updateProfile } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ToastView, useToast } from "@/src/components/toast";
import { LANG_NAMES, SUPPORTED_LANGS, useI18n, type Lang } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors, scheme, setScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim() || undefined, username: username.trim() || undefined });
      setUser(updated);
      setName(updated.name);
      setUsername(updated.username);
      toast.show(t("settings.saved"));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="settings-back-button" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="arrow-back" size={19} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 26 }]} bottomOffset={24}>
        <Text style={styles.sectionLabel}>{t("settings.profileSection")}</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t("settings.name")}</Text>
          <TextInput testID="edit-name-input" value={name} onChangeText={setName} placeholder={t("settings.name")} placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.fieldLabel}>{t("settings.username")}</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput testID="edit-username-input" value={username} onChangeText={setUsername} placeholder={t("settings.username")} placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input, { flex: 1, marginBottom: 0 }]} />
          </View>
          <Pressable testID="save-profile-button" disabled={saving} onPress={save} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.75 }, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("settings.saveProfile")}</Text>}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t("settings.theme")}</Text>
        <View style={styles.themeRow}>
          <Pressable testID="theme-light-option" onPress={() => setScheme("light")} style={[styles.themeOption, scheme === "light" && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="sunny-outline" size={18} color={scheme === "light" ? colors.onBrandTertiary : colors.muted} />
            <Text style={[styles.themeText, { color: scheme === "light" ? colors.onBrandTertiary : colors.muted }]}>{t("settings.themeLight")}</Text>
          </Pressable>
          <Pressable testID="theme-dark-option" onPress={() => setScheme("dark")} style={[styles.themeOption, scheme === "dark" && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="moon-outline" size={18} color={scheme === "dark" ? colors.onBrandTertiary : colors.muted} />
            <Text style={[styles.themeText, { color: scheme === "dark" ? colors.onBrandTertiary : colors.muted }]}>{t("settings.themeDark")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t("settings.languageSection")}</Text>
        <Text style={styles.hint}>{t("settings.languageHint")}</Text>
        <View style={styles.card}>
          {SUPPORTED_LANGS.map((item: Lang, index: number) => (
            <Pressable
              key={item}
              testID={`lang-option-${item}`}
              onPress={() => setLang(item)}
              style={({ pressed }) => [
                styles.langRow,
                index < SUPPORTED_LANGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.langName}>{LANG_NAMES[item]}</Text>
              <View style={[styles.radio, lang === item && styles.radioActive]}>
                {lang === item && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>
      </KeyboardAwareScrollView>

      <ToastView message={toast.message} bottom={insets.bottom + 24} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 14, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  content: { paddingHorizontal: 18, paddingTop: 6 },
  sectionLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "800", marginBottom: 8, marginTop: 16 },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 6, marginTop: 4 },
  input: { minHeight: 46, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.onSurface, fontSize: 12, marginBottom: 10 },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  atSign: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  primaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  themeRow: { flexDirection: "row", gap: 10 },
  themeOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 15, backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.border },
  themeText: { fontSize: 12, fontWeight: "800" },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46 },
  langName: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brandPrimary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brandPrimary },
}));
