import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii } from "../theme";

/** Flat by rule: a white surface with a 1px border and never a shadow. */
export function Panel({
  children,
  padded = false,
  style
}: PropsWithChildren<{ padded?: boolean; style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    overflow: "hidden"
  },
  padded: { padding: 16 }
});
