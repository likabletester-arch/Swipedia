import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { api, appleAuth, guest, login, requestRegisterCode, setToken, verifyRegister, type User } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { makeStyles, useTheme } from "@/src/theme";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "login" | "register";

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { user, ready, setUser } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleReady).catch(() => setAppleReady(false));
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const sessionId = window.location.href.match(/[?#&]session_id=([^&#]+)/)?.[1];
    if (!sessionId) return;
    let mounted = true;
    setBusy(true);
    api<{ session_token: string; user: User }>("/auth/session", { method: "POST", body: JSON.stringify({ session_id: decodeURIComponent(sessionId) }) })
      .then(async (response) => {
        if (!mounted) return;
        await setToken(response.session_token);
        window.history.replaceState(window.history.state, "", `${window.location.origin}/`);
        setUser(response.user);
        router.replace("/(tabs)");
      })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : t("auth.error")); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, [router, setUser, t]);

  if (ready && user) return <Redirect href="/(tabs)" />;

  const run = async (action: () => Promise<User>) => {
    setBusy(true);
    setError("");
    try {
      setUser(await action());
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setBusy(false);
    }
  };

  const sendRegisterCode = async () => {
    setBusy(true);
    setError("");
    try {
      await requestRegisterCode(name.trim(), email.trim(), phone.trim(), password);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setStep("form");
    setCode("");
    setError("");
  };

  const googleLogin = async () => {
    setBusy(true);
    setError("");
    let captured = "";
    const listener = Linking.addEventListener("url", ({ url }) => { captured = url; });
    try {
      const redirectUrl = Platform.OS === "web" ? `${window.location.origin}/` : Linking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      captured = result.type === "success" ? result.url : captured || (await Linking.getInitialURL()) || "";
      const sessionId = captured.match(/[?#&]session_id=([^&#]+)/)?.[1];
      if (!sessionId) throw new Error(t("auth.error"));
      const response = await api<{ session_token: string; user: User }>("/auth/session", { method: "POST", body: JSON.stringify({ session_id: decodeURIComponent(sessionId) }) });
      await setToken(response.session_token);
      setUser(response.user);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      listener.remove();
      setBusy(false);
    }
  };

  const appleLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error(t("auth.error"));
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ") || undefined;
      setUser(await appleAuth(credential.identityToken, fullName, credential.email ?? undefined));
      router.replace("/(tabs)");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "ERR_REQUEST_CANCELED") {
        setError(err instanceof Error ? err.message : t("auth.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.authWrap} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.authGlow} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 22 }}>
        <View style={styles.authTop}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}><Ionicons name="sparkles" size={19} color={colors.onBrandPrimary} /></View>
            <Text style={styles.logoText}>Swipedia</Text>
          </View>
          <Text style={[styles.eyebrow, { marginTop: 34 }]}>{t("auth.tagline")}</Text>
          <Text style={styles.authTitle}>{t("auth.title")}</Text>
          <Text style={styles.authSubtitle}>{t("auth.subtitle")}</Text>
        </View>
        <View style={styles.authCard}>
          <View style={styles.modeRow}>
            <Pressable testID="auth-mode-login" onPress={() => switchMode("login")} style={[styles.modeButton, mode === "login" && styles.modeButtonActive]}><Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>{t("auth.login")}</Text></Pressable>
            <Pressable testID="auth-mode-register" onPress={() => switchMode("register")} style={[styles.modeButton, mode === "register" && styles.modeButtonActive]}><Text style={[styles.modeText, mode === "register" && styles.modeTextActive]}>{t("auth.register")}</Text></Pressable>
          </View>

          {mode === "register" && step === "code" ? (
            <>
              <Text style={styles.verifyTitle}>{t("auth.verifyTitle")}</Text>
              <Text style={styles.verifySub}>{t("auth.verifySubtitle", { email: email.trim() })}</Text>
              <TextInput testID="code-input" value={code} onChangeText={setCode} placeholder={t("auth.code")} placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} style={[styles.input, { textAlign: "center", letterSpacing: 8, fontSize: 18 }]} />
              {!!error && <Text testID="auth-error-text" style={{ color: colors.error, fontSize: 10, marginBottom: 8 }}>{error}</Text>}
              <Pressable testID="verify-submit-button" disabled={busy} onPress={() => run(() => verifyRegister(email.trim(), code.trim()))} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.78 }, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("auth.verifyButton")}</Text>}
              </Pressable>
              <Pressable testID="resend-code-button" onPress={sendRegisterCode} disabled={busy} style={styles.guestButton}>
                <Text style={styles.guestText}>{t("auth.resend")}</Text>
              </Pressable>
            </>
          ) : mode === "register" ? (
            <>
              <TextInput testID="name-input" value={name} onChangeText={setName} placeholder={t("auth.name")} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="email-input" value={email} onChangeText={setEmail} placeholder={t("auth.email")} placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput testID="phone-input" value={phone} onChangeText={setPhone} placeholder={t("auth.phone")} placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />
              <TextInput testID="password-input" value={password} onChangeText={setPassword} placeholder={t("auth.password")} placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
              <Text style={styles.phoneHint}>{t("auth.phoneHint")}</Text>
              {!!error && <Text testID="auth-error-text" style={{ color: colors.error, fontSize: 10, marginBottom: 8 }}>{error}</Text>}
              <Pressable testID="auth-submit-button" disabled={busy} onPress={sendRegisterCode} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.78 }, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("auth.sendCode")}</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput testID="email-input" value={email} onChangeText={setEmail} placeholder={t("auth.email")} placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput testID="password-input" value={password} onChangeText={setPassword} placeholder={t("auth.password")} placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
              {!!error && <Text testID="auth-error-text" style={{ color: colors.error, fontSize: 10, marginBottom: 8 }}>{error}</Text>}
              <Pressable testID="auth-submit-button" disabled={busy} onPress={() => run(() => login(email, password))} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.78 }, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{t("auth.submitLogin")}</Text>}
              </Pressable>
            </>
          )}

          {step === "form" && (
            <>
              <Pressable testID="google-login-button" onPress={googleLogin} disabled={busy} style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.7 }]}>
                <Ionicons name="logo-google" size={16} color={colors.error} />
                <Text style={styles.googleText}>{t("auth.google")}</Text>
              </Pressable>
              {appleReady && (
                <View testID="apple-login-button">
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={15}
                    style={{ height: 48, marginTop: 9 }}
                    onPress={appleLogin}
                  />
                </View>
              )}
              <Pressable testID="guest-login-button" onPress={() => run(() => guest())} style={styles.guestButton}>
                <Text style={styles.guestText}>{t("auth.guest")}</Text>
              </Pressable>
            </>
          )}
        </View>
        <Text style={styles.legal}>{t("auth.legal")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  authWrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 22 },
  authGlow: { position: "absolute", top: -130, right: -95, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.brandTertiary, opacity: 0.7 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  logoText: { color: colors.onSurface, fontSize: 20, fontWeight: "800", letterSpacing: -0.8 },
  authTop: { paddingTop: 64, paddingBottom: 34 },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  authTitle: { color: colors.onSurface, fontSize: 23, lineHeight: 29, fontWeight: "800", marginTop: 10 },
  authSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  authCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.border },
  modeRow: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: 13, padding: 4, marginBottom: 13 },
  modeButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  modeButtonActive: { backgroundColor: colors.surface },
  modeText: { color: colors.muted, fontWeight: "700", fontSize: 11 },
  modeTextActive: { color: colors.onSurface },
  input: { minHeight: 48, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.onSurface, fontSize: 12, marginBottom: 9 },
  phoneHint: { color: colors.muted, fontSize: 9, lineHeight: 13, marginBottom: 10, marginTop: -2 },
  verifyTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", marginBottom: 5 },
  verifySub: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  googleButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 9 },
  googleText: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },
  guestButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 5 },
  guestText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 11 },
  legal: { color: colors.muted, fontSize: 9, textAlign: "center", lineHeight: 14, marginTop: 20 },
}));
