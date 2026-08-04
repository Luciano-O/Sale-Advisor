import { spawnSync } from "node:child_process";

const builds = [
  ...["api", "worker", "migrate", "railway-runtime"].map((target) => ({
    args: ["--target", target],
    tag: `sale-advisor-${target}:local`
  })),
  {
    args: [
      "--file",
      "infra/railway/admin.Dockerfile",
      "--build-arg",
      "VITE_API_URL=https://api.example.invalid"
    ],
    tag: "sale-advisor-admin:local"
  }
];

for (const build of builds) {
  const result = spawnSync("docker", ["build", ...build.args, "--tag", build.tag, "."], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
