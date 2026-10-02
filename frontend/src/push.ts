import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPush } from "@/src/api";

// Giriş sonrası ve her uygulama açılışında çağrılır; native FCM/APNs token'ı alıp backend'e kaydeder.
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await registerPush(userId, Platform.OS, String(tokenResp.data));
  } catch {
    // push kaydı başarısız olsa bile uygulama akışı engellenmez
  }
}
