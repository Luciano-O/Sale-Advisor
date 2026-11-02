import type { PropsWithChildren } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

import { typography } from "../theme";

export function Headline({
  children,
  variant = "headline",
  style
}: PropsWithChildren<{
  variant?: "display" | "headline" | "productName";
  style?: StyleProp<TextStyle>;
}>) {
  return (
    <Text accessibilityRole="header" style={[typography[variant], style]}>
      {children}
    </Text>
  );
}
