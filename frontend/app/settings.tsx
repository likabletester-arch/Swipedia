import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView, KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { changePassword, confirmContactChange, requestContactChangeCode, updateProfile, uploadImage } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ToastView, useToast } from "@/src/components/toast";
import { UserAvatar } from "@/src/components/user-avatar";
import { LANG_NAMES, SUPPORTED_LANGS, useI18n, type Lang } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

type ChangeMode = "email" | "phone" | "password" | null;

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
  const [uploading, setUploading] = useState(false);

  const [mode, setMode] = useState<ChangeMode>(null);
  const [step, setStep] = useState<"input" | "code">("input");
  const [newValue, setNewValue] = useState("");
  const [code, setCode] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState("");

  if (!user) return null;
  const isGuest = !!user.is_guest;

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

  const pickPhoto = async () => {
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (permission.status !== "granted") {
      Alert.alert(t("create.permTitle"), t("create.permText"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("create.openSettings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const path = await uploadImage(result.assets[0].uri, result.assets[0].mimeType);
      const updated = await updateProfile({ avatar: path });
      setUser(updated);
      toast.show(t("settings.photoUpdated"));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t("create.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const openChange = (next: Exclude<ChangeMode, null>) => {
    setMode(next);
    setStep("input");
    setNewValue(next === "email" ? user.email : next === "phone" ? (user.phone ?? "") : "");
    setCode("");
    setCurrentPw("");
    setNewPw("");
    setChangeError("");
  };

  const closeChange = () => setMode(null);

  const sendCode = async () => {
    if (mode !== "email" && mode !== "phone") return;
    setChangeBusy(true);
    setChangeError("");
    try {
      await requestContactChangeCode(mode, newValue.trim());
      setStep("code");
      toast.show(t("settings.codeSentTo", { email: user.email }));
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setChangeBusy(false);
    }
  };

  const confirmChange = async () => {
    if (mode !== "email" && mode !== "phone") return;
    setChangeBusy(true);
    setChangeError("");
    try {
      const updated = await confirmContactChange(mode, code.trim());
      setUser(updated);
      closeChange();
      toast.show(t("settings.changed"));
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setChangeBusy(false);
    }
  };

  const submitPassword = async () => {
    if (newPw.trim().length < 6) {
      setChangeError(t("settings.passwordMismatch"));
      return;
    }
    setChangeBusy(true);
    setChangeError("");
    try {
      await changePassword(currentPw, newPw);
      closeChange();
      toast.show(t("settings.passwordChanged"));
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setChangeBusy(false);
    }
  };

  const modalTitle = mode === "email" ? t("settings.changeEmailTitle") : mode === "phone" ? t("settings.changePhoneTitle") : t("settings.changePasswordTitle");

  return (
    <View style={styles.screen} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="settings-back-button" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="arrow-back" size={19} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 26 }]} bottomOffset={24}>
        {/* Profil fotoğrafı */}
        <Text style={styles.sectionLabel}>{t("settings.photo")}</Text>
        <View style={[styles.card, styles.photoCard]}>
          <UserAvatar avatar={user.avatar} name={user.name} size={72} radius={24} />
          <View style={{ flex: 1 }}>
            <Text style={styles.photoName}>{user.name}</Text>
            <Pressable testID="change-photo-button" disabled={uploading} onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, pressed && { opacity: 0.75 }]}>
              {uploading ? <ActivityIndicator color={colors.onBrandTertiary} size="small" /> : (
                <>
                  <Ionicons name="camera-outline" size={15} color={colors.onBrandTertiary} />
                  <Text style={styles.photoButtonText}>{t("settings.changePhoto")}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Hesap bilgileri */}
        <Text style={styles.sectionLabel}>{t("settings.accountSection")}</Text>
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

        {/* Güvenlik / doğrulamalı değişiklikler */}
        <Text style={styles.sectionLabel}>{t("settings.securitySection")}</Text>
        {isGuest ? (
          <View style={styles.card}>
            <Text style={styles.guestNotice}>{t("settings.guestNotice")}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <InfoRow testID="change-email-row" icon="mail-outline" label={t("settings.email")} value={user.email || t("settings.notSet")} action={t("settings.change")} onPress={() => openChange("email")} styles={styles} colors={colors} />
            <View style={styles.rowDivider} />
            <InfoRow testID="change-phone-row" icon="call-outline" label={t("settings.phone")} value={user.phone || t("settings.notSet")} action={t("settings.change")} onPress={() => openChange("phone")} styles={styles} colors={colors} />
            <View style={styles.rowDivider} />
            <InfoRow testID="change-password-row" icon="lock-closed-outline" label={t("settings.password")} value="••••••••" action={t("settings.change")} onPress={() => openChange("password")} styles={styles} colors={colors} />
          </View>
        )}

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

        <View style={styles.legalLinks}>
          <Pressable testID="settings-terms-link" onPress={() => router.push("/legal?doc=terms")}><Text style={styles.legalLink}>{t("legal.terms")}</Text></Pressable>
          <Text style={styles.legalSep}>|</Text>
          <Pressable testID="settings-privacy-link" onPress={() => router.push("/legal?doc=privacy")}><Text style={styles.legalLink}>{t("legal.privacy")}</Text></Pressable>
        </View>
      </KeyboardAwareScrollView>

      {/* Değişiklik modalı */}
      <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={closeChange}>
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={closeChange} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.sheet} testID="change-sheet">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{modalTitle}</Text>

              {mode === "password" ? (
                <>
                  <TextInput testID="current-password-input" value={currentPw} onChangeText={setCurrentPw} placeholder={t("settings.currentPassword")} placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
                  <TextInput testID="new-password-input" value={newPw} onChangeText={setNewPw} placeholder={t("settings.newPassword")} placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
                  {!!changeError && <Text style={styles.changeError}>{changeError}</Text>}
                  <Pressable testID="submit-password-button" disabled={changeBusy} onPress={submitPassword} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.75 }, changeBusy && { opacity: 0.6 }]}>
                    {changeBusy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("settings.save")}</Text>}
                  </Pressable>
                </>
              ) : step === "input" ? (
                <>
                  <Text style={styles.verifyHint}>{t("settings.verifyHint", { email: user.email })}</Text>
                  <TextInput
                    testID="change-value-input"
                    value={newValue}
                    onChangeText={setNewValue}
                    placeholder={mode === "email" ? t("settings.newEmail") : t("settings.newPhone")}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType={mode === "email" ? "email-address" : "phone-pad"}
                    style={styles.input}
                  />
                  {!!changeError && <Text style={styles.changeError}>{changeError}</Text>}
                  <Pressable testID="send-change-code-button" disabled={changeBusy} onPress={sendCode} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.75 }, changeBusy && { opacity: 0.6 }]}>
                    {changeBusy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("settings.sendCode")}</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.verifyHint}>{t("settings.enterCode")}</Text>
                  <TextInput testID="change-code-input" value={code} onChangeText={setCode} placeholder={t("settings.enterCode")} placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} style={[styles.input, { textAlign: "center", letterSpacing: 8, fontSize: 18 }]} />
                  {!!changeError && <Text style={styles.changeError}>{changeError}</Text>}
                  <Pressable testID="confirm-change-button" disabled={changeBusy} onPress={confirmChange} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.75 }, changeBusy && { opacity: 0.6 }]}>
                    {changeBusy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("settings.confirm")}</Text>}
                  </Pressable>
                  <Pressable testID="resend-change-code-button" onPress={sendCode} disabled={changeBusy} style={styles.resendButton}>
                    <Text style={styles.resendText}>{t("auth.resend")}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ToastView message={toast.message} bottom={insets.bottom + 24} />
    </View>
  );
}

function InfoRow({ testID, icon, label, value, action, onPress, styles, colors }: {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  action: string;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={16} color={colors.onSurfaceSecondary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.changeChip, pressed && { opacity: 0.7 }]}>
        <Text style={styles.changeChipText}>{action}</Text>
      </Pressable>
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
  photoCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  photoName: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginBottom: 9 },
  photoButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, minHeight: 38, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.brandTertiary },
  photoButtonText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "800" },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 6, marginTop: 4 },
  input: { minHeight: 46, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.onSurface, fontSize: 12, marginBottom: 10 },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  atSign: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  primaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  guestNotice: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 4 },
  infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  infoValue: { color: colors.onSurface, fontSize: 12, fontWeight: "700", marginTop: 2 },
  changeChip: { minHeight: 34, paddingHorizontal: 13, borderRadius: 11, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  changeChipText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "800" },
  rowDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  themeRow: { flexDirection: "row", gap: 10 },
  themeOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 15, backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.border },
  themeText: { fontSize: 12, fontWeight: "800" },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46 },
  langName: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brandPrimary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brandPrimary },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(31,28,24,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 28 },
  sheetHandle: { width: 36, height: 4, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 13 },
  sheetTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", marginBottom: 12 },
  verifyHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 11 },
  changeError: { color: colors.error, fontSize: 10, marginBottom: 8 },
  resendButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 4 },
  resendText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800" },
  legalLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
  legalLink: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "600" },
  legalSep: { color: colors.muted, fontSize: 11 },
}));
