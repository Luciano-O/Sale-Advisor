import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { colors, fonts, radii, typography } from "../../src/theme";
import { BackBar } from "../../src/ui/BackBar";
import { Button } from "../../src/ui/Button";
import { Dialog } from "../../src/ui/Dialog";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { Screen } from "../../src/ui/Screen";
import { SwitchTrack } from "../../src/ui/Switch";

function Bullet({ color }: { color: string }) {
  return <View style={[styles.bullet, { backgroundColor: color }]} />;
}

function ServerItem({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.item}>
      <Bullet color={colors.ink} />
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export default function PrivacyScreen() {
  const { preferences, setAnalyticsEnabled, clearLocalData } = useApp();
  const [confirming, setConfirming] = useState(false);
  const usage = preferences.analyticsEnabled;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackBar label="Voltar para Ajustes" onBack={() => router.back()} />
        <View style={styles.body}>
          <View style={styles.title}>
            <Headline>Privacidade</Headline>
            <Text style={styles.subtitle}>
              Não existe conta nem login. Para o servidor, este aparelho é só um código aleatório.
            </Text>
          </View>
          <View style={[styles.card, styles.cardCobalt]}>
            <View style={styles.cardHeader}>
              <Icon name="phone" size={26} color={colors.surface} strokeWidth={1.8} />
              <Text accessibilityRole="header" style={[styles.cardTitle, styles.onCobalt]}>
                Fica neste aparelho
              </Text>
            </View>
            {[
              "Os produtos que você segue",
              "As lojas e marcas bloqueadas",
              "As ofertas que você ocultou"
            ].map((text) => (
              <View key={text} style={styles.item}>
                <Bullet color={colors.surface} />
                <Text style={[styles.itemTitle, styles.onCobalt, styles.itemText]}>{text}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.card, styles.cardWhite]}>
            <View style={styles.cardHeader}>
              <Icon name="server" size={26} strokeWidth={1.8} />
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Vai para o servidor
              </Text>
            </View>
            <ServerItem
              title="As subcategorias que você segue"
              detail="Para saber de quais ofertas mandar alerta."
            />
            <ServerItem
              title="Um código aleatório desta instalação"
              detail="Criado no primeiro uso. Não tem nome nem número de telefone."
            />
            <ServerItem
              title="Uso anônimo do app"
              detail={
                usage
                  ? "Só enquanto estiver ligado, logo abaixo."
                  : "Desligado. Nada de uso é enviado."
              }
            />
          </View>
          <View style={styles.never}>
            <Icon name="ban" size={20} />
            <Text style={styles.neverText}>Nunca pedimos nome, email, telefone nem login.</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: usage }}
            onPress={() => void setAnalyticsEnabled(!usage)}
            style={styles.usage}
          >
            <View style={styles.itemText}>
              <Text style={typography.titleSm}>Enviar uso anônimo</Text>
              <Text style={styles.itemDetail}>
                Quais telas você abre e em quais ofertas toca. Ajuda a melhorar o app.
              </Text>
            </View>
            <SwitchTrack value={usage} />
          </Pressable>
          <View style={styles.erase}>
            <Button
              label="Apagar dados deste aparelho"
              variant="destructive"
              onPress={() => setConfirming(true)}
            />
            <Text style={styles.eraseNote}>
              Apaga o que você segue, os bloqueios e as ofertas ocultadas, e cria um código novo.
            </Text>
          </View>
        </View>
      </ScrollView>
      <Dialog
        visible={confirming}
        title="Apagar tudo e recomeçar?"
        message="O que você segue, as lojas e marcas bloqueadas e as ofertas ocultadas saem deste aparelho. O app cria um código novo e volta para o começo."
        confirmLabel="Apagar e recomeçar"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void clearLocalData();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  body: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  title: { gap: 8, paddingBottom: 8, paddingHorizontal: 4 },
  subtitle: { ...typography.body, color: colors.slate },
  card: {
    borderRadius: radii.panel,
    gap: 12,
    paddingBottom: 18,
    paddingLeft: 18,
    paddingRight: 16,
    paddingTop: 16
  },
  cardCobalt: { backgroundColor: colors.cobalt },
  cardWhite: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.condensedExtraBold,
    fontSize: 28,
    lineHeight: 30
  },
  onCobalt: { color: colors.surface },
  item: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  bullet: { borderRadius: radii.bar, height: 8, marginTop: 7, width: 8 },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 21 },
  itemDetail: { ...typography.caption, color: colors.slate },
  never: {
    alignItems: "center",
    borderColor: colors.dash,
    borderRadius: radii.panel,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  neverText: { ...typography.bodySm, flex: 1 },
  usage: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 10,
    minHeight: 72,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 12
  },
  erase: { alignItems: "center", gap: 2, marginTop: 8 },
  eraseNote: {
    ...typography.caption,
    color: colors.slate,
    maxWidth: 300,
    textAlign: "center"
  }
});
