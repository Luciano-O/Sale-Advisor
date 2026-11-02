import { describe, expect, it } from "vitest";

import {
  formatAmount,
  formatDelta,
  formatMoney,
  formatPercent,
  formatRelativeTime,
  formatUpdateTime,
  formatWholeAmount,
  formatWholeMoney
} from "./format";

const now = new Date(2026, 9, 29, 12, 0);
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("money", () => {
  it("formats prices with cents the Brazilian way", () => {
    expect(formatMoney(189990)).toBe("R$ 1.899,90");
    expect(formatMoney(5)).toBe("R$ 0,05");
    expect(formatMoney(123456789)).toBe("R$ 1.234.567,89");
  });

  it("rounds to whole reais for comparisons", () => {
    expect(formatWholeMoney(23910)).toBe("R$ 239");
    expect(formatWholeMoney(184950)).toBe("R$ 1.850");
  });

  it("drops the currency in chart columns", () => {
    expect(formatAmount(189990)).toBe("1.899,90");
    expect(formatWholeAmount(213900)).toBe("2.139");
  });
});

describe("percentages", () => {
  it("rounds a percentage", () => {
    expect(formatPercent(11.4)).toBe("11%");
  });

  it("writes a discount as a price change: cheaper is negative", () => {
    expect(formatDelta(11.2)).toBe("−11%");
    expect(formatDelta(-5)).toBe("+5%");
  });

  it("never writes a signed zero", () => {
    expect(formatDelta(0)).toBe("0%");
    expect(formatDelta(0.3)).toBe("0%");
    expect(formatDelta(-0.3)).toBe("0%");
  });

  it("has nothing to say without history", () => {
    expect(formatDelta(null)).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  it("counts minutes during the first hour", () => {
    expect(formatRelativeTime(ago(0.5), now)).toBe("agora");
    expect(formatRelativeTime(ago(8), now)).toBe("há 8 min");
    expect(formatRelativeTime(ago(59), now)).toBe("há 59 min");
  });

  it("counts hours within the same day", () => {
    expect(formatRelativeTime(ago(60), now)).toBe("há 1 h");
    expect(formatRelativeTime(ago(180), now)).toBe("há 3 h");
  });

  it("uses calendar days after that", () => {
    expect(formatRelativeTime(ago(16 * 60), now)).toBe("ontem");
    expect(formatRelativeTime(ago(4 * 24 * 60), now)).toBe("há 4 dias");
  });

  it("still counts minutes across midnight", () => {
    const earlyMorning = new Date(2026, 9, 29, 0, 30);
    const before = new Date(earlyMorning.getTime() - 50 * 60_000).toISOString();
    expect(formatRelativeTime(before, earlyMorning)).toBe("há 50 min");
  });

  it("treats a clock ahead of the device as now", () => {
    expect(formatRelativeTime(ago(-10), now)).toBe("agora");
  });
});

describe("formatUpdateTime", () => {
  it("says when the list last came from the network", () => {
    expect(formatUpdateTime(new Date(2026, 9, 29, 9, 5).toISOString(), now)).toBe(
      "de hoje às 09:05"
    );
    expect(formatUpdateTime(new Date(2026, 9, 28, 13, 52).toISOString(), now)).toBe(
      "de ontem às 13:52"
    );
    expect(formatUpdateTime(new Date(2026, 9, 3, 18, 0).toISOString(), now)).toBe(
      "de 03/10 às 18:00"
    );
  });
});
