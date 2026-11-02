import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, MIN_TOUCH_TARGET, radii, shadows, typography } from "../theme";

/** The undo notice: floats 16 from the sides, over whatever is below it. */
export function Snackbar({
  message,
  actionLabel = "Desfazer",
  onAction,
  bottom = 24
}: {
  message: string;
  actionLabel?: string;
  onAction(): void;
  bottom?: number;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.snackbar, { bottom }]}>
      <Text style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    ...shadows.snackbar,
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.control,
    flexDirection: "row",
    gap: 12,
    left: 16,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 8,
    position: "absolute",
    right: 16
  },
  message: { ...typography.body, color: colors.surface, flex: 1, paddingVertical: 8 },
  action: { justifyContent: "center", minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 10 },
  actionText: { color: colors.labelBoa, fontFamily: fonts.bodyBold, fontSize: 15 }
});
