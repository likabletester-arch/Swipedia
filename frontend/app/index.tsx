import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";

import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";

// Açılış animasyonu: logo belirir → marka rengi tüm ekranı kaplar →
// kaplanmış ekran kendi içine çöker → giriş/ana sayfaya yönlendirme.
export default function Index() {
  const { user, ready } = useAuth();
  const { colors } = useTheme();
  const [done, setDone] = useState(false);

  const logoScale = useSharedValue(0.35);
  const logoOpacity = useSharedValue(0);
  const circleScale = useSharedValue(0);
  const coverScale = useSharedValue(1);
  const coverOpacity = useSharedValue(1);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 240 });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 170 });
    textOpacity.value = withDelay(220, withTiming(1, { duration: 280 }));
    circleScale.value = withDelay(300, withTiming(32, { duration: 640, easing: Easing.out(Easing.cubic) }));
    coverScale.value = withDelay(1300, withTiming(0, { duration: 470, easing: Easing.in(Easing.cubic) }));
    coverOpacity.value = withDelay(1630, withTiming(0, { duration: 170 }));
    const timer = setTimeout(() => setDone(true), 1860);
    return () => clearTimeout(timer);
  }, [logoScale, logoOpacity, circleScale, coverScale, coverOpacity, textOpacity]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: circleScale.value }] }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.value, transform: [{ scale: coverScale.value }] }));

  if (done && ready) {
    return <Redirect href={user ? "/(tabs)" : "/login"} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]} testID="app-splash">
      <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
        <Animated.View style={[styles.circle, { backgroundColor: colors.brandPrimary }, circleStyle]} />
        <View style={styles.center}>
          <Animated.View style={[styles.logoMark, { backgroundColor: colors.surfaceInverse }, logoStyle]}>
            <Ionicons name="sparkles" size={34} color={colors.brandPrimary} />
          </Animated.View>
          <Animated.Text style={[styles.logoText, { color: colors.onSurfaceInverse }, textStyle]}>Swipedia</Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  circle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 120,
    height: 120,
    marginTop: -60,
    marginLeft: -60,
    borderRadius: 60,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 12,
  },
  logoText: { fontSize: 26, fontWeight: "900", letterSpacing: -1 },
});
