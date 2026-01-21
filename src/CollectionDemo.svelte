<script lang="ts">
  import { collection, totalCards } from './stores/collection';

  // Example card IDs for testing
  const testCards = ['base1-4', 'sv1-25', 'base1-1'];

  function handleIncrement(cardId: string) {
    const result = collection.increment(cardId);
    if (!result.success) {
      console.warn(`Failed to increment ${cardId}: ${result.error}`);
    }
  }

  function handleDecrement(cardId: string) {
    const result = collection.decrement(cardId);
    if (!result.success) {
      console.warn(`Failed to decrement ${cardId}: ${result.error}`);
    }
  }
</script>

<div class="demo">
  <h2>Collection Store Demo</h2>

  <div class="stats">
    <p><strong>Total Cards:</strong> {$totalCards}</p>
  </div>

  <div class="cards">
    {#each testCards as cardId (cardId)}
      <div class="card">
        <span class="card-id">{cardId}</span>
        <div class="controls">
          <button onclick={() => handleDecrement(cardId)}>-</button>
          <span class="quantity">{$collection[cardId] || 0}</span>
          <button onclick={() => handleIncrement(cardId)}>+</button>
        </div>
      </div>
    {/each}
  </div>

  <div class="actions">
    <button onclick={() => collection.reset()}>Reset Collection</button>
    <button onclick={() => console.log(collection.exportData())}>Log Collection Data</button>
  </div>

  <div class="info">
    <p>💡 Try incrementing a card to 99 - it won't go higher!</p>
    <p>💡 Changes are automatically saved to localStorage</p>
    <p>💡 Refresh the page to see persistence in action</p>
  </div>
</div>

<style>
  .demo {
    padding: 2rem;
    max-width: 600px;
    margin: 0 auto;
  }

  h2 {
    margin-bottom: 1.5rem;
  }

  .stats {
    background: #f0f0f0;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
  }

  .card-id {
    font-family: monospace;
    font-weight: bold;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .quantity {
    min-width: 3ch;
    text-align: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid #333;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
  }

  button:hover {
    background: #f0f0f0;
  }

  button:active {
    background: #e0e0e0;
  }

  .actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .actions button {
    flex: 1;
  }

  .info {
    background: #e3f2fd;
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .info p {
    margin: 0.5rem 0;
  }
</style>
