# Live2D 看板娘

Shirone 的 Live2D 功能是一个可选的 persistent shell feature，用于在站点中挂载类似 Pio 的 Live2D 看板娘。它默认关闭，只有在配置完整并进入组件视口后，才会加载 Live2D runtime。

## 实现概览

当前实现位于：

```text
src/types/live2dConfig.ts
src/config/live2dConfig.ts
src/components/features/live2d/
├── Live2D.svelte
├── runtime.ts
└── index.ts
```

Layout 接入点是 `src/layouts/Layout.astro`。Live2D 位于 `<slot />` 外部，因此不属于 Swup 替换的页面容器。Shirone 当前只替换 `main` 和 `#toc`，所以站内从首页进入文章、再进入其他页面时，Live2D 组件不会重新创建。

组件使用 `client:visible` 水合，生命周期如下：

```text
Layout shell
  → client:visible
  → 动态加载样式
  → 动态加载 l2d.js
  → 动态加载 pio.js
  → new window.Paul_Pio(options)
  → 在当前浏览器 session 中持续存在
```

Shirone 不把 Pio 或 Live2D runtime 放进 npm 依赖，也不把它们打进主 bundle。`runtime.ts` 使用 `loadScriptOnce()`，并对样式和脚本地址做缓存，避免重复加载。

## 零负担行为

以下任一条件不满足时，功能会被视为未启用：

- `enable` 为 `false`；
- `models` 为空；
- `l2dScript` 为空；
- `pioScript` 为空。

未启用时：

- Layout 不动态导入 Live2D 组件；
- 页面不输出 Live2D DOM；
- 不加载 Live2D CSS、`l2d.js` 或 `pio.js`；
- 不产生 Live2D 网络请求；
- 不会给页面增加布局空间。

## 准备 runtime 和模型

Shirone 只提供集成层，不分发具体的 Pio runtime、Live2D 模型或模型授权。请自行确认 runtime 和模型的许可证，并把资源放在站点可访问的位置。

默认配置对应以下路径：

```text
public/live2d/l2d.js
public/live2d/pio.js
public/live2d/pio.css
public/live2d/models/<your-model>.json
```

构建后它们会对应到：

```text
/live2d/l2d.js
/live2d/pio.js
/live2d/pio.css
/live2d/models/<your-model>.json
```

如果 runtime 部署在 CDN 或其他路径，可以在配置中修改脚本和样式地址。`l2d.js` 必须先于 `pio.js` 加载，并且 Pio runtime 需要暴露 `window.Paul_Pio` 构造函数。

## 配置

配置文件：`src/config/live2dConfig.ts`。

最小配置示例：

```ts
export const live2dConfig: Live2DConfig = withUserConfig("live2d", {
	enable: true,
	models: ["/live2d/models/pio/model.json"],
	position: "right",
	width: 280,
	height: 250,
	hiddenOnMobile: true,
	mode: "fixed",
	dialog: {},
	l2dScript: "/live2d/l2d.js",
	pioScript: "/live2d/pio.js",
	style: "/live2d/pio.css",
});
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enable` | `boolean` | 总开关，默认 `false`。 |
| `models` | `string[]` | 模型 JSON 地址列表；为空时不会初始化。 |
| `position` | `"left" \| "right"` | 看板娘停靠方向。 |
| `width` / `height` | `number` | canvas 尺寸，单位为像素。 |
| `hiddenOnMobile` | `boolean` | 是否在移动端隐藏。 |
| `mode` | `"fixed" \| "draggable"` | 传给 Pio runtime 的交互模式。 |
| `dialog` | `object` | Pio 对话配置，文案由站点用户提供。 |
| `l2dScript` | `string` | Live2D 基础 runtime 地址。 |
| `pioScript` | `string` | Pio 主 runtime 地址。 |
| `style` | `string` | Pio 样式地址；留空可禁用额外样式加载。 |

如果使用内容分离模式，配置覆盖文件为：

```text
config/live2d.yaml
```

对应领域键是 `live2d`。例如：

```yaml
enable: true
models:
  - /live2d/models/pio/model.json
position: right
width: 280
height: 250
hiddenOnMobile: true
mode: fixed
l2dScript: /live2d/l2d.js
pioScript: /live2d/pio.js
style: /live2d/pio.css
```

## 启用步骤

1. 准备并放置 `l2d.js`、`pio.js`、可选的 `pio.css` 和模型 JSON。
2. 在 `src/config/live2dConfig.ts` 中把 `enable` 改为 `true`。
3. 在 `models` 中填入至少一个有效模型地址。
4. 启动开发服务器：

   ```bash
   pnpm.cmd dev
   ```

5. 打开首页或其他页面，等待看板娘进入视口后观察浏览器 Network 和 Console。

如果在 Linux 或 NixOS 环境中运行，可使用不带 `.cmd` 的等价命令：

```bash
pnpm dev
```

## 测试与验证

### 默认关闭状态

保持默认配置不变，运行：

```bash
npx.cmd astro check
pnpm.cmd check:manifest
pnpm.cmd build
```

检查 `dist/` 中的 HTML：

- 不应出现 `data-live2d`；
- 不应出现 `l2d.js` 或 `pio.js` 的脚本引用；
- 不应出现 Live2D 组件样式；
- 浏览器 Network 不应请求 Live2D runtime 或模型。

### 开启状态

准备真实 runtime 和模型后，把配置临时开启，再运行：

```bash
npx.cmd astro check
pnpm.cmd build
```

浏览器检查项：

1. 首次打开页面时，组件只在进入视口后开始加载资源。
2. `l2d.js` 在 `pio.js` 之前加载。
3. `window.Paul_Pio` 成功创建实例。
4. 从 `/` 导航到文章页、再导航到其他页面时，模型不会重复创建。
5. 同一 session 中只出现一份 Live2D runtime script 和 stylesheet。
6. 移动端、左右位置和暗色模式下页面仍可正常阅读。

推荐同时运行站点无障碍测试：

```bash
npx.cmd playwright test tests/site/a11y.spec.ts
```

当前仓库没有提交具体 Pio 模型，因此开启状态的视觉和 runtime 交互测试必须由实际使用的模型资源提供后执行。

## 常见问题

### 页面有容器但模型没有显示

检查以下内容：

- `models` 是否至少有一个地址；
- 模型 JSON 是否能直接通过浏览器访问；
- `l2d.js` 是否先加载成功；
- `pio.js` 是否定义了 `window.Paul_Pio`；
- `pio.js` 是否要求特定的 canvas id 或 CSS class；
- 浏览器 Console 是否有跨域、模型解析或资源路径错误。

### 直接访问能显示，Swup 导航后异常

确认 runtime 自身不会在每次页面切换时再次创建实例。Live2D 组件位于 Layout persistent shell 中，不需要添加 `content:replace` 初始化逻辑；重复初始化通常来自 runtime 自己的页面脚本或把组件错误地放进了 `#swup-container`。

### 想更换模型

只需替换 `models` 数组中的 JSON 地址。模型文件的内部资源路径也必须相对于其部署位置有效；更换模型时不需要修改 Layout 或 Swup 代码。
