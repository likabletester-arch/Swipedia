import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/src/i18n";
import { getLegal } from "@/src/legal";
import { makeStyles, useTheme } from "@/src/theme";

export default function LegalScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useI18n();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc = params.doc === "privacy" ? "privacy" : "terms";
  const content = getLegal(doc, lang);

  return (
    <View style={styles.screen} testID="legal-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="legal-back-button" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
          <Ionicons name="arrow-back" size={19} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{content.title}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
        {!!content.updated && <Text style={styles.updated}>{content.updated}</Text>}
        {content.sections.map((section) => (
          <View key={section.t} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.t}</Text>
            <Text style={styles.sectionBody}>{section.b}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 14, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 12 },
  updated: { color: colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  sectionBody: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 19 },
}));
