import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme";

/** Onboarding progress as named bars: done in ink, current in cobalt, future in line. */
export function AxisStepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <View accessibilityLabel="Etapas" style={styles.row}>
      {steps.map((step, index) => (
        <View key={step} accessibilityState={{ selected: index === current }} style={styles.step}>
          <View
            style={[
              styles.bar,
              {
                backgroundColor:
                  index < current ? colors.ink : index === current ? colors.cobalt : colors.line
              }
            ]}
          />
          <Text style={index === current ? styles.current : styles.name}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4, marginHorizontal: 16 },
  step: { flex: 1, gap: 6 },
  bar: { borderRadius: 1, height: 6 },
  name: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 13 },
  current: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 13 }
});
