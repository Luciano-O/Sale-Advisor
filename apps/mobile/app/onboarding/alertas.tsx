import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Rect } from "react-native-svg";

import { useApp } from "../../src/app-context";
import { useOnboarding } from "../../src/onboarding-context";
import { colors, fonts, radii, typography } from "../../src/theme";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { OnboardingHeader } from "../../src/ui/OnboardingHeader";
import { Screen } from "../../src/ui/Screen";

const PROMISES = [
  ["Só o que você escolheu.", "Subcategorias inteiras ou produtos específicos."],
  ["Uma vez por oferta.", "Se encontrarmos a mesma oferta de novo, você não recebe outro alerta."],
  ["Sua lista não sai do aparelho.", "O servidor recebe só as subcategorias."]
] as const;

function NotificationPreview() {
  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        <Svg width={20} height={20} viewBox="0 0 28 28">
          <Rect width={28} height={28} rx={7} fill={colors.cobalt} />
          <Rect x={6} y={7} width={16} height={3.5} rx={0.8} fill={colors.surface} />
          <Rect x={6} y={12.25} width={11} height={3.5} rx={0.8} fill={colors.surface} />
          <Rect x={6} y={17.5} width={6.5} height={3.5} rx={0.8} fill={colors.signal} />
        </Svg>
        <Text style={styles.previewMeta}>Sale Advisor · KaBuM! · agora</Text>
      </View>
      <Text style={styles.previewTitle}>RTX 5060 8GB por R$ 1.899,90</Text>
      <Text style={styles.previewBody}>Muito boa: 11% abaixo da mediana de 30 dias.</Text>
    </View>
  );
}

export default function AlertsStep() {
  const { enableAlerts } = useApp();
  const { update } = useOnboarding();
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);
  const decide = (alertsEnabled: boolean) => {
    update((current) => ({ ...current, alertsEnabled }));
    router.push("/onboarding/pronto");
  };
  return (
    <Screen>
      <OnboardingHeader step={2} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <Headline>Um alerta só quando passa no teste.</Headline>
        </View>
        <View style={styles.band}>
          <NotificationPreview />
          <Text style={styles.example}>Exemplo de alerta</Text>
        </View>
        <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View>
            {PROMISES.map(([title, detail], index) => (
              <View key={title} style={[styles.promise, index > 0 && styles.promiseDivided]}>
                <Text style={styles.promiseTitle}>{title}</Text>
                <Text style={styles.promiseDetail}>{detail}</Text>
              </View>
            ))}
          </View>
          <View style={styles.spacer} />
          <View style={styles.actions}>
            <Text style={styles.permission}>
              O Android vai pedir sua permissão para mostrar notificações.
            </Text>
            <Button
              label="Ativar alertas"
              icon="arrowForward"
              disabled={asking}
              onPress={() => {
                setAsking(true);
                void enableAlerts()
                  .then(decide)
                  .finally(() => setAsking(false));
              }}
            />
            <Button label="Agora não" variant="link" onPress={() => decide(false)} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  title: { paddingBottom: 20, paddingHorizontal: 24, paddingTop: 22 },
  band: {
    backgroundColor: colors.cobalt,
    gap: 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    boxShadow: "0 10px 24px rgba(8, 20, 90, 0.35), 0 2px 4px rgba(8, 20, 90, 0.25)",
    gap: 6,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  previewHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  previewMeta: { color: colors.slate, fontFamily: fonts.body, fontSize: 12 },
  previewTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  previewBody: { ...typography.bodySm, color: colors.slate },
  example: { color: colors.cobaltMist, fontFamily: fonts.body, fontSize: 12, paddingLeft: 4 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 6 },
  promise: { gap: 2, paddingVertical: 14 },
  promiseDivided: { borderTopColor: colors.line, borderTopWidth: 1 },
  promiseTitle: {
    color: colors.ink,
    fontFamily: fonts.condensedBold,
    fontSize: 21,
    lineHeight: 23
  },
  promiseDetail: { ...typography.bodySm, color: colors.slate },
  spacer: { flex: 1 },
  actions: { gap: 8 },
  permission: { ...typography.caption, color: colors.slate }
});
