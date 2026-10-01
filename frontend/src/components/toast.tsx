import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);
  return { message, show };
}

export function ToastView({ message, bottom = 24 }: { message: string | null; bottom?: number }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, { bottom, backgroundColor: colors.surfaceInverse }]} testID="toast-message">
      <Text style={[styles.text, { color: colors.onSurfaceInverse }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: "86%",
  },
  text: { fontSize: 13, fontWeight: "800", textAlign: "center" },
});
