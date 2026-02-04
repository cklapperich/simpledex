<script lang="ts">
	import { scanStore, type QueueItem } from '../../stores/scan';
	import { Loader2, Check, X } from 'lucide-svelte';

	interface Props {
		selectedItemId?: string | null;
	}

	let { selectedItemId = $bindable(null) }: Props = $props();

	function handleItemClick(item: QueueItem) {
		selectedItemId = item.id;
	}

	function removeItem(e: MouseEvent, itemId: string) {
		e.stopPropagation();
		scanStore.removeFromQueue(itemId);
		if (selectedItemId === itemId) {
			selectedItemId = null;
		}
	}
</script>

<div class="queue-strip">
	<div class="queue-scroll">
		{#each $scanStore.queueItems as item (item.id)}
			<div
				role="button"
				tabindex="0"
				class="queue-item"
				class:selected={selectedItemId === item.id}
				class:complete={item.status === 'complete'}
				class:error={item.status === 'error'}
				onclick={() => handleItemClick(item)}
				onkeydown={(e) => e.key === 'Enter' && handleItemClick(item)}
			>
				<div class="thumbnail-container">
					<img
						src={item.thumbnailUrl}
						alt="Captured card"
						class="thumbnail"
					/>

					<!-- Status overlay -->
					{#if item.status === 'processing'}
						<div class="status-overlay processing">
							<Loader2 class="spinner" size={20} />
						</div>
					{:else if item.status === 'complete'}
						<div class="status-overlay complete">
							<Check size={16} />
						</div>
					{:else if item.status === 'error'}
						<div class="status-overlay error">
							<X size={16} />
						</div>
					{/if}
				</div>

				<!-- Remove button -->
				<button
					type="button"
					class="remove-btn"
					onclick={(e) => removeItem(e, item.id)}
					aria-label="Remove from queue"
				>
					<X size={12} />
				</button>
			</div>
		{:else}
			<div class="empty-queue">
				<span>Capture cards to add to queue</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.queue-strip {
		display: flex;
		align-items: center;
		height: 100%;
		padding: 0.5rem 1rem;
	}

	.queue-scroll {
		display: flex;
		flex-direction: row;
		gap: 0.75rem;
		overflow-x: auto;
		overflow-y: hidden;
		height: 100%;
		align-items: center;
		scroll-snap-type: x mandatory;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding: 0.25rem;
	}

	.queue-scroll::-webkit-scrollbar {
		display: none;
	}

	.queue-item {
		position: relative;
		flex-shrink: 0;
		width: 56px;
		height: 78px;
		border-radius: 6px;
		overflow: hidden;
		cursor: pointer;
		border: 2px solid transparent;
		background: transparent;
		padding: 0;
		transition: border-color 0.2s ease, transform 0.2s ease;
		scroll-snap-align: center;
	}

	.queue-item:hover {
		transform: scale(1.05);
	}

	.queue-item.selected {
		border-color: rgba(99, 102, 241, 0.8);
	}

	.queue-item.complete {
		border-color: rgba(34, 197, 94, 0.5);
	}

	.queue-item.error {
		border-color: rgba(239, 68, 68, 0.5);
	}

	.thumbnail-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.status-overlay {
		position: absolute;
		bottom: 2px;
		right: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-overlay.processing {
		background-color: rgba(99, 102, 241, 0.9);
		color: white;
	}

	.status-overlay.processing :global(.spinner) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.status-overlay.complete {
		background-color: rgba(34, 197, 94, 0.9);
		color: white;
	}

	.status-overlay.error {
		background-color: rgba(239, 68, 68, 0.9);
		color: white;
	}

	.remove-btn {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background-color: rgba(239, 68, 68, 0.9);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.queue-item:hover .remove-btn {
		opacity: 1;
	}

	.empty-queue {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.75rem;
		text-align: center;
	}
</style>
