export interface SwipeableOptions {
	onLeft?: () => void;
	onRight?: () => void;
	threshold?: number;
}

export function swipeable(node: HTMLElement, options: SwipeableOptions) {
	let startX = 0;
	let tracking = false;
	const threshold = options.threshold ?? 50;

	function handleTouchStart(e: TouchEvent) {
		startX = e.touches[0].clientX;
		tracking = true;
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!tracking) return;
		const deltaX = e.changedTouches[0].clientX - startX;
		if (deltaX > threshold) options.onRight?.();
		else if (deltaX < -threshold) options.onLeft?.();
		tracking = false;
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchend', handleTouchEnd);

	return {
		update(newOptions: SwipeableOptions) {
			options = newOptions;
		},
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchend', handleTouchEnd);
		}
	};
}
