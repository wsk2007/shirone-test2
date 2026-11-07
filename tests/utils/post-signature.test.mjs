import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import { getPostSignature } from "../../src/utils/post-signature.ts";

test("reads a stored signature without GPG and rejects stale source content", async (context) => {
	try {
		execFileSync("gpg", ["--version"], { stdio: "ignore" });
	} catch {
		context.skip("gpg is required for the detached signature test");
		return;
	}

	const gpgHome = mkdtempSync(join(tmpdir(), "shirone-gpg-test-"));
	const projectRoot = mkdtempSync(join(process.cwd(), ".post-signature-test-"));
	chmodSync(gpgHome, 0o700);
	const sourceFile = join(projectRoot, "post.md");
	const signatureFile = join(gpgHome, "post.md.asc");
	try {
		execFileSync(
			"gpg",
			[
				"--homedir",
				gpgHome,
				"--batch",
				"--passphrase",
				"",
				"--quick-generate-key",
				"Shirone test signer <shirone-test@example.invalid>",
				"ed25519",
				"sign",
				"1d",
			],
			{ stdio: "ignore" },
		);
		const keyListing = execFileSync(
			"gpg",
			["--homedir", gpgHome, "--batch", "--with-colons", "--list-secret-keys"],
			{ encoding: "utf8" },
		);
		const fingerprint = keyListing
			.split("\n")
			.find((line) => line.startsWith("fpr:"))
			?.split(":")[9];
		assert.ok(fingerprint, "the generated key has a fingerprint");

		const markdown = "---\ntitle: Test\n---\nOriginal markdown.\n";
		writeFileSync(sourceFile, markdown);
		const value = execFileSync(
			"gpg",
			["--homedir", gpgHome, "--batch", "--yes", "--armor", "--detach-sign", "--local-user", fingerprint, "--output", "-", "--"],
			{ input: markdown, encoding: "utf8" },
		);
		const config = {
			enable: true,
			keyFingerprint: fingerprint,
			gpgHome: "",
			directory: relative(process.cwd(), join(projectRoot, "signatures")),
		};
		const sourcePath = relative(process.cwd(), sourceFile).split(sep).join("/");
		mkdirSync(join(projectRoot, "signatures"), { recursive: true });
		writeFileSync(join(projectRoot, "signatures", "index.json"), JSON.stringify({
			schemaVersion: 1,
			keyFingerprint: fingerprint,
			posts: {
				[sourcePath]: {
					sha256: createHash("sha256").update(markdown).digest("hex"),
					signature: value,
				},
			},
		}));
		assert.match(await getPostSignature(sourceFile, config), /BEGIN PGP SIGNATURE/);
		assert.equal(await getPostSignature(sourceFile, config), value);
		writeFileSync(signatureFile, value);
		execFileSync(
			"gpg",
			["--homedir", gpgHome, "--batch", "--verify", signatureFile, sourceFile],
			{ stdio: "ignore" },
		);

		writeFileSync(sourceFile, "---\ntitle: Test\n---\nChanged markdown.\n");
		await assert.rejects(getPostSignature(sourceFile, config), /missing or stale/);
	} finally {
		rmSync(gpgHome, { recursive: true, force: true });
		rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("returns no signature when disabled and validates required options", async () => {
	assert.equal(await getPostSignature(undefined, { enable: false, keyFingerprint: "", gpgHome: "" }), null);
	await assert.rejects(
		getPostSignature("unused.md", { enable: true, keyFingerprint: "short", gpgHome: "/tmp" }),
		/full 40- or 64-character hexadecimal key fingerprint/,
	);
});
