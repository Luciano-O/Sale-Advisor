import { existsSync } from "node:fs";

import type { ConfigContext, ExpoConfig } from "expo/config";

// Firebase config for push: an EAS file environment variable in cloud builds, or a local copy
// (ignored by Git) for native builds on this machine. Without it the app builds without FCM.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync("./google-services.json") ? "./google-services.json" : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Sale Advisor",
  slug: config.slug ?? "sale-advisor",
  android: {
    ...config.android,
    ...(googleServicesFile ? { googleServicesFile } : {})
  }
});
