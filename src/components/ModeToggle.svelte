<script lang="ts">
  let {
    mode = $bindable('collection' as 'collection' | 'wishlist')
  }: { mode: 'collection' | 'wishlist' } = $props();
</script>

<div class="inline-flex rounded-lg bg-gray-100 p-1">
  <button
    class="px-4 py-2 rounded-md transition-colors"
    class:bg-white={mode === 'collection'}
    class:shadow={mode === 'collection'}
    onclick={() => mode = 'collection'}
  >
    Collection
  </button>
  <button
    class="px-4 py-2 rounded-md transition-colors"
    class:bg-white={mode === 'wishlist'}
    class:shadow={mode === 'wishlist'}
    onclick={() => mode = 'wishlist'}
  >
    Wishlist
  </button>
</div>
