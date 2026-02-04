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
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.matches-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.match-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 6px;
		border: 1px solid transparent;
	}

	.match-row.best {
		background: rgba(34, 197, 94, 0.15);
		border-color: rgba(34, 197, 94, 0.5);
	}

	.thumbnail {
		width: 32px;
		height: 44px;
		object-fit: cover;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.card-info {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.card-name {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.95);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-meta {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.add-button {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(34, 197, 94, 0.8);
		border: none;
		border-radius: 6px;
		color: white;
		cursor: pointer;
	}

	.add-button:active {
		transform: scale(0.95);
	}

	.swipe-hint {
		display: flex;
		justify-content: space-between;
		padding: 2px 4px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.3);
	}

	.hint-left {
		color: rgba(239, 68, 68, 0.5);
	}

	.hint-right {
		color: rgba(34, 197, 94, 0.5);
	}
</style>
