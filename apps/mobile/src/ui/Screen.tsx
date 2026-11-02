import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";

/** The ground of every screen; content starts below the status bar. */
export function Screen({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.ground, flex: 1 }
});
