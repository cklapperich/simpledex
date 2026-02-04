<script lang="ts">
	import type { QueueItem } from '../../stores/scan';
	import { getAllCardImageUrls } from '../../utils/cardImage';
	import { getCardName } from '../../utils/cardUtils';
	import { swipeable } from '../../lib/actions/swipeable';
	import { Plus } from 'lucide-svelte';

	interface Props {
		item: QueueItem | null;
		onAdd: (cardId: string) => void;
		onReject: () => void;
	}

	let { item, onAdd, onReject }: Props = $props();

	const MAX_MATCHES = 3;

	let matches = $derived(
		item?.result?.matches?.slice(0, MAX_MATCHES) ?? []
	);

	let bestMatchId = $derived(matches[0]?.cardId ?? null);

	function handleSwipeRight() {
		if (bestMatchId) {
			onAdd(bestMatchId);
		}
	}

	function handleSwipeLeft() {
		onReject();
	}

	function handleAddClick(cardId: string) {
		onAdd(cardId);
	}

	function formatConfidence(score: number): string {
		return `${Math.round(score * 100)}%`;
	}

	function getImageUrl(card: QueueItem['result']['matches'][0]['card']): string {
		const urls = getAllCardImageUrls(card);
		return urls[0] ?? '';
	}
</script>

{#if item && matches.length > 0}
	<div
		class="inline-results"
		use:swipeable={{ onLeft: handleSwipeLeft, onRight: handleSwipeRight, threshold: 50 }}
	>
		<div class="matches-list">
			{#each matches as match, index (match.cardId)}
				{@const isBest = index === 0}
				<div class="match-row" class:best={isBest}>
					<img
						src={getImageUrl(match.card)}
						alt={getCardName(match.card)}
						class="thumbnail"
						loading="lazy"
					/>
					<div class="card-info">
						<span class="card-name">{getCardName(match.card)}</span>
						<span class="card-meta">
							{match.card.set} &bull; {formatConfidence(match.score)}
						</span>
					</div>
					<button
						class="add-button"
						onclick={() => handleAddClick(match.cardId)}
						aria-label="Add {getCardName(match.card)} to collection"
					>
						<Plus size={20} />
					</button>
				</div>
			{/each}
		</div>
		<div class="swipe-hint">
			<span class="hint-left">Swipe left to reject</span>
			<span class="hint-right">Swipe right to add best</span>
		</div>
	</div>
{/if}

<style>
	.inline-results {
		height: 180px;
		background: rgba(0, 0, 0, 0.8);
		border-radius: 12px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow: hidden;
	}

	.matches-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow-y: auto;
	}

	.match-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		border: 1px solid transparent;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.match-row.best {
		background: rgba(34, 197, 94, 0.15);
		border-color: rgba(34, 197, 94, 0.5);
	}

	.thumbnail {
		width: 40px;
		height: 56px;
		object-fit: cover;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.card-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		overflow: hidden;
	}

	.card-name {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.95);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-meta {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.add-button {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(59, 130, 246, 0.8);
		border: none;
		border-radius: 8px;
		color: white;
		cursor: pointer;
		transition: background-color 0.15s ease, transform 0.1s ease;
	}

	.add-button:hover {
		background: rgba(59, 130, 246, 1);
	}

	.add-button:active {
		transform: scale(0.95);
	}

	.swipe-hint {
		display: flex;
		justify-content: space-between;
		padding: 4px 8px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
	}

	.hint-left {
		color: rgba(239, 68, 68, 0.6);
	}

	.hint-right {
		color: rgba(34, 197, 94, 0.6);
	}
</style>
