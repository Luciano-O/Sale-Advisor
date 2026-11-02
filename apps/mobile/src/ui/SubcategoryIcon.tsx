import Svg, { Path } from "react-native-svg";

import { colors } from "../theme";

// One stroke drawing per subcategory; a new subcategory gets its drawing from the canvas.
const DRAWINGS: Record<string, string> = {
  GPU: "M2 6v13 M2 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2 M7 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M15 10h3 M15 14h3 M6 17v2.5 M10 17v2.5"
};
const FALLBACK = "M7 7h10v10H7z M10 10h4v4h-4z";

export function SubcategoryIcon({
  subcategory,
  size = 26,
  color = colors.ink
}: {
  subcategory: string;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={DRAWINGS[subcategory] ?? FALLBACK}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
