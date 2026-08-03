import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../src/app-context";
import { colors, commonStyles, formatMoney } from "../../src/theme";

export default function OfferDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { offers, hideOffer, track } = useApp();
  const offer = offers.find((item) => item.id === id);

  useEffect(() => {
    if (id) void track("offer_viewed", { offerId: id });
  }, [id, track]);

  if (!offer)
    return (
      <View style={[commonStyles.screen, commonStyles.content]}>
        <View style={commonStyles.card}>
          <Text style={styles.model}>Oferta indisponível</Text>
          <Text style={commonStyles.subtitle}>
            Ela pode ter sido ocultada pelos seus filtros ou ainda não estar no cache local.
          </Text>
        </View>
      </View>
    );

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.content}>
      <Text style={commonStyles.eyebrow}>{offer.label.replace("_", " ")}</Text>
      <Text style={commonStyles.title}>{offer.product.model}</Text>
      <Text style={commonStyles.subtitle}>
        {offer.product.vendor} ·{" "}
        {offer.product.vramGb ? `${offer.product.vramGb} GB` : "VRAM não informada"}
      </Text>
      <View style={commonStyles.card}>
        <Text style={styles.price}>{formatMoney(offer.effectivePriceCents)}</Text>
        {offer.lowestPriceCents ? (
          <Text style={styles.meta}>Menor observado: {formatMoney(offer.lowestPriceCents)}</Text>
        ) : null}
        <View style={styles.divider} />
        <Text style={styles.score}>{offer.qualityScore}/100</Text>
        <Text style={styles.model}>{offer.scoreSummary}</Text>
        <Text style={styles.meta}>
          {offer.mentionCount} menção(ões) · última observação{" "}
          {new Date(offer.lastSeenAt).toLocaleString("pt-BR")}
        </Text>
      </View>
      <View style={commonStyles.card}>
        <Text style={styles.model}>{offer.store.name}</Text>
        <Text style={styles.meta}>{offer.store.domain}</Text>
        {offer.coupon ? <Text style={styles.coupon}>Cupom: {offer.coupon}</Text> : null}
        <Text style={styles.meta}>Condição: {offer.condition ?? "não informada"}</Text>
      </View>
      <Pressable
        style={commonStyles.button}
        disabled={!offer.url}
        onPress={() => {
          if (!offer.url) return;
          void track("offer_clicked", { offerId: offer.id });
          void Linking.openURL(offer.url);
        }}
      >
        <Text style={commonStyles.buttonText}>Abrir na loja</Text>
      </Pressable>
      <Pressable
        style={commonStyles.secondaryButton}
        onPress={() => {
          void hideOffer(offer.id).then(() => router.back());
        }}
      >
        <Text style={commonStyles.secondaryButtonText}>Ocultar esta oferta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  price: { color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  model: { color: colors.text, fontSize: 17, fontWeight: "800", lineHeight: 24 },
  meta: { color: colors.muted, lineHeight: 20 },
  score: { color: colors.accent, fontSize: 22, fontWeight: "900" },
  divider: { backgroundColor: colors.border, height: 1 },
  coupon: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentDark,
    borderRadius: 8,
    color: colors.accent,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7
  }
});
