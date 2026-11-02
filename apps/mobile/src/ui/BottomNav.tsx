import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radii } from "../theme";
import { Icon, type IconName } from "./Icon";

export type NavKey = "ofertas" | "seguindo" | "ajustes";

const ITEMS: ReadonlyArray<{ key: NavKey; label: string; icon: IconName }> = [
  { key: "ofertas", label: "Ofertas", icon: "navOffers" },
  { key: "seguindo", label: "Seguindo", icon: "navFollowing" },
  { key: "ajustes", label: "Ajustes", icon: "navSettings" }
];

export function BottomNav({ active, onSelect }: { active: NavKey; onSelect(key: NavKey): void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {ITEMS.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.key)}
            style={styles.item}
          >
            <View style={[styles.indicator, selected && styles.indicatorActive]}>
              <Icon
                name={item.icon}
                size={22}
                color={selected ? colors.surface : colors.ink}
                strokeWidth={selected ? 2.4 : 2}
              />
            </View>
            <Text style={[styles.label, selected && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 80
  },
  item: { alignItems: "center", flex: 1, gap: 4, justifyContent: "center", paddingTop: 6 },
  indicator: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radii.control,
    height: 32,
    justifyContent: "center",
    overflow: "hidden",
    width: 56
  },
  indicatorActive: { backgroundColor: colors.cobalt },
  label: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 13 },
  labelActive: { color: colors.ink, fontFamily: fonts.condensedBold }
});
