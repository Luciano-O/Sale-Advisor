import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REQUIRED_NODE_MAJOR = 24;
const REQUIRED_PNPM_VERSION = "11.7.0";

export function validateToolVersions({ node, pnpm }) {
  const errors = [];
  const nodeMajor = Number(/^v?(\d+)/u.exec(node)?.[1]);
  if (nodeMajor !== REQUIRED_NODE_MAJOR) {
    errors.push(`Node 24.x is required; found ${node || "unknown"}.`);
  }
  if (pnpm !== REQUIRED_PNPM_VERSION) {
    errors.push(`pnpm 11.7.0 is required; found ${pnpm || "unknown"}.`);
  }
  return errors;
}

export function currentPnpmVersion(environment = process.env) {
  const userAgentVersion = /\bpnpm\/([^\s]+)/u.exec(environment.npm_config_user_agent ?? "")?.[1];
  if (userAgentVersion) return userAgentVersion;

  const executable = process.platform === "win32" ? "corepack.cmd" : "corepack";
  const result = spawnSync(executable, ["pnpm", "--version"], {
    encoding: "utf8",
    shell: false
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function runPreflight() {
  const versions = { node: process.version, pnpm: currentPnpmVersion() };
  const errors = validateToolVersions(versions);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[preflight] ${error}`);
    return 1;
  }
  console.log(`[preflight] Node ${versions.node}; pnpm ${versions.pnpm}.`);
  return 0;
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) process.exitCode = runPreflight();
