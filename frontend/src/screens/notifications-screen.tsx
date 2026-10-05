import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/src/api";
import { useI18n } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  points: "sparkles",
  rank_up: "trophy",
  comment: "chatbubble-outline",
  mention: "at-outline",
  share: "paper-plane-outline",
  system: "megaphone-outline",
};

function timeAgo(iso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notif.justNow");
  if (mins < 60) return t("notif.minsAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notif.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("notif.daysAgo", { n: days });
}

function iconColor(type: string, colors: ReturnType<typeof useTheme>["colors"]): string {
  switch (type) {
    case "points":
      return colors.warning;
    case "rank_up":
      return colors.brandPrimary;
    case "comment":
      return colors.info;
    case "share":
      return colors.success;
    case "system":
      return colors.brandSecondary;
    default:
      return colors.muted;
  }
}

function iconBg(type: string, colors: ReturnType<typeof useTheme>["colors"]): string {
  switch (type) {
    case "points":
      return colors.brandTertiary;
    case "rank_up":
      return colors.brandTertiary;
    case "comment":
      return colors.surfaceTertiary;
    case "share":
      return colors.surfaceTertiary;
    case "system":
      return colors.brandTertiary;
    default:
      return colors.surfaceSecondary;
  }
}

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  const handlePress = async (item: Notification) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.notification_id);
        setNotifications((prev) =>
          prev.map((n) => (n.notification_id === item.notification_id ? { ...n, read: true } : n))
        );
      } catch {
        // silent
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: Notification }) => {
    const ic = ICON_MAP[item.type] || "notifications-outline";
    return (
      <Pressable
        onPress={() => handlePress(item)}
        style={({ pressed }) => [
          styles.card,
          !item.read && styles.cardUnread,
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconBg(item.type, colors) }]}>
          <Ionicons name={ic} size={18} color={iconColor(item.type, colors)} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.cardTime}>{timeAgo(item.created_at, t)}</Text>
        </View>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.brandPrimary }]} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("notif.title")}</Text>
        {unreadCount > 0 ? (
          <Pressable
            onPress={handleMarkAllRead}
            style={({ pressed }) => [styles.markAllButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="checkmark-done-outline" size={18} color={colors.brandPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="notifications-off-outline" size={36} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>{t("notif.empty")}</Text>
          <Text style={styles.emptyHint}>{t("notif.emptyHint")}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.notification_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={colors.brandPrimary}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: colors.onSurface,
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    markAllButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      color: colors.onSurface,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyHint: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 18,
      marginTop: 8,
      maxWidth: 260,
    },
    list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 32 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      marginBottom: 6,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    cardUnread: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    cardContent: { flex: 1 },
    cardTitle: {
      color: colors.onSurface,
      fontSize: 13,
      fontWeight: "700",
    },
    cardTitleUnread: {
      fontWeight: "900",
    },
    cardBody: {
      color: colors.onSurfaceSecondary,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 16,
      marginTop: 2,
    },
    cardTime: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 4,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  })
);
