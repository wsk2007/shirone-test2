import type { SignatureConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/** Build-time detached GPG signatures displayed below each enabled license card. */
export const signatureConfig: SignatureConfig = withUserConfig("signature", {
	enable: true,
	keyFingerprint: "D7BD1DC68789B9D497D44F927936C710E4AF13EC",
	gpgHome: "/home/wsk/Testing/shirone2/gpghome",
});
