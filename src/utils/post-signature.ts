import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SignatureConfig } from "@/types/config";

const fingerprintPattern = /^(?:[\da-f]{40}|[\da-f]{64})$/i;

/** Return the detached signature for a post, reusing a content-addressed build cache. */
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
	if (!config.gpgHome.trim()) {
		throw new Error("GPG signing requires an explicit gpgHome path.");
	}

	const markdown = await readFile(sourceFile);
	const gpgHome = path.resolve(process.cwd(), config.gpgHome);
	const fingerprint = config.keyFingerprint.trim().toUpperCase();
	const cacheKey = createHash("sha256")
		.update(markdown)
		.update("\0")
		.update(fingerprint)
		.update("\0")
		.update(gpgHome)
		.digest("hex");
	const cacheDir = path.resolve(process.cwd(), ".astro", "gpg-signatures");
	const cacheFile = path.join(cacheDir, `${cacheKey}.asc`);

	try {
		return await readFile(cacheFile, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}

	let signature: string;
	try {
		signature = execFileSync(
			"gpg",
			[
				"--homedir",
				gpgHome,
				"--batch",
				"--yes",
				"--armor",
				"--detach-sign",
				"--local-user",
				fingerprint,
				"--output",
				"-",
				"--",
			],
			{ input: markdown, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stderr =
			error && typeof error === "object" && "stderr" in error
				? (error as { stderr?: Buffer }).stderr
				: undefined;
		const detail = stderr ? String(stderr).trim() || message : message;
		throw new Error(
			`GPG signing failed for ${sourceFile} with key ${fingerprint}: ${detail}`,
		);
	}

	await mkdir(cacheDir, { recursive: true });
	const temporaryFile = `${cacheFile}.${process.pid}.${randomUUID()}.tmp`;
	await writeFile(temporaryFile, signature, { mode: 0o600 });
	await rename(temporaryFile, cacheFile);
	return signature;
}
