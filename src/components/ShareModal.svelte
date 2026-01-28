<script lang="ts">
  import Modal from './Modal.svelte';
  import { toast } from 'svelte-sonner';

  interface Props {
    show: boolean;
    shareUrl: string;
    onClose: () => void;
  }

  let { show, shareUrl, onClose }: Props = $props();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard', {
        description: 'Share your collection and wishlist with others',
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link', {
        description: 'Please try again',
        duration: 3000
      });
    }
  }
</script>

<Modal {show} {onClose}>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Share Collection & Wishlist</h2>
      <button
        onclick={onClose}
        class="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <p class="text-gray-600">
      Share your collection and wishlist with friends via this link. Both are always live and show your current cards.
    </p>

    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div class="flex items-center gap-2">
        <input
          type="text"
          readonly
          value={shareUrl}
          class="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onclick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onclick={handleCopy}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
        >
          Copy Link
        </button>
      </div>
    </div>

    <div class="text-sm text-gray-500">
      <p>Anyone with this link can view your collection and wishlist.</p>
    </div>
  </div>
</Modal>
