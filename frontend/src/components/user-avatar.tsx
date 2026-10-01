import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fileUrl } from "@/src/api";
import { useTheme } from "@/src/theme";

// Uygulama logosu = doğrulanmış admin hesabının profil fotoğrafı.
const APP_LOGO = require("@/assets/images/icon.png");

export function UserAvatar({ avatar, name, size = 38, radius }: { avatar?: string; name: string; size?: number; radius?: number }) {
  const { colors } = useTheme();
  const borderRadius = radius ?? Math.round(size * 0.36);
  const isLogo = avatar === "app_logo";
  const isHttp = !!avatar && avatar.startsWith("http");
  const isPath = !!avatar && !isLogo && !isHttp;
  const [resolved, setResolved] = useState<string | null>(isHttp ? avatar! : null);

  useEffect(() => {
    let mounted = true;
    if (isHttp) {
      setResolved(avatar!);
    } else if (isPath) {
      fileUrl(avatar!).then((uri) => { if (mounted) setResolved(uri); }).catch(() => {});
    } else {
      setResolved(null);
    }
    return () => { mounted = false; };
  }, [avatar, isHttp, isPath]);

  if (isLogo) {
    return <Image source={APP_LOGO} style={{ width: size, height: size, borderRadius }} contentFit="cover" />;
  }
  if (resolved) {
    return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius }} contentFit="cover" />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius, backgroundColor: colors.brandTertiary }]}>
      <Text style={[styles.initial, { color: colors.onBrandTertiary, fontSize: Math.round(size * 0.34) }]}>{(name || "?").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { fontWeight: "900" },
});
