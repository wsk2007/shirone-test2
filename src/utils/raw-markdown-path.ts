import { basename, extname } from "node:path";

export function getRawMarkdownPath(postId: string, sourceFile: string): string {
	const extension = extname(sourceFile).toLowerCase();
	const id = postId.replace(/\.(md|mdx)$/i, "");
	const isIndexFile = basename(sourceFile).toLowerCase() === `index${extension}`;
	const path =
		isIndexFile && id !== "index" && !id.endsWith("/index")
			? `${id}/index`
			: id;
	return `${path}${extension}`;
}

export function getRawMarkdownHref(postId: string, sourceFile: string): string {
	return `/raw-markdown/${getRawMarkdownPath(postId, sourceFile)
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/")}`;
}
