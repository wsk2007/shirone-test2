# Bangumi 游戏数据源

Shirone can populate the games page from a Bangumi user collection through a build-time snapshot. The page never requests Bangumi from the browser, so the source remains compatible with the remote-data zero-extra-burden rule.

## Configuration

Configure the source in `src/config/gamesConfig.ts` or through the external content configuration overlay:

```ts
source: {
	kind: "snapshot",
	provider: "bangumi",
	// file: "bangumi.json", // default provider snapshot
	// fetchOnDev: true,     // live fetch only when the dev snapshot is missing
},
providers: {
	bangumi: {
		enable: true,
		userId: "965119",
		request: {
			pageSize: 50,
			maxItems: 300,
			minDelayMs: 1500,
		},
	},
},
fallback: { kind: "local" },
snapshot: {
	directory: "src/data/games-snapshots",
	staleAfterDays: 30,
	keepLastValid: true,
},
```

The safe default remains `source: { kind: "local" }` with Bangumi disabled. When the snapshot is missing or invalid, `fallback: { kind: "local" }` keeps the manually maintained games list visible. Use `kind: "empty"` when an unavailable remote source should render no game cards instead.

## API scheme

The adapter uses Bangumi’s v0 API:

1. `GET https://api.bgm.tv/v0/users/{userId}/collections?subject_type=4&type={status}&limit={limit}&offset={offset}` retrieves game collections. Bangumi subject type `4` means game.
2. Collection status values map as follows:

   | Bangumi `type` | Game status |
   | ---: | --- |
   | `1` | `wishlist` |
   | `2` | `completed` |
   | `3` | `playing` |
   | `4` | `backlog` |
   | `5` | `backlog` |

3. `GET https://api.bgm.tv/v0/subjects/{subjectId}` enriches each collection entry with the full title, cover, summary, tags, platform, year, and infobox data.
4. Bangumi ratings are on a 0–10 scale; the games card uses 0–5, so the adapter divides by two and rounds to one decimal place.

The authoritative API definitions are maintained in the [Bangumi API OpenAPI schema](https://github.com/bangumi/api/blob/master/open-api/v0.yaml).

## Synchronization

The explicit sync command writes `src/data/games-snapshots/bangumi.json`:

```sh
NODE_USE_ENV_PROXY=1 pnpm games:sync
```

Use `--if-stale` to skip synchronization while the existing snapshot is still fresh:

```sh
NODE_USE_ENV_PROXY=1 pnpm games:sync --if-stale
```

`NODE_USE_ENV_PROXY=1` is needed in environments where direct access to Bangumi is blocked and Node must use the configured proxy. The command performs network access only during explicit synchronization. In development, `fetchOnDev: true` may fetch once when the configured snapshot is absent and then writes the local snapshot.

Snapshots contain a version, provider, fetch timestamp, account reference, and normalized `GameItem[]`. Empty responses preserve the previous non-empty snapshot when `snapshot.keepLastValid` is enabled.

## Field mapping

| Bangumi data | Games page field |
| --- | --- |
| `subject_id` | Stable `bangumi-{id}` item ID and Bangumi subject link |
| `subject.name_cn` / `subject.name` | `name` |
| Game infobox developer fields | `developer` |
| Subject tags and platform terms | `category`, `tags`, and `platform` |
| Subject images | `cover` |
| Collection status | `status` |
| Collection `rate` or subject score | `rating` |
| Subject date | `year` |
| Subject summary | `description` |

The category mapper targets the existing games categories: `open-world`, `sandbox`, `rpg`, `action`, and `casual`. Unknown or visual-novel/music-oriented entries fall back to `casual`; other unknown entries fall back to `action`.

## Validation

Run the type check after changing the source:

```sh
pnpm exec astro check
```

For a live smoke test using the configured account:

```sh
NODE_USE_ENV_PROXY=1 pnpm exec node --input-type=module -e '
import { fetchBangumiGamesData } from "./scripts/games/providers/bangumi.mjs";
const result = await fetchBangumiGamesData({ userId: "965119" });
console.log(result.accountRef, result.rawItems.length);
'
```

The focused browser and accessibility tests should also be run before merging:

```sh
pnpm exec playwright test tests/site/games.spec.ts tests/site/a11y.spec.ts
```
