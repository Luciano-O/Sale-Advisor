import { StyleSheet, Text, View } from "react-native";

import { typography } from "../theme";
import { BrandMark } from "./BrandMark";

export function BrandLockup() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Sale Advisor">
      <BrandMark />
      <Text style={typography.titleSm}>Sale Advisor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 8 }
});
