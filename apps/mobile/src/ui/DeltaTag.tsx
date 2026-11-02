import { StyleSheet, Text } from "react-native";

import { colors, fonts, radii, typography } from "../theme";

/** The reviewer's pen: orange, always with ink text, at most one per block. */
export function DeltaTag({ value }: { value: string }) {
  return <Text style={styles.tag}>{value}</Text>;
}

const styles = StyleSheet.create({
  tag: {
    ...typography.tag,
    alignSelf: "flex-start",
    backgroundColor: colors.signal,
    borderRadius: radii.tag,
    fontFamily: fonts.condensedExtraBold,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 5
  }
});
