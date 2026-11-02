import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CatalogModel } from "../api";
import { subcategoryLowerName, subcategorySearchExample, subcategorySingularName } from "../labels";
import { searchProducts } from "../selection";
import { colors, fonts, MIN_TOUCH_TARGET, radii, typography } from "../theme";
import { Icon } from "./Icon";

/**
 * Quick search over the catalog, covering the whole screen so the field stays above the keyboard.
 * Products are always picked from this list, never typed in.
 */
export function ProductSearch({
  visible,
  subcategory,
  catalog,
  loading,
  selected,
  onToggle,
  onClose
}: {
  visible: boolean;
  subcategory: string;
  catalog: readonly CatalogModel[];
  loading: boolean;
  selected: readonly string[];
  onToggle(model: string): void;
  onClose(): void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);
  const { results, total } = searchProducts(catalog, query, subcategory);
  const typed = query.trim().length > 0;
  const scope = subcategoryLowerName(subcategory);
  const chosen = new Set(selected.map((model) => model.toLocaleLowerCase("pt-BR")));
  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      onShow={() => input.current?.focus()}
      statusBarTranslucent
      visible={visible}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Concluir busca"
            onPress={onClose}
            style={styles.barButton}
          >
            <Icon name="arrowBack" strokeWidth={2.2} />
          </Pressable>
          <TextInput
            ref={input}
            accessibilityLabel="Buscar produto"
            autoCorrect={false}
            cursorColor={colors.cobalt}
            onChangeText={setQuery}
            placeholder={subcategorySearchExample(subcategory)}
            placeholderTextColor={colors.slate}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          {typed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              onPress={() => setQuery("")}
              style={styles.barButton}
            >
              <Icon name="close" size={20} color={colors.slate} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.count}>
          {typed
            ? `${total === 1 ? "1 resultado" : `${total} resultados`} em ${scope}`
            : `Buscando em ${scope} · toque para adicionar`}
        </Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {loading && catalog.length === 0 ? (
            <ActivityIndicator color={colors.cobalt} style={styles.loading} />
          ) : null}
          {results.map((result) => {
            const on = chosen.has(result.model.toLocaleLowerCase("pt-BR"));
            return (
              <Pressable
                key={result.model}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => onToggle(result.model)}
                style={[styles.row, on && styles.rowOn]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>
                    {result.pre}
                    <Text style={styles.match}>{result.match}</Text>
                    {result.post}
                  </Text>
                  <Text style={styles.meta}>
                    {result.vendor} · {subcategorySingularName(subcategory)}
                  </Text>
                </View>
                {on ? (
                  <View style={styles.checked}>
                    <Icon name="check" size={18} color={colors.surface} strokeWidth={2.8} />
                  </View>
                ) : (
                  <Icon name="plusBox" size={28} strokeWidth={1.6} />
                )}
              </Pressable>
            );
          })}
          {typed && total === 0 ? (
            <Text style={styles.message}>
              Nenhum produto com “{query.trim()}” em {scope}. Confira o nome, por exemplo RTX 5070
              Ti.
            </Text>
          ) : null}
          {total > results.length ? (
            <Text style={styles.more}>
              Mais {total - results.length} resultados. Continue digitando para refinar.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface, flex: 1 },
  bar: {
    alignItems: "center",
    borderBottomColor: colors.cobalt,
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: 4,
    minHeight: 58,
    paddingHorizontal: 4
  },
  barButton: {
    alignItems: "center",
    height: MIN_TOUCH_TARGET,
    justifyContent: "center",
    width: MIN_TOUCH_TARGET
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 22,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 0
  },
  count: {
    color: colors.slate,
    fontFamily: fonts.condensedSemiBold,
    fontSize: 15,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 14
  },
  list: { borderTopColor: colors.hairline, borderTopWidth: 1, flex: 1 },
  loading: { marginTop: 24 },
  row: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 8
  },
  rowOn: { backgroundColor: colors.cobaltWash },
  rowText: { flex: 1, gap: 1 },
  name: { color: colors.ink, fontFamily: fonts.condensedSemiBold, fontSize: 20, lineHeight: 23 },
  match: { color: colors.cobalt, fontFamily: fonts.condensedExtraBold },
  meta: { ...typography.caption, color: colors.slate },
  checked: {
    alignItems: "center",
    backgroundColor: colors.cobalt,
    borderRadius: radii.chip,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  message: { ...typography.body, color: colors.slate, padding: 20 },
  more: { ...typography.bodySm, color: colors.slate, paddingHorizontal: 20, paddingVertical: 14 }
});
