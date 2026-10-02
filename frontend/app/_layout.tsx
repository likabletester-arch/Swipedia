import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Alert, LogBox, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { LanguageProvider } from "@/src/i18n";
import { ThemeProvider } from "@/src/theme";
import { queryClient } from "@/src/query-client";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// 1. Foreground handler — module scope, before any component
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// 2. Android channel — module scope, before any component
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    const openUrl = (data: Record<string, any>) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (String(url).startsWith("http")) Linking.openURL(String(url));
      else router.push(String(url));
    };

    // 3. Warm tap — app open
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openUrl(response.notification.request.content.data || {});
    });

    // 4. Cold-start tap — app was killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openUrl(response.notification.request.content.data || {});
    });

    // 5. Denied-permission weekly nudge
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const lastNudge = await AsyncStorage.getItem("pushNudgeAt");
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
      Alert.alert(
        "Bildirimleri aç",
        "Yeni sorular, yorumlar ve takip ettiğin kişilerden haberdar olmak için bildirimlere izin ver.",
        [
          { text: "Daha sonra", style: "cancel", onPress: () => AsyncStorage.setItem("pushNudgeAt", String(Date.now())) },
          { text: "Ayarları aç", onPress: () => { AsyncStorage.setItem("pushNudgeAt", String(Date.now())); Linking.openSettings(); } },
        ],
      );
    })();

    return () => {
      tapSub.remove();
    };
  }, [router]);

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <ThemeProvider>
            <LanguageProvider>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
