import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Dimensions, Modal, Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/theme";

export type Rect = { x: number; y: number; width: number; height: number };

// Tetikleyici konumundan tam ekrana doğru yumuşakça genişleyen overlay.
export function ExpandingOverlay({ fromRect, onClose, children }: { fromRect: Rect; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const { width: W, height: H } = Dimensions.get("window");
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [p]);

  const close = () => {
    p.value = withTiming(0, { duration: 230, easing: Easing.in(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(onClose)();
    });
  };

  const containerStyle = useAnimatedStyle(() => ({
    left: interpolate(p.value, [0, 1], [fromRect.x, 0]),
    top: interpolate(p.value, [0, 1], [fromRect.y, 0]),
    width: interpolate(p.value, [0, 1], [fromRect.width, W]),
    height: interpolate(p.value, [0, 1], [fromRect.height, H]),
    borderRadius: interpolate(p.value, [0, 1], [18, 0]),
    opacity: interpolate(p.value, [0, 0.12, 1], [0, 1, 1]),
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0, 0.5]) }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.3, 1], [0, 1]) }));

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.container, { backgroundColor: colors.surface }, containerStyle]}>
        <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
        <Pressable onPress={close} hitSlop={12} testID="overlay-close" style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="close" size={20} color={colors.onSurface} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "#000" },
  container: { position: "absolute", overflow: "hidden" },
  content: { flex: 1 },
  closeBtn: { position: "absolute", top: 50, right: 16, width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", zIndex: 20 },
});
