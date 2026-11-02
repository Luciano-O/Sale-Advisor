import { Pressable, StyleSheet, View } from "react-native";

import { colors, MIN_TOUCH_TARGET } from "../theme";
import { Icon } from "./Icon";

export function Switch({
  value,
  onValueChange,
  label,
  onInk = false
}: {
  value: boolean;
  onValueChange(value: boolean): void;
  label: string;
  /** The off state reads differently on an ink panel than on white. */
  onInk?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.target}
    >
      <SwitchTrack value={value} onInk={onInk} />
    </Pressable>
  );
}

/** The drawing alone, for rows that are entirely the switch. */
export function SwitchTrack({ value, onInk = false }: { value: boolean; onInk?: boolean }) {
  return (
    <View style={[styles.track, value ? styles.trackOn : onInk ? styles.offInk : styles.offWhite]}>
      {value ? (
        <View style={styles.thumbOn}>
          <Icon name="check" size={14} color={colors.cobalt} strokeWidth={3.2} />
        </View>
      ) : (
        <View
          style={[styles.thumbOff, { backgroundColor: onInk ? colors.steel : colors.steelDeep }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  target: { justifyContent: "center", minHeight: MIN_TOUCH_TARGET },
  track: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: "row",
    height: 32,
    width: 52
  },
  trackOn: {
    backgroundColor: colors.cobalt,
    borderColor: colors.cobalt,
    justifyContent: "flex-end",
    paddingHorizontal: 2
  },
  offInk: { backgroundColor: colors.inkRaised, borderColor: colors.steel, paddingHorizontal: 6 },
  offWhite: {
    backgroundColor: colors.hairline,
    borderColor: colors.steelDeep,
    paddingHorizontal: 6
  },
  thumbOn: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  thumbOff: { borderRadius: 8, height: 16, width: 16 }
});
