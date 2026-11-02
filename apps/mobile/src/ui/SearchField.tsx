import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { colors, radii, typography } from "../theme";
import { Icon } from "./Icon";

export function SearchField({
  disabled = false,
  ...input
}: Omit<TextInputProps, "style" | "editable"> & { disabled?: boolean }) {
  return (
    <View style={[styles.field, disabled && styles.disabled]}>
      <Icon name="search" size={22} color={disabled ? colors.dash : colors.ink} />
      <TextInput
        {...input}
        editable={!disabled}
        placeholderTextColor={colors.slate}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radii.control,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16
  },
  disabled: { backgroundColor: colors.ground, borderColor: colors.line },
  input: { ...typography.body, flex: 1, paddingVertical: 0 }
});
