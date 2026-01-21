<script lang="ts">
  import { user, isAuthenticated } from '../stores/auth';
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
</script>

<div class="flex items-center gap-3 text-sm">
  {#if $isAuthenticated}
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-green-500"></div>
      <span class="text-gray-700">Signed in as <strong>{getDisplayName()}</strong></span>
    </div>
  {:else}
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-gray-400"></div>
      <span class="text-gray-600">Not signed in (local only)</span>
    </div>
  {/if}

  <div class="text-gray-500">|</div>

  <div class="text-gray-700">
    <strong>{$totalCards}</strong> {$totalCards === 1 ? 'card' : 'cards'}
  </div>
</div>
