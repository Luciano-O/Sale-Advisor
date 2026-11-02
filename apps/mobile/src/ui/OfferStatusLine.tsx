import { StyleSheet, Text, View } from "react-native";

import { formatDelta } from "../format";
import type { ProductStatus } from "../following";
import { colors, radii, typography } from "../theme";
import { DeltaTag } from "./DeltaTag";
import { LabelTag } from "./LabelTag";

/** Whether something followed has passed the test: the label as conclusion, or still waiting. */
export function OfferStatusLine({
  status,
  foundText,
  waitingText
}: {
  status: ProductStatus | null;
  foundText: string;
  waitingText: string;
}) {
  const delta = status ? formatDelta(status.discountPercent) : null;
  return (
    <View style={styles.line}>
      {status ? <LabelTag label={status.label} /> : <Text style={styles.waiting}>Aguardando</Text>}
      {delta ? <DeltaTag value={delta} /> : null}
      <Text style={styles.text}>{status ? foundText : waitingText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  waiting: {
    ...typography.tag,
    backgroundColor: colors.labelNormal,
    borderRadius: radii.tag,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  text: { ...typography.caption, color: colors.slate, flexShrink: 1 }
});
