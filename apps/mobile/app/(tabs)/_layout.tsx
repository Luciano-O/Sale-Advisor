import { Tabs } from "expo-router";

import { colors } from "../../src/theme";
import { BottomNav, type NavKey } from "../../src/ui/BottomNav";

const ROUTES: Record<NavKey, string> = {
  ofertas: "index",
  seguindo: "seguindo",
  ajustes: "ajustes"
};
const KEYS: readonly NavKey[] = ["ofertas", "seguindo", "ajustes"];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ground } }}
      tabBar={({ state, navigation }) => (
        <BottomNav
          active={KEYS[state.index] ?? "ofertas"}
          onSelect={(key) => navigation.navigate(ROUTES[key])}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="seguindo" />
      <Tabs.Screen name="ajustes" />
    </Tabs>
  );
}
