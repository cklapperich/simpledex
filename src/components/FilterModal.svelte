<script lang="ts">
  interface Props {
    activeFilters: Set<string>;
    onToggle: (filter: string) => void;
    onClose: () => void;
  }

  let { activeFilters, onToggle, onClose }: Props = $props();

  // Pokémon types
  const energyTypes = [
    { id: 'Grass', label: 'Grass', icon: '/icons/grass.png' },
    { id: 'Fire', label: 'Fire', icon: '/icons/fire.png' },
    { id: 'Water', label: 'Water', icon: '/icons/water.png' },
    { id: 'Lightning', label: 'Lightning', icon: '/icons/lightning.png' },
    { id: 'Psychic', label: 'Psychic', icon: '/icons/psychic.png' },
    { id: 'Fighting', label: 'Fighting', icon: '/icons/fighting.png' },
    { id: 'Darkness', label: 'Darkness', icon: '/icons/darkness.png' },
    { id: 'Metal', label: 'Metal', icon: '/icons/metal.png' },
    { id: 'Dragon', label: 'Dragon', icon: '/icons/dragon.png' },
    { id: 'Fairy', label: 'Fairy', icon: '/icons/fairy.png' },
    { id: 'Colorless', label: 'Colorless', icon: '/icons/colorless.png' },
  ];

  // Card categories
  const categories = [
    { id: 'Trainer', label: 'Trainer', icon: '/icons/trainer.png' },
    { id: 'Item', label: 'Item', icon: '/icons/item.png' },
    { id: 'Supporter', label: 'Supporter', icon: '/icons/supporter.png' },
    { id: 'Tool', label: 'Tool', icon: '/icons/tool.png' },
    { id: 'Energy', label: 'Energy', icon: '/icons/energy.png' },
  ];

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<!-- Modal Backdrop -->
<div
  class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center md:justify-center"
  onclick={handleBackdropClick}
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div class="bg-white w-full md:max-w-lg md:rounded-lg max-h-[85vh] md:max-h-[90vh] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900">Filters</h2>
      <button
        onclick={onClose}
        class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
        aria-label="Close"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Scrollable Filter Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Energy Types Section -->
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Types</h3>
        <div class="space-y-2">
          {#each energyTypes as type (type.id)}
            <button
              onclick={() => onToggle(type.id)}
              class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div class="w-10 h-10 flex-shrink-0">
                {#if type.icon}
                  <img src={type.icon} alt={type.label} class="w-full h-full object-contain" />
                {/if}
              </div>
              <span class="flex-1 text-left text-gray-900">{type.label}</span>
              <div class="w-6 h-6 flex-shrink-0">
                {#if activeFilters.has(type.id)}
                  <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                {:else}
                  <div class="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Categories Section -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Card Types</h3>
        <div class="space-y-2">
          {#each categories as category (category.id)}
            <button
              onclick={() => onToggle(category.id)}
              class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div class="w-10 h-10 flex-shrink-0">
                {#if category.icon}
                  <img src={category.icon} alt={category.label} class="w-full h-full object-contain" />
                {/if}
              </div>
              <span class="flex-1 text-left text-gray-900">{category.label}</span>
              <div class="w-6 h-6 flex-shrink-0">
                {#if activeFilters.has(category.id)}
                  <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                {:else}
                  <div class="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Footer with Apply Button -->
    <div class="p-4 border-t border-gray-200">
      <button
        onclick={onClose}
        class="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        Apply Filters
      </button>
    </div>
  </div>
</div>
