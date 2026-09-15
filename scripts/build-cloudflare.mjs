import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [databaseName, databaseId] = process.argv.slice(2);

if (!databaseName || !databaseId) {
  console.error("Usage: npm run build:cloudflare -- <database-name> <database-id>");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["run", "build"], {
  env: {
    ...process.env,
    CLOUDFLARE_D1_DATABASE_NAME: databaseName,
    CLOUDFLARE_D1_DATABASE_ID: databaseId,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(`Cloudflare build failed: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  const projectRoot = process.cwd();
  const serverDirectory = resolve(projectRoot, "dist/server");
  const wranglerConfigPath = resolve(serverDirectory, "wrangler.json");
  const workerEntryPath = resolve(serverDirectory, "worker-entry.mjs");

  copyFileSync(
    resolve(projectRoot, "scripts/cloudflare-worker-entry.mjs"),
    workerEntryPath,
  );

  const wranglerConfig = JSON.parse(readFileSync(wranglerConfigPath, "utf8"));
  wranglerConfig.main = "worker-entry.mjs";
  wranglerConfig.triggers = {
    ...(wranglerConfig.triggers ?? {}),
    crons: ["0 * * * *"],
  };
  writeFileSync(wranglerConfigPath, `${JSON.stringify(wranglerConfig, null, 2)}\n`);
} catch (error) {
  console.error(
    `Cloudflare Worker wrapper setup failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

process.exit(0);
