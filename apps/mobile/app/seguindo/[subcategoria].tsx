import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { productStatus } from "../../src/following";
import { subcategoryAddExample, subcategoryLowerName, subcategoryName } from "../../src/labels";
import {
  removeSubcategory,
  setSubcategoryMode,
  toggleSubcategoryProduct
} from "../../src/preferences";
import { colors, fonts, MIN_TOUCH_TARGET, radii, typography } from "../../src/theme";
import type { LocalPreferences, SubcategoryMode } from "../../src/types";
import { BackBar } from "../../src/ui/BackBar";
import { Button } from "../../src/ui/Button";
import { CatalogOfflineNotice } from "../../src/ui/CatalogOfflineNotice";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { LabelRamp } from "../../src/ui/LabelRamp";
import { OfferStatusLine } from "../../src/ui/OfferStatusLine";
import { Panel } from "../../src/ui/Panel";
import { ProductSearch } from "../../src/ui/ProductSearch";
import { Screen } from "../../src/ui/Screen";
import { SearchField } from "../../src/ui/SearchField";
import { SegmentedControl } from "../../src/ui/SegmentedControl";
import { Snackbar } from "../../src/ui/Snackbar";
import { SubcategoryIcon } from "../../src/ui/SubcategoryIcon";

const MODES: ReadonlyArray<{ key: SubcategoryMode; label: string }> = [
  { key: "produtos", label: "Produtos específicos" },
  { key: "inteira", label: "Subcategoria inteira" }
];
const UNDO_MS = 5_000;

export default function EditSubcategoryScreen() {
  const { subcategoria: subcategory = "" } = useLocalSearchParams<{ subcategoria: string }>();
  const {
    preferences,
    savePreferences,
    offers,
    feedSource,
    catalog,
    catalogStatus,
    reloadCatalog,
    showUndoNotice
  } = useApp();
  const [searching, setSearching] = useState(false);
  // Undoing restores the whole previous state, which keeps a removed product in its place.
  const [removed, setRemoved] = useState<{ model: string; before: LocalPreferences } | null>(null);
  const follow = preferences.subcategories[subcategory];
  const now = new Date();
  const statusOffers = feedSource === "starter" ? [] : offers;
  const lowerName = subcategoryLowerName(subcategory);
  const offline = catalogStatus === "failed" && !catalog?.length;

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  // Nothing to edit: this subcategory was just unfollowed, on the way back.
  if (!follow) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackBar label="Voltar para Seguindo" onBack={() => router.back()} />
        <View style={styles.body}>
          <View style={styles.title}>
            <View style={styles.titleRow}>
              <SubcategoryIcon subcategory={subcategory} size={34} />
              <Headline style={styles.headline}>{subcategoryName(subcategory)}</Headline>
            </View>
            <Text style={styles.note}>As mudanças valem na hora.</Text>
          </View>
          <SegmentedControl
            label={`Como seguir ${lowerName}`}
            options={MODES}
            value={follow.mode}
            onChange={(mode) =>
              void savePreferences(setSubcategoryMode(preferences, subcategory, mode))
            }
          />
          {follow.mode === "inteira" ? (
            <Panel padded style={styles.wholePanel}>
              <LabelRamp />
              <Text style={styles.wholeText}>
                Todas as ofertas boas ou melhores de {lowerName}, de qualquer modelo. Seus produtos
                ficam guardados se você voltar para específicos.
              </Text>
            </Panel>
          ) : (
            <View style={styles.specific}>
              {offline ? (
                <>
                  <CatalogOfflineNotice
                    body="Os produtos que você já segue continuam valendo. Para adicionar outros, a lista precisa da internet."
                    onRetry={() => void reloadCatalog()}
                  />
                  <SearchField disabled placeholder={subcategoryAddExample(subcategory)} />
                </>
              ) : (
                <Pressable
                  accessibilityRole="search"
                  onPress={() => setSearching(true)}
                  style={styles.searchEntry}
                >
                  <Icon name="search" size={20} strokeWidth={2.2} />
                  <Text numberOfLines={1} style={styles.searchText}>
                    {subcategoryAddExample(subcategory)}
                  </Text>
                </Pressable>
              )}
              {follow.products.length > 0 ? (
                <Panel>
                  {follow.products.map((model, index) => (
                    <View key={model} style={[styles.item, index > 0 && styles.itemDivided]}>
                      <View style={styles.itemText}>
                        <Text style={styles.itemName}>{model}</Text>
                        <OfferStatusLine
                          status={productStatus(statusOffers, model, now)}
                          foundText="oferta válida agora"
                          waitingText="nenhuma oferta boa agora"
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Parar de seguir ${model}`}
                        onPress={() => {
                          setRemoved({ model, before: preferences });
                          void savePreferences(
                            toggleSubcategoryProduct(preferences, subcategory, model)
                          );
                        }}
                        style={styles.remove}
                      >
                        <Icon name="close" size={20} strokeWidth={2.4} />
                      </Pressable>
                    </View>
                  ))}
                </Panel>
              ) : (
                <Text style={styles.empty}>
                  Nenhum produto escolhido. Adicione um acima ou siga a subcategoria inteira.
                </Text>
              )}
            </View>
          )}
          <View style={styles.stop}>
            <Button
              label={`Parar de seguir ${lowerName}`}
              variant="destructive"
              onPress={() => {
                const before = preferences;
                void savePreferences(removeSubcategory(preferences, subcategory));
                showUndoNotice({
                  message: `${subcategoryName(subcategory)} saiu da lista`,
                  undo: () => void savePreferences(before)
                });
                router.back();
              }}
            />
          </View>
        </View>
      </ScrollView>
      {removed ? (
        <Snackbar
          message={`${removed.model} saiu da lista`}
          onAction={() => {
            void savePreferences(removed.before);
            setRemoved(null);
          }}
        />
      ) : null}
      <ProductSearch
        visible={searching}
        subcategory={subcategory}
        catalog={catalog ?? []}
        loading={catalogStatus === "loading"}
        selected={follow.products}
        onToggle={(model) =>
          void savePreferences(toggleSubcategoryProduct(preferences, subcategory, model))
        }
        onClose={() => setSearching(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  body: { gap: 18, paddingHorizontal: 24, paddingTop: 8 },
  title: { gap: 8 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  headline: { flexShrink: 1 },
  note: { ...typography.bodySm, color: colors.slate },
  wholePanel: { gap: 12 },
  wholeText: { ...typography.bodySm, color: colors.slate },
  specific: { gap: 12 },
  searchEntry: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radii.control,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16
  },
  searchText: { color: colors.slate, flex: 1, fontFamily: fonts.body, fontSize: 16 },
  item: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 12
  },
  itemDivided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  itemText: { flex: 1, gap: 6 },
  itemName: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 22, lineHeight: 24 },
  remove: {
    alignItems: "center",
    height: MIN_TOUCH_TARGET,
    justifyContent: "center",
    width: MIN_TOUCH_TARGET
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
  stop: { alignItems: "center", marginTop: 8 }
});
