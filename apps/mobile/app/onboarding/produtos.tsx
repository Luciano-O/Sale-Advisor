import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { subcategoryLowerName, subcategoryName, subcategorySearchExample } from "../../src/labels";
import { useOnboarding } from "../../src/onboarding-context";
import {
  followPendingWhole,
  pendingSubcategories,
  setSubcategoryMode,
  toggleSubcategoryProduct
} from "../../src/preferences";
import { colors, fonts, radii, typography } from "../../src/theme";
import type { SubcategoryFollow, SubcategoryMode } from "../../src/types";
import { BottomBar } from "../../src/ui/BottomBar";
import { Button } from "../../src/ui/Button";
import { CatalogOfflineNotice } from "../../src/ui/CatalogOfflineNotice";
import { Chip } from "../../src/ui/Chip";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { LabelRamp } from "../../src/ui/LabelRamp";
import { OnboardingHeader } from "../../src/ui/OnboardingHeader";
import { Panel } from "../../src/ui/Panel";
import { ProductSearch } from "../../src/ui/ProductSearch";
import { Screen } from "../../src/ui/Screen";
import { SegmentedControl } from "../../src/ui/SegmentedControl";

const MODES: ReadonlyArray<{ key: SubcategoryMode; label: string }> = [
  { key: "produtos", label: "Produtos específicos" },
  { key: "inteira", label: "Subcategoria inteira" }
];

function followSummary({ mode, products }: SubcategoryFollow): string {
  if (mode === "inteira") return "inteira";
  if (products.length === 0) return "nenhum produto";
  return products.length === 1 ? "1 produto" : `${products.length} produtos`;
}

export default function ProductsStep() {
  const { catalog, catalogStatus, reloadCatalog } = useApp();
  const { draft, update } = useOnboarding();
  const [searching, setSearching] = useState<string | null>(null);
  const groups = Object.entries(draft.subcategories);
  const pending = pendingSubcategories(draft);
  const toAlerts = () => router.push("/onboarding/alertas");
  // Without a list to pick from, the only choice left is following the subcategories whole.
  const offline = catalogStatus === "failed" && !catalog?.length;
  const followWholeAndGo = () => {
    update((current) =>
      Object.keys(current.subcategories).reduce(
        (next, key) => setSubcategoryMode(next, key, "inteira"),
        current
      )
    );
    toAlerts();
  };
  return (
    <Screen>
      <OnboardingHeader
        step={1}
        onSkip={() => {
          update(followPendingWhole);
          toAlerts();
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.title}>
          <Headline>Quais produtos você quer?</Headline>
          <Text style={styles.body}>
            Para cada subcategoria, escolha produtos específicos ou siga a subcategoria inteira.
          </Text>
        </View>
        {offline ? (
          <>
            <CatalogOfflineNotice
              body="Na primeira vez, a lista precisa da internet. Você pode seguir as subcategorias inteiras e escolher produtos depois."
              onRetry={() => void reloadCatalog()}
            />
            {groups.map(([key]) => (
              <View key={key} style={styles.groupHeader}>
                <Text accessibilityRole="header" style={styles.groupName}>
                  {subcategoryName(key)}
                </Text>
                <Text style={styles.summary}>inteira</Text>
              </View>
            ))}
          </>
        ) : (
          groups.map(([key, follow]) => (
            <View key={key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text accessibilityRole="header" style={styles.groupName}>
                  {subcategoryName(key)}
                </Text>
                <Text style={styles.summary}>{followSummary(follow)}</Text>
              </View>
              <SegmentedControl
                label={`Como seguir ${subcategoryLowerName(key)}`}
                options={MODES}
                value={follow.mode}
                onChange={(mode) => update((current) => setSubcategoryMode(current, key, mode))}
              />
              {follow.mode === "inteira" ? (
                <Panel padded style={styles.wholePanel}>
                  <LabelRamp />
                  <Text style={styles.wholeText}>
                    Todas as ofertas boas ou melhores de {subcategoryLowerName(key)}, de qualquer
                    modelo.
                  </Text>
                </Panel>
              ) : (
                <View style={styles.specific}>
                  <Pressable
                    accessibilityRole="search"
                    onPress={() => setSearching(key)}
                    style={styles.searchEntry}
                  >
                    <Icon name="search" size={20} strokeWidth={2.2} />
                    <Text numberOfLines={1} style={styles.searchText}>
                      {subcategorySearchExample(key)}
                    </Text>
                  </Pressable>
                  {follow.products.length > 0 ? (
                    <View style={styles.chips}>
                      {follow.products.map((model) => (
                        <Chip
                          key={model}
                          large
                          label={model}
                          variant="product"
                          onRemove={() =>
                            update((current) => toggleSubcategoryProduct(current, key, model))
                          }
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.needsPick}>
                      Escolha pelo menos um produto ou siga a subcategoria inteira.
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
      {offline ? (
        <BottomBar caption="Subcategorias inteiras · ofertas boas ou melhores">
          <Button label="Continuar assim" icon="arrowForward" onPress={followWholeAndGo} />
        </BottomBar>
      ) : (
        <BottomBar
          caption={
            pending.length > 0
              ? `Escolha produtos em ${pending.map(subcategoryLowerName).join(" e ")} ou siga inteira`
              : groups
                  .map(([key, follow]) => `${subcategoryName(key)}: ${followSummary(follow)}`)
                  .join(" · ")
          }
        >
          <Button
            label="Continuar"
            icon="arrowForward"
            disabled={pending.length > 0}
            onPress={toAlerts}
          />
        </BottomBar>
      )}
      <ProductSearch
        visible={searching !== null}
        subcategory={searching ?? ""}
        catalog={catalog ?? []}
        loading={catalogStatus === "loading"}
        selected={searching ? (draft.subcategories[searching]?.products ?? []) : []}
        onToggle={(model) => {
          if (searching) update((current) => toggleSubcategoryProduct(current, searching, model));
        }}
        onClose={() => setSearching(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 26, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 22 },
  title: { gap: 10 },
  body: { ...typography.body, color: colors.slate },
  group: { gap: 12 },
  groupHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  groupName: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 26, lineHeight: 28 },
  summary: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 15 },
  wholePanel: { gap: 12 },
  wholeText: { ...typography.bodySm, color: colors.slate },
  specific: { gap: 10 },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  needsPick: { ...typography.bodySm }
});
