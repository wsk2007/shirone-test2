import { readFile } from "node:fs/promises";
import type { APIRoute, GetStaticPaths } from "astro";
import { getRawMarkdownPaths } from "@utils/raw-markdown";

export const getStaticPaths: GetStaticPaths = () => getRawMarkdownPaths(".mdx");

export const GET: APIRoute = async ({ props }) => {
	const markdown = await readFile(props.sourceFile);
	return new Response(markdown, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
};
