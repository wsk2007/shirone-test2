import type {
	Live2DConfig,
	ResolvedLive2DOptions,
} from "@/types/live2dConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * Live2D 看板娘配置单一真源。
 *
 * 默认关闭且没有模型，因此关闭状态不会输出 DOM、加载 CSS 或请求任何
 * Live2D runtime。启用前请把 runtime 与模型文件放进 public/live2d/，或
 * 将下面的资源地址改成你自己的部署地址。
 */
export const live2dConfig: Live2DConfig = withUserConfig("live2d", {
	/** 全局开关；false 时保持零额外负担。 */
	enable: true,
	/** 模型 JSON 地址；至少配置一个后才会初始化。 */
	models: ["/live2d/models/pio/model.json"],
	/** 看板娘停靠方向。 */
	position: "right",
	/** canvas 宽度与高度。 */
	width: 280,
	height: 250,
	/** 移动端隐藏，避免遮挡阅读内容。 */
	hiddenOnMobile: true,
	/** fixed 保持在视口，draggable 交由 Pio runtime 处理。 */
	mode: "fixed",
	/** Pio 对话文案；这里不内置用户可见文案。 */
	dialog: {},
	/** 第一阶段默认使用站点自己的 public 资源。 */
	l2dScript: "/live2d/l2d.js",
	pioScript: "/live2d/pio.js",
	style: "/live2d/pio.css",
});

/** 解析并校验 Live2D 配置；无效配置与关闭状态等价。 */
export function resolveLive2DOptions(
	config: Live2DConfig,
): ResolvedLive2DOptions | null {
	if (!config.enable) return null;

	const models = config.models
		.map((model) => model.trim())
		.filter(Boolean);
	const l2dScript = config.l2dScript.trim();
	const pioScript = config.pioScript.trim();

	if (!models.length || !l2dScript || !pioScript) return null;

	return {
		models,
		position: config.position,
		width: Math.max(1, Math.round(config.width)),
		height: Math.max(1, Math.round(config.height)),
		hiddenOnMobile: config.hiddenOnMobile,
		mode: config.mode ?? "fixed",
		dialog: config.dialog ?? {},
		l2dScript,
		pioScript,
		style: config.style?.trim() || undefined,
	};
}
