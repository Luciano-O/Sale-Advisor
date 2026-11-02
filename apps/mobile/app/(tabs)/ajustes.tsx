import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  AppState as NativeAppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useApp } from "../../src/app-context";
import { notificationPermission } from "../../src/notifications";
import {
  alertsPanelState,
  blockedStoresSummary,
  hiddenOffersSummary,
  type NotificationPermission
} from "../../src/settings";
import { colors, fonts, radii, typography } from "../../src/theme";
import { BrandLockup } from "../../src/ui/BrandLockup";
import { Button } from "../../src/ui/Button";
import { DeltaTag } from "../../src/ui/DeltaTag";
import { Headline } from "../../src/ui/Headline";
import { Icon, type IconName } from "../../src/ui/Icon";
import { InkSwitchPanel } from "../../src/ui/InkSwitchPanel";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";

function SettingsRow({
  icon,
  title,
  detail,
  count,
  divided = false,
  onPress
}: {
  icon: IconName;
  title: string;
  detail: string;
  count?: number;
  divided?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, divided && styles.rowDivided]}
    >
      <Icon name={icon} strokeWidth={1.8} />
      <View style={styles.rowText}>
        <Text style={typography.titleSm}>{title}</Text>
        <Text numberOfLines={2} style={styles.rowDetail}>
          {detail}
        </Text>
      </View>
      {count ? <Text style={styles.count}>{count}</Text> : null}
      <Icon name="chevronForward" size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { preferences, setAlertsEnabled, hiddenOffers, stores } = useApp();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const readPermission = useCallback(() => {
    void notificationPermission().then(setPermission);
  }, []);
  useFocusEffect(readPermission);
  // Coming back from the Android settings changes the answer while this tab stays focused.
  useEffect(() => {
    const subscription = NativeAppState.addEventListener("change", (state) => {
      if (state === "active") readPermission();
    });
    return () => subscription.remove();
  }, [readPermission]);
  const panel = permission ? alertsPanelState(permission, preferences.alertsEnabled) : null;
  const toNotShown = () => router.push("/ajustes/nao-mostrar");
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <BrandLockup />
          <Headline>Ajustes</Headline>
        </View>
        {panel === "blocked" ? (
          <View style={styles.blocked}>
            <View style={styles.blockedHeader}>
              <View style={styles.blockedTitle}>
                <Text style={styles.alertsTitle}>Alertas de ofertas</Text>
                <DeltaTag value="Bloqueados no Android" />
              </View>
              <Icon name="bellOff" size={26} color={colors.surface} strokeWidth={1.8} />
            </View>
            <Text style={styles.blockedBody}>
              O Android está impedindo os alertas deste app. As ofertas continuam na lista, mas você
              só fica sabendo quando abrir.
            </Text>
            <Button
              label="Abrir configurações do Android"
              variant="onInk"
              icon="external"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : panel ? (
          <InkSwitchPanel
            title="Alertas de ofertas"
            description={
              panel === "on"
                ? "Um alerta para cada oferta que passa no teste, só do que você segue."
                : "Desligados. As ofertas continuam na lista, sem alerta."
            }
            value={panel === "on"}
            onValueChange={(value) => void setAlertsEnabled(value).then(readPermission)}
          />
        ) : null}
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Não mostrar
          </Text>
          <Panel>
            <SettingsRow
              icon="eyeOff"
              title="Ofertas ocultadas"
              detail={hiddenOffersSummary(hiddenOffers)}
              count={hiddenOffers.length}
              onPress={toNotShown}
            />
            <SettingsRow
              divided
              icon="store"
              title="Lojas bloqueadas"
              detail={blockedStoresSummary(preferences.blockedStores, stores ?? [])}
              count={preferences.blockedStores.length}
              onPress={toNotShown}
            />
          </Panel>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Privacidade
          </Text>
          <Panel>
            <SettingsRow
              icon="shield"
              title="O que sai do aparelho"
              detail="Só as subcategorias e um código aleatório."
              onPress={() => router.push("/ajustes/privacidade")}
            />
          </Panel>
        </View>
        <View style={styles.footer}>
          <Svg width={58} height={44} viewBox="0 0 58 44">
            <Rect x={0} y={0} width={56} height={11} rx={2} fill={colors.ink} />
            <Rect x={0} y={16} width={38} height={11} rx={2} fill={colors.ink} />
            <Rect x={0} y={32} width={23} height={11} rx={2} fill={colors.cobalt} />
          </Svg>
          <View style={styles.footerText}>
            <Text style={styles.motto}>Toda oferta passa por um teste.</Text>
            <Text style={styles.version}>
              Sale Advisor · versão {Constants.expoConfig?.version ?? ""}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 12 },
  title: { gap: 16, paddingHorizontal: 4 },
  blocked: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 12,
    paddingBottom: 16,
    paddingLeft: 18,
    paddingRight: 16,
    paddingTop: 16
  },
  blockedHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  blockedTitle: { flex: 1, gap: 8 },
  alertsTitle: {
    color: colors.surface,
    fontFamily: fonts.condensedBold,
    fontSize: 23,
    lineHeight: 24
  },
  blockedBody: { ...typography.bodySm, color: colors.inkMist },
  section: { gap: 10, marginTop: 8 },
  sectionTitle: { ...typography.section, paddingHorizontal: 4 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 10
  },
  rowDivided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  rowText: { flex: 1, gap: 2 },
  rowDetail: { ...typography.caption, color: colors.slate },
  count: {
    color: colors.ink,
    fontFamily: fonts.condensedBold,
    fontSize: 22,
    fontVariant: ["tabular-nums"]
  },
  footer: { gap: 12, paddingHorizontal: 4, paddingTop: 28 },
  footerText: { gap: 4 },
  motto: { color: colors.ink, fontFamily: fonts.condensedExtraBold, fontSize: 26, lineHeight: 28 },
  version: { ...typography.caption, color: colors.slate, fontVariant: ["tabular-nums"] }
});
