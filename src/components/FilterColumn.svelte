<script lang="ts">
  interface Props {
    activeFilters: Set<string>;
    onToggle: (filter: string) => void;
  }

  let { activeFilters, onToggle }: Props = $props();

  // Pokémon types - circular symbols
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

  // Card categories - rectangular symbols
  const categories = [
    { id: 'Trainer', label: 'Trainer', icon: '/icons/trainer.png' },
    { id: 'Item', label: 'Item', icon: '/icons/item.png' },
    { id: 'Supporter', label: 'Supporter', icon: '/icons/supporter.png' },
    { id: 'Tool', label: 'Tool', icon: '/icons/tool.png' },
    { id: 'Energy', label: 'Energy', icon: '/icons/energy.png' },
  ];

  // Format filters - text-based filters
  const formatFilters = [
    { id: 'NoRulebox', label: 'No Rule Box', icon: null },
    { id: 'ExpandedLegal', label: 'Expanded Legal', icon: null },
  ];
</script>

<div class="filter-column">
  <!-- Energy/Type filters (circular) -->
  <div class="filter-section">
    <div class="section-label">Types</div>
    {#each energyTypes as type (type.id)}
      <button
        class="filter-button circular"
        class:active={activeFilters.has(type.id)}
        onclick={() => onToggle(type.id)}
        title={type.label}
      >
        {#if type.icon}
          <img src={type.icon} alt={type.label} class="filter-icon-img" />
        {:else}
          <span class="filter-icon-placeholder">{type.label[0]}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Category filters (rectangular) -->
  <div class="filter-section">
    <div class="section-label">Cards</div>
    {#each categories as category (category.id)}
      <button
        class="filter-button rectangular"
        class:active={activeFilters.has(category.id)}
        class:smaller={category.id === 'Item'}
        onclick={() => onToggle(category.id)}
        title={category.label}
      >
        {#if category.icon}
          <img src={category.icon} alt={category.label} class="filter-icon-img" />
        {:else}
          <span class="filter-icon-placeholder">{category.label[0]}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Format filters (rectangular text) -->
  <div class="filter-section">
    <div class="section-label">Format</div>
    {#each formatFilters as filter (filter.id)}
      <button
        class="filter-button rectangular text-filter"
        class:active={activeFilters.has(filter.id)}
        onclick={() => onToggle(filter.id)}
        title={filter.label}
      >
        <span class="filter-text">{filter.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .filter-column {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    width: 100%;
  }

  .filter-section {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #9ca3af;
    letter-spacing: 0.05em;
    min-width: 60px;
    margin: 0;
    padding: 0;
    line-height: 1;
  }

  .filter-button {
    width: 48px;
    height: 48px;
    border: 2px solid transparent;
    background-color: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    padding: 2px;
    margin: 0;
  }

  .filter-button.circular {
    border-radius: 50%;
  }

  .filter-button.rectangular {
    border-radius: 0.375rem;
    width: 108px;
    height: auto;
  }

  .filter-button.rectangular.smaller {
    width: 76px;
    height: auto;
  }

  .filter-button:hover {
    transform: scale(1.05);
  }

  .filter-button.active {
    border-color: #1f2937;
    box-shadow: 0 0 0 2px white, 0 0 0 4px #1f2937;
  }

  .filter-button.text-filter {
    width: auto;
    min-width: 108px;
    padding: 0.5rem 1rem;
  }

  .filter-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }

  .filter-button.active .filter-text {
    color: #1f2937;
  }

  .filter-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .filter-icon-placeholder {
    font-size: 1.25rem;
    font-weight: bold;
    color: #9ca3af;
  }
</style>
