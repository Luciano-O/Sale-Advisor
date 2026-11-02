import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, MIN_TOUCH_TARGET } from "../theme";
import { AxisStepper } from "./AxisStepper";
import { BackBar } from "./BackBar";

const STEPS = ["Subcategorias", "Produtos", "Alertas"];

export function OnboardingHeader({ step, onSkip }: { step: number; onSkip?: () => void }) {
  return (
    <View style={styles.header}>
      <BackBar
        onBack={() => router.back()}
        trailing={
          onSkip ? (
            <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
              <Text style={styles.skipText}>Pular</Text>
            </Pressable>
          ) : undefined
        }
      />
      <AxisStepper steps={STEPS} current={step} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  skip: { justifyContent: "center", minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 16 },
  skipText: { color: colors.cobalt, fontFamily: fonts.bodySemiBold, fontSize: 15 }
});
