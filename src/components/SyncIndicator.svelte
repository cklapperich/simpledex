<script lang="ts">
  import { user, isAuthenticated, auth } from '../stores/auth';
  import { totalCards } from '../stores/collection';

  function getDisplayName(): string {
    if (!$user) return '';

    // Try to get name from user metadata
    if ($user.user_metadata?.full_name) {
      return $user.user_metadata.full_name;
    }

    // Fall back to email
    if ($user.email) {
      return $user.email.split('@')[0];
    }

    return 'User';
  }

  async function handleSignIn() {
    const result = await auth.signInWithGoogle();
    if (!result.success && result.error) {
      alert(`Sign in failed: ${result.error}`);
    }
  }

  async function handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
      const result = await auth.signOut();
      if (!result.success && result.error) {
        alert(`Sign out failed: ${result.error}`);
      }
    }
  }
</script>

<div class="flex items-center gap-3 text-sm flex-wrap">
  {#if $isAuthenticated}
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-green-500"></div>
      <span class="text-gray-700">Signed in as <strong>{getDisplayName()}</strong></span>
    </div>
    <div class="text-gray-500">|</div>
    <button
      onclick={handleSignOut}
      class="text-blue-600 hover:text-blue-800 underline"
    >
      Sign Out
    </button>
  {:else}
    <button
      onclick={handleSignIn}
      class="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
    >
      <div class="w-2 h-2 rounded-full bg-gray-400"></div>
      <span class="text-gray-600">Not signed in (local only)</span>
    </button>
  {/if}

  <div class="text-gray-500">|</div>

  <div class="text-gray-700">
    <strong>{$totalCards}</strong> {$totalCards === 1 ? 'card' : 'cards'}
  </div>
</div>
