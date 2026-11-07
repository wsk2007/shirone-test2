import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { signatureConfig } from "../../src/config/signatureConfig.ts";
import { getPostSignatureIndexPath } from "../../src/utils/post-signature.ts";

const projectRoot = process.cwd();
const postsDirectory = resolve(projectRoot, "src/content/posts");
const fingerprint = signatureConfig.keyFingerprint.trim().toUpperCase();
const fingerprintPattern = /^(?:[\da-f]{40}|[\da-f]{64})$/i;

async function collectPostFiles(directory, files = []) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			await collectPostFiles(fullPath, files);
		} else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
			files.push(fullPath);
		}
	}
	return files;
}

function signMarkdown(markdown, gpgHome) {
	const args = [];
	if (gpgHome) args.push("--homedir", resolve(projectRoot, gpgHome));
	args.push(
		"--batch",
		"--yes",
		"--armor",
		"--detach-sign",
		"--local-user",
		fingerprint,
		"--output",
		"-",
		"--",
	);
	try {
		return execFileSync("gpg", args, {
			input: markdown,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch (error) {
		const stderr = error && typeof error === "object" && "stderr" in error
			? String(error.stderr ?? "").trim()
			: "";
		throw new Error(`GPG signing failed for key ${fingerprint}: ${stderr || error.message}`);
	}
}

async function main() {
	if (process.argv.includes("--help") || process.argv.includes("-h")) {
		console.log("Usage: pnpm posts:sign");
		console.log("Signs src/content/posts/**/*.md(x) and writes post-signatures/index.json.");
		console.log("The local GPG key is used only by this command, never by site builds.");
		return;
	}
	if (!signatureConfig.enable) {
		throw new Error('Signature display is disabled. Set "signature.enable: true" before signing posts.');
	}
	if (!fingerprintPattern.test(fingerprint)) {
		throw new Error("signature.keyFingerprint must be a full 40- or 64-character hexadecimal fingerprint.");
	}

	const postFiles = (await collectPostFiles(postsDirectory)).sort();
	if (postFiles.length === 0) {
		throw new Error(`No Markdown posts found in ${postsDirectory}. Run "pnpm content:sync" first if using an external content repository.`);
	}

	const posts = {};
	for (const sourceFile of postFiles) {
		const relativeSource = relative(projectRoot, sourceFile).split(sep).join("/");
		const markdown = await readFile(sourceFile);
		posts[relativeSource] = {
			sha256: createHash("sha256").update(markdown).digest("hex"),
			signature: signMarkdown(markdown, signatureConfig.gpgHome?.trim()),
		};
	}

	const indexFile = getPostSignatureIndexPath(projectRoot, signatureConfig);
	await mkdir(dirname(indexFile), { recursive: true });
	const temporaryFile = `${indexFile}.${process.pid}.${randomUUID()}.tmp`;
	const index = {
		schemaVersion: 1,
		keyFingerprint: fingerprint,
		posts,
	};
	await writeFile(temporaryFile, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o644 });
	await rename(temporaryFile, indexFile);
	console.log(`[posts:sign] Signed ${postFiles.length} posts into ${relative(projectRoot, indexFile)}.`);
	console.log("[posts:sign] The signature index is public; the private key remains in the local GPG home.");
}

main().catch((error) => {
	console.error(`[posts:sign] ${error.message}`);
	process.exitCode = 1;
});
