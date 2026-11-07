import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { gamesConfig } from "@/config/gamesConfig";
import { gamesData } from "@/data/games";
import type { GameItem, GamesConfig } from "@/types/gamesConfig";
import { normalizeGameItem } from "./games/normalize.ts";

export { normalizeGameItem } from "./games/normalize.ts";

function parseSnapshot(content: string): GameItem[] | null {
	try {
		const parsed = JSON.parse(content);
		const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
		if (!Array.isArray(rawItems)) return null;
		return rawItems.map(normalizeGameItem).filter((item): item is GameItem => Boolean(item));
	} catch { return null; }
}

export function resolveGamesOptions(config: GamesConfig) {
	const source = config.source?.kind === "snapshot" ? config.source : { kind: "local" as const };
	const provider = source.provider === "bangumi" ? "bangumi" : undefined;
	const file = source.file && /^[a-zA-Z0-9_-]+\.json$/.test(source.file) ? source.file : provider ? `${provider}.json` : undefined;
	return { source: { ...source, ...(provider ? { provider } : {}), ...(file ? { file } : {}) }, fallback: config.fallback?.kind === "empty" ? "empty" : "local", snapshot: { directory: config.snapshot?.directory || "src/data/games-snapshots", staleAfterDays: config.snapshot?.staleAfterDays || 30, keepLastValid: config.snapshot?.keepLastValid ?? true } } as const;
}

export async function getGamesList(config = gamesConfig): Promise<GameItem[]> {
	const options = resolveGamesOptions(config);
	if (options.source.kind !== "snapshot" || !options.source.file) return config.items ?? gamesData;
	const filePath = join(isAbsolute(options.snapshot.directory) ? options.snapshot.directory : resolve(process.cwd(), options.snapshot.directory), options.source.file);
	if (!existsSync(filePath) && options.source.fetchOnDev !== false && options.source.provider === "bangumi") {
		const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
		const provider = config.providers?.bangumi;
		if (isDev && provider?.enable && provider.userId) {
			try {
				const { fetchBangumiGamesData } = await import("../../scripts/games/providers/bangumi.mjs");
				const fetched = await fetchBangumiGamesData(provider);
				const items = fetched.rawItems.map(normalizeGameItem).filter((item): item is GameItem => Boolean(item));
				if (items.length > 0) {
					mkdirSync(resolve(process.cwd(), options.snapshot.directory), { recursive: true });
					writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, provider: "bangumi", fetchedAt: new Date().toISOString(), accountRef: fetched.accountRef, items }, null, 2));
					return items;
				}
			} catch (error) {
				console.warn(`[games] Live Bangumi fetch failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
	const result = parseSnapshot(readFileSync(filePath, "utf8"));
	return result ?? (options.fallback === "local" ? config.items ?? gamesData : []);
}
