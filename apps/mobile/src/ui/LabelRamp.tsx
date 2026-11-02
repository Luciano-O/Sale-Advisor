import { StyleSheet, Text, View } from "react-native";

import { LABEL_RAMP, labelColor, labelName } from "../labels";
import { colors, fonts, radii } from "../theme";

/** The fixed ramp as a ruler, with a bracket over what the user receives: boa and better. */
export function LabelRamp({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <View style={styles.row}>
        {LABEL_RAMP.map((label) => (
          <View
            key={label}
            style={[styles.step, styles.compactBar, { backgroundColor: labelColor(label) }]}
          />
        ))}
      </View>
    );
  return (
    <View accessibilityLabel="Você recebe ofertas boas, muito boas e excepcionais" accessible>
      <View style={styles.row}>
        <View style={styles.step} />
        <View style={styles.bracketColumn}>
          <Text style={styles.received}>Você recebe estas</Text>
          <View style={styles.bracket} />
        </View>
      </View>
      <View style={styles.row}>
        {LABEL_RAMP.map((label) => (
          <View key={label} style={styles.step}>
            <View style={[styles.bar, { backgroundColor: labelColor(label) }]} />
            <Text style={label === "normal" ? styles.excluded : styles.included}>
              {labelName(label)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3 },
  step: { flex: 1, gap: 4 },
  bracketColumn: { flex: 3, gap: 4 },
  received: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 13 },
  bracket: {
    borderColor: colors.ink,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    height: 7,
    marginBottom: 4
  },
  bar: { borderRadius: radii.bar, height: 10 },
  compactBar: { borderRadius: radii.bar, height: 8 },
  included: { color: colors.ink, fontFamily: fonts.condensedSemiBold, fontSize: 13 },
  excluded: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 13 }
});
