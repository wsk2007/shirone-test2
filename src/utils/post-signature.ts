import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SignatureConfig } from "@/types/config";

const fingerprintPattern = /^(?:[\da-f]{40}|[\da-f]{64})$/i;

export function getPostSignatureIndexPath(
	projectRoot: string,
	config: Pick<SignatureConfig, "directory">,
): string {
	return path.resolve(projectRoot, config.directory || "post-signatures", "index.json");
}

function getSourceKey(projectRoot: string, sourceFile: string): string {
	const relativePath = path.relative(projectRoot, path.resolve(sourceFile));
	if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
		throw new Error(`Post source must be inside the project root: ${sourceFile}`);
	}
	return relativePath.split(path.sep).join("/");
}

/** Read a pre-generated detached signature; builds never invoke GPG or access a private key. */
export async function getPostSignature(
	sourceFile: string | undefined,
	config: SignatureConfig,
): Promise<string | null> {
	if (!config.enable) return null;
	if (!sourceFile) {
		throw new Error("GPG signing is enabled, but Astro did not provide the post source file path.");
	}
	if (!fingerprintPattern.test(config.keyFingerprint.trim())) {
		throw new Error("GPG signing requires a full 40- or 64-character hexadecimal key fingerprint.");
	}
	const projectRoot = process.cwd();
	const sourcePath = getSourceKey(projectRoot, sourceFile);
	const markdown = await readFile(sourceFile);
	const sourceHash = createHash("sha256").update(markdown).digest("hex");
	const fingerprint = config.keyFingerprint.trim().toUpperCase();
	const indexFile = getPostSignatureIndexPath(projectRoot, config);
	let index: {
		schemaVersion?: number;
		keyFingerprint?: string;
		posts?: Record<string, { sha256?: string; signature?: string }>;
	};
	try {
		index = JSON.parse(await readFile(indexFile, "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		throw new Error(`Post signature index is missing. Run "pnpm posts:sign" locally before building: ${indexFile}`);
	}
	if (index.schemaVersion !== 1) {
		throw new Error(`Unsupported post signature index version in ${indexFile}. Run "pnpm posts:sign" to regenerate it.`);
	}
	if (index.keyFingerprint?.toUpperCase() !== fingerprint) {
		throw new Error(`Post signature index uses a different key. Run "pnpm posts:sign" with ${fingerprint}.`);
	}
	const record = index.posts?.[sourcePath];
	if (!record?.signature || record.sha256 !== sourceHash) {
		throw new Error(`Post signature for ${sourcePath} is missing or stale. Run "pnpm posts:sign" locally before building.`);
	}
	return record.signature;
}
