import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "../../src/app-context";
import { filterOffers } from "../../src/filters";
import { productStatus, subcategoryStatus, type ProductStatus } from "../../src/following";
import { subcategoryName } from "../../src/labels";
import { useOnboarding } from "../../src/onboarding-context";
import { activeSubcategories } from "../../src/preferences";
import { colors, fonts, MIN_TOUCH_TARGET, typography } from "../../src/theme";
import type { MobileOffer } from "../../src/types";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { OfferStatusLine } from "../../src/ui/OfferStatusLine";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";

function FollowedItem({
  name,
  status,
  divided = false
}: {
  name: string;
  status: ProductStatus | null;
  divided?: boolean;
}) {
  return (
    <View style={[styles.item, divided && styles.divided]}>
      <Text style={styles.itemName}>{name}</Text>
      <OfferStatusLine
        status={status}
        foundText="passou no teste hoje"
        waitingText="nenhuma oferta boa ainda"
      />
    </View>
  );
}

export default function ReadyStep() {
  const { feedOffers, feedSource, catalog } = useApp();
  const { draft, finish } = useOnboarding();
  const insets = useSafeAreaInsets();
  const now = new Date();
  // Demonstration offers never passed any test.
  const relevant: MobileOffer[] =
    feedSource === "starter" ? [] : filterOffers(feedOffers, draft, new Set(), "discount");
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <Headline>
            {draft.alertsEnabled
              ? "Pronto. Agora o histórico trabalha por você."
              : "Pronto. As ofertas aprovadas vão aparecer no feed."}
          </Headline>
          <Text style={styles.body}>
            {draft.alertsEnabled
              ? "Procuramos ofertas o tempo todo e testamos cada uma que encontramos. Quando alguma passar, trazemos para você."
              : "Sem alertas, você só fica sabendo quando abrir o app."}
          </Text>
        </View>
        <Panel>
          <View style={styles.panelHeader}>
            <Text accessibilityRole="header" style={styles.panelTitle}>
              Acompanhando
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.dismissTo("/onboarding/subcategorias")}
              style={styles.edit}
            >
              <Text style={styles.editText}>Editar</Text>
            </Pressable>
          </View>
          {draft.followAll ? (
            <View style={styles.divided}>
              <FollowedItem
                name="Todo o hardware"
                status={
                  activeSubcategories(catalog)
                    .map((key) => subcategoryStatus(relevant, key, now))
                    .find((status) => status !== null) ?? null
                }
              />
            </View>
          ) : (
            Object.entries(draft.subcategories).map(([key, follow]) => (
              <View key={key} style={styles.divided}>
                <Text style={styles.group}>{subcategoryName(key)}</Text>
                {follow.mode === "inteira" ? (
                  <FollowedItem
                    name="Subcategoria inteira"
                    status={subcategoryStatus(relevant, key, now)}
                  />
                ) : (
                  follow.products.map((model, index) => (
                    <FollowedItem
                      key={model}
                      name={model}
                      status={productStatus(relevant, model, now)}
                      divided={index > 0}
                    />
                  ))
                )}
              </View>
            ))
          )}
          {draft.alertsEnabled ? (
            <View style={styles.alertsOn}>
              <Icon name="bell" size={22} color={colors.surface} />
              <Text style={styles.alertsText}>Alertas ligados</Text>
              <Icon name="check" size={22} color={colors.surface} strokeWidth={2.6} />
            </View>
          ) : (
            <View style={styles.alertsOff}>
              <View style={styles.alertsRow}>
                <Icon name="bellOff" size={22} color={colors.surface} />
                <Text style={styles.alertsText}>Alertas desligados</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void Linking.openSettings()}
                style={styles.settings}
              >
                <Text style={styles.settingsText}>Ativar nas configurações do Android</Text>
              </Pressable>
            </View>
          )}
        </Panel>
        <View style={styles.spacer} />
        <View style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <Button label="Ver ofertas" icon="arrowForward" onPress={() => void finish()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 22, paddingHorizontal: 24, paddingTop: 24 },
  title: { gap: 10 },
  body: { ...typography.body, color: colors.slate, fontSize: 16, lineHeight: 23 },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16
  },
  panelTitle: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 22 },
  edit: { justifyContent: "center", minHeight: MIN_TOUCH_TARGET, paddingLeft: 16 },
  editText: { color: colors.cobalt, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  divided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  group: {
    color: colors.slate,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  item: { gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  itemName: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 22, lineHeight: 24 },
  alertsOn: {
    alignItems: "center",
    backgroundColor: colors.cobalt,
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16
  },
  alertsOff: { backgroundColor: colors.ink, gap: 12, padding: 16 },
  alertsRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  alertsText: { color: colors.surface, flex: 1, fontFamily: fonts.condensedBold, fontSize: 20 },
  settings: {
    alignItems: "center",
    borderColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12
  },
  settingsText: { color: colors.surface, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  spacer: { flex: 1 }
});
