import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { registerPush } from "@/src/api";

// Expo Go (SDK 53+) uzaktan push bildirimlerini desteklemez; modülü orada hiç yükleme.
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Giriş sonrası ve her uygulama açılışında çağrılır; native FCM/APNs token'ı alıp backend'e kaydeder.
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === "web" || isExpoGo) return;
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await registerPush(userId, Platform.OS, String(tokenResp.data));
  } catch {
    // push kaydı başarısız olsa bile uygulama akışı engellenmez
  }
}
