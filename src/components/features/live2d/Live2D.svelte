<script lang="ts">
	import { onMount } from "svelte";
	import { createLive2DInstance } from "./runtime";
	import type { ResolvedLive2DOptions } from "@/types/live2dConfig";

	let { options }: { options: ResolvedLive2DOptions } = $props();
	let container = $state<HTMLElement>();
	let failed = $state(false);

	onMount(() => {
		if (!container) return;

		createLive2DInstance(options).catch((error: unknown) => {
			failed = true;
			console.error("Failed to initialize Live2D feature", error);
		});
	});
</script>

<div
	bind:this={container}
	class="shirone-live2d pio-container"
	class:shirone-live2d--left={options.position === "left"}
	class:shirone-live2d--right={options.position === "right"}
	class:shirone-live2d--mobile-hidden={options.hiddenOnMobile}
	class:left={options.position === "left"}
	class:right={options.position === "right"}
	data-live2d
	style={`--live2d-width: ${options.width}px; --live2d-height: ${options.height}px`}
	aria-hidden={failed ? "true" : undefined}
>
	<div class="shirone-live2d__action pio-action" aria-hidden="true"></div>
	<canvas
		id="pio"
		width={options.width}
		height={options.height}
		aria-hidden="true"
	></canvas>
</div>
