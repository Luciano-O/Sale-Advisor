import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, typography } from "../theme";
import { SwitchTrack } from "./Switch";

/** The decision block ("Seguir todo o hardware", "Alertas de ofertas"): the whole panel toggles. */
export function InkSwitchPanel({
  title,
  description,
  value,
  onValueChange
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange(value: boolean): void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.panel, { borderColor: value ? colors.cobalt : colors.ink }]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <SwitchTrack value={value} onInk />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    borderWidth: 2,
    flexDirection: "row",
    gap: 16,
    paddingLeft: 18,
    paddingRight: 16,
    paddingVertical: 16
  },
  text: { flex: 1, gap: 4 },
  title: {
    color: colors.surface,
    fontFamily: fonts.condensedBold,
    fontSize: 23,
    lineHeight: 24
  },
  description: { ...typography.bodySm, color: colors.inkMist }
});
