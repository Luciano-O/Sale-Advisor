import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { type CatalogModel, fetchCatalog } from "../src/api";
import { useApp } from "../src/app-context";
import { modelChoices, toggleModel } from "../src/selection";
import { colors, fonts, radii, typography } from "../src/theme";
import type { ScoreLabel } from "../src/types";

const labels: ScoreLabel[] = ["normal", "boa", "muito_boa", "excepcional"];
const split = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function PreferencesScreen() {
  const { preferences, savePreferences, installationId, hiddenCount, showHiddenOffers } = useApp();
  const [followedModels, setFollowedModels] = useState<string[]>([]);
  const [models, setModels] = useState("");
  const [brands, setBrands] = useState("");
  const [stores, setStores] = useState("");
  const [minimumLabel, setMinimumLabel] = useState<ScoreLabel>(preferences.minimumLabel);
  // Null while loading or offline: the screen falls back to the free-text field.
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);

  useEffect(() => {
    setFollowedModels(preferences.followedModels);
    setModels(preferences.followedModels.join(", "));
    setBrands(preferences.blockedBrands.join(", "));
    setStores(preferences.blockedStores.join(", "));
    setMinimumLabel(preferences.minimumLabel);
  }, [preferences]);

  useEffect(() => {
    let active = true;
    fetchCatalog()
      .then((items) => {
        if (active) setCatalog(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.content}>
      <Text style={commonStyles.eyebrow}>PRIVADO POR PADRÃO</Text>
      <Text style={commonStyles.title}>Seus critérios, neste aparelho.</Text>
      <Text style={commonStyles.subtitle}>
        Modelos, marcas e lojas bloqueadas não saem do dispositivo. O servidor recebe apenas GPU e o
        nível mínimo.
      </Text>
      {catalog ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Modelos seguidos</Text>
          <View style={styles.labels}>
            {modelChoices(catalog, followedModels).map((model) => {
              const selected = followedModels.some(
                (item) => item.toLocaleLowerCase("pt-BR") === model.toLocaleLowerCase("pt-BR")
              );
              return (
                <Pressable
                  key={model}
                  style={[styles.pill, selected && styles.pillActive]}
                  onPress={() => setFollowedModels((current) => toggleModel(current, model))}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextActive]}>{model}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helper}>Nenhum selecionado acompanha qualquer GPU.</Text>
        </View>
      ) : (
        <Field
          label="Modelos seguidos"
          helper="Separe por vírgulas. Vazio acompanha qualquer GPU."
          value={models}
          onChangeText={setModels}
          placeholder="RTX 5060, RX 9070 XT"
        />
      )}
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
            followedModels: catalog ? followedModels : split(models),
            blockedBrands: split(brands),
            blockedStores: split(stores),
            minimumLabel
          }).then(() => router.back());
        }}
      >
        <Text style={commonStyles.buttonText}>Salvar filtros</Text>
      </Pressable>
      {hiddenCount > 0 ? (
        <Pressable style={styles.secondaryButton} onPress={() => void showHiddenOffers()}>
          <Text style={styles.secondaryButtonText}>Mostrar ofertas ocultas ({hiddenCount})</Text>
        </Pressable>
      ) : null}
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
        placeholderTextColor={colors.slate}
        autoCapitalize="characters"
      />
      <Text style={styles.helper}>{helper}</Text>
    </View>
  );
}

const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16 },
  eyebrow: typography.section,
  title: typography.headline,
  subtitle: { ...typography.body, color: colors.slate },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.panel,
    padding: 16,
    gap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 22
  },
  buttonText: { ...typography.button, color: colors.surface },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radii.control,
    borderWidth: 2,
    minHeight: 52,
    paddingHorizontal: 16
  }
});

const styles = StyleSheet.create({
  field: { gap: 7 },
  fieldLabel: { ...typography.titleSm },
  helper: { ...typography.caption, color: colors.slate },
  labels: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    borderColor: colors.ink,
    borderRadius: radii.chip,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12
  },
  pillActive: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  pillText: { color: colors.ink, fontFamily: fonts.condensedBold, fontSize: 16 },
  pillTextActive: { color: colors.surface },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.ink,
    borderRadius: radii.control,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 48
  },
  secondaryButtonText: { ...typography.buttonSm },
  installation: { ...typography.caption, color: colors.slate, textAlign: "center" }
});
