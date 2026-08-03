import { Link } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "../src/app-context";
import { colors, commonStyles, formatMoney } from "../src/theme";
import type { MobileOffer } from "../src/types";

function OfferCard({ offer }: { offer: MobileOffer }) {
  return (
    <Link href={{ pathname: "/offer/[id]", params: { id: offer.id } }} asChild>
      <Pressable style={commonStyles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{offer.label.replace("_", " ")}</Text>
          <Text style={styles.score}>{offer.qualityScore}/100</Text>
        </View>
        <Text style={styles.model}>
          {offer.product.model} {offer.product.vramGb ? `${offer.product.vramGb}GB` : ""}
        </Text>
        <Text style={styles.price}>{formatMoney(offer.effectivePriceCents)}</Text>
        <View style={styles.row}>
          <Text style={styles.store}>{offer.store.name}</Text>
          <Text style={styles.mentions}>{offer.mentionCount} menção(ões)</Text>
        </View>
        <Text style={styles.summary} numberOfLines={2}>
          {offer.scoreSummary}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function FeedScreen() {
  const { offers, loading, offline, error, lastUpdated, refresh } = useApp();
  return (
    <View style={commonStyles.screen}>
      <FlatList
        data={offers}
        keyExtractor={({ id }) => id}
        contentContainerStyle={commonStyles.content}
        refreshing={loading}
        onRefresh={() => void refresh()}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.row}>
              <Text style={commonStyles.eyebrow}>SALE ADVISOR</Text>
              <Link href="/preferences" asChild>
                <Pressable style={styles.preferenceButton}>
                  <Text style={styles.preferenceText}>Filtros</Text>
                </Pressable>
              </Link>
            </View>
            <Text style={commonStyles.title}>Ofertas que valem a pena.</Text>
            <Text style={commonStyles.subtitle}>
              O histórico decide a qualidade; seus filtros ficam neste aparelho.
            </Text>
            {offline ? (
              <View style={styles.offline}>
                <Text style={styles.offlineText}>Modo offline · mostrando o último cache</Text>
                {error ? <Text style={styles.offlineDetail}>{error}</Text> : null}
              </View>
            ) : (
              <Text style={styles.updated}>
                {lastUpdated
                  ? `Atualizado ${new Date(lastUpdated).toLocaleTimeString("pt-BR")}`
                  : "Sincronizando…"}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : (
            <View style={commonStyles.card}>
              <Text style={styles.model}>Nenhuma oferta relevante agora</Text>
              <Text style={commonStyles.subtitle}>
                Ajuste os filtros ou puxe a tela para atualizar. O cache continuará disponível
                offline.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <OfferCard offer={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 8, paddingTop: 26 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  preferenceButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  preferenceText: { color: colors.text, fontWeight: "700" },
  offline: { backgroundColor: "#352c16", borderRadius: 12, gap: 3, padding: 12 },
  offlineText: { color: colors.warning, fontWeight: "800" },
  offlineDetail: { color: colors.muted, fontSize: 12 },
  updated: { color: colors.muted, fontSize: 12 },
  label: {
    backgroundColor: colors.accentDark,
    borderRadius: 999,
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase"
  },
  score: { color: colors.muted, fontWeight: "700" },
  model: { color: colors.text, fontSize: 18, fontWeight: "800" },
  price: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.6 },
  store: { color: colors.muted, fontWeight: "700" },
  mentions: { color: colors.muted, fontSize: 12 },
  summary: { color: colors.muted, lineHeight: 20 }
});
