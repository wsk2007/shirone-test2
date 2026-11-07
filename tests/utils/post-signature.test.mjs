import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	chmodSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { getPostSignature } from "../../src/utils/post-signature.ts";

test("creates a verifiable signature in a temporary GPG home and reuses the cache", async (context) => {
	try {
		execFileSync("gpg", ["--version"], { stdio: "ignore" });
	} catch {
		context.skip("gpg is required for the detached signature test");
		return;
	}

	const gpgHome = mkdtempSync(join(tmpdir(), "shirone-gpg-test-"));
	chmodSync(gpgHome, 0o700);
	const sourceFile = join(gpgHome, "post.md");
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

		writeFileSync(sourceFile, "---\ntitle: Test\n---\nOriginal markdown.\n");
		const config = { enable: true, keyFingerprint: fingerprint, gpgHome };
		const value = await getPostSignature(sourceFile, config);
		assert.match(value, /BEGIN PGP SIGNATURE/);
		assert.equal(await getPostSignature(sourceFile, config), value);
		writeFileSync(signatureFile, value);
		execFileSync(
			"gpg",
			["--homedir", gpgHome, "--batch", "--verify", signatureFile, sourceFile],
			{ stdio: "ignore" },
		);

		writeFileSync(sourceFile, "---\ntitle: Test\n---\nChanged markdown.\n");
		const changed = await getPostSignature(sourceFile, config);
		assert.notEqual(changed, value);
	} finally {
		rmSync(gpgHome, { recursive: true, force: true });
	}
});

test("returns no signature when disabled and validates required options", async () => {
	assert.equal(await getPostSignature(undefined, { enable: false, keyFingerprint: "", gpgHome: "" }), null);
	await assert.rejects(
		getPostSignature("unused.md", { enable: true, keyFingerprint: "short", gpgHome: "/tmp" }),
		/full 40- or 64-character hexadecimal key fingerprint/,
	);
});
