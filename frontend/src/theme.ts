import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBF7",
  onSurface: "#2D1E19",
  surfaceSecondary: "#F4EDE4",
  onSurfaceSecondary: "#2D1E19",
  surfaceTertiary: "#E8DFD5",
  onSurfaceTertiary: "#2D1E19",
  surfaceInverse: "#3E2723",
  onSurfaceInverse: "#FDFBF7",
  muted: "#7D6B5D",

  brand: "#D85A38",
  onBrand: "#FDFBF7",
  brandPrimary: "#C04A2C",
  onBrandPrimary: "#FDFBF7",
  brandSecondary: "#DE8F42",
  onBrandSecondary: "#2D1E19",
  brandTertiary: "#657153",
  onBrandTertiary: "#FDFBF7",

  success: "#657153",
  onSuccess: "#FDFBF7",
  warning: "#DE8F42",
  onWarning: "#2D1E19",
  error: "#A43B2A",
  onError: "#FDFBF7",
  info: "#657153",
  onInfo: "#FDFBF7",

  border: "#E8DFD5",
  borderStrong: "#CDBCA7",
  divider: "#E8DFD5",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const colors = light;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? defaultScheme);
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "dark" && themes.dark ? "dark" : defaultScheme;
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayReg: "Fraunces_400Regular",
  body: "DMSans_400Regular",
  bodyMed: "DMSans_500Medium",
};

export const radii = { sm: 6, md: 12, lg: 20, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
