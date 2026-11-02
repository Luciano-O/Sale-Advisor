import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";

import { formatAmount, formatDelta, formatWholeAmount, formatWholeMoney } from "../format";
import { labelName } from "../labels";
import { colors, fonts, radii, typography } from "../theme";
import type { ScoreLabel } from "../types";
import { verdictCaption, verdictChart, type VerdictChartRow, type VerdictPrices } from "../verdict";

const GROW_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const GROW_MS = 900;
const GROW_DELAY_MS: Record<VerdictChartRow["key"], number> = {
  median: 100,
  lowest: 260,
  today: 560
};
const NOTE_DELAY_MS = 900;
const NOTE_MS = 500;

const ROW_TITLES: Record<VerdictChartRow["key"], string> = {
  median: "Mediana 30 dias",
  lowest: "Mínima 90 dias",
  today: "Hoje"
};

function useProgress(delay: number, duration: number, easing = GROW_EASING) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) progress.value = withDelay(delay, withTiming(1, { duration, easing }));
  }, [delay, duration, easing, progress, reducedMotion]);
  return progress;
}

function GrowingBar({ row }: { row: VerdictChartRow }) {
  const progress = useProgress(GROW_DELAY_MS[row.key], GROW_MS);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: row.key === "today" ? colors.signal : colors.labelBoa },
        { width: `${row.percent}%` },
        grow
      ]}
    />
  );
}

function RisingNote({ children }: { children: React.ReactNode }) {
  const progress = useProgress(NOTE_DELAY_MS, NOTE_MS);
  const rise = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }]
  }));
  return <Animated.View style={rise}>{children}</Animated.View>;
}

/**
 * The signature: a full-width cobalt band that shows today's price being tested against the
 * median and the 90-day low, with the label as the conclusion.
 */
export function VerdictChart({
  prices,
  label,
  qualityScore,
  discountPercent,
  expired = false
}: {
  prices: VerdictPrices;
  label: ScoreLabel;
  qualityScore: number;
  discountPercent: number | null;
  expired?: boolean;
}) {
  const chart = verdictChart(prices);
  const delta = formatDelta(discountPercent);
  // The columns hold numbers that cannot wrap, so they follow the system font size and the longest
  // price. All rows share one width, or their bars would not be on the same scale.
  const scale = Math.max(1, useWindowDimensions().fontScale);
  const valueWidth =
    Math.max(COLUMN_VALUE, formatAmount(prices.priceCents).length * VALUE_CHAR_WIDTH) * scale;
  // Large text has no room for every axis label; the grid lines stay.
  const sparseTicks = scale > SPARSE_TICKS_FROM_SCALE;
  return (
    <View style={styles.band}>
      <View style={styles.header}>
        <View style={styles.conclusion}>
          <Text style={styles.lead}>{expired ? "Veredito quando chegou" : "Veredito"}</Text>
          <Text style={styles.label}>{labelName(label)}</Text>
        </View>
        <Text style={styles.score}>nota {qualityScore}/100</Text>
      </View>
      {chart ? (
        <View style={styles.chart}>
          {chart.rows.map((row) => (
            <View key={row.key} style={styles.grid}>
              <Text style={row.key === "today" ? styles.rowTitleToday : styles.rowTitle}>
                {row.key === "today" && expired ? "Último preço" : ROW_TITLES[row.key]}
              </Text>
              <View style={styles.barArea}>
                {chart.ticks.map((tick) => (
                  <View key={tick.cents} style={[styles.gridLine, { left: `${tick.percent}%` }]} />
                ))}
                <GrowingBar row={row} />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  row.key === "today" ? styles.valueToday : styles.value,
                  { width: valueWidth }
                ]}
              >
                {row.key === "today" ? formatAmount(row.cents) : formatWholeAmount(row.cents)}
              </Text>
            </View>
          ))}
          {chart.bracket && delta ? (
            <RisingNote>
              <View style={styles.grid}>
                <View style={styles.rowTitleSpace} />
                <View style={[styles.bracketArea, { height: BRACKET_HEIGHT * scale }]}>
                  <View
                    style={[
                      styles.bracket,
                      {
                        left: `${chart.bracket.startPercent}%`,
                        right: `${100 - chart.bracket.endPercent}%`
                      }
                    ]}
                  />
                  <Text style={[styles.delta, { left: `${chart.bracket.midPercent}%` }]}>
                    {delta}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[styles.vs, { width: valueWidth }]}>
                  vs. mediana
                </Text>
              </View>
            </RisingNote>
          ) : null}
          <View style={styles.grid}>
            <View style={styles.rowTitleSpace} />
            <View style={[styles.tickArea, { height: TICK_HEIGHT * scale }]}>
              {chart.ticks.map((tick, index) =>
                sparseTicks && index % 2 === 1 ? null : (
                  <Text
                    key={tick.cents}
                    style={[
                      styles.tick,
                      index > 0 && styles.tickCentered,
                      { left: `${tick.percent}%` }
                    ]}
                  >
                    {index === 0 && !sparseTicks
                      ? formatWholeMoney(tick.cents)
                      : formatWholeAmount(tick.cents)}
                  </Text>
                )
              )}
            </View>
            <View style={{ width: valueWidth }} />
          </View>
        </View>
      ) : null}
      <RisingNote>
        <Text style={styles.caption}>{verdictCaption(prices)}</Text>
      </RisingNote>
    </View>
  );
}

const COLUMN_TITLE = 84;
const COLUMN_VALUE = 70;
const VALUE_CHAR_WIDTH = 8.6;
const BRACKET_HEIGHT = 32;
const TICK_HEIGHT = 16;
const SPARSE_TICKS_FROM_SCALE = 1.3;

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.cobalt,
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 18
  },
  header: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  conclusion: {
    alignItems: "baseline",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: 10
  },
  lead: { color: colors.cobaltMist, fontFamily: fonts.condensedSemiBold, fontSize: 15 },
  label: {
    color: colors.surface,
    fontFamily: fonts.condensedExtraBold,
    fontSize: 30,
    lineHeight: 32
  },
  score: { color: colors.cobaltMist, fontFamily: fonts.condensedSemiBold, fontSize: 14 },
  chart: { gap: 8 },
  grid: { alignItems: "center", flexDirection: "row", gap: 10 },
  rowTitle: {
    color: colors.cobaltMist,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 15,
    lineHeight: 16,
    width: COLUMN_TITLE
  },
  rowTitleToday: {
    color: colors.surface,
    fontFamily: fonts.condensedBold,
    fontSize: 15,
    lineHeight: 16,
    width: COLUMN_TITLE
  },
  rowTitleSpace: { width: COLUMN_TITLE },
  barArea: { flex: 1, flexDirection: "row", height: 24 },
  gridLine: {
    backgroundColor: colors.cobaltGrid,
    bottom: -4,
    position: "absolute",
    top: -4,
    width: 1
  },
  bar: { borderRadius: radii.bar, height: "100%", transformOrigin: "left center" },
  value: {
    color: colors.surface,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "right"
  },
  valueToday: {
    color: colors.surface,
    fontFamily: fonts.condensedExtraBold,
    fontSize: 19,
    fontVariant: ["tabular-nums"],
    textAlign: "right"
  },
  bracketArea: { flex: 1 },
  bracket: {
    borderBottomWidth: 2,
    borderColor: colors.signal,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    height: 9,
    position: "absolute",
    top: 0
  },
  delta: {
    backgroundColor: colors.signal,
    borderRadius: 3,
    color: colors.ink,
    fontFamily: fonts.condensedExtraBold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    lineHeight: 15,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
    top: 13,
    transform: [{ translateX: "-50%" }]
  },
  vs: {
    color: colors.cobaltMist,
    fontFamily: fonts.condensedMedium,
    fontSize: 13,
    lineHeight: 15,
    paddingTop: 12
  },
  tickArea: { flex: 1 },
  tick: {
    color: colors.cobaltMist,
    fontFamily: fonts.condensedMedium,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    position: "absolute"
  },
  tickCentered: { transform: [{ translateX: "-50%" }] },
  caption: {
    ...typography.bodySm,
    borderTopColor: colors.cobaltGrid,
    borderTopWidth: 1,
    color: colors.surface,
    paddingTop: 12
  }
});
