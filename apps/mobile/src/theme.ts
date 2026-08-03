import { StyleSheet } from "react-native";

export const colors = {
  background: "#0b0f14",
  surface: "#121923",
  surfaceRaised: "#1a2431",
  border: "#293647",
  text: "#f4f7fb",
  muted: "#9dacbd",
  accent: "#70e1a1",
  accentDark: "#153d2b",
  warning: "#f5c76a",
  danger: "#ff8b8b"
};

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 14 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  buttonText: { color: "#062215", fontWeight: "800", fontSize: 14 },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  secondaryButtonText: { color: colors.text, fontWeight: "700" },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12
  }
});

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
