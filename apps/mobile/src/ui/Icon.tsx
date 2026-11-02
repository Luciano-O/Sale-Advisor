import Svg, { Path } from "react-native-svg";

import { colors } from "../theme";

// Stroke icons drawn on the canvas, on a 24×24 grid. Circles and rects are written as paths.
const ICONS = {
  arrowBack: ["M19 12H5", "m11 18-6-6 6-6"],
  arrowForward: ["M5 12h14", "m13 6 6 6-6 6"],
  check: ["M20 6 9 17l-5-5"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  copy: [
    "M11 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
    "M5 15V5a2 2 0 0 1 2-2h8"
  ],
  external: [
    "M14 4h6v6",
    "M20 4 10 14",
    "M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
  ],
  eyeOff: [
    "M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.3",
    "M6.6 6.6C3.6 8.6 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6",
    "M9.9 9.9a3 3 0 0 0 4.2 4.2",
    "m2 2 20 20"
  ],
  navOffers: ["M4 6h16", "M4 12h11", "M4 18h6"],
  navFollowing: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    "M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
    "M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0"
  ],
  navSettings: ["M4 7h9", "M17 7h3", "M15 5v4", "M4 17h3", "M11 17h9", "M9 15v4"],
  noConnection: [
    "M2 2l20 20",
    "M8.5 16.5a5 5 0 0 1 7 0",
    "M5 12.9a10 10 0 0 1 5.2-2.8",
    "M19 12.9a10 10 0 0 0-2.3-1.6",
    "M12 20h.01"
  ],
  plus: ["M12 5v14", "M5 12h14"],
  search: ["M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0", "m20 20-3.5-3.5"],
  trash: [
    "M3 6h18",
    "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
    "M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"
  ]
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 2
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICONS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
