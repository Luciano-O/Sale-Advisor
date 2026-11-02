import Svg, { Rect } from "react-native-svg";

import { colors } from "../theme";

/** Three left-aligned bars (A Regra da Barra): the shortest is cobalt. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect x={3} y={5} width={22} height={4.5} rx={1} fill={colors.ink} />
      <Rect x={3} y={11.75} width={15} height={4.5} rx={1} fill={colors.ink} />
      <Rect x={3} y={18.5} width={9} height={4.5} rx={1} fill={colors.cobalt} />
    </Svg>
  );
}
