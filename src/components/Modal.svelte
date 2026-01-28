<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    show: boolean;
    onClose: () => void;
    children: Snippet;
  }

  let { show, onClose, children }: Props = $props();

  function handleBackdropClick() {
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="button"
    tabindex="0"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative z-10"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      {@render children()}
    </div>
  </div>
{/if}
