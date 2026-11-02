import { StyleSheet, Text, View } from "react-native";

import { LABEL_RAMP, labelColor, labelName } from "../labels";
import { colors, fonts } from "../theme";
import type { ScoreLabel } from "../types";

/** The fixed ramp as a ruler. Labels below the threshold stay named, but do not count as received. */
export function LabelRamp({ from = "boa" }: { from?: ScoreLabel }) {
  const first = LABEL_RAMP.indexOf(from);
  return (
    <View style={styles.row}>
      {LABEL_RAMP.map((label, index) => (
        <View key={label} style={styles.step}>
          <View style={[styles.bar, { backgroundColor: labelColor(label) }]} />
          <Text style={index >= first ? styles.included : styles.excluded}>{labelName(label)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  step: { flex: 1, gap: 6 },
  bar: { borderRadius: 2, height: 10 },
  included: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 13 },
  excluded: { color: colors.slate, fontFamily: fonts.condensedMedium, fontSize: 13 }
});
