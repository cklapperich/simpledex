<script lang="ts">
	import { get } from 'svelte/store';
	import CameraPreview from './CameraPreview.svelte';
	import ViewfinderOverlay from './ViewfinderOverlay.svelte';
	import CaptureButton from './CaptureButton.svelte';
	import QueuePanel from './QueuePanel.svelte';
	import InlineResults from './InlineResults.svelte';
	import { scanStore } from '../../stores/scan';
	import { scannerService } from '../../services/scanner';
	import { cardMap } from '../../stores/cards';
	import { collection } from '../../stores/collection';

	let cameraPreview: CameraPreview | null = $state(null);
	let selectedItemId = $state<string | null>(null);

	let selectedItem = $derived($scanStore.queueItems.find(item => item.id === selectedItemId) ?? null);

	async function handleCapture() {
		if (!cameraPreview) return;
		const blob = await cameraPreview.capture();
		const id = scanStore.addToQueue(blob);
		selectedItemId = id; // Select the newly captured item
		processCapture(id, blob); // fire-and-forget
	}

	async function processCapture(id: string, blob: Blob) {
		scanStore.setItemStatus(id, 'processing');
		try {
			const matches = await scannerService.findMatches(blob);
			const cards = get(cardMap);
			const enrichedMatches = matches.map(match => ({
				cardId: match.cardId,
				score: match.score,
				card: cards.get(match.cardId)!
			})).filter(match => match.card);
			scanStore.setResult(id, { matches: enrichedMatches });
		} catch (error) {
			console.error('Capture failed:', error);
			scanStore.setItemStatus(id, 'error');
		}
	}

	function handleAdd(cardId: string) {
		collection.increment(cardId);
		if (selectedItemId) {
			scanStore.removeFromQueue(selectedItemId);
			// Select next completed item if any
			const remaining = $scanStore.queueItems.filter(item => item.id !== selectedItemId);
			const nextCompleted = remaining.find(item => item.status === 'complete' && item.result);
			selectedItemId = nextCompleted?.id ?? null;
		}
	}

	function handleReject() {
		if (selectedItemId) {
			scanStore.removeFromQueue(selectedItemId);
			// Select next completed item if any
			const remaining = $scanStore.queueItems.filter(item => item.id !== selectedItemId);
			const nextCompleted = remaining.find(item => item.status === 'complete' && item.result);
			selectedItemId = nextCompleted?.id ?? null;
		}
	}

</script>

<div class="scan-interface">
	<!-- Background layer: Camera Preview -->
	<div class="camera-layer">
		<CameraPreview bind:this={cameraPreview} />
	</div>

	<!-- Overlay layer: Viewfinder -->
	<div class="viewfinder-layer">
		<ViewfinderOverlay />
	</div>

	<!-- UI layer: Capture Button -->
	<div class="capture-layer">
		<CaptureButton onclick={handleCapture} />
	</div>

	<!-- Inline results panel - between capture button and queue -->
	<div class="results-layer">
		<InlineResults item={selectedItem} onAdd={handleAdd} onReject={handleReject} />
	</div>

	<!-- Queue strip - always visible at bottom -->
	<div class="queue-strip">
		<QueuePanel bind:selectedItemId />
	</div>
</div>

<style>
	.scan-interface {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 100vh;
		overflow: hidden;
		background-color: #0a0a0a;
	}

	/* Camera preview - full screen background */
	.camera-layer {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	/* Viewfinder overlay - centered card frame */
	.viewfinder-layer {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
	}

	/* Capture button - fixed above results panel */
	.capture-layer {
		position: fixed;
		bottom: calc(100px + 180px + 2rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
	}

	/* Inline results - between capture button and queue */
	.results-layer {
		position: fixed;
		bottom: calc(100px + 1rem);
		left: 1rem;
		right: 1rem;
		z-index: 5;
	}

	/* Queue strip - always visible at bottom */
	.queue-strip {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: 100px;
		background-color: rgba(15, 15, 15, 0.95);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		z-index: 5;
	}
</style>
