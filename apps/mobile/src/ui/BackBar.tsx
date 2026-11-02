import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MIN_TOUCH_TARGET } from "../theme";
import { Icon } from "./Icon";

/** Inner screens have no title bar: a back arrow, and the big title comes right below. */
export function BackBar({
  onBack,
  label = "Voltar",
  trailing
}: {
  onBack(): void;
  label?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="arrowBack" strokeWidth={2.2} />
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 8
  },
  back: {
    alignItems: "center",
    height: MIN_TOUCH_TARGET,
    justifyContent: "center",
    width: MIN_TOUCH_TARGET
  }
});
