import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, typography } from "../theme";

/** A row inside a Panel; rows after the first are separated by a hairline. */
export function ListRow({
  title,
  subtitle,
  trailing,
  onPress,
  divided = false
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?(): void;
  divided?: boolean;
}) {
  const content = (
    <>
      <View style={styles.text}>
        <Text style={typography.titleSm}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle = [styles.row, divided && styles.divided];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={rowStyle}>
      {content}
    </Pressable>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10
  },
  divided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  text: { flex: 1, gap: 3 },
  subtitle: { ...typography.caption, color: colors.slate }
});
