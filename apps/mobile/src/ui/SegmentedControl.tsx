import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii } from "../theme";
import { Icon } from "./Icon";

/**
 * Two equal segments. "compact" is the 34-tall version that shares a line with the offer count;
 * its touch area still reaches 48.
 */
export function SegmentedControl<Key extends string>({
  options,
  value,
  onChange,
  label,
  compact = false
}: {
  options: ReadonlyArray<{ key: Key; label: string }>;
  value: Key;
  onChange(key: Key): void;
  label: string;
  compact?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, compact ? styles.groupCompact : styles.groupFull]}
    >
      {options.map((option, index) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            hitSlop={compact ? { top: 7, bottom: 7 } : undefined}
            onPress={() => onChange(option.key)}
            style={[
              styles.segment,
              !compact && styles.segmentFull,
              compact && styles.segmentCompact,
              index > 0 && styles.divided,
              selected && styles.selected
            ]}
          >
            {selected && !compact ? (
              <Icon name="check" size={16} color={colors.surface} strokeWidth={3} />
            ) : null}
            <Text
              style={[styles.text, compact && styles.textCompact, selected && styles.textSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderColor: colors.ink,
    borderWidth: 1.5,
    flexDirection: "row",
    maxWidth: "100%",
    overflow: "hidden"
  },
  groupFull: { borderRadius: radii.control, minHeight: 44 },
  groupCompact: { borderRadius: radii.chip, minHeight: 34 },
  segment: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center"
  },
  segmentFull: { flex: 1, paddingHorizontal: 8 },
  segmentCompact: { flexShrink: 1, paddingHorizontal: 12 },
  divided: { borderLeftColor: colors.ink, borderLeftWidth: 1.5 },
  selected: { backgroundColor: colors.cobalt },
  text: { color: colors.ink, flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 15 },
  textCompact: { fontSize: 14 },
  textSelected: { color: colors.surface, fontFamily: fonts.bodyBold }
});
