import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import {
  availableStores,
  blockedStoreRows,
  hiddenOfferRow,
  type PublicStore
} from "../../src/settings";
import { colors, fonts, radii, typography } from "../../src/theme";
import type { HiddenOffer } from "../../src/types";
import { BackBar } from "../../src/ui/BackBar";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";
import { Sheet } from "../../src/ui/Sheet";
import { Snackbar } from "../../src/ui/Snackbar";

const UNDO_MS = 5_000;

function ItemRow({
  name,
  detail,
  actionLabel,
  accessibilityLabel,
  divided,
  onAction
}: {
  name: string;
  detail: string;
  actionLabel: string;
  accessibilityLabel: string;
  divided: boolean;
  onAction(): void;
}) {
  return (
    <View style={[styles.row, divided && styles.rowDivided]}>
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{name}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Button
        label={actionLabel}
        accessibilityLabel={accessibilityLabel}
        variant="outline"
        onPress={onAction}
      />
    </View>
  );
}

export default function NotShownScreen() {
  const {
    preferences,
    savePreferences,
    hiddenOffers,
    unhideOffer,
    restoreHidden,
    stores,
    storesStatus,
    reloadStores,
    track
  } = useApp();
  const [blocking, setBlocking] = useState(false);
  const [undo, setUndo] = useState<{ message: string; run(): void } | null>(null);
  const now = new Date();
  const blocked = preferences.blockedStores;
  const options = availableStores(stores ?? [], blocked);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const show = (offer: HiddenOffer, name: string) => {
    void unhideOffer(offer.id);
    setUndo({ message: `${name} voltou para a lista`, run: () => void restoreHidden(offer) });
  };
  const setBlocked = (value: string[]) =>
    void savePreferences({ ...preferences, blockedStores: value });
  const unblock = (key: string, name: string) => {
    setBlocked(blocked.filter((item) => item !== key));
    setUndo({ message: `${name} desbloqueada`, run: () => setBlocked(blocked) });
  };
  const block = ({ name, domain }: PublicStore) => {
    setBlocked([...blocked, domain]);
    setBlocking(false);
    setUndo({ message: `${name} bloqueada`, run: () => setBlocked(blocked) });
    void track("store_blocked");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackBar label="Voltar para Ajustes" onBack={() => router.back()} />
        <View style={styles.body}>
          <View style={styles.title}>
            <Headline>Não mostrar</Headline>
            <Text style={styles.subtitle}>
              Nada desta lista aparece nas ofertas nem vira alerta. Fica só neste aparelho.
            </Text>
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Ofertas ocultadas <Text style={styles.sectionCount}>{hiddenOffers.length || ""}</Text>
            </Text>
            {hiddenOffers.length > 0 ? (
              <Panel>
                {hiddenOffers.map((offer, index) => {
                  const row = hiddenOfferRow(offer, now);
                  return (
                    <ItemRow
                      key={row.id}
                      name={row.name}
                      detail={row.meta}
                      actionLabel="Mostrar"
                      accessibilityLabel={`Mostrar de novo ${row.name}`}
                      divided={index > 0}
                      onAction={() => show(offer, row.name)}
                    />
                  );
                })}
              </Panel>
            ) : (
              <Text style={styles.empty}>
                Nenhuma oferta oculta. Use Ocultar no detalhe de uma oferta para tirá-la da lista.
              </Text>
            )}
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Lojas bloqueadas <Text style={styles.sectionCount}>{blocked.length || ""}</Text>
            </Text>
            {blocked.length > 0 ? (
              <Panel>
                {blockedStoreRows(blocked, stores ?? []).map((row, index) => (
                  <ItemRow
                    key={row.key}
                    name={row.name}
                    detail={row.hint}
                    actionLabel="Desbloquear"
                    accessibilityLabel={`Desbloquear ${row.name}`}
                    divided={index > 0}
                    onAction={() => unblock(row.key, row.name)}
                  />
                ))}
              </Panel>
            ) : (
              <Text style={styles.empty}>Nenhuma loja bloqueada.</Text>
            )}
            <Button label="Bloquear uma loja" variant="outline" onPress={() => setBlocking(true)} />
          </View>
        </View>
      </ScrollView>
      {undo ? (
        <Snackbar
          message={undo.message}
          onAction={() => {
            undo.run();
            setUndo(null);
          }}
        />
      ) : null}
      <Sheet
        visible={blocking}
        title="Bloquear uma loja"
        description="As ofertas desta loja somem da lista e não viram alerta."
        onClose={() => setBlocking(false)}
      >
        <ScrollView style={styles.options}>
          {options.map((store) => (
            <Pressable
              key={store.domain}
              accessibilityRole="button"
              accessibilityLabel={`Bloquear ${store.name}`}
              onPress={() => block(store)}
              style={styles.option}
            >
              <View style={styles.rowText}>
                <Text style={typography.titleSm}>{store.name}</Text>
                <Text style={styles.rowDetail}>{store.domain}</Text>
              </View>
              <Icon name="ban" strokeWidth={1.9} />
            </Pressable>
          ))}
          {options.length === 0 && storesStatus === "loading" ? (
            <ActivityIndicator color={colors.cobalt} style={styles.loading} />
          ) : null}
          {options.length === 0 && storesStatus === "failed" ? (
            <View style={styles.message}>
              <Text style={styles.messageText}>
                Sem conexão com a lista de lojas. Tente de novo em instantes.
              </Text>
              <Button
                label="Tentar de novo"
                variant="outline"
                onPress={() => void reloadStores()}
              />
            </View>
          ) : null}
          {options.length === 0 && storesStatus === "ready" ? (
            <Text style={[styles.messageText, styles.message]}>
              Não há outras lojas para bloquear.
            </Text>
          ) : null}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 96 },
  body: { gap: 28, paddingHorizontal: 20, paddingTop: 8 },
  title: { gap: 8, paddingHorizontal: 4 },
  subtitle: { ...typography.body, color: colors.slate },
  section: { gap: 10 },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.condensedBold,
    fontSize: 22,
    lineHeight: 24,
    paddingHorizontal: 4
  },
  sectionCount: {
    color: colors.slate,
    fontFamily: fonts.condensedSemiBold,
    fontVariant: ["tabular-nums"]
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10
  },
  rowDivided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  rowText: { flex: 1, gap: 3 },
  rowName: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 21, lineHeight: 22 },
  rowDetail: {
    ...typography.caption,
    color: colors.slate,
    fontVariant: ["tabular-nums"]
  },
  empty: {
    ...typography.bodySm,
    borderColor: colors.dash,
    borderRadius: radii.panel,
    borderStyle: "dashed",
    borderWidth: 1.5,
    color: colors.slate,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  options: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  option: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  loading: { marginVertical: 24 },
  message: { gap: 12, padding: 20 },
  messageText: { ...typography.body, color: colors.slate }
});
