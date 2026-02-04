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
	let isPanelExpanded = $state(false);
	let isCapturing = $state(false);

	async function handleCapture() {
		if (isCapturing || !cameraPreview) return;

		isCapturing = true;

		try {
			// Capture viewfinder region (original aspect ratio, no preprocessing)
			const blob = await cameraPreview.capture();

			// Add to queue (shows original card to user)
			const id = scanStore.addToQueue(blob);

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
		} finally {
			isCapturing = false;
		}
	}

	function togglePanel() {
		isPanelExpanded = !isPanelExpanded;
	}
</script>

<div class="scan-interface" class:panel-expanded={isPanelExpanded}>
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

	<!-- Side panel: Queue -->
	<div class="queue-layer" class:expanded={isPanelExpanded}>
		<button class="panel-toggle" onclick={togglePanel} aria-label="Toggle queue panel">
			<span class="toggle-icon">{isPanelExpanded ? '›' : '‹'}</span>
		</button>
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

	/* Capture button - fixed at bottom center */
	.capture-layer {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
	}

	/* Queue panel - side drawer */
	.queue-layer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100%;
		width: 80px;
		background-color: rgba(15, 15, 15, 0.95);
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		z-index: 5;
		transition: width 0.3s ease;
		display: flex;
		flex-direction: row;
	}

	.queue-layer.expanded {
		width: 240px;
	}

	.panel-toggle {
		position: absolute;
		left: -24px;
		top: 50%;
		transform: translateY(-50%);
		width: 24px;
		height: 48px;
		background-color: rgba(15, 15, 15, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-right: none;
		border-radius: 8px 0 0 8px;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s ease;
	}

	.panel-toggle:hover {
		color: rgba(255, 255, 255, 1);
	}

	.toggle-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	/* Mobile: Queue panel at bottom */
	@media (max-width: 768px) {
		.queue-layer {
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			height: 100px;
			border-left: none;
			border-top: 1px solid rgba(255, 255, 255, 0.1);
			flex-direction: column;
		}

		.queue-layer.expanded {
			width: 100%;
			height: 200px;
		}

		.panel-toggle {
			left: 50%;
			top: -24px;
			transform: translateX(-50%);
			width: 48px;
			height: 24px;
			border-radius: 8px 8px 0 0;
			border: 1px solid rgba(255, 255, 255, 0.1);
			border-bottom: none;
		}

		.toggle-icon {
			transform: rotate(90deg);
		}

		.capture-layer {
			bottom: calc(100px + 2rem);
		}

		.panel-expanded .capture-layer {
			bottom: calc(200px + 2rem);
		}
	}
</style>
