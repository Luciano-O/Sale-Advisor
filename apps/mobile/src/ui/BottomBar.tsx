import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "../theme";

/** The white base of a screen, where the primary action lives. */
export function BottomBar({ caption, children }: PropsWithChildren<{ caption?: string }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12
  },
  caption: {
    color: colors.slate,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 15,
    lineHeight: 20
  }
});
