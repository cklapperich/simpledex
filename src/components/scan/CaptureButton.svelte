<script lang="ts">
	interface Props {
		onclick: () => void;
		disabled?: boolean;
	}

	let { onclick, disabled = false }: Props = $props();
</script>

<button
	type="button"
	class="capture-button"
	{onclick}
	{disabled}
	aria-label="Capture photo"
>
	<span class="inner-circle"></span>
</button>

<style>
	.capture-button {
		position: relative;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: transparent;
		border: 4px solid rgba(255, 255, 255, 0.9);
		padding: 4px;
		cursor: pointer;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.3),
			inset 0 0 0 2px rgba(255, 255, 255, 0.1);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}

	.capture-button:hover:not(:disabled) {
		transform: scale(1.05);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.4),
			inset 0 0 0 2px rgba(255, 255, 255, 0.2);
	}

	.capture-button:active:not(:disabled) {
		transform: scale(0.95);
		box-shadow:
			0 1px 4px rgba(0, 0, 0, 0.3),
			inset 0 0 0 2px rgba(255, 255, 255, 0.1);
	}

	.capture-button:disabled {
		cursor: not-allowed;
		border-color: rgba(128, 128, 128, 0.5);
		opacity: 0.6;
	}

	.inner-circle {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.95) 0%,
			rgba(240, 240, 240, 0.9) 50%,
			rgba(220, 220, 220, 0.85) 100%
		);
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.8),
			inset 0 -2px 4px rgba(0, 0, 0, 0.1);
		transition:
			background 0.15s ease,
			box-shadow 0.15s ease;
	}

	.capture-button:hover:not(:disabled) .inner-circle {
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 1) 0%,
			rgba(245, 245, 245, 0.95) 50%,
			rgba(230, 230, 230, 0.9) 100%
		);
	}

	.capture-button:active:not(:disabled) .inner-circle {
		background: linear-gradient(
			145deg,
			rgba(230, 230, 230, 0.9) 0%,
			rgba(220, 220, 220, 0.85) 50%,
			rgba(200, 200, 200, 0.8) 100%
		);
		box-shadow:
			inset 0 1px 2px rgba(0, 0, 0, 0.15),
			inset 0 -1px 2px rgba(255, 255, 255, 0.5);
	}

	.capture-button:disabled .inner-circle {
		background: linear-gradient(
			145deg,
			rgba(180, 180, 180, 0.7) 0%,
			rgba(160, 160, 160, 0.6) 50%,
			rgba(140, 140, 140, 0.5) 100%
		);
		box-shadow: none;
	}
</style>
