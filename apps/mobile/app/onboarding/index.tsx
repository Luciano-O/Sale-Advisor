import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useOnboarding } from "../../src/onboarding-context";
import { colors, fonts, typography } from "../../src/theme";
import { BrandLockup } from "../../src/ui/BrandLockup";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { Screen } from "../../src/ui/Screen";
import { VerdictBars } from "../../src/ui/VerdictChart";

const EXAMPLE = { priceCents: 189990, median30dInCents: 213900, lowest90dInCents: 184900 };

export default function WelcomeScreen() {
  const { skip } = useOnboarding();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BrandLockup />
          <Headline variant="display">
            Toda oferta passa por um <Text style={styles.accent}>teste.</Text>
          </Headline>
        </View>
        <View style={styles.band}>
          <View style={styles.bandHeader}>
            <Text style={styles.product}>RTX 5060 8GB</Text>
            <Text style={styles.bandNote}>preço à vista · menor é melhor</Text>
          </View>
          <VerdictBars prices={EXAMPLE} discountPercent={11} />
          <View style={styles.verdict}>
            <View style={styles.conclusion}>
              <Text style={styles.lead}>Veredito</Text>
              <Text style={styles.label}>Muito boa</Text>
            </View>
            <Text style={styles.example}>Exemplo ilustrativo</Text>
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.pitch}>
            Você só escolhe o que quer. Nós encontramos as ofertas, testamos cada uma contra o
            histórico e trazemos só as que passam.
          </Text>
          <View style={styles.spacer} />
          <Button
            label="Começar"
            icon="arrowForward"
            onPress={() => router.push("/onboarding/subcategorias")}
          />
          <Button label="Pular por enquanto" variant="link" onPress={() => void skip()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  header: { gap: 20, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 24 },
  accent: { color: colors.cobalt },
  band: {
    backgroundColor: colors.cobalt,
    gap: 14,
    paddingBottom: 18,
    paddingHorizontal: 24,
    paddingTop: 22
  },
  bandHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between"
  },
  product: { color: colors.surface, fontFamily: fonts.bodySemiBold, fontSize: 17 },
  bandNote: { color: colors.cobaltMist, fontFamily: fonts.condensedMedium, fontSize: 14 },
  verdict: {
    alignItems: "baseline",
    borderTopColor: colors.cobaltGrid,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    paddingTop: 12
  },
  conclusion: { alignItems: "baseline", flexDirection: "row", gap: 10 },
  lead: { color: colors.cobaltMist, fontFamily: fonts.condensedSemiBold, fontSize: 15 },
  label: {
    color: colors.surface,
    fontFamily: fonts.condensedExtraBold,
    fontSize: 30,
    lineHeight: 32
  },
  example: { color: colors.cobaltMist, fontFamily: fonts.body, fontSize: 12 },
  body: { flex: 1, gap: 10, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 22 },
  pitch: { ...typography.body, fontSize: 17, lineHeight: 25 },
  spacer: { flex: 1 }
});
