<script lang="ts">
  import { user, isAuthenticated } from '../stores/auth';
  import { totalCards } from '../stores/collection';
  import { getOrCreateShareCode } from '../utils/shareUtils';
  import ShareModal from './ShareModal.svelte';
  import { toast } from 'svelte-sonner';

  let showModal = $state(false);
  let shareUrl = $state('');
  let loading = $state(false);

  async function handleShare() {
    if (!$user) {
      toast.error('Please sign in to share', {
        description: 'You need to be signed in to share your collection',
        duration: 3000
      });
      return;
    }

    loading = true;

    try {
      const shareCode = await getOrCreateShareCode($user.id);

      if (!shareCode) {
        toast.error('Failed to generate share link', {
          description: 'Please try again',
          duration: 3000
        });
        return;
      }

      // Get current domain (works for localhost and production)
      const baseUrl = window.location.origin;
      shareUrl = `${baseUrl}/share/${shareCode}`;
      showModal = true;
    } catch (error) {
      console.error('Failed to create share link:', error);
      toast.error('Failed to generate share link', {
        description: 'Please try again',
        duration: 3000
      });
    } finally {
      loading = false;
    }
  }
</script>

{#if $isAuthenticated && $totalCards > 0}
  <button
    onclick={handleShare}
    disabled={loading}
    class="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    title="Share your collection and wishlist"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
    {loading ? 'Loading...' : 'Share'}
  </button>
{/if}

<ShareModal show={showModal} {shareUrl} onClose={() => showModal = false} />
