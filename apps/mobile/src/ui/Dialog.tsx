import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, shadows, typography } from "../theme";
import { Button } from "./Button";

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
      <View style={styles.root}>
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
            <Button label={confirmLabel} onPress={onConfirm} />
            <Button label={cancelLabel} variant="outline" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24 },
  veil: { backgroundColor: colors.veil },
  dialog: {
    ...shadows.dialog,
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    gap: 10,
    padding: 20
  },
  title: { color: colors.ink, fontFamily: fonts.condensedExtraBold, fontSize: 30, lineHeight: 30 },
  message: { ...typography.body, color: colors.slate },
  actions: { gap: 8, marginTop: 10 }
});
