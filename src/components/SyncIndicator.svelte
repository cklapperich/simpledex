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
      <span class="text-gray-700">Signed in</span>
      {#if $user?.id}
        <span class="text-gray-500 text-xs">({$user.id})</span>
      {/if}
    </div>
    <div class="text-gray-500">|</div>
    <button
      onclick={handleSignOut}
      class="hover:opacity-70 transition-opacity"
      title="Sign out"
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 38H11C9.89543 38 9 37.1046 9 36V12C9 10.8954 9.89543 10 11 10H20" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
        <path d="M31 30L39 24L31 18" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M39 24H20" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  {:else}
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-gray-400"></div>
      <span class="text-gray-700">Not signed in</span>
    </div>
    <div class="text-gray-500">|</div>
    <button
      onclick={handleSignIn}
      class="text-blue-600 hover:text-blue-800 underline"
    >
      Sign in
    </button>
  {/if}
</div>
