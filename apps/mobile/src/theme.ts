import type { TextStyle, ViewStyle } from "react-native";

// Values come from apps/mobile/DESIGN.md. This module stays free of react-native at runtime so
// the pure rules that use it (labels.ts) run under vitest.
export const colors = {
  ink: "#0B1220",
  slate: "#485264",
  ground: "#F1F2F5",
  surface: "#FFFFFF",
  line: "#D5D9E0",
  hairline: "#E6E9EE",
  dash: "#A3AAB6",
  pebble: "#C9CED8",
  cobalt: "#2147F0",
  cobaltDeep: "#1A36B8",
  cobaltMist: "#D5DDFE",
  cobaltGrid: "#4A69F4",
  cobaltWash: "#EEF3FE",
  inkRaised: "#1E2838",
  inkMist: "#B9C2D3",
  steel: "#8A96AB",
  steelDeep: "#6B7385",
  signal: "#FF6B2C",
  labelNormal: "#DDE1E8",
  labelBoa: "#9DB0FB",
  labelMuitoBoa: "#2147F0",
  labelExcepcional: "#FF6B2C",
  barTrack: "#EEF0F3",
  disabledText: "#5B6577",
  veil: "rgba(11, 18, 32, 0.5)"
};

// Embedded by the expo-font config plugin, one family per weight (see app.json). Android picks a
// system fallback when fontWeight is combined with these, so styles set only fontFamily.
export const fonts = {
  body: "Barlow_400Regular",
  bodyMedium: "Barlow_500Medium",
  bodySemiBold: "Barlow_600SemiBold",
  bodyBold: "Barlow_700Bold",
  condensedMedium: "BarlowCondensed_500Medium",
  condensedSemiBold: "BarlowCondensed_600SemiBold",
  condensedBold: "BarlowCondensed_700Bold",
  condensedExtraBold: "BarlowCondensed_800ExtraBold"
};

export const radii = { bar: 2, tag: 4, chip: 6, control: 8, panel: 10, sheet: 16, pill: 16 };

export const spacing = { tight: 6, group: 10, stack: 16, gutter: 20, gutterWide: 24, section: 28 };

/** Touch targets never go below this (A Regra dos 48dp). */
export const MIN_TOUCH_TARGET = 48;

function textRole(
  fontFamily: string,
  fontSize: number,
  lineRatio: number,
  extra: TextStyle = {}
): TextStyle {
  return {
    fontFamily,
    fontSize,
    lineHeight: Math.round(fontSize * lineRatio),
    includeFontPadding: false,
    color: colors.ink,
    ...extra
  };
}

const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

// A line height below the font's own cuts descenders on Android. This room keeps them visible
// without changing the spacing around the text.
const descenderRoom = (size: number): TextStyle => ({ marginBottom: -size, paddingBottom: size });

export const typography = {
  display: textRole(fonts.condensedExtraBold, 58, 0.9, {
    letterSpacing: -0.58,
    ...descenderRoom(11)
  }),
  headline: textRole(fonts.condensedExtraBold, 42, 0.95, {
    letterSpacing: -0.42,
    ...descenderRoom(8)
  }),
  productName: textRole(fonts.condensedExtraBold, 46, 0.95, {
    letterSpacing: -0.46,
    ...descenderRoom(9)
  }),
  price: textRole(fonts.condensedExtraBold, 52, 0.95, {
    letterSpacing: -0.52,
    ...TABULAR,
    ...descenderRoom(9)
  }),
  title: textRole(fonts.condensedBold, 24, 1.05),
  titleSm: textRole(fonts.condensedBold, 20, 1.1),
  section: textRole(fonts.condensedSemiBold, 16, 1.2, { color: colors.slate }),
  tag: textRole(fonts.condensedBold, 14, 1, TABULAR),
  body: textRole(fonts.body, 15, 1.45),
  bodySm: textRole(fonts.body, 14, 1.4),
  caption: textRole(fonts.body, 13, 1.35),
  button: textRole(fonts.bodyBold, 17, 1.2),
  buttonSm: textRole(fonts.bodySemiBold, 15, 1.2)
};

export const shadows: Record<"sheet" | "snackbar" | "dialog", ViewStyle> = {
  sheet: { boxShadow: "0 -12px 28px rgba(11, 18, 32, 0.25)" },
  snackbar: { boxShadow: "0 8px 20px rgba(11, 18, 32, 0.3)" },
  dialog: { boxShadow: "0 16px 40px rgba(11, 18, 32, 0.3)" }
};
