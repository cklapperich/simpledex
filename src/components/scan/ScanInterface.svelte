<script lang="ts">
	import { get } from 'svelte/store';
	import CameraPreview from './CameraPreview.svelte';
	import ViewfinderOverlay from './ViewfinderOverlay.svelte';
	import CaptureButton from './CaptureButton.svelte';
	import QueuePanel from './QueuePanel.svelte';
	import { scanStore } from '../../stores/scan';
	import { scannerService } from '../../services/scanner';
	import { cardMap } from '../../stores/cards';

	let cameraPreview: CameraPreview | null = $state(null);
	let isCapturing = $state(false);

	async function handleCapture() {
		if (isCapturing || !cameraPreview) return;

		isCapturing = true;
		let id: string | undefined;

		try {
			// Capture viewfinder region (original aspect ratio, no preprocessing)
			const blob = await cameraPreview.capture();

			// Add to queue (shows original card to user)
			id = scanStore.addToQueue(blob);

			// Set status to processing
			scanStore.setItemStatus(id, 'processing');

			// Find matches (preprocessing happens in scanner service)
			const matches = await scannerService.findMatches(blob);

			// Enrich matches with card data from cardMap
			const cards = get(cardMap);
			const enrichedMatches = matches.map(match => ({
				cardId: match.cardId,
				score: match.score,
				card: cards.get(match.cardId)!
			})).filter(match => match.card);

			// Set result
			scanStore.setResult(id, { matches: enrichedMatches });
		} catch (error) {
			console.error('Capture failed:', error);
			if (id) {
				scanStore.setItemStatus(id, 'error');
			}
		} finally {
			isCapturing = false;
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
		<CaptureButton onclick={handleCapture} disabled={isCapturing} />
	</div>

	<!-- Queue strip - always visible at bottom -->
	<div class="queue-strip">
		<QueuePanel />
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

	/* Capture button - fixed above queue */
	.capture-layer {
		position: fixed;
		bottom: calc(100px + 1.5rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
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
