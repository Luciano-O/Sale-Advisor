import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { subcategoryModeLabel, subcategoryStatusLabel } from "../../src/following";
import { subcategoryHint, subcategoryName } from "../../src/labels";
import { activeSubcategories, addSubcategory } from "../../src/preferences";
import { colors, fonts, radii, typography } from "../../src/theme";
import type { MobileOffer, SubcategoryFollow } from "../../src/types";
import { BrandLockup } from "../../src/ui/BrandLockup";
import { Button } from "../../src/ui/Button";
import { Chip } from "../../src/ui/Chip";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { InkSwitchPanel } from "../../src/ui/InkSwitchPanel";
import { LabelRamp } from "../../src/ui/LabelRamp";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";
import { Sheet } from "../../src/ui/Sheet";
import { Snackbar } from "../../src/ui/Snackbar";
import { SubcategoryIcon } from "../../src/ui/SubcategoryIcon";

const UNDO_MS = 5_000;

function SubcategoryCard({
  subcategory,
  follow,
  offers,
  now
}: {
  subcategory: string;
  follow: SubcategoryFollow;
  offers: readonly MobileOffer[];
  now: Date;
}) {
  const status = subcategoryStatusLabel(offers, subcategory, now);
  const hasValid = !status.startsWith("Nenhuma");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/seguindo/[subcategoria]", params: { subcategoria: subcategory } })
      }
    >
      <Panel>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <SubcategoryIcon subcategory={subcategory} />
            <View style={styles.cardTitle}>
              <Text style={typography.title}>{subcategoryName(subcategory)}</Text>
              <Text style={styles.cardMode}>{subcategoryModeLabel(follow)}</Text>
            </View>
            <Icon name="chevronForward" size={22} strokeWidth={2.2} />
          </View>
          {follow.mode === "inteira" ? (
            <LabelRamp compact />
          ) : follow.products.length > 0 ? (
            <View style={styles.chips}>
              {follow.products.map((model) => (
                <Chip key={model} label={model} variant="product" />
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.cardFooter}>
          <View style={[styles.dot, hasValid && styles.dotOn]} />
          <Text style={hasValid ? styles.statusOn : styles.status}>{status}</Text>
        </View>
      </Panel>
    </Pressable>
  );
}

export default function FollowingScreen() {
  const { preferences, savePreferences, offers, feedSource, catalog, undoNotice, showUndoNotice } =
    useApp();
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const active = activeSubcategories(catalog);
  const followed = Object.entries(preferences.subcategories);
  const available = active.filter((key) => !preferences.subcategories[key]);
  // Demonstration offers are not offers for what the user follows.
  const statusOffers = feedSource === "starter" ? [] : offers;

  useEffect(() => {
    if (!undoNotice) return;
    const timer = setTimeout(() => showUndoNotice(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [showUndoNotice, undoNotice]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <BrandLockup />
          <Headline>Seguindo</Headline>
        </View>
        <InkSwitchPanel
          title="Seguir todo o hardware"
          description="Todas as ofertas boas ou melhores, de todas as subcategorias."
          value={preferences.followAll}
          onValueChange={(followAll) => void savePreferences({ ...preferences, followAll })}
        />
        {preferences.followAll ? (
          <Panel padded style={styles.allPanel}>
            <LabelRamp />
            <View style={styles.included}>
              <Text accessibilityRole="header" style={styles.includedTitle}>
                Incluídas
              </Text>
              <View style={styles.chips}>
                {active.map((key) => (
                  <Chip key={key} label={subcategoryName(key)} variant="inclusion" />
                ))}
              </View>
              <Text style={styles.includedNote}>Subcategorias novas entram automaticamente.</Text>
            </View>
          </Panel>
        ) : (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Hardware ·{" "}
              {followed.length === 1 ? "1 subcategoria" : `${followed.length} subcategorias`}
            </Text>
            {followed.map(([key, follow]) => (
              <SubcategoryCard
                key={key}
                subcategory={key}
                follow={follow}
                offers={statusOffers}
                now={now}
              />
            ))}
            {followed.length === 0 ? (
              <Text style={styles.nothing}>
                Você não está seguindo nada. Enquanto isso, não trazemos nenhuma oferta.
              </Text>
            ) : null}
            {available.length > 0 ? (
              <Button
                label="Adicionar subcategoria"
                variant="outline"
                onPress={() => setAdding(true)}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
      {undoNotice ? (
        <Snackbar
          message={undoNotice.message}
          onAction={() => {
            undoNotice.undo();
            showUndoNotice(null);
          }}
          bottom={16}
        />
      ) : null}
      <Sheet
        visible={adding}
        title="Adicionar subcategoria"
        description="Ela entra inteira. Depois você pode escolher produtos específicos."
        onClose={() => setAdding(false)}
      >
        <View style={styles.options}>
          {available.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => {
                void savePreferences(addSubcategory(preferences, key));
                setAdding(false);
              }}
              style={styles.option}
            >
              <SubcategoryIcon subcategory={key} />
              <View style={styles.optionText}>
                <Text style={typography.titleSm}>{subcategoryName(key)}</Text>
                <Text style={styles.optionHint}>{subcategoryHint(key)}</Text>
              </View>
              <Icon name="plusBox" size={28} strokeWidth={1.6} />
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 12 },
  title: { gap: 16, paddingHorizontal: 4 },
  section: { gap: 10 },
  sectionTitle: { ...typography.section, paddingHorizontal: 4 },
  cardBody: { gap: 10, paddingLeft: 16, paddingRight: 14, paddingVertical: 14 },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  cardTitle: { flex: 1, gap: 1 },
  cardMode: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cardFooter: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  dot: { backgroundColor: colors.pebble, borderRadius: radii.bar, height: 8, width: 8 },
  dotOn: { backgroundColor: colors.cobalt },
  status: { ...typography.bodySm, color: colors.slate, flexShrink: 1 },
  statusOn: { color: colors.cobalt, flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  allPanel: { gap: 14 },
  included: { gap: 8 },
  includedTitle: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 22 },
  includedNote: { ...typography.bodySm, color: colors.slate, marginTop: 4 },
  nothing: {
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
  optionText: { flex: 1, gap: 1 },
  optionHint: { ...typography.caption, color: colors.slate }
});
