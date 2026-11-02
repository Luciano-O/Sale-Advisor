import { StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { colors, typography } from "../../src/theme";
import { BrandLockup } from "../../src/ui/BrandLockup";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { Screen } from "../../src/ui/Screen";

// Alertas, Não mostrar e Privacidade chegam na fase seguinte. Até lá, o que a tela antiga de
// preferências oferecia e não mudou de lugar continua aqui.
export default function SettingsScreen() {
  const { hiddenCount, showHiddenOffers, installationId } = useApp();
  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.title}>
          <BrandLockup />
          <Headline>Ajustes</Headline>
        </View>
        {hiddenCount > 0 ? (
          <Button
            label={`Mostrar ofertas ocultas (${hiddenCount})`}
            variant="outline"
            onPress={() => void showHiddenOffers()}
          />
        ) : null}
        <Text style={styles.installation}>Instalação anônima: {installationId ?? "criando…"}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingHorizontal: 20, paddingTop: 12 },
  title: { gap: 16, paddingHorizontal: 4 },
  installation: { ...typography.caption, color: colors.slate, paddingHorizontal: 4 }
});
