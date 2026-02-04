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
	<!-- Camera section: preview + viewfinder + capture button -->
	<div class="camera-section">
		<div class="camera-layer">
			<CameraPreview bind:this={cameraPreview} />
		</div>
		<div class="viewfinder-layer">
			<ViewfinderOverlay />
		</div>
		<div class="capture-layer">
			<CaptureButton onclick={handleCapture} />
		</div>
	</div>

	<!-- Bottom controls: results + queue -->
	<div class="bottom-section">
		<div class="results-panel">
			<InlineResults item={selectedItem} onAdd={handleAdd} onReject={handleReject} />
		</div>
		<div class="queue-panel">
			<QueuePanel bind:selectedItemId />
		</div>
	</div>
</div>

<style>
	.scan-interface {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		background-color: #0a0a0a;
	}

	/* Camera section - takes remaining space */
	.camera-section {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.camera-layer {
		position: absolute;
		inset: 0;
	}

	.viewfinder-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.capture-layer {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
	}

	/* Bottom section - fixed height for results + queue */
	.bottom-section {
		flex-shrink: 0;
		background-color: rgba(15, 15, 15, 0.95);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.results-panel {
		padding: 0.5rem;
	}

	.queue-panel {
		height: 90px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
