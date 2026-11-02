import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, MIN_TOUCH_TARGET, radii, typography } from "../theme";
import { Icon } from "./Icon";

/**
 * "filter" narrows a list (36 tall, 48 to the touch). "product" is something the user chose, with
 * an × when it can be removed. "inclusion" lists what cannot be edited there.
 */
export function Chip({
  label,
  variant = "filter",
  selected = false,
  onPress,
  onRemove
}: {
  label: string;
  variant?: "filter" | "product" | "inclusion";
  selected?: boolean;
  onPress?(): void;
  onRemove?(): void;
}) {
  if (variant === "inclusion")
    return (
      <View style={[styles.small, styles.inclusion]}>
        <Text style={styles.smallText}>{label}</Text>
      </View>
    );
  if (variant === "product")
    return (
      <View style={[styles.small, styles.product]}>
        <Text style={[styles.smallText, styles.productText]}>{label}</Text>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remover ${label}`}
            hitSlop={12}
            onPress={onRemove}
          >
            <Icon name="close" size={14} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        ) : null}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      onPress={onPress}
      style={[styles.filter, selected && styles.filterSelected]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
      {onRemove ? (
        <Icon
          name="close"
          size={14}
          color={selected ? colors.surface : colors.ink}
          strokeWidth={2.6}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  small: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.chip,
    flexDirection: "row",
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10
  },
  smallText: { ...typography.tag, fontFamily: fonts.condensedBold, fontSize: 16, lineHeight: 18 },
  product: { backgroundColor: colors.cobalt },
  productText: { color: colors.surface },
  inclusion: { backgroundColor: colors.cobaltWash },
  filter: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radii.chip,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    minHeight: MIN_TOUCH_TARGET - 12,
    paddingHorizontal: 14
  },
  filterSelected: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  filterText: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 15 },
  filterTextSelected: { color: colors.surface, fontFamily: fonts.bodyBold }
});
