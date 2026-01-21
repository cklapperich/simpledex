<script lang="ts">
  import { auth, isAuthenticated, isLoading, user } from '../stores/auth';

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

{#if $isLoading}
  <button
    class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 text-gray-400 cursor-wait"
    disabled
    title="Loading..."
  >
    <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </button>
{:else if $isAuthenticated}
  <button
    onclick={handleSignOut}
    class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 text-gray-300 hover:bg-gray-700"
    title="Sign out ({$user?.email || 'User'})"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  </button>
{:else}
  <button
    onclick={handleSignIn}
    class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 text-gray-300 hover:bg-gray-700"
    title="Sign in with Google"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </button>
{/if}
