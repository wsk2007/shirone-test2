import type { SignatureConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/** Build-time detached GPG signatures displayed below each enabled license card. */
export const signatureConfig: SignatureConfig = withUserConfig("signature", {
	enable: false,
	keyFingerprint: "",
	gpgHome: "",
});
