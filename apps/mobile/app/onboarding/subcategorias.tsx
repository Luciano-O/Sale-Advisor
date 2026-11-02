import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { subcategoryHint, subcategoryName } from "../../src/labels";
import { useOnboarding } from "../../src/onboarding-context";
import {
  activeSubcategories,
  stepAfterSubcategories,
  toggleSubcategory
} from "../../src/preferences";
import { colors, radii, typography } from "../../src/theme";
import { BottomBar } from "../../src/ui/BottomBar";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { InkSwitchPanel } from "../../src/ui/InkSwitchPanel";
import { OnboardingHeader } from "../../src/ui/OnboardingHeader";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";
import { SubcategoryIcon } from "../../src/ui/SubcategoryIcon";

function caption(followAll: boolean, chosen: readonly string[]): string {
  if (followAll) return "Todo o hardware · ofertas boas ou melhores";
  if (chosen.length === 0) return "Escolha pelo menos uma subcategoria";
  const names = chosen.map(subcategoryName).join(", ");
  return chosen.length === 1 ? `1 escolhida · ${names}` : `${chosen.length} escolhidas · ${names}`;
}

export default function SubcategoriesStep() {
  const { catalog } = useApp();
  const { draft, update } = useOnboarding();
  const active = activeSubcategories(catalog);
  const chosen = Object.keys(draft.subcategories);
  const canContinue = draft.followAll || chosen.length > 0;
  const goOn = (followAll: boolean) => {
    const next = { ...draft, followAll };
    update(() => next);
    router.push(`/onboarding/${stepAfterSubcategories(next)}`);
  };
  return (
    <Screen>
      <OnboardingHeader step={0} onSkip={() => goOn(true)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <Headline>O que você quer acompanhar?</Headline>
          <Text style={styles.body}>
            Siga a categoria inteira ou escolha as subcategorias. Depois você decide os produtos de
            cada uma.
          </Text>
        </View>
        <InkSwitchPanel
          title="Seguir todo o hardware"
          description="Todas as ofertas boas ou melhores, de todas as subcategorias."
          value={draft.followAll}
          onValueChange={(followAll) => update((current) => ({ ...current, followAll }))}
        />
        <View style={styles.section}>
          <Text accessibilityRole="header" style={typography.section}>
            {draft.followAll ? "Incluídas no hardware inteiro" : "Ou escolha as subcategorias"}
          </Text>
          <Panel>
            {active.map((key, index) => {
              const hot = !draft.followAll && Boolean(draft.subcategories[key]);
              const on = draft.followAll || hot;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: draft.followAll }}
                  disabled={draft.followAll}
                  onPress={() => update((current) => toggleSubcategory(current, key))}
                  style={[
                    styles.row,
                    index > 0 && styles.rowDivided,
                    draft.followAll && styles.rowIncluded,
                    hot && styles.rowHot
                  ]}
                >
                  <SubcategoryIcon
                    subcategory={key}
                    color={hot ? colors.surface : draft.followAll ? colors.cobalt : colors.ink}
                  />
                  <View style={styles.rowText}>
                    <Text style={[typography.titleSm, hot && styles.textHot]}>
                      {subcategoryName(key)}
                    </Text>
                    <Text style={[styles.hint, hot && styles.hintHot]}>{subcategoryHint(key)}</Text>
                  </View>
                  <View style={[styles.box, on && styles.boxOn, hot && styles.boxHot]}>
                    {on ? (
                      <Icon
                        name="check"
                        size={16}
                        color={hot ? colors.cobalt : colors.surface}
                        strokeWidth={3.2}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Panel>
        </View>
      </ScrollView>
      <BottomBar caption={caption(draft.followAll, chosen)}>
        <Button
          label="Continuar"
          icon="arrowForward"
          disabled={!canContinue}
          onPress={() => goOn(draft.followAll)}
        />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 22 },
  title: { gap: 10 },
  body: { ...typography.body, color: colors.slate },
  section: { gap: 10 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  rowDivided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  rowIncluded: { backgroundColor: colors.cobaltWash },
  rowHot: { backgroundColor: colors.cobalt },
  rowText: { flex: 1, gap: 1 },
  textHot: { color: colors.surface },
  hint: { ...typography.caption, color: colors.slate },
  hintHot: { color: colors.cobaltMist },
  box: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.slate,
    borderRadius: radii.chip - 1,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  boxOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  boxHot: { backgroundColor: colors.surface, borderColor: colors.surface }
});
