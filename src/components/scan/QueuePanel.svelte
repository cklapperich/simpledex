<script lang="ts">
	import { scanStore, type QueueItem } from '../../stores/scan';
	import { collection } from '../../stores/collection';
	import { Loader2, Check, X } from 'lucide-svelte';
	import { getAllCardImageUrls } from '../../utils/cardImage';
	import { getCardName } from '../../utils/cardUtils';

	interface Props {
		selectedItemId?: string | null;
	}

	let { selectedItemId = $bindable(null) }: Props = $props();

	let showResultModal = $state(false);
	let selectedItem = $state<QueueItem | null>(null);

	// Close modal if selectedItem is removed from the queue
	$effect(() => {
		if (selectedItem && showResultModal) {
			const stillInQueue = $scanStore.queueItems.some(item => item.id === selectedItem?.id);
			if (!stillInQueue) {
				closeModal();
			}
		}
	});

	function handleItemClick(item: QueueItem) {
		selectedItemId = item.id;

		if (item.status === 'complete' && item.result) {
			selectedItem = item;
			showResultModal = true;
		}
	}

	function closeModal() {
		showResultModal = false;
		selectedItem = null;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			closeModal();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeModal();
		}
	}

	function removeItem(e: MouseEvent, itemId: string) {
		e.stopPropagation();
		scanStore.removeFromQueue(itemId);
		if (selectedItemId === itemId) {
			selectedItemId = null;
		}
	}

	/**
	 * Remove current item and show next completed item, or close modal
	 */
	function removeAndShowNext(itemId: string, addCardId?: string) {
		// Get remaining items after removal (filter out the one being removed)
		const remaining = $scanStore.queueItems.filter(item => item.id !== itemId);
		// Find next completed item
		const nextCompleted = remaining.find(item => item.status === 'complete' && item.result);

		// Update selectedItem BEFORE removing from queue to avoid $effect race
		if (nextCompleted) {
			selectedItem = nextCompleted;
			selectedItemId = nextCompleted.id;
		} else {
			selectedItem = null;
			selectedItemId = null;
			showResultModal = false;
		}

		// Now add to collection and remove from queue
		if (addCardId) {
			collection.increment(addCardId);
		}
		scanStore.removeFromQueue(itemId);
	}

	/**
	 * Handle adding the best match card to collection
	 */
	function handleAdd() {
		if (!selectedItem?.result?.matches?.[0]) return;
		const cardId = selectedItem.result.matches[0].cardId;
		removeAndShowNext(selectedItem.id, cardId);
	}

	/**
	 * Handle rejecting the match
	 */
	function handleReject() {
		if (!selectedItem) return;
		removeAndShowNext(selectedItem.id);
	}

	/**
	 * Handle selecting an alternative match
	 */
	function handleSelectAlternative(cardId: string) {
		if (!selectedItem) return;
		removeAndShowNext(selectedItem.id, cardId);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="queue-panel">
	<div class="queue-header">
		<span class="queue-title">Queue</span>
		<span class="queue-count">{$scanStore.queueItems.length}</span>
	</div>

	<div class="queue-items">
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
				<span>No captures yet</span>
			</div>
		{/each}
	</div>
</div>

<!-- Result Modal/Overlay -->
{#if showResultModal && selectedItem}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Enter' && closeModal()}
	>
		<div class="modal-content">
			<button
				type="button"
				class="modal-close"
				onclick={closeModal}
				aria-label="Close result"
			>
				<X size={24} />
			</button>

			<div class="result-container">
				<!-- Captured image -->
				<div class="captured-image">
					<img
						src={selectedItem.thumbnailUrl}
						alt="Captured card"
					/>
				</div>

				<!-- Match results -->
				<div class="match-results">
					<h3 class="results-title">Match Results</h3>

					{#if selectedItem.result && selectedItem.result.matches.length > 0}
						<div class="matches-list">
							{#each selectedItem.result.matches.slice(0, 5) as match, index (match.cardId)}
								{@const imageUrls = getAllCardImageUrls(match.card, 'en')}
								{@const cardName = getCardName(match.card)}
								<div class="match-item" class:best-match={index === 0}>
									{#if index === 0}
										<span class="best-badge">Best Match</span>
									{/if}
									<div class="match-card">
										<img
											src={imageUrls[0]}
											alt={cardName}
											class="match-thumbnail"
										/>
										<div class="match-info">
											<span class="match-name">{cardName}</span>
											<span class="match-set">{match.card.set} #{match.card.number}</span>
											<span class="match-score">{Math.round(match.score * 100)}% confidence</span>
										</div>
										{#if index > 0}
											<button
												type="button"
												class="alt-add-btn"
												onclick={() => handleSelectAlternative(match.cardId)}
											>
												Add
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Action Buttons for Best Match -->
						<div class="modal-actions">
							<button type="button" class="add-btn" onclick={handleAdd}>
								Add to Collection
							</button>
							<button type="button" class="reject-btn" onclick={handleReject}>
								Reject
							</button>
						</div>
					{:else}
						<div class="no-matches">
							<p>No matches found for this capture.</p>
						</div>
						<div class="modal-actions">
							<button type="button" class="reject-btn" onclick={handleReject}>
								Dismiss
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.queue-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0.5rem;
		overflow: hidden;
	}

	.queue-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.queue-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.queue-count {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
		background-color: rgba(255, 255, 255, 0.1);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	.queue-items {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Mobile: horizontal scroll */
	@media (max-width: 768px) {
		.queue-items {
			flex-direction: row;
			overflow-x: auto;
			overflow-y: hidden;
		}
	}

	.queue-item {
		position: relative;
		flex-shrink: 0;
		width: 60px;
		height: 84px;
		border-radius: 6px;
		overflow: hidden;
		cursor: pointer;
		border: 2px solid transparent;
		background: transparent;
		padding: 0;
		transition: border-color 0.2s ease, transform 0.2s ease;
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
		width: 20px;
		height: 20px;
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
		height: 100%;
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.75rem;
		text-align: center;
		padding: 1rem;
	}

	/* Modal styles */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.85);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal-content {
		position: relative;
		background-color: #1a1a1a;
		border-radius: 12px;
		max-width: 800px;
		max-height: 90vh;
		overflow-y: auto;
		width: 100%;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.modal-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.1);
		border: none;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
		z-index: 10;
	}

	.modal-close:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.result-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		padding: 1.5rem;
	}

	@media (max-width: 640px) {
		.result-container {
			grid-template-columns: 1fr;
		}
	}

	.captured-image {
		aspect-ratio: 2.5 / 3.5;
		border-radius: 8px;
		overflow: hidden;
		background-color: #2a2a2a;
	}

	.captured-image img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.match-results {
		display: flex;
		flex-direction: column;
	}

	.results-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
		margin-bottom: 1rem;
	}

	.matches-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.match-item {
		position: relative;
		background-color: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.match-item.best-match {
		background-color: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.3);
	}

	.best-badge {
		position: absolute;
		top: -8px;
		left: 8px;
		background-color: #22c55e;
		color: white;
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.match-card {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.match-thumbnail {
		width: 50px;
		height: 70px;
		object-fit: cover;
		border-radius: 4px;
		background-color: #2a2a2a;
	}

	.match-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.match-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}

	.match-set {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.match-score {
		font-size: 0.75rem;
		color: rgba(99, 102, 241, 0.9);
		font-weight: 500;
	}

	.no-matches {
		color: rgba(255, 255, 255, 0.5);
		text-align: center;
		padding: 2rem;
	}

	/* Modal Action Buttons */
	.modal-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.add-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		background-color: #22c55e;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.add-btn:hover {
		background-color: #16a34a;
	}

	.reject-btn {
		padding: 0.75rem 1rem;
		background-color: transparent;
		color: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.reject-btn:hover {
		background-color: rgba(239, 68, 68, 0.1);
		border-color: #ef4444;
		color: #ef4444;
	}

	/* Alternative Add Button */
	.alt-add-btn {
		flex-shrink: 0;
		padding: 0.375rem 0.625rem;
		background-color: rgba(34, 197, 94, 0.2);
		color: #22c55e;
		border: 1px solid #22c55e;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-left: auto;
	}

	.alt-add-btn:hover {
		background-color: #22c55e;
		color: white;
	}
</style>
