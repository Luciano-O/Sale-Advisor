import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, typography } from "../theme";
import { Icon } from "./Icon";

export function CatalogOfflineNotice({ body, onRetry }: { body: string; onRetry(): void }) {
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Icon name="noConnection" color={colors.surface} />
      <View style={styles.text}>
        <Text style={styles.title}>Sem conexão com a lista de produtos</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable accessibilityRole="button" hitSlop={4} onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Tentar de novo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  text: { flex: 1, gap: 4 },
  title: { color: colors.surface, fontFamily: fonts.condensedBold, fontSize: 21, lineHeight: 23 },
  body: { ...typography.bodySm, color: colors.inkMist },
  retry: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.surface,
    borderRadius: radii.control,
    borderWidth: 1.5,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 16
  },
  retryText: { color: colors.surface, fontFamily: fonts.bodySemiBold, fontSize: 15 }
});
