import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, StyleSheet } from "react-native";

import { storage } from "@/src/utils/storage";

export type ColorScheme = "light" | "dark";
const THEME_KEY = "swipedia.theme";

const light = {
  surface: "#FFFDF9",
  onSurface: "#1F1C18",
  surfaceSecondary: "#F5EFE6",
  onSurfaceSecondary: "#3D3832",
  surfaceTertiary: "#EAE0D0",
  onSurfaceTertiary: "#59524A",
  surfaceInverse: "#1F1C18",
  onSurfaceInverse: "#FFFDF9",
  muted: "#7A7065",
  brand: "#FF6B4A",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF6B4A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF8C6B",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FFE5DC",
  onBrandTertiary: "#D43B17",
  success: "#2D9D78",
  onSuccess: "#FFFFFF",
  warning: "#E5A93B",
  onWarning: "#1F1C18",
  error: "#E05A47",
  onError: "#FFFFFF",
  info: "#3A86FF",
  onInfo: "#FFFFFF",
  border: "#E6DCD0",
  borderStrong: "#D9C8B8",
  divider: "#EFE6DC",
};

// Karanlık tema: açılış logosunun sıcak kömür + mercan tonlarına uyarlandı.
const dark: typeof light = {
  surface: "#171210",
  onSurface: "#F7EFE7",
  surfaceSecondary: "#221A15",
  onSurfaceSecondary: "#EBDFD2",
  surfaceTertiary: "#2E231B",
  onSurfaceTertiary: "#CDBFAC",
  surfaceInverse: "#0F0C0A",
  onSurfaceInverse: "#FFF6EF",
  muted: "#95887A",
  brand: "#FF6B4A",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF6B4A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF8C6B",
  onBrandSecondary: "#1F1C18",
  brandTertiary: "#47281E",
  onBrandTertiary: "#FFA68D",
  success: "#3DBB93",
  onSuccess: "#0F0C0A",
  warning: "#E5A93B",
  onWarning: "#1F1C18",
  error: "#E5745F",
  onError: "#0F0C0A",
  info: "#5E9AFF",
  onInfo: "#0F0C0A",
  border: "#392B21",
  borderStrong: "#4D3B2D",
  divider: "#2A2019",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  setScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({ scheme: defaultScheme, colors: light, setScheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(defaultScheme);

  useEffect(() => {
    storage.secureGet<ColorScheme | null>(THEME_KEY, null).then((saved) => {
      if (saved === "dark" || saved === "light") {
        setSchemeState(saved);
        Appearance.setColorScheme?.(saved);
      }
    });
  }, []);

  const setScheme = (next: ColorScheme) => {
    setSchemeState(next);
    Appearance.setColorScheme?.(next);
    storage.secureSet(THEME_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(() => ({ scheme, colors: themes[scheme], setScheme }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
