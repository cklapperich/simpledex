<script lang="ts">
	import type { Card } from '../types';
	import { cardMap } from '../stores/cards';
	import { getCardImageUrl } from '../utils/cardImage';
	import { groupDeckCards } from '../utils/deckStats';
	import { getCardName } from '../utils/cardUtils';
	import CollapsibleSection from './CollapsibleSection.svelte';

	// Helper to sum quantities in an array
	function sumQuantities(cards: Array<{ quantity: number }>): number {
		return cards.reduce((sum, c) => sum + c.quantity, 0);
	}

	let {
		deckCards,
		onRemoveCard,
		onAddCard
	}: {
		deckCards: Record<string, number>;
		onRemoveCard: (cardId: string) => void;
		onAddCard?: (cardId: string) => void;
	} = $props();

	const groupedCards = $derived(groupDeckCards(deckCards, $cardMap));

	// Compute totals for each section
	const pokemonTotalCount = $derived(sumQuantities(groupedCards.pokemon));

	const trainersSupportersCount = $derived(sumQuantities(groupedCards.trainers.supporters));
	const trainersItemsCount = $derived(sumQuantities(groupedCards.trainers.items));
	const trainersToolsCount = $derived(sumQuantities(groupedCards.trainers.tools));
	const trainersTotalCount = $derived(
		trainersSupportersCount + trainersItemsCount + trainersToolsCount
	);

	const energyTotalCount = $derived(sumQuantities(groupedCards.energy));

	const totalCards = $derived(pokemonTotalCount + trainersTotalCount + energyTotalCount);

	function handleRemove(cardId: string) {
		onRemoveCard(cardId);
	}

	function handleAdd(cardId: string) {
		onAddCard?.(cardId);
	}
</script>

{#snippet cardRow(cardId: string, quantity: number, card: Card)}
	<div class="group flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
		<!-- Card Image (small thumbnail) -->
		<div class="h-22 w-16 flex-shrink-0">
			<img
				src={getCardImageUrl(card, 'en')}
				alt={getCardName(card)}
				loading="lazy"
				class="h-full w-full rounded border border-gray-200 object-cover"
			/>
		</div>

		<!-- Card Info -->
		<div class="min-w-0 flex-1">
			<div class="truncate text-sm font-medium">{getCardName(card)}</div>
			<div class="text-xs text-gray-500">{card.set} {card.number}</div>
			<div class="text-xs text-gray-400">{card.supertype}</div>
		</div>

		<!-- Quantity Controls -->
		<div class="flex flex-shrink-0 items-center gap-2">
			<button
				type="button"
				class="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white transition-colors hover:bg-red-600"
				onclick={() => handleRemove(cardId)}
				aria-label="Remove one"
			>
				-
			</button>
			<span class="w-8 text-center text-lg font-bold">
				{quantity}
			</span>
			{#if onAddCard}
				<button
					type="button"
					class="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white transition-colors hover:bg-green-600"
					onclick={() => handleAdd(cardId)}
					aria-label="Add one"
				>
					+
				</button>
			{:else}
				<div class="w-7"></div>
				<!-- Spacer for alignment -->
			{/if}
		</div>
	</div>
{/snippet}

{#snippet cardList(cards: Array<{ cardId: string; quantity: number; card: Card }>)}
	<div class="space-y-1">
		{#each cards as { cardId, quantity, card } (cardId)}
			{@render cardRow(cardId, quantity, card)}
		{/each}
	</div>
{/snippet}

<div class="space-y-2">
	{#if totalCards === 0}
		<div class="py-8 text-center text-gray-400">No cards in deck</div>
	{:else}
		<!-- Pokemon Section -->
		{#if pokemonTotalCount > 0}
			<CollapsibleSection title="Pokemon" count={pokemonTotalCount}>
				{@render cardList(groupedCards.pokemon)}
			</CollapsibleSection>
		{/if}

		<!-- Trainers Section -->
		{#if trainersTotalCount > 0}
			<CollapsibleSection title="Trainers" count={trainersTotalCount}>
				{#if trainersSupportersCount > 0}
					<CollapsibleSection title="Supporters" count={trainersSupportersCount} defaultOpen={false}>
						{@render cardList(groupedCards.trainers.supporters)}
					</CollapsibleSection>
				{/if}
				{#if trainersItemsCount > 0}
					<CollapsibleSection title="Items" count={trainersItemsCount} defaultOpen={false}>
						{@render cardList(groupedCards.trainers.items)}
					</CollapsibleSection>
				{/if}
				{#if trainersToolsCount > 0}
					<CollapsibleSection title="Tools" count={trainersToolsCount} defaultOpen={false}>
						{@render cardList(groupedCards.trainers.tools)}
					</CollapsibleSection>
				{/if}
			</CollapsibleSection>
		{/if}

		<!-- Energy Section -->
		{#if energyTotalCount > 0}
			<CollapsibleSection title="Energy" count={energyTotalCount}>
				{@render cardList(groupedCards.energy)}
			</CollapsibleSection>
		{/if}
	{/if}
</div>
