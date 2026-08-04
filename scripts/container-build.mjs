import { spawnSync } from "node:child_process";

for (const target of ["api", "worker", "migrate"]) {
  const result = spawnSync(
    "docker",
    ["build", "--target", target, "--tag", `sale-advisor-${target}:local`, "."],
    { stdio: "inherit", shell: process.platform === "win32" }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
