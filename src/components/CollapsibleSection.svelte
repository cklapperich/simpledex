<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		title: string;
		count: number;
		defaultOpen?: boolean;
		children?: import('svelte').Snippet;
	}

	const { title, count, defaultOpen = true, children }: Props = $props();

	let expanded = $state(untrack(() => defaultOpen));

	function toggle() {
		expanded = !expanded;
	}
</script>

<div class="w-full">
	<button
		type="button"
		onclick={toggle}
		class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100"
	>
		<svg
			class="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200"
			class:rotate-90={expanded}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
		<span class="font-medium text-gray-900">{title}</span>
		<span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
			{count}
		</span>
	</button>

	{#if expanded}
		<div class="mt-1">
			{@render children?.()}
		</div>
	{/if}
</div>
