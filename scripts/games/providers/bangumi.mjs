const BANGUMI_API_BASE = "https://api.bgm.tv";
const USER_AGENT = "Shirone/1.0 (https://github.com/shirone; GamesSync)";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STATUS_COLLECTIONS = [
	{ type: 3, status: "playing" },
	{ type: 2, status: "completed" },
	{ type: 1, status: "wishlist" },
	{ type: 4, status: "backlog" },
	{ type: 5, status: "backlog" },
];

async function fetchJson(url, timeoutMs = 15000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
		});
		if (!response.ok) return { ok: false, status: response.status };
		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("application/json")) return { ok: false, status: 415 };
		return { ok: true, data: await response.json() };
	} catch (error) {
		return { ok: false, error };
	} finally {
		clearTimeout(timer);
	}
}

async function fetchCollectionType(userId, type, status, options) {
	const pageSize = Math.min(Math.max(10, options.pageSize || 50), 100);
	const maxItems = Math.max(1, options.maxItems || 300);
	const minDelayMs = Math.max(0, options.minDelayMs || 300);
	const collected = [];
	let offset = 0;
	while (collected.length < maxItems) {
		const limit = Math.min(pageSize, maxItems - collected.length);
		const url = `${BANGUMI_API_BASE}/v0/users/${encodeURIComponent(userId)}/collections?subject_type=4&type=${type}&limit=${limit}&offset=${offset}`;
		const result = await fetchJson(url);
		if (!result.ok) {
			if (result.status === 404) return [];
			throw new Error(`Bangumi collections request failed (HTTP ${result.status || "network error"})`);
		}
		const rows = Array.isArray(result.data?.data) ? result.data.data : [];
		collected.push(...rows);
		if (rows.length < limit || collected.length >= (result.data?.total || maxItems)) break;
		offset += rows.length;
		await delay(minDelayMs);
	}
	return collected.map((item) => ({ item, status }));
}

async function fetchSubject(subjectId) {
	const result = await fetchJson(`${BANGUMI_API_BASE}/v0/subjects/${subjectId}`, 10000);
	return result.ok ? result.data : null;
}

function infoboxValue(infobox, keys) {
	if (!Array.isArray(infobox)) return undefined;
	for (const key of keys) {
		const row = infobox.find((item) => item?.key === key);
		if (!row) continue;
		if (typeof row.value === "string" && row.value.trim()) return row.value.trim();
		if (Array.isArray(row.value)) {
			const value = row.value.find((item) => typeof item === "string" ? item.trim() : item?.v?.trim());
			if (value) return typeof value === "string" ? value.trim() : value.v.trim();
		}
	}
	return undefined;
}

function categoryFor(subject, detail) {
	const text = [subject.platform, detail?.platform, ...(subject.tags || []).map((tag) => tag?.name || tag)].filter(Boolean).join(" ").toLowerCase();
	if (/sandbox|建造|模拟|simulation/.test(text)) return "sandbox";
	if (/open[- ]world|开放世界/.test(text)) return "open-world";
	if (/rpg|jrpg|角色扮演/.test(text)) return "rpg";
	if (/action|动作|射击|格斗/.test(text)) return "action";
	if (/casual|休闲|派对|party/.test(text)) return "casual";
	if (/galgame|视觉小说|visual novel|音游|音乐游戏|mug|全年龄/.test(text)) return "casual";
	return "action";
}

function platformFor(subject, detail, tags) {
	const explicit = subject.platform || detail?.platform;
	if (explicit && explicit !== "游戏") return explicit;
	const known = tags.find((tag) => /^(pc|windows|switch|ns|ps[345]|ios|android|mac|xbox|steam)$/i.test(tag));
	return known;
}

export async function fetchBangumiGamesData(config) {
	const userId = config.userId?.trim();
	if (!userId) throw new Error("Bangumi userId is required in gamesConfig.providers.bangumi.userId");
	const options = config.request || {};
	const entries = (await Promise.all(STATUS_COLLECTIONS.map(({ type, status }) => fetchCollectionType(userId, type, status, options)))).flat();
	const rawItems = [];
	for (let i = 0; i < entries.length; i += 6) {
		const batch = entries.slice(i, i + 6);
		const results = await Promise.all(batch.map(async ({ item, status }) => {
			const subject = item.subject || {};
			const detail = item.subject_id ? await fetchSubject(item.subject_id) : null;
			const name = subject.name_cn || subject.name || detail?.name_cn || detail?.name || "";
			if (!name.trim()) return null;
			const score = Number(item.rate || subject.score || detail?.rating?.score || 0);
			const year = String(subject.date || detail?.date || "").slice(0, 4);
			const tags = (subject.tags || detail?.tags || []).map((tag) => typeof tag === "string" ? tag : tag?.name).filter(Boolean).slice(0, 8);
			return {
				id: `bangumi-${item.subject_id}`,
				name: name.trim(),
				developer: infoboxValue(detail?.infobox, ["开发", "开发商", "制作", "Developer"]) || "Bangumi",
				category: categoryFor(subject, detail),
				status,
				cover: subject.images?.large || subject.images?.common || subject.images?.medium || detail?.images?.large || detail?.images?.common,
				rating: Number.isFinite(score) ? Math.max(0, Math.min(5, Math.round((score / 2) * 10) / 10)) : 0,
				platform: platformFor(subject, detail, tags),
				year,
				tags,
				description: detail?.summary || subject.short_summary || "",
				link: item.subject_id ? `https://bgm.tv/subject/${item.subject_id}` : undefined,
			};
		}));
		rawItems.push(...results.filter(Boolean));
		if (i + 6 < entries.length) await delay(100);
	}
	return { provider: "bangumi", accountRef: userId, rawItems };
}
