import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";

type Labels = { current: string; longest: string; close: string };

export function StreakMark({ size = 30 }: { size?: number }) {
  const { scheme } = useTheme();
  return <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.22 }]}>
    <Image source={scheme === "dark" ? require("../../assets/images/streak-dark.png") : require("../../assets/images/streak-light.png")} contentFit="contain" style={StyleSheet.absoluteFill} />
  </View>;
}

export function StreakCalendar({ visible, onClose, streak, longest, completedDates, locale, labels }: { visible: boolean; onClose: () => void; streak: number; longest: number; completedDates: string[]; locale: string; labels: Labels }) {
  const { colors } = useTheme();
  const now = new Date();
  const months = [-1, 0, 1].map((offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1));
  const completed = new Set(completedDates);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]} testID="streak-calendar">
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        <View style={styles.stats}><StreakMark size={32} /><Text style={[styles.statText, { color: colors.onSurface }]}>{labels.current}: {streak}</Text><Text style={[styles.statText, { color: colors.onSurface }]}>{labels.longest}: {longest}</Text></View>
        {months.map((month, index) => <Month key={month.toISOString()} month={month} completed={completed} locale={locale} faded={index !== 1} colors={colors} />)}
        <Pressable testID="streak-calendar-close" onPress={onClose} style={styles.close}><Text style={[styles.closeText, { color: colors.muted }]}>{labels.close}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

function Month({ month, completed, locale, faded, colors }: { month: Date; completed: Set<string>; locale: string; faded: boolean; colors: ReturnType<typeof useTheme>["colors"] }) {
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  return <View style={[styles.month, { borderTopColor: colors.divider }, faded && styles.faded]}>
    <Text style={[styles.monthTitle, { color: colors.onSurface }]}>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}</Text>
    <View style={styles.grid}>{Array.from({ length: leading + days }).map((_, index) => {
      const day = index - leading + 1;
      if (day < 1) return <View key={`empty-${index}`} style={styles.day} />;
      const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const complete = completed.has(iso);
      return <View key={iso} style={[styles.day, complete && styles.completeDay]}><Text style={[styles.dayText, { color: colors.onSurfaceSecondary }, complete && styles.completeDayText]}>{day}</Text></View>;
    })}</View>
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(18,14,11,0.48)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 24 },
  handle: { width: 36, height: 4, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)", alignSelf: "center", marginBottom: 14 },
  mark: { overflow: "hidden" },
  stats: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  statText: { fontSize: 11, fontWeight: "800" },
  month: { borderTopWidth: 1, paddingTop: 10, marginTop: 8 },
  faded: { opacity: 0.45 },
  monthTitle: { fontSize: 12, fontWeight: "900", marginBottom: 8, textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 10, fontWeight: "700", width: 23, height: 23, textAlign: "center", textAlignVertical: "center", includeFontPadding: false, lineHeight: 23 },
  completeDay: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  completeDayText: { backgroundColor: "#FF6B4A", borderRadius: 12, color: "#FFFFFF", fontWeight: "900" },
  close: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 8 },
  closeText: { fontSize: 12, fontWeight: "800" },
});