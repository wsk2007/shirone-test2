import type { GameItem } from "../../types/gamesConfig.ts";

const VALID_STATUSES = new Set(["playing", "completed", "backlog", "wishlist"]);

function safeUrl(value: unknown): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	const url = value.trim();
	if (url.startsWith("//")) return `https:${url}`;
	if (url.startsWith("http://")) return url.replace(/^http:/i, "https:");
	if (url.startsWith("https://") || /^\/[a-zA-Z0-9_\-.\/]+$/.test(url)) {
		return url;
	}
	return undefined;
}

function cleanText(value: unknown, max = 500): string {
	if (typeof value !== "string") return "";
	const text = value.replace(/<[^>]*>/g, "").replace(/[\r\n\t]+/g, " ").trim();
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function normalizeGameItem(raw: unknown): GameItem | null {
	if (!raw || typeof raw !== "object") return null;
	const item = raw as Record<string, unknown>;
	if (
		typeof item.id !== "string" ||
		!item.id.trim() ||
		typeof item.name !== "string" ||
		!item.name.trim()
	) {
		return null;
	}

	const status = VALID_STATUSES.has(String(item.status))
		? (String(item.status) as GameItem["status"])
		: "backlog";
	const rating =
		typeof item.rating === "number" && Number.isFinite(item.rating)
			? Math.max(0, Math.min(5, Math.round(item.rating * 10) / 10))
			: undefined;
	const tags = Array.isArray(item.tags)
		? [
				...new Set(
					item.tags
						.filter(
							(tag): tag is string =>
								typeof tag === "string" && Boolean(tag.trim()),
						)
						.map((tag) => tag.trim().slice(0, 30)),
				),
			].slice(0, 8)
		: [];

	return {
		id: item.id.trim(),
		name: item.name.trim(),
		developer:
			typeof item.developer === "string" && item.developer.trim()
				? item.developer.trim()
				: "Unknown",
		category:
			typeof item.category === "string" && item.category.trim()
				? item.category.trim()
				: "action",
		status,
		rating,
		hours:
			typeof item.hours === "number" && Number.isFinite(item.hours)
				? Math.max(0, Math.round(item.hours))
				: undefined,
		cover: safeUrl(item.cover),
		icon: typeof item.icon === "string" ? item.icon : undefined,
		platform: typeof item.platform === "string" ? item.platform.trim() : undefined,
		year: typeof item.year === "string" ? item.year.trim().slice(0, 4) : undefined,
		tags,
		description: cleanText(item.description),
		link: safeUrl(item.link),
		featured: item.featured === true,
	};
}
