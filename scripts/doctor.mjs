import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import net from "node:net";
import { delimiter, join } from "node:path";
import process from "node:process";

import { currentPnpmVersion, validateToolVersions } from "./preflight.mjs";

const REQUIRED_ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "API_PORT",
  "ADMIN_API_KEY",
  "NOTIFICATION_PROVIDER",
  "EXPO_PUBLIC_API_URL"
];

function pass(message) {
  console.log(`[doctor] ok: ${message}`);
}

function fail(errors, message) {
  errors.push(message);
  console.error(`[doctor] error: ${message}`);
}

function command(executable, args) {
  return spawnSync(executable, args, { encoding: "utf8", shell: false });
}

function loadEnvironmentFile(errors) {
  if (!existsSync(".env")) {
    fail(errors, ".env is missing (copy .env.example and configure it).");
    return;
  }
  const keys = new Set();
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (match?.[1]) keys.add(match[1]);
  }
  const missing = REQUIRED_ENV_KEYS.filter((key) => !keys.has(key));
  if (missing.length > 0) fail(errors, `.env is missing keys: ${missing.join(", ")}.`);
  else
    pass(`.env contains required keys (${REQUIRED_ENV_KEYS.join(", ")}); values were not shown.`);
}

async function canBind(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function composeOwnsPort(port) {
  const docker = process.platform === "win32" ? "docker.exe" : "docker";
  const result = command(docker, [
    "compose",
    "-f",
    "infra/compose.yaml",
    "port",
    port === 5432 ? "postgres" : "redis",
    String(port)
  ]);
  return result.status === 0 && result.stdout.includes(`:${port}`);
}

async function checkDevelopmentPorts(errors) {
  for (const port of [5432, 6379]) {
    if (await canBind(port)) pass(`127.0.0.1:${port} is available.`);
    else if (composeOwnsPort(port))
      pass(`127.0.0.1:${port} belongs to the development Compose project.`);
    else fail(errors, `127.0.0.1:${port} is occupied by an unexpected process.`);
  }
}

function findOnPath(name) {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return name;
}

function checkJava(errors) {
  const java = process.platform === "win32" ? "java.exe" : "java";
  const result = command(java, ["-version"]);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0 || !/version "21(?:\.|")/u.test(output)) {
    fail(errors, "Java 21 is required for Android.");
  } else pass("Java 21 is available.");
}

function androidSdkRoot() {
  const configured = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (configured) return configured;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, "Android", "Sdk");
  }
  return "";
}

function checkAndroid(errors) {
  checkJava(errors);
  const sdk = androidSdkRoot();
  if (!sdk || !existsSync(join(sdk, "platforms", "android-36"))) {
    fail(errors, "Android SDK platform API 36 is required.");
  } else pass(`Android SDK API 36 is installed under ${sdk}.`);

  const buildTools = sdk ? join(sdk, "build-tools") : "";
  const hasBuildTools36 =
    buildTools &&
    existsSync(buildTools) &&
    readdirSync(buildTools).some((version) => version.startsWith("36."));
  if (!hasBuildTools36) fail(errors, "Android build-tools 36.x are required.");
  else pass("Android build-tools 36.x are installed.");

  const adb = sdk
    ? join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb")
    : findOnPath(process.platform === "win32" ? "adb.exe" : "adb");
  const devices = command(adb, ["devices"]);
  const ready = devices.status === 0 && /\tdevice\r?$/mu.test(devices.stdout);
  if (!ready) fail(errors, "ADB must report at least one target in state 'device'.");
  else pass("ADB reports a ready device.");
}

const errors = [];
const versionErrors = validateToolVersions({
  node: process.version,
  pnpm: currentPnpmVersion()
});
for (const error of versionErrors) fail(errors, error);
if (versionErrors.length === 0) pass(`Node ${process.version} and pnpm 11.7.0.`);

loadEnvironmentFile(errors);
const docker = command(process.platform === "win32" ? "docker.exe" : "docker", ["info"]);
if (docker.status !== 0) fail(errors, "Docker Desktop must be installed and running.");
else pass("Docker Desktop is running.");
await checkDevelopmentPorts(errors);

if (process.argv.includes("--android")) checkAndroid(errors);
if (errors.length > 0) process.exitCode = 1;
