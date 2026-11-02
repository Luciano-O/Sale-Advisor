import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchOffer } from "../../src/api";
import { useApp } from "../../src/app-context";
import { formatMoney, formatRelativeTime } from "../../src/format";
import { conditionName, offerName, subcategorySingularName } from "../../src/labels";
import { offerState } from "../../src/offer-state";
import { colors, fonts, MIN_TOUCH_TARGET, radii, typography } from "../../src/theme";
import type { MobileOffer } from "../../src/types";
import { Button } from "../../src/ui/Button";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";
import { VerdictChart } from "../../src/ui/VerdictChart";

// Opened from a push, the offer may be the first screen: there is nothing to go back to.
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function BackBar({ onHide }: { onHide?: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={leave}
        style={styles.back}
      >
        <Icon name="arrowBack" strokeWidth={2.2} />
      </Pressable>
      {onHide ? (
        <Pressable accessibilityRole="button" onPress={onHide} style={styles.hide}>
          <Icon name="eyeOff" size={20} />
          <Text style={styles.hideText}>Ocultar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CouponButton({ coupon }: { coupon: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? "Cupom copiado" : `Copiar cupom ${coupon}`}
      hitSlop={6}
      onPress={() => {
        void Clipboard.setStringAsync(coupon);
        setCopied(true);
      }}
      style={styles.coupon}
    >
      <Text numberOfLines={1} style={styles.couponText}>
        {copied ? "Copiado" : `Cupom ${coupon}`}
      </Text>
      <Icon name="copy" size={16} strokeWidth={2.2} />
    </Pressable>
  );
}

function OfferDetails({ offer }: { offer: MobileOffer }) {
  const { hideOffer, track } = useApp();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const expired = offerState(offer, now) === "expired";
  const isDemo = offer.id.startsWith("demo-");
  const openStore = () => {
    if (!offer.url) return;
    void track("offer_clicked", { offerId: offer.id });
    void Linking.openURL(offer.url);
  };
  const storeLabel = `Abrir na ${offer.store.name}`;
  const noLink = isDemo ? "Link indisponível na demonstração" : "Link indisponível";
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackBar onHide={() => void hideOffer(offer).then(leave)} />
        <View style={styles.title}>
          <Text style={styles.kicker}>
            {offer.product.vendor} · {subcategorySingularName(offer.product.category)}
          </Text>
          <Headline variant="productName">{offerName(offer.product)}</Headline>
        </View>
        {expired ? (
          <View accessibilityRole="alert" style={styles.expired}>
            <Text style={styles.expiredTitle}>Esta oferta expirou</Text>
            <Text style={styles.expiredBody}>
              Faz mais de 72 horas que não encontramos esta oferta. O preço e o estoque podem ter
              mudado.
            </Text>
          </View>
        ) : null}
        <View style={styles.priceBlock}>
          {expired ? <Text style={styles.kicker}>Último preço encontrado</Text> : null}
          <Text style={typography.price}>{formatMoney(offer.effectivePriceCents)}</Text>
          <View style={styles.priceMeta}>
            <Text style={styles.found}>
              à vista · encontrada{" "}
              {formatRelativeTime(expired ? offer.lastSeenAt : offer.firstSeenAt, now)}
            </Text>
            {offer.coupon ? <CouponButton coupon={offer.coupon} /> : null}
          </View>
        </View>
        <View style={styles.verdict}>
          <VerdictChart
            prices={{
              priceCents: offer.effectivePriceCents,
              median30dInCents: offer.history.median30dInCents,
              lowest90dInCents: offer.history.lowest90dInCents
            }}
            label={offer.label}
            qualityScore={offer.qualityScore}
            discountPercent={offer.history.discountVsMedianPercent}
            expired={expired}
          />
        </View>
        <Panel style={styles.facts}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>Loja</Text>
            <Text style={styles.factValue}>{offer.store.name}</Text>
            <Text style={styles.factHint}>{offer.store.domain}</Text>
          </View>
          <View style={[styles.fact, styles.factDivided]}>
            <Text style={styles.factLabel}>Condição</Text>
            <Text style={styles.factValue}>{conditionName(offer.condition)}</Text>
          </View>
        </Panel>
        {isDemo ? <Text style={styles.illustrative}>Exemplo ilustrativo</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {expired ? (
          <>
            <Button
              label={`Ofertas válidas de ${offer.product.model}`}
              icon="arrowForward"
              onPress={() =>
                router.dismissTo({ pathname: "/", params: { model: offer.product.model } })
              }
            />
            {offer.url ? (
              <Button label={`${storeLabel} mesmo assim`} variant="outline" onPress={openStore} />
            ) : null}
          </>
        ) : (
          <Button
            label={offer.url ? storeLabel : noLink}
            icon="external"
            disabled={!offer.url}
            onPress={openStore}
          />
        )}
      </View>
    </Screen>
  );
}

export default function OfferDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { offers, track } = useApp();
  const listed = offers.find((item) => item.id === id);
  // A pushed offer may not be on the loaded feed pages yet, or may have expired.
  const [fetched, setFetched] = useState<MobileOffer | null>(null);
  const [fetching, setFetching] = useState(true);
  const offer = listed ?? fetched;

  useEffect(() => {
    if (id) void track("offer_viewed", { offerId: id });
  }, [id, track]);

  useEffect(() => {
    if (!id || listed) return;
    let active = true;
    setFetching(true);
    fetchOffer(id)
      .then((value) => {
        if (active) setFetched(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [id, listed]);

  if (offer) return <OfferDetails offer={offer} />;

  return (
    <Screen>
      <BackBar />
      {fetching ? (
        <ActivityIndicator color={colors.cobalt} style={styles.loading} />
      ) : (
        <View style={styles.unavailable}>
          <Headline>Não conseguimos abrir esta oferta</Headline>
          <Text style={styles.unavailableBody}>
            Ela pode ter saído da lista, ou o aparelho está sem conexão. Tente de novo em instantes.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 8
  },
  back: {
    alignItems: "center",
    height: MIN_TOUCH_TARGET,
    justifyContent: "center",
    width: MIN_TOUCH_TARGET
  },
  hide: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12
  },
  hideText: { color: colors.ink, fontFamily: fonts.condensedSemiBold, fontSize: 16 },
  title: { gap: 4, paddingHorizontal: 24, paddingTop: 4 },
  kicker: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 15 },
  expired: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 3,
    marginHorizontal: 24,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  expiredTitle: {
    color: colors.surface,
    fontFamily: fonts.condensedBold,
    fontSize: 19,
    lineHeight: 21
  },
  expiredBody: { ...typography.caption, color: colors.inkMist },
  priceBlock: { gap: 6, paddingHorizontal: 24, paddingTop: 16 },
  priceMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between"
  },
  found: { ...typography.bodySm, color: colors.slate, flexShrink: 1 },
  coupon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radii.chip,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    minHeight: 36,
    paddingLeft: 12,
    paddingRight: 10
  },
  couponText: {
    color: colors.ink,
    flexShrink: 1,
    fontFamily: fonts.condensedBold,
    fontSize: 16
  },
  verdict: { marginTop: 18 },
  facts: { flexDirection: "row", marginHorizontal: 24, marginTop: 16 },
  fact: { flex: 1, gap: 2, paddingHorizontal: 14, paddingVertical: 12 },
  factDivided: { borderLeftColor: colors.hairline, borderLeftWidth: 1 },
  factLabel: { color: colors.slate, fontFamily: fonts.condensedSemiBold, fontSize: 13 },
  factValue: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 19, lineHeight: 22 },
  factHint: { color: colors.slate, fontFamily: fonts.body, fontSize: 12 },
  illustrative: {
    color: colors.slate,
    fontFamily: fonts.body,
    fontSize: 12,
    marginHorizontal: 28,
    marginTop: 8
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12
  },
  loading: { marginTop: 48 },
  unavailable: { gap: 10, paddingHorizontal: 24, paddingTop: 8 },
  unavailableBody: { ...typography.body, color: colors.slate }
});
