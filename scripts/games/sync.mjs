import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gamesConfig } from "../../src/config/gamesConfig.ts";
import { normalizeGameItem } from "../../src/utils/games/normalize.ts";
import { fetchBangumiGamesData } from "./providers/bangumi.mjs";
import { commitSnapshot, isSnapshotStale } from "../anime/snapshot-store.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const provider = gamesConfig.providers?.bangumi;
const args = process.argv.slice(2);
const ifStale = args.includes("--if-stale");
if (!provider?.enable || !provider.userId) {
	console.log("[games-sync] Bangumi is not enabled or userId is missing in gamesConfig.");
	process.exit(0);
}
const directory = gamesConfig.snapshot?.directory || "src/data/games-snapshots";
const targetDir = join(root, directory);
const targetFile = join(targetDir, "bangumi.json");
if (ifStale && !isSnapshotStale(targetFile, gamesConfig.snapshot?.staleAfterDays || 30)) {
	console.log("[games-sync] Snapshot is fresh; skipping.");
	process.exit(0);
}
try {
	const result = await fetchBangumiGamesData(provider);
	const items = result.rawItems.map(normalizeGameItem).filter(Boolean);
	const content = JSON.stringify({ schemaVersion: 1, provider: "bangumi", fetchedAt: new Date().toISOString(), accountRef: result.accountRef, items }, null, 2);
	const tempFile = join(targetDir, `.temp-bangumi-${Date.now()}.json`);
	const outcome = commitSnapshot({ targetFile, tempFile, jsonContent: content, itemCount: items.length, keepLastValid: gamesConfig.snapshot?.keepLastValid ?? true });
	console.log(outcome === "kept" ? `[games-sync] Kept last valid snapshot at ${targetFile}.` : `[games-sync] Synced ${items.length} games to ${targetFile}.`);
} catch (error) {
	console.error("[games-sync] Failed:", error instanceof Error ? error.message : String(error));
	process.exit(1);
}
