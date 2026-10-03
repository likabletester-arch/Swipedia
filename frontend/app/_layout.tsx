import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { Alert, LogBox, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider } from "@/src/auth";
import { GuestGuardProvider } from "@/src/guest-guard";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { LanguageProvider, useI18n } from "@/src/i18n";
import { isExpoGo } from "@/src/push";
import { ThemeProvider } from "@/src/theme";
import { queryClient } from "@/src/query-client";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

function PushSetup() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    // Expo Go SDK 53+ uzaktan push desteklemez; modülü sadece gerçek build'de yükle.
    if (Platform.OS === "web" || isExpoGo) return;

    let tapSub: { remove: () => void } | undefined;

    (async () => {
      const Notifications = await import("expo-notifications");

      // 1. Foreground handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // 2. Android channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
        });
      }

      const openUrl = (data: Record<string, any>) => {
        const url = data?.deeplink || data?.action_url;
        if (!url) return;
        if (String(url).startsWith("http")) Linking.openURL(String(url));
        else router.push(String(url));
      };

      // 3. Warm tap — app open
      tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
        openUrl(response.notification.request.content.data || {});
      });

      // 4. Cold-start tap — app was killed
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) openUrl(response.notification.request.content.data || {});
      });

      // 5. Denied-permission weekly nudge
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const lastNudge = await AsyncStorage.getItem("pushNudgeAt");
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
      Alert.alert(
        t("push.enableTitle"),
        t("push.enableBody"),
        [
          { text: t("push.later"), style: "cancel", onPress: () => AsyncStorage.setItem("pushNudgeAt", String(Date.now())) },
          { text: t("push.openSettings"), onPress: () => { AsyncStorage.setItem("pushNudgeAt", String(Date.now())); Linking.openSettings(); } },
        ],
      );
    })();

    return () => {
      tapSub?.remove();
    };
  }, [router, t]);

  return null;
}

export default function RootLayout() {

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <ThemeProvider>
            <LanguageProvider>
            <PushSetup />
            <AuthProvider>
              <GuestGuardProvider><Stack screenOptions={{ headerShown: false }} /></GuestGuardProvider>
            </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
