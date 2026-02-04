<script lang="ts">
	// ViewfinderOverlay - displays a card frame overlay to help users position the card
	// Pokemon card aspect ratio is 2.5:3.5 (approximately 5:7 or ~0.714)
</script>

<div class="viewfinder-overlay">
	<!-- Semi-transparent darkened areas around the frame -->
	<div class="overlay-mask">
		<div class="mask-top"></div>
		<div class="mask-middle">
			<div class="mask-left"></div>
			<div class="frame-container">
				<!-- Corner brackets -->
				<div class="corner corner-top-left"></div>
				<div class="corner corner-top-right"></div>
				<div class="corner corner-bottom-left"></div>
				<div class="corner corner-bottom-right"></div>
			</div>
			<div class="mask-right"></div>
		</div>
		<div class="mask-bottom"></div>
	</div>

	<!-- Instruction text -->
	<div class="instruction-text">Position card in frame</div>
</div>

<style>
	.viewfinder-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.overlay-mask {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	.mask-top,
	.mask-bottom {
		flex: 1;
		background-color: rgba(0, 0, 0, 0.5);
	}

	.mask-middle {
		display: flex;
		/* Pokemon card aspect ratio: width = height * (5/7) */
		/* Frame height is 70% of viewport height, width maintains aspect ratio */
		height: 70vh;
	}

	.mask-left,
	.mask-right {
		flex: 1;
		background-color: rgba(0, 0, 0, 0.5);
	}

	.frame-container {
		position: relative;
		/* Width based on Pokemon card aspect ratio (5:7) */
		/* Height is 70vh, so width should be 70vh * (5/7) = 50vh */
		width: min(75vw, 50vh);
		height: min(105vw, 70vh);
		/* Fallback for aspect ratio calculation */
		aspect-ratio: 5 / 7;
	}

	/* Corner bracket styling */
	.corner {
		position: absolute;
		width: 24px;
		height: 24px;
		border-color: rgba(255, 255, 255, 0.9);
		border-style: solid;
		border-width: 0;
	}

	.corner-top-left {
		top: 0;
		left: 0;
		border-top-width: 3px;
		border-left-width: 3px;
		border-top-left-radius: 4px;
	}

	.corner-top-right {
		top: 0;
		right: 0;
		border-top-width: 3px;
		border-right-width: 3px;
		border-top-right-radius: 4px;
	}

	.corner-bottom-left {
		bottom: 0;
		left: 0;
		border-bottom-width: 3px;
		border-left-width: 3px;
		border-bottom-left-radius: 4px;
	}

	.corner-bottom-right {
		bottom: 0;
		right: 0;
		border-bottom-width: 3px;
		border-right-width: 3px;
		border-bottom-right-radius: 4px;
	}

	.instruction-text {
		position: absolute;
		bottom: 15%;
		left: 50%;
		transform: translateX(-50%);
		color: rgba(255, 255, 255, 0.9);
		font-size: 1rem;
		font-weight: 500;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
		white-space: nowrap;
	}

	/* Responsive adjustments for smaller screens */
	@media (max-width: 480px) {
		.corner {
			width: 20px;
			height: 20px;
		}

		.instruction-text {
			font-size: 0.875rem;
			bottom: 12%;
		}
	}
</style>
