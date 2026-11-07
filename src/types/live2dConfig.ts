/**
 * Live2D 看板娘配置。
 *
 * Live2D runtime 不属于 Shirone 的 npm 依赖；启用后由浏览器从配置的
 * public 资源路径按需加载。模型 JSON、l2d.js、pio.js 与样式由站点自行提供。
 */
export interface Live2DDialogConfig {
	/** 首次显示时的问候语。 */
	welcome?: string | string[];
	/** 点击或触摸模型时的提示语。 */
	touch?: string | string[];
	/** 返回首页时的提示语。 */
	home?: string;
	/** 换装提示：[触发文本, 提示文本]。 */
	skin?: [string, string];
	/** 关闭提示语。 */
	close?: string;
	/** 链接提示语。 */
	link?: string;
}

export interface Live2DConfig {
	/** 全局开关；关闭时不输出组件、不加载脚本，也不产生样式。 */
	enable: boolean;
	/** Pio 模型 JSON 地址列表；为空时视为未配置。 */
	models: string[];
	/** 看板娘停靠方向。 */
	position: "left" | "right";
	/** canvas 宽度（像素）。 */
	width: number;
	/** canvas 高度（像素）。 */
	height: number;
	/** 是否在移动端隐藏。 */
	hiddenOnMobile: boolean;
	/** Pio 的交互模式。 */
	mode?: "fixed" | "draggable";
	/** Pio 对话配置；文案由站点用户提供。 */
	dialog?: Live2DDialogConfig;
	/** l2d.js 的浏览器资源地址。 */
	l2dScript: string;
	/** pio.js 的浏览器资源地址。 */
	pioScript: string;
	/** Pio 样式地址；留空则不加载样式。 */
	style?: string;
}

export interface ResolvedLive2DOptions {
	models: string[];
	position: "left" | "right";
	width: number;
	height: number;
	hiddenOnMobile: boolean;
	mode: "fixed" | "draggable";
	dialog: Live2DDialogConfig;
	l2dScript: string;
	pioScript: string;
	style?: string;
}
