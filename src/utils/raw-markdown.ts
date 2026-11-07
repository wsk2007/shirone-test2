import { getCollection } from "astro:content";
import { extname } from "node:path";
import { getRawMarkdownPath } from "@utils/raw-markdown-path";

export async function getRawMarkdownPaths(
	extension: ".md" | ".mdx",
): Promise<Array<{ params: { path: string }; props: { sourceFile: string } }>> {
	const posts = await getCollection("posts");
	return posts
		.filter((entry) => entry.filePath && extname(entry.filePath).toLowerCase() === extension)
		.map((entry) => {
			if (!entry.filePath) {
				throw new Error(`Cannot publish raw Markdown for post "${entry.id}": source path is unavailable.`);
			}
			const sourceId = getRawMarkdownPath(entry.id, entry.filePath).slice(
				0,
				-extension.length,
			);
			return {
				params: { path: sourceId },
				props: { sourceFile: entry.filePath },
			};
		});
}
