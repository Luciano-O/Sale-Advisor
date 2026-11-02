import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { useApp } from "../../src/app-context";
import {
  ALL_SUBCATEGORIES,
  hiddenOfferSnapshot,
  offerCountLabel,
  subcategoryFilters,
  visibleOffers
} from "../../src/feed";
import { formatDelta, formatMoney, formatRelativeTime, formatUpdateTime } from "../../src/format";
import { labelColor, labelName, offerName } from "../../src/labels";
import { isNewOffer } from "../../src/offer-state";
import { activeSubcategories, followedSubcategories } from "../../src/preferences";
import { colors, fonts, radii, typography } from "../../src/theme";
import type { MobileOffer, OfferSort } from "../../src/types";
import { BrandLockup } from "../../src/ui/BrandLockup";
import { Button } from "../../src/ui/Button";
import { Chip } from "../../src/ui/Chip";
import { Headline } from "../../src/ui/Headline";
import { Icon } from "../../src/ui/Icon";
import { Panel } from "../../src/ui/Panel";
import { Screen } from "../../src/ui/Screen";
import { SegmentedControl } from "../../src/ui/SegmentedControl";
import { Snackbar } from "../../src/ui/Snackbar";
import { discountBarPercent } from "../../src/verdict";

const SORT_OPTIONS: ReadonlyArray<{ key: OfferSort; label: string }> = [
  { key: "recent", label: "Mais recentes" },
  { key: "discount", label: "Maior desconto" }
];

// The app filters on the device, so a page can bring few visible offers: keep loading pages
// until the list has enough to scroll or the feed ends.
const MIN_VISIBLE_OFFERS = 8;
const UNDO_MS = 5_000;

function OfferRow({
  offer,
  isNew,
  first,
  last,
  now
}: {
  offer: MobileOffer;
  isNew: boolean;
  first: boolean;
  last: boolean;
  now: Date;
}) {
  const discount = offer.history.discountVsMedianPercent;
  const delta = formatDelta(discount);
  return (
    <View style={[styles.rowFrame, first && styles.rowFrameFirst, last && styles.rowFrameLast]}>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: "/offer/[id]", params: { id: offer.id } })}
        style={[styles.row, !first && styles.rowDivided]}
      >
        <View style={styles.rowMain}>
          <View style={styles.rowName}>
            {isNew ? <View accessibilityLabel="Nova" style={styles.newMark} /> : null}
            <Text numberOfLines={2} style={styles.name}>
              {offerName(offer.product)}
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.meta}>
            {labelName(offer.label)} · {offer.store.name} ·{" "}
            {formatRelativeTime(offer.firstSeenAt, now)}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: labelColor(offer.label),
                  width: `${discountBarPercent(discount)}%`
                }
              ]}
            />
          </View>
        </View>
        <View style={styles.rowSide}>
          {delta ? <Text style={styles.delta}>{delta}</Text> : null}
          <Text numberOfLines={1} style={styles.price}>
            {formatMoney(offer.effectivePriceCents)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function SkeletonRow({ index, width }: { index: number; width: number }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reducedMotion)
      opacity.value = withDelay(
        index * 120,
        withRepeat(
          withSequence(withTiming(0.5, { duration: 700 }), withTiming(1, { duration: 700 })),
          -1
        )
      );
  }, [index, opacity, reducedMotion]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.row, index > 0 && styles.rowDivided, pulse]}>
      <View style={styles.rowMain}>
        <View style={[styles.skeletonName, { width: `${width}%` }]} />
        <View style={[styles.skeletonMeta, { width: `${width - 18}%` }]} />
        <View style={styles.barTrack} />
      </View>
      <View style={styles.rowSide}>
        <View style={styles.skeletonDelta} />
        <View style={styles.skeletonPrice} />
      </View>
    </Animated.View>
  );
}

function LoadingList() {
  return (
    <View style={styles.block} accessibilityLabel="Buscando ofertas">
      <Panel>
        {[62, 48, 70, 55, 66].map((width, index) => (
          <SkeletonRow key={width} index={index} width={width} />
        ))}
      </Panel>
    </View>
  );
}

function EmptyList() {
  return (
    <View style={styles.block}>
      <Panel style={styles.empty}>
        <View style={styles.emptyChart}>
          <View style={styles.emptyAxis} />
          {[92, 70, 48].map((width) => (
            <View key={width} style={[styles.emptyBar, { width: `${width}%` }]} />
          ))}
        </View>
        <View style={styles.emptyText}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>
            Nenhuma oferta passou no teste
          </Text>
          <Text style={styles.emptyBody}>
            Nas últimas 72 horas, não encontramos nenhuma oferta boa do que você segue. Assim que
            encontrarmos, trazemos para você.
          </Text>
        </View>
        <View style={styles.emptyAction}>
          <Button
            label="Ver o que eu sigo"
            variant="outline"
            onPress={() => router.navigate("/seguindo")}
          />
        </View>
      </Panel>
    </View>
  );
}

function OfflineNotice({
  lastUpdated,
  now,
  onRetry
}: {
  lastUpdated: string | null;
  now: Date;
  onRetry(): void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.offline}>
      <Icon name="noConnection" size={22} color={colors.surface} />
      <View style={styles.noticeText}>
        <Text style={styles.noticeTitleOnInk}>Sem conexão</Text>
        <Text style={styles.offlineBody}>
          {lastUpdated
            ? `Mostrando a última atualização, ${formatUpdateTime(lastUpdated, now)}. `
            : "Mostrando a última atualização. "}
          Algumas ofertas podem ter expirado.
        </Text>
      </View>
      <Pressable accessibilityRole="button" hitSlop={6} onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>Tentar</Text>
      </Pressable>
    </View>
  );
}

function DemoNotice() {
  return (
    <View accessibilityRole="alert" style={styles.demo}>
      <Text style={styles.noticeTitle}>Modo demonstração</Text>
      <Text style={styles.demoBody}>
        Os preços abaixo são ilustrativos. As ofertas reais aparecem assim que o app se conectar.
      </Text>
    </View>
  );
}

export default function OffersScreen() {
  const {
    offers,
    preferences,
    catalog,
    loading,
    offline,
    feedSource,
    lastUpdated,
    lastViewedAt,
    hasMore,
    loadingMore,
    loadedPages,
    sort,
    changeSort,
    refresh,
    loadMore,
    lastHidden,
    undoHide,
    dismissLastHidden
  } = useApp();
  const params = useLocalSearchParams<{ model?: string }>();
  const model = params.model || undefined;
  const [category, setCategory] = useState(ALL_SUBCATEGORIES);
  const filters = useMemo(
    () => subcategoryFilters(followedSubcategories(preferences, activeSubcategories(catalog))),
    [catalog, preferences]
  );
  const now = new Date();
  const rows = visibleOffers(offers, {
    now,
    ...(category === ALL_SUBCATEGORIES ? {} : { category }),
    ...(model ? { model } : {})
  });
  const visibleCount = rows.length;

  useEffect(() => {
    if (!loading && !offline && hasMore && visibleCount < MIN_VISIBLE_OFFERS) void loadMore();
  }, [hasMore, loadMore, loadedPages, loading, offline, visibleCount]);

  useEffect(() => {
    if (!lastHidden) return;
    const timer = setTimeout(dismissLastHidden, UNDO_MS);
    return () => clearTimeout(timer);
  }, [dismissLastHidden, lastHidden]);

  const searching = visibleCount === 0 && (loading || loadingMore || (hasMore && !offline));
  const isDemo = feedSource === "starter";

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={({ id }) => id}
        contentContainerStyle={styles.content}
        refreshing={loading && visibleCount > 0}
        onRefresh={() => void refresh()}
        onEndReached={() => {
          if (hasMore) void loadMore();
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <BrandLockup />
            <Headline>Ofertas válidas</Headline>
            {isDemo ? (
              <DemoNotice />
            ) : offline ? (
              <OfflineNotice lastUpdated={lastUpdated} now={now} onRetry={() => void refresh()} />
            ) : null}
            {filters.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
                style={styles.filtersScroll}
              >
                {filters.map((filter) => (
                  <Chip
                    key={filter.key}
                    label={filter.label}
                    selected={category === filter.key}
                    onPress={() => setCategory(filter.key)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {model ? (
              <View style={styles.modelFilter}>
                <Chip
                  label={model}
                  selected
                  onPress={() => router.setParams({ model: "" })}
                  onRemove={() => router.setParams({ model: "" })}
                />
              </View>
            ) : null}
            <View style={styles.controls}>
              <Text accessibilityLiveRegion="polite" style={styles.count}>
                {searching ? "Buscando ofertas…" : offerCountLabel(visibleCount, hasMore)}
              </Text>
              <SegmentedControl
                compact
                label="Ordenar"
                options={SORT_OPTIONS}
                value={sort}
                onChange={changeSort}
              />
            </View>
          </View>
        }
        ListEmptyComponent={searching ? <LoadingList /> : <EmptyList />}
        ListFooterComponent={
          loadingMore && visibleCount > 0 ? (
            <ActivityIndicator color={colors.cobalt} style={styles.footer} />
          ) : isDemo && visibleCount > 0 ? (
            <Text style={styles.illustrative}>Exemplo ilustrativo</Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <OfferRow
            offer={item}
            isNew={isNewOffer(item, lastViewedAt)}
            first={index === 0}
            last={index === visibleCount - 1}
            now={now}
          />
        )}
      />
      {lastHidden ? (
        <Snackbar
          message={`${hiddenOfferSnapshot(lastHidden).name} ocultada`}
          onAction={() => void undoHide()}
          bottom={16}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 12 },
  header: { gap: 16, marginBottom: 16, paddingHorizontal: 4 },
  filtersScroll: { marginHorizontal: -24 },
  filters: { gap: 8, paddingHorizontal: 24 },
  modelFilter: { alignItems: "flex-start" },
  // With a large system font the control no longer fits beside the count and takes its own line.
  controls: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between"
  },
  count: {
    color: colors.slate,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 15
  },
  // The rows of a virtualized list cannot live inside one Panel, so each draws its part of it.
  rowFrame: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden"
  },
  rowFrameFirst: {
    borderTopLeftRadius: radii.panel,
    borderTopRightRadius: radii.panel,
    borderTopWidth: 1
  },
  rowFrameLast: {
    borderBottomLeftRadius: radii.panel,
    borderBottomRightRadius: radii.panel,
    borderBottomWidth: 1
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  rowDivided: { borderTopColor: colors.hairline, borderTopWidth: 1 },
  rowMain: { flex: 1, gap: 2, minWidth: 0 },
  rowName: { alignItems: "center", flexDirection: "row", gap: 8 },
  newMark: { backgroundColor: colors.cobalt, borderRadius: 2, height: 8, width: 8 },
  name: { ...typography.titleSm, flexShrink: 1 },
  meta: { ...typography.caption, color: colors.slate },
  barTrack: {
    backgroundColor: colors.barTrack,
    borderRadius: radii.bar,
    height: 8,
    marginTop: 6
  },
  barFill: { borderRadius: radii.bar, height: "100%" },
  rowSide: { alignItems: "flex-end", gap: 2, minWidth: 84 },
  delta: {
    color: colors.ink,
    fontFamily: fonts.condensedExtraBold,
    fontSize: 24,
    fontVariant: ["tabular-nums"],
    lineHeight: 24
  },
  price: {
    color: colors.slate,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 15,
    fontVariant: ["tabular-nums"]
  },
  skeletonName: {
    backgroundColor: colors.labelNormal,
    borderRadius: 3,
    height: 18,
    marginBottom: 6
  },
  skeletonMeta: { backgroundColor: colors.hairline, borderRadius: 3, height: 10 },
  skeletonDelta: { backgroundColor: colors.labelNormal, borderRadius: 3, height: 22, width: 52 },
  skeletonPrice: {
    backgroundColor: colors.hairline,
    borderRadius: 3,
    height: 12,
    marginTop: 6,
    width: 70
  },
  block: { flexGrow: 1 },
  empty: { gap: 14, paddingBottom: 18, paddingHorizontal: 18, paddingTop: 20 },
  emptyChart: { gap: 8, paddingLeft: 12 },
  emptyAxis: {
    backgroundColor: colors.ink,
    bottom: -4,
    left: 0,
    position: "absolute",
    top: -4,
    width: 2
  },
  emptyBar: {
    borderColor: colors.dash,
    borderRadius: radii.bar,
    borderStyle: "dashed",
    borderWidth: 1.5,
    height: 14
  },
  emptyText: { gap: 6 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 26, lineHeight: 28 },
  emptyBody: { ...typography.body, color: colors.slate },
  emptyAction: { alignSelf: "flex-start" },
  offline: {
    alignItems: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  noticeText: { flex: 1, gap: 2 },
  noticeTitle: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 19, lineHeight: 21 },
  noticeTitleOnInk: {
    color: colors.surface,
    fontFamily: fonts.condensedBold,
    fontSize: 19,
    lineHeight: 21
  },
  offlineBody: { ...typography.caption, color: colors.inkMist },
  retry: {
    alignItems: "center",
    borderColor: colors.surface,
    borderRadius: radii.chip,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12
  },
  retryText: { color: colors.surface, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  demo: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radii.panel,
    borderStyle: "dashed",
    borderWidth: 2,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  demoBody: { ...typography.caption, color: colors.slate },
  footer: { paddingVertical: 16 },
  illustrative: { ...typography.caption, color: colors.slate, paddingLeft: 4, paddingTop: 8 }
});
