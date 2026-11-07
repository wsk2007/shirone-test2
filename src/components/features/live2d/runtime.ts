import { loadScriptOnce } from "@utils/script-loader";
import type { ResolvedLive2DOptions } from "@/types/live2dConfig";

type PioConstructor = new (options: Record<string, unknown>) => unknown;

declare global {
	interface Window {
		Paul_Pio?: PioConstructor;
	}
}

const stylesheetCache = new Map<string, Promise<void>>();
let componentStyleInjected = false;

function injectComponentStyle(): void {
	if (componentStyleInjected || document.querySelector("style[data-live2d-style]")) {
		componentStyleInjected = true;
		return;
	}

	const style = document.createElement("style");
	style.dataset.live2dStyle = "";
	style.textContent = `
		.shirone-live2d {
			position: fixed;
			bottom: 0;
			z-index: 40;
			pointer-events: none;
			width: var(--live2d-width);
			height: var(--live2d-height);
		}
		.shirone-live2d--left { left: 0; }
		.shirone-live2d--right { right: 0; }
		.shirone-live2d canvas {
			display: block;
			max-width: 100%;
			height: auto;
			pointer-events: auto;
		}
		.shirone-live2d__action {
			position: absolute;
			inset: 0;
			pointer-events: auto;
		}
		@media (max-width: 767px) {
			.shirone-live2d--mobile-hidden { display: none; }
		}
	`;
	document.head.appendChild(style);
	componentStyleInjected = true;
}

function loadStylesheetOnce(url: string): Promise<void> {
	const normalizedUrl = url.trim();
	if (!normalizedUrl) return Promise.resolve();

	const cached = stylesheetCache.get(normalizedUrl);
	if (cached) return cached;

	const existing = document.querySelector<HTMLLinkElement>(
		`link[rel="stylesheet"][href="${CSS.escape(normalizedUrl)}"]`,
	);
	if (existing) {
		const promise = Promise.resolve();
		stylesheetCache.set(normalizedUrl, promise);
		return promise;
	}

	const promise = new Promise<void>((resolve, reject) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = normalizedUrl;
		link.onload = () => resolve();
		link.onerror = () => {
			stylesheetCache.delete(normalizedUrl);
			link.remove();
			reject(new Error(`Failed to load Live2D stylesheet: ${normalizedUrl}`));
		};
		document.head.appendChild(link);
	});

	stylesheetCache.set(normalizedUrl, promise);
	return promise;
}

/** 动态加载并创建一次 Pio runtime；所有调用共享浏览器资源缓存。 */
export async function createLive2DInstance(
	options: ResolvedLive2DOptions,
): Promise<unknown> {
	injectComponentStyle();
	await loadStylesheetOnce(options.style ?? "");
	await loadScriptOnce(options.l2dScript);
	await loadScriptOnce(options.pioScript);

	if (!window.Paul_Pio) {
		throw new Error("Live2D runtime did not expose window.Paul_Pio");
	}

	return new window.Paul_Pio({
		mode: options.mode,
		hidden: options.hiddenOnMobile,
		content: options.dialog,
		model: options.models,
		position: options.position,
		width: options.width,
		height: options.height,
	});
}
