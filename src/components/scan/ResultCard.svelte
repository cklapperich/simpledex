<script lang="ts">
	import { scanStore, type QueueItem } from '../../stores/scan';
	import { collection } from '../../stores/collection';
	import { cardMap } from '../../stores/cards';

	interface Props {
		queueItem: QueueItem;
	}

	let { queueItem }: Props = $props();

	let showAlternatives = $state(false);

	// Get the top match and alternatives
	let topMatch = $derived(queueItem.result?.matches?.[0]);
	let alternatives = $derived(queueItem.result?.matches?.slice(1) ?? []);

	/**
	 * Get the image URL for a card
	 */
	function getCardImageUrl(card: { images?: { url: string }[]; setId?: string; id?: string }): string {
		// Try direct image URL first
		if (card.images?.[0]?.url) {
			return card.images[0].url;
		}
		// Construct TCGdex URL as fallback
		if (card.setId && card.id) {
			const localId = card.id.split('-').pop() || card.id;
			return `https://assets.tcgdex.net/en/${card.setId}/${localId}/high.webp`;
		}
		// Final fallback
		return '/placeholder-card.png';
	}

	/**
	 * Format confidence score as percentage
	 */
	function formatConfidence(score: number): string {
		return `${(score * 100).toFixed(1)}%`;
	}

	/**
	 * Handle adding card to collection
	 */
	function handleAdd() {
		if (!topMatch) return;
		collection.increment(topMatch.cardId);
		scanStore.removeFromQueue(queueItem.id);
	}

	/**
	 * Handle rejecting the match
	 */
	function handleReject() {
		scanStore.removeFromQueue(queueItem.id);
	}

	/**
	 * Handle selecting an alternative match
	 */
	function handleSelectAlternative(cardId: string) {
		collection.increment(cardId);
		scanStore.removeFromQueue(queueItem.id);
	}

	function toggleAlternatives() {
		showAlternatives = !showAlternatives;
	}
</script>

<div class="result-card">
	{#if queueItem.status === 'processing'}
		<div class="processing">
			<div class="spinner"></div>
			<span>Identifying card...</span>
		</div>
	{:else if queueItem.status === 'error'}
		<div class="error">
			<span class="error-icon">!</span>
			<span>{queueItem.error ?? 'Failed to identify card'}</span>
			<button class="reject-btn" onclick={handleReject}>Dismiss</button>
		</div>
	{:else if queueItem.status === 'complete' && topMatch}
		<!-- Top Match Display -->
		<div class="top-match">
			<div class="match-image">
				<img
					src={getCardImageUrl(topMatch.card)}
					alt={topMatch.card.names?.en ?? 'Card'}
					loading="lazy"
				/>
			</div>
			<div class="match-details">
				<h3 class="card-name">{topMatch.card.names?.en ?? 'Unknown Card'}</h3>
				<p class="card-set">{topMatch.card.set} #{topMatch.card.number}</p>
				<p class="confidence">
					<span class="confidence-label">Confidence:</span>
					<span class="confidence-value">{formatConfidence(topMatch.score)}</span>
				</p>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="actions">
			<button class="add-btn" onclick={handleAdd}>
				Add to Collection
			</button>
			<button class="reject-btn" onclick={handleReject}>
				Reject
			</button>
		</div>

		<!-- Alternatives Section -->
		{#if alternatives.length > 0}
			<div class="alternatives-section">
				<button class="alternatives-toggle" onclick={toggleAlternatives}>
					<span>{showAlternatives ? 'Hide' : 'Show'} alternatives ({alternatives.length})</span>
					<span class="toggle-arrow" class:expanded={showAlternatives}>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" fill="none"/>
						</svg>
					</span>
				</button>

				{#if showAlternatives}
					<div class="alternatives-list">
						{#each alternatives as match (match.cardId)}
							<div class="alternative-item">
								<div class="alt-image">
									<img
										src={getCardImageUrl(match.card)}
										alt={match.card.names?.en ?? 'Card'}
										loading="lazy"
									/>
								</div>
								<div class="alt-details">
									<p class="alt-name">{match.card.names?.en ?? 'Unknown'}</p>
									<p class="alt-set">{match.card.set} #{match.card.number}</p>
									<p class="alt-confidence">{formatConfidence(match.score)}</p>
								</div>
								<button
									class="alt-add-btn"
									onclick={() => handleSelectAlternative(match.cardId)}
								>
									Add
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="pending">
			<span>Waiting to process...</span>
		</div>
	{/if}
</div>

<style>
	.result-card {
		background-color: #1a1a1a;
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	/* Processing State */
	.processing {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Error State */
	.error {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		color: #ef4444;
	}

	.error-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background-color: #ef4444;
		color: white;
		border-radius: 50%;
		font-weight: bold;
		font-size: 0.875rem;
	}

	/* Pending State */
	.pending {
		padding: 1rem;
		color: rgba(255, 255, 255, 0.5);
		text-align: center;
	}

	/* Top Match */
	.top-match {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.match-image {
		flex-shrink: 0;
		width: 100px;
		height: 140px;
		border-radius: 8px;
		overflow: hidden;
		background-color: #2a2a2a;
	}

	.match-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.match-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.25rem;
	}

	.card-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #fff;
		line-height: 1.2;
	}

	.card-set {
		margin: 0;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.confidence {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
	}

	.confidence-label {
		color: rgba(255, 255, 255, 0.5);
	}

	.confidence-value {
		color: #22c55e;
		font-weight: 600;
		margin-left: 0.25rem;
	}

	/* Action Buttons */
	.actions {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
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

	/* Alternatives Section */
	.alternatives-section {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 0.75rem;
	}

	.alternatives-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.875rem;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.alternatives-toggle:hover {
		color: rgba(255, 255, 255, 0.9);
	}

	.toggle-arrow {
		transition: transform 0.2s ease;
	}

	.toggle-arrow.expanded {
		transform: rotate(180deg);
	}

	.alternatives-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.alternative-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background-color: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
	}

	.alt-image {
		flex-shrink: 0;
		width: 50px;
		height: 70px;
		border-radius: 4px;
		overflow: hidden;
		background-color: #2a2a2a;
	}

	.alt-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.alt-details {
		flex: 1;
		min-width: 0;
	}

	.alt-name {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.alt-set {
		margin: 0;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.alt-confidence {
		margin: 0;
		font-size: 0.75rem;
		color: #22c55e;
	}

	.alt-add-btn {
		flex-shrink: 0;
		padding: 0.5rem 0.75rem;
		background-color: rgba(34, 197, 94, 0.2);
		color: #22c55e;
		border: 1px solid #22c55e;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.alt-add-btn:hover {
		background-color: #22c55e;
		color: white;
	}
</style>
