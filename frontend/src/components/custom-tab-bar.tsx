import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/src/i18n";
import { useTheme } from "@/src/theme";

type Item = { name: string; labelKey: string; icon: keyof typeof Ionicons.glyphMap };

// Sol: Rütbeler + Oluştur · Orta: Keşfet (%25 büyük) · Sağ: Mesaj + Profil
const ITEMS: Item[] = [
  { name: "ranks", labelKey: "tabs.ranks", icon: "trophy-outline" },
  { name: "create", labelKey: "tabs.create", icon: "add-circle-outline" },
  { name: "index", labelKey: "tabs.explore", icon: "compass" },
  { name: "chat", labelKey: "tabs.chat", icon: "chatbubble-ellipses-outline" },
  { name: "profile", labelKey: "tabs.profile", icon: "person-outline" },
];

function AnimatedIcon({ name, color, size, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number; focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.12, { duration: 60 }),
        withTiming(1, { duration: 60 })
      );
    }
  }, [focused, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          paddingBottom: Platform.OS === "web" ? 0 : insets.bottom,
          height: Platform.OS === "web" ? 64 : 62 + insets.bottom,
        },
      ]}
      testID="custom-tab-bar"
    >
      {ITEMS.map((item) => {
        const routeIndex = state.routes.findIndex((route) => route.name === item.name);
        const focused = state.index === routeIndex;
        const color = focused ? colors.brandPrimary : colors.muted;
        const onPress = () => {
          const route = state.routes[routeIndex];
          if (!route) return;
          if (!focused) navigation.navigate(route.name);
        };

        if (item.name === "index") {
          return (
            <Pressable key={item.name} testID="tab-kesfet" onPress={onPress} style={({ pressed }) => [styles.centerSlot, pressed && { opacity: 0.85 }]}>
              <View style={[styles.centerButton, { backgroundColor: colors.brandPrimary, shadowColor: colors.brandPrimary }]}>
                <AnimatedIcon name={item.icon} color={colors.onBrandPrimary} size={28} focused={focused} />
              </View>
              <Text style={[styles.label, { color }]}>{t(item.labelKey)}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={item.name} testID={`tab-${item.name}`} onPress={onPress} style={({ pressed }) => [styles.slot, pressed && { opacity: 0.7 }]}>
            <AnimatedIcon name={item.icon} color={color} size={22} focused={focused} />
            <Text style={[styles.label, { color }]}>{t(item.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    paddingHorizontal: 8,
  },
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 48,
    marginBottom: 6,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginBottom: 6,
  },
  // Merkez Keşfet butonu: diğerlerinden %25 daha büyük (56 vs 44).
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  label: { fontSize: 10, fontWeight: "800" },
});
