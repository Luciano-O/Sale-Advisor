import { Stack } from "expo-router";

import { OnboardingProvider } from "../../src/onboarding-context";
import { colors } from "../../src/theme";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
      />
    </OnboardingProvider>
  );
}
