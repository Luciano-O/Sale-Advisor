import { Pressable, StyleSheet, Text } from "react-native";

import { colors, MIN_TOUCH_TARGET, radii, typography } from "../theme";
import { Icon, type IconName } from "./Icon";

/**
 * Primary is ink, 56 tall, one per screen, with an icon on the right. Destructive never uses an
 * alert color: it is underlined ink text with a trash can.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  accessibilityLabel
}: {
  label: string;
  onPress?(): void;
  variant?: "primary" | "outline" | "destructive" | "onInk" | "link";
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  if (variant === "destructive")
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={styles.destructive}
      >
        <Icon name="trash" size={20} />
        <Text style={styles.destructiveText}>{label}</Text>
      </Pressable>
    );
  if (variant === "link")
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
        <Text style={styles.linkText}>{label}</Text>
      </Pressable>
    );
  const primary = variant === "primary";
  const iconColor = primary ? colors.surface : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        primary ? styles.primary : variant === "onInk" ? styles.onInk : styles.outline,
        !primary && !icon && styles.centered,
        disabled && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      <Text
        style={[primary ? styles.primaryText : styles.outlineText, disabled && styles.disabledText]}
      >
        {label}
      </Text>
      {icon && !disabled ? (
        <Icon name={icon} size={22} color={iconColor} strokeWidth={2.2} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.control,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingLeft: 22,
    paddingRight: 20
  },
  primaryText: { ...typography.button, color: colors.surface, flexShrink: 1 },
  outline: {
    alignItems: "center",
    borderColor: colors.ink,
    borderRadius: radii.control,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16
  },
  onInk: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16
  },
  centered: { justifyContent: "center" },
  outlineText: { ...typography.buttonSm, flexShrink: 1 },
  disabled: { backgroundColor: colors.labelNormal, borderColor: colors.labelNormal },
  disabledText: { color: colors.disabledText },
  pressed: { opacity: 0.8 },
  link: { alignItems: "center", justifyContent: "center", minHeight: MIN_TOUCH_TARGET },
  linkText: { ...typography.buttonSm, color: colors.cobalt },
  destructive: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: MIN_TOUCH_TARGET
  },
  destructiveText: { ...typography.buttonSm, textDecorationLine: "underline" }
});
