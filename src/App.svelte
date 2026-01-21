<script lang="ts">
  import { onMount } from 'svelte';
  import CollectionDemo from './CollectionDemo.svelte';

  onMount(() => {
    console.log('SimpleDex initialized');
  });
</script>

<main>
  <h1>SimpleDex</h1>
  <p>Pokemon TCG Collection Tracker</p>

  <CollectionDemo />
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  h1 {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.2rem;
    color: #666;
  }
</style>
