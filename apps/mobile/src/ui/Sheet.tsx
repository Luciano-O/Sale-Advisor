import type { PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radii, shadows, typography } from "../theme";

export function Sheet({
  visible,
  title,
  description,
  onClose,
  children
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  description?: string;
  onClose(): void;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={onClose}
            style={styles.veil}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          entering={SlideInDown}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  veil: { backgroundColor: colors.veil, flex: 1 },
  sheet: {
    ...shadows.sheet,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    maxHeight: "85%",
    paddingTop: 10
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.pebble,
    borderRadius: 2,
    height: 4,
    width: 36
  },
  header: { gap: 4, paddingBottom: 12, paddingHorizontal: 20, paddingTop: 14 },
  title: { color: colors.ink, fontFamily: fonts.condensedExtraBold, fontSize: 30, lineHeight: 30 },
  description: { ...typography.bodySm, color: colors.slate }
});
