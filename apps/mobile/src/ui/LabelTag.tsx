import { StyleSheet, Text } from "react-native";

import { labelColor, labelName, labelTextColor } from "../labels";
import { radii, typography } from "../theme";
import type { ScoreLabel } from "../types";

export function LabelTag({ label }: { label: ScoreLabel }) {
  return (
    <Text
      style={[styles.tag, { backgroundColor: labelColor(label), color: labelTextColor(label) }]}
    >
      {labelName(label)}
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: {
    ...typography.tag,
    alignSelf: "flex-start",
    borderRadius: radii.tag,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5
  }
});
