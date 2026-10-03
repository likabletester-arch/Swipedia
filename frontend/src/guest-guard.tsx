import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { useTheme } from "@/src/theme";

type GuestGuard = { requireAccount: (action: string) => boolean };
const GuestGuardContext = createContext<GuestGuard>({ requireAccount: () => true });

export function GuestGuardProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const [action, setAction] = useState<string | null>(null);
  const leavingGuest = useRef(false);
  const wasGuest = useRef(user?.is_guest);

  useEffect(() => {
    if (user?.is_guest && !wasGuest.current) leavingGuest.current = false;
    wasGuest.current = user?.is_guest;
  }, [user?.is_guest]);

  const requireAccount = useCallback((nextAction: string) => {
    if (!user?.is_guest) return true;
    if (leavingGuest.current) return false;
    setAction(nextAction);
    return false;
  }, [user?.is_guest]);

  const openAuth = async (mode: "login" | "register") => {
    leavingGuest.current = true;
    setAction(null);
    await AsyncStorage.setItem("swipedia-next-auth-mode", mode);
    await logout();
    router.replace("/login");
  };

  return (
    <GuestGuardContext.Provider value={{ requireAccount }}>
      {children}
      {action ? <Modal visible transparent animationType="fade" onRequestClose={() => setAction(null)}>
        <View style={styles.backdrop} testID="guest-account-prompt">
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{t("guest.title")}</Text>
            <Text style={[styles.message, { color: colors.muted }]}>{t("guest.message", { action: action || "" })}</Text>
            <Pressable testID="guest-register-button" onPress={() => { void openAuth("register"); }} style={[styles.primary, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>{t("guest.registerNow")}</Text></Pressable>
            <Pressable testID="guest-login-button" onPress={() => { void openAuth("login"); }} style={[styles.secondary, { borderColor: colors.border }]}><Text style={{ color: colors.onSurface, fontWeight: "800" }}>{t("guest.login")}</Text></Pressable>
            <Pressable testID="guest-cancel-button" onPress={() => setAction(null)} style={styles.cancel}><Text style={{ color: colors.muted, fontWeight: "800" }}>{t("guest.cancel")}</Text></Pressable>
          </View>
        </View>
      </Modal> : null}
    </GuestGuardContext.Provider>
  );
}

export function useRequireAccount() {
  return useContext(GuestGuardContext).requireAccount;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,17,14,0.45)", justifyContent: "center", padding: 28 },
  card: { borderRadius: 22, padding: 20, alignItems: "stretch" },
  title: { fontSize: 17, fontWeight: "900", textAlign: "center" },
  message: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 8, marginBottom: 18 },
  primary: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondary: { minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cancel: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 3 },
});