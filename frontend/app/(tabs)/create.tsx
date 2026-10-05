import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createQuestion, uploadImage } from "@/src/api";
import { CATEGORY_DEFS } from "@/src/categories";
import { ToastView, useToast } from "@/src/components/toast";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { useRequireAccount } from "@/src/guest-guard";
import { usesNativeTabs } from "@/src/navigation";
import { DIFFICULTIES } from "@/src/ranks";
import { makeStyles, useTheme } from "@/src/theme";
import { ImageFlowError, pickCroppedImage } from "@/src/utils/image-upload";

const CATEGORIES = CATEGORY_DEFS;

const PRESET_BACKGROUNDS = [
  "https://customer-assets-m6fa6gv7.emergentagent.net/job_micro-genius-3/artifacts/93swrgde_beyaz%20soru%20arka%20plan%C4%B1.jpg",
  "https://customer-assets-m6fa6gv7.emergentagent.net/job_micro-genius-3/artifacts/nxhgxe1u_beyaz%20arka%20plan%202.jpg",
  "https://customer-assets-m6fa6gv7.emergentagent.net/job_micro-genius-3/artifacts/k47ixcce_siyah%20soru%20arka%20plan%C4%B1.jpg",
  "https://customer-assets-m6fa6gv7.emergentagent.net/job_micro-genius-3/artifacts/9xwi6mj9_siyah%20arka%20pla.jpg",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1080&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1080&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1080&auto=format&fit=crop",
];

export default function CreateScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useAuth();
  const requireAccount = useRequireAccount();
  const router = useRouter();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [category, setCategory] = useState("Genel Kültür");
  const [difficulty, setDifficulty] = useState<string>("kolay");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [background, setBackground] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.is_guest && !requireAccount(t("guest.question"))) router.replace("/(tabs)");
  }, [requireAccount, router, t, user?.is_guest]);

  const updateOption = (value: string, index: number) => setOptions((old) => old.map((item, i) => (i === index ? value : item)));

  const pickBackground = async () => {
    if (!requireAccount(t("guest.question"))) return;
    setUploading(true);
    try {
      const asset = await pickCroppedImage([9, 16]);
      const path = await uploadImage(asset.uri, asset.mimeType, asset.name);
      setBackground(path);
      setBackgroundPreview(asset.uri);
      toast.show(t("create.bgLoaded"));
    } catch (err) {
      if (err instanceof ImageFlowError && err.code === "permission") setPermDenied(true);
      else if (!(err instanceof ImageFlowError && err.code === "cancelled")) toast.show(t("create.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    if (!requireAccount(t("guest.question"))) return;
    if (!text.trim() || options.some((item) => !item.trim()) || !explanation.trim()) {
      toast.show(t("create.incomplete"));
      return;
    }
    setBusy(true);
    try {
      await createQuestion({ category, text: text.trim(), options: options.map((item) => item.trim()), correct_index: correct, explanation: explanation.trim(), difficulty, background });
      toast.show(t("create.published"));
      setText("");
      setOptions(["", "", "", ""]);
      setCorrect(0);
      setExplanation("");
      setDifficulty("kolay");
      setBackground(null);
      setBackgroundPreview(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen} testID="create-screen">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.headerTitle}>{t("create.title")}</Text>
          <Text style={styles.headerHint}>{t("create.hint")}</Text>
        </View>
        <Pressable testID="create-tip-button" onPress={() => toast.show(t("create.tip"))} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="bulb-outline" size={19} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: bottomChrome + 26 }]} bottomOffset={24}>
        <Text style={styles.sectionLabel}>{t("create.topic")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((item) => (
            <Pressable key={item.key} testID={`category-chip-${item.value}`} onPress={() => setCategory(item.value)} style={[styles.chip, styles.chipRowInner, category === item.value && styles.chipActive]}>
              <Ionicons name={item.icon} size={12} color={category === item.value ? colors.onBrandTertiary : colors.muted} />
              <Text style={[styles.chipText, category === item.value && styles.chipTextActive]}>{t(`cat.${item.key}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>{t("create.difficulty")}</Text>
        <View style={styles.chipRowWrap}>
          {DIFFICULTIES.map((item) => (
            <Pressable key={item.key} testID={`difficulty-chip-${item.key}`} onPress={() => setDifficulty(item.key)} style={[styles.chip, difficulty === item.key && styles.chipActive]}>
              <Text style={[styles.chipText, difficulty === item.key && styles.chipTextActive]}>{t(`diff.${item.key}`)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("create.questionLabel")}</Text>
        <Text style={styles.createHint}>{t("create.questionHint")}</Text>
        <TextInput testID="question-input" value={text} onChangeText={setText} placeholder={t("create.questionPlaceholder")} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.textArea]} />

        <Text style={styles.sectionLabel}>{t("create.options")}</Text>
        {options.map((item, index) => (
          <View key={index} style={styles.radioRow}>
            <Pressable testID={`correct-radio-${index}`} onPress={() => setCorrect(index)} style={styles.radioTouch} hitSlop={6}>
              <View style={[styles.radio, correct === index && styles.radioActive]}>
                {correct === index && <View style={styles.radioDot} />}
              </View>
            </Pressable>
            <TextInput testID={`option-input-${index}`} value={item} onChangeText={(value) => updateOption(value, index)} placeholder={t("create.optionPlaceholder", { letter: String.fromCharCode(65 + index) }) + (correct === index ? t("create.correctSuffix") : "")} placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, marginBottom: 0 }]} />
          </View>
        ))}

        <Text style={styles.sectionLabel}>{t("create.background")}</Text>
        <Text style={styles.createHint}>{t("create.backgroundHint")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable testID="background-none" onPress={() => { setBackground(null); setBackgroundPreview(null); }} style={[styles.bgTile, background === null && styles.bgTileActive]}>
            <View style={[styles.bgThumb, styles.bgNone]}><Ionicons name="color-palette-outline" size={18} color={colors.onSurfaceInverse} /></View>
            <Text style={styles.bgLabel}>{t("create.classic")}</Text>
          </Pressable>
          {PRESET_BACKGROUNDS.map((uri) => (
            <Pressable key={uri} testID={`background-preset-${PRESET_BACKGROUNDS.indexOf(uri)}`} onPress={() => { setBackground(uri); setBackgroundPreview(uri); }} style={[styles.bgTile, background === uri && styles.bgTileActive]}>
              <Image source={{ uri }} style={styles.bgThumb} contentFit="cover" />
            </Pressable>
          ))}
          <Pressable testID="background-upload-button" onPress={pickBackground} disabled={uploading} style={[styles.bgTile, background !== null && !PRESET_BACKGROUNDS.includes(background) && styles.bgTileActive]}>
            {backgroundPreview && background !== null && !PRESET_BACKGROUNDS.includes(background) ? (
              <Image source={{ uri: backgroundPreview }} style={styles.bgThumb} contentFit="cover" />
            ) : (
              <View style={[styles.bgThumb, styles.bgUpload]}>
                {uploading ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Ionicons name="image-outline" size={18} color={colors.brandPrimary} />}
              </View>
            )}
            <Text style={styles.bgLabel}>{uploading ? t("create.uploading") : t("create.upload")}</Text>
          </Pressable>
        </ScrollView>

        <Text style={styles.sectionLabel}>{t("create.explanation")}</Text>
        <TextInput testID="explanation-input" value={explanation} onChangeText={setExplanation} placeholder={t("create.explanationPlaceholder")} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.textArea]} />

        <Pressable testID="publish-question-button" disabled={busy} onPress={publish} style={({ pressed }) => [styles.primaryButton, { marginTop: 14 }, pressed && { opacity: 0.75 }, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("create.publish")}</Text>}
        </Pressable>
      </KeyboardAwareScrollView>

      <Modal visible={permDenied} transparent animationType="fade" onRequestClose={() => setPermDenied(false)}>
        <View style={styles.permBackdrop}>
          <View style={styles.permCard} testID="permission-card">
            <Ionicons name="images-outline" size={26} color={colors.brandPrimary} />
            <Text style={styles.permTitle}>{t("create.permTitle")}</Text>
            <Text style={styles.permText}>{t("create.permText")}</Text>
            <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={({ pressed }) => [styles.primaryButton, { alignSelf: "stretch" }, pressed && { opacity: 0.75 }]}>
              <Text style={styles.primaryButtonText}>{t("create.openSettings")}</Text>
            </Pressable>
            <Pressable testID="permission-cancel-button" onPress={() => setPermDenied(false)} style={styles.permCancel}>
              <Text style={styles.permCancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ToastView message={toast.message} bottom={bottomChrome + 24} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  headerHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  formScroll: { paddingHorizontal: 18, paddingTop: 2 },
  sectionLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "800", marginBottom: 8, marginTop: 14 },
  createHint: { color: colors.muted, lineHeight: 16, fontSize: 10, marginBottom: 6 },
  chipRow: { gap: 7, paddingRight: 18 },
  chipRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { flexShrink: 0, height: 36, justifyContent: "center", borderRadius: 999, paddingHorizontal: 13, backgroundColor: colors.surfaceSecondary },
  chipRowInner: { flexDirection: "row", alignItems: "center", gap: 5 },
  chipActive: { backgroundColor: colors.brandTertiary },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  chipTextActive: { color: colors.onBrandTertiary },
  input: { minHeight: 46, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.onSurface, fontSize: 12, marginBottom: 8 },
  textArea: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 7 },
  radioTouch: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brandPrimary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brandPrimary },
  bgTile: { alignItems: "center", gap: 5, borderRadius: 14, padding: 4, borderWidth: 2, borderColor: "transparent" },
  bgTileActive: { borderColor: colors.brandPrimary },
  bgThumb: { width: 62, height: 88, borderRadius: 11, overflow: "hidden" },
  bgNone: { backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  bgUpload: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  bgLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  permBackdrop: { flex: 1, backgroundColor: "rgba(31,28,24,0.45)", justifyContent: "center", padding: 28 },
  permCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, alignItems: "center", gap: 8 },
  permTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  permText: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", marginBottom: 6 },
  permCancel: { minHeight: 44, justifyContent: "center" },
  permCancelText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
}));
