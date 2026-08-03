import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useApp } from "../src/app-context";
import { colors, commonStyles } from "../src/theme";
import type { ScoreLabel } from "../src/types";

const labels: ScoreLabel[] = ["normal", "boa", "muito_boa", "excepcional"];
const split = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function PreferencesScreen() {
  const { preferences, savePreferences, installationId } = useApp();
  const [models, setModels] = useState("");
  const [brands, setBrands] = useState("");
  const [stores, setStores] = useState("");
  const [minimumLabel, setMinimumLabel] = useState<ScoreLabel>(preferences.minimumLabel);

  useEffect(() => {
    setModels(preferences.followedModels.join(", "));
    setBrands(preferences.blockedBrands.join(", "));
    setStores(preferences.blockedStores.join(", "));
    setMinimumLabel(preferences.minimumLabel);
  }, [preferences]);

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.content}>
      <Text style={commonStyles.eyebrow}>PRIVADO POR PADRÃO</Text>
      <Text style={commonStyles.title}>Seus critérios, neste aparelho.</Text>
      <Text style={commonStyles.subtitle}>
        Modelos, marcas e lojas bloqueadas não saem do dispositivo. O servidor recebe apenas GPU e o
        nível mínimo.
      </Text>
      <Field
        label="Modelos seguidos"
        helper="Separe por vírgulas. Vazio acompanha qualquer GPU."
        value={models}
        onChangeText={setModels}
        placeholder="RTX 4060, RX 7600"
      />
      <Field
        label="Marcas bloqueadas"
        helper="Fabricantes que não devem aparecer."
        value={brands}
        onChangeText={setBrands}
        placeholder="NVIDIA"
      />
      <Field
        label="Lojas bloqueadas"
        helper="Use nome ou domínio."
        value={stores}
        onChangeText={setStores}
        placeholder="exemplo.com"
      />
      <View style={commonStyles.card}>
        <Text style={styles.fieldLabel}>Qualidade mínima</Text>
        <View style={styles.labels}>
          {labels.map((label) => (
            <Pressable
              key={label}
              style={[styles.pill, minimumLabel === label && styles.pillActive]}
              onPress={() => setMinimumLabel(label)}
            >
              <Text style={[styles.pillText, minimumLabel === label && styles.pillTextActive]}>
                {label.replace("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable
        style={commonStyles.button}
        onPress={() => {
          void savePreferences({
            followedCategories: ["GPU"],
            followedModels: split(models),
            blockedBrands: split(brands),
            blockedStores: split(stores),
            minimumLabel
          }).then(() => router.back());
        }}
      >
        <Text style={commonStyles.buttonText}>Salvar filtros</Text>
      </Pressable>
      <Text style={styles.installation}>Instalação anônima: {installationId ?? "criando…"}</Text>
    </ScrollView>
  );
}

function Field({
  label,
  helper,
  ...input
}: {
  label: string;
  helper: string;
  value: string;
  onChangeText(value: string): void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        style={commonStyles.input}
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
      />
      <Text style={styles.helper}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  fieldLabel: { color: colors.text, fontSize: 15, fontWeight: "800" },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  labels: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  pillActive: { backgroundColor: colors.accentDark, borderColor: colors.accent },
  pillText: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  pillTextActive: { color: colors.accent },
  installation: { color: colors.muted, fontSize: 10, textAlign: "center" }
});
