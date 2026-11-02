import { describe, expect, it } from "vitest";

import { discountBarPercent, verdictCaption, verdictChart } from "./verdict";

const offer = (
  priceCents: number,
  median30dInCents: number | null,
  lowest90dInCents: number | null
) => ({ priceCents, median30dInCents, lowest90dInCents });

describe("verdictCaption", () => {
  it("compares the price against the median and the 90-day low", () => {
    expect(verdictCaption(offer(189990, 213900, 184900))).toBe(
      "R$ 239 abaixo da mediana de 30 dias e R$ 51 acima da mínima de 90 dias."
    );
  });

  it("announces the lowest price of the last 90 days", () => {
    expect(verdictCaption(offer(184900, 213900, 184900))).toBe(
      "R$ 290 abaixo da mediana de 30 dias. Menor preço dos últimos 90 dias."
    );
    expect(verdictCaption(offer(180000, 213900, 184900))).toBe(
      "R$ 339 abaixo da mediana de 30 dias. Menor preço dos últimos 90 dias."
    );
  });

  it("says so when the price is above the median", () => {
    expect(verdictCaption(offer(220000, 200000, 190000))).toBe(
      "R$ 200 acima da mediana de 30 dias e R$ 300 acima da mínima de 90 dias."
    );
  });

  it("says so when the price matches the median", () => {
    expect(verdictCaption(offer(200000, 200000, 190000))).toBe(
      "Igual à mediana de 30 dias e R$ 100 acima da mínima de 90 dias."
    );
  });

  it("never rounds a real difference down to zero reais", () => {
    expect(verdictCaption(offer(199990, 200000, 199980))).toBe(
      "R$ 1 abaixo da mediana de 30 dias e R$ 1 acima da mínima de 90 dias."
    );
  });

  it("uses only the comparison it has", () => {
    expect(verdictCaption(offer(189990, 213900, null))).toBe(
      "R$ 239 abaixo da mediana de 30 dias."
    );
    expect(verdictCaption(offer(189990, null, 184900))).toBe("R$ 51 acima da mínima de 90 dias.");
    expect(verdictCaption(offer(184900, null, 184900))).toBe("Menor preço dos últimos 90 dias.");
  });

  it("is honest when there is no history yet", () => {
    expect(verdictCaption(offer(189990, null, null))).toBe(
      "Ainda estamos juntando o histórico de preços deste produto."
    );
  });
});

describe("verdictChart", () => {
  it("draws the approved example on a truncated axis", () => {
    expect(verdictChart(offer(189990, 213900, 184900))).toEqual({
      rows: [
        { key: "median", cents: 213900, percent: 100 },
        { key: "lowest", cents: 184900, percent: 46.2 },
        { key: "today", cents: 189990, percent: 55.6 }
      ],
      ticks: [
        { cents: 160000, percent: 0 },
        { cents: 180000, percent: 37.1 },
        { cents: 200000, percent: 74.2 }
      ],
      bracket: { startPercent: 55.6, endPercent: 100, midPercent: 77.8 }
    });
  });

  it("keeps the bracket between today and the median when today is the most expensive", () => {
    const chart = verdictChart(offer(220000, 200000, 190000));
    expect(chart?.rows.find(({ key }) => key === "today")?.percent).toBe(100);
    const median = chart?.rows.find(({ key }) => key === "median")?.percent;
    expect(chart?.bracket).toMatchObject({ startPercent: median, endPercent: 100 });
  });

  it("has no bracket when today matches the median", () => {
    expect(verdictChart(offer(200000, 200000, 190000))?.bracket).toBeNull();
  });

  it("leaves every bar visible when all prices are equal", () => {
    const chart = verdictChart(offer(200000, 200000, 200000));
    expect(chart?.rows.every(({ percent }) => percent > 0)).toBe(true);
    expect(chart?.ticks.length).toBeGreaterThan(0);
  });

  it("draws only the rows it has and no bracket without a median", () => {
    const chart = verdictChart(offer(189990, null, 184900));
    expect(chart?.rows.map(({ key }) => key)).toEqual(["lowest", "today"]);
    expect(chart?.bracket).toBeNull();
  });

  it("has no chart without history", () => {
    expect(verdictChart(offer(189990, null, null))).toBeNull();
  });

  it("never draws a tick past the top of the axis", () => {
    const chart = verdictChart(offer(189990, 213900, 184900));
    expect(chart?.ticks.every(({ percent }) => percent < 100)).toBe(true);
  });
});

describe("discountBarPercent", () => {
  it("fills the bar in proportion, with 20% as a full bar", () => {
    expect(discountBarPercent(11)).toBe(55);
    expect(discountBarPercent(20)).toBe(100);
  });

  it("caps a huge discount", () => {
    expect(discountBarPercent(45)).toBe(100);
  });

  it("leaves the bar empty when the price is not below the median", () => {
    expect(discountBarPercent(-5)).toBe(0);
    expect(discountBarPercent(null)).toBe(0);
  });
});
