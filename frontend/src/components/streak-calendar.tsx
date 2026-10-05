import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Labels = { current: string; longest: string; close: string };

export function StreakMark({ size = 30 }: { size?: number }) {
  const scale = size / 30;
  return <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}>
    <View style={[styles.orbit, { width: size * 0.76, height: size * 0.76, borderRadius: size * 0.38 }]} />
    <Ionicons name="calendar-outline" size={18 * scale} color="#FFFFFF" />
    <Ionicons name="sparkles" size={10 * scale} color="#FFFFFF" style={styles.sparkle} />
  </View>;
}

export function StreakCalendar({ visible, onClose, streak, longest, completedDates, locale, labels }: { visible: boolean; onClose: () => void; streak: number; longest: number; completedDates: string[]; locale: string; labels: Labels }) {
  const now = new Date();
  const months = [-1, 0, 1].map((offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1));
  const completed = new Set(completedDates);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet} testID="streak-calendar">
        <View style={styles.handle} />
        <View style={styles.stats}><StreakMark size={32} /><Text style={styles.statText}>{labels.current}: {streak}</Text><Text style={styles.statText}>{labels.longest}: {longest}</Text></View>
        {months.map((month, index) => <Month key={month.toISOString()} month={month} completed={completed} locale={locale} faded={index !== 1} />)}
        <Pressable testID="streak-calendar-close" onPress={onClose} style={styles.close}><Text style={styles.closeText}>{labels.close}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

function Month({ month, completed, locale, faded }: { month: Date; completed: Set<string>; locale: string; faded: boolean }) {
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  return <View style={[styles.month, faded && styles.faded]}>
    <Text style={styles.monthTitle}>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}</Text>
    <View style={styles.grid}>{Array.from({ length: leading + days }).map((_, index) => {
      const day = index - leading + 1;
      if (day < 1) return <View key={`empty-${index}`} style={styles.day} />;
      const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return <View key={iso} style={styles.day}><Text style={styles.dayText}>{day}</Text>{completed.has(iso) && <View style={styles.dot}><Ionicons name="sparkles" size={8} color="#FFFFFF" /></View>}</View>;
    })}</View>
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(18,14,11,0.48)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#1F1C18", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 24 },
  handle: { width: 36, height: 4, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)", alignSelf: "center", marginBottom: 14 },
  mark: { backgroundColor: "#FF6B4A", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  orbit: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)" },
  sparkle: { position: "absolute" },
  stats: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  statText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  month: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", paddingTop: 10, marginTop: 8 },
  faded: { opacity: 0.45 },
  monthTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", marginBottom: 8, textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayText: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "700" },
  dot: { position: "absolute", bottom: 2, width: 15, height: 15, borderRadius: 5, backgroundColor: "#FF6B4A", alignItems: "center", justifyContent: "center" },
  close: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 8 },
  closeText: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "800" },
});