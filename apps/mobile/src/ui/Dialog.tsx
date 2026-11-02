import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, MIN_TOUCH_TARGET, radii, shadows, typography } from "../theme";

/** Only for destructive actions; the final button is solid ink, never an alert color. */
export function Dialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {/* A translucent modal is measured without the system bars, but covers them. */}
      <View style={[styles.root, { height: Dimensions.get("screen").height }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, styles.veil]}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.action}>
              <Text style={typography.buttonSm}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={[styles.action, styles.confirm]}
            >
              <Text style={[typography.buttonSm, styles.confirmText]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: "center", padding: 24 },
  veil: { backgroundColor: colors.veil },
  dialog: {
    ...shadows.dialog,
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    gap: 12,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 20,
    paddingTop: 24
  },
  title: { color: colors.ink, fontFamily: fonts.condensedExtraBold, fontSize: 30, lineHeight: 30 },
  message: { ...typography.body, color: colors.slate },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 8
  },
  action: {
    alignItems: "center",
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16
  },
  confirm: { backgroundColor: colors.ink, paddingHorizontal: 18 },
  confirmText: { color: colors.surface }
});
