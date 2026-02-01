<script lang="ts">
  import type { DeckStats } from '../utils/deckStats';

  let { stats }: { stats: DeckStats } = $props();
</script>

<div class="grid grid-cols-3 gap-4 text-sm">
  <!-- Pokemon Column -->
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <span class="font-bold text-gray-800">Pokemon</span>
      <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
        {stats.pokemon}
      </span>
    </div>
    <ul class="space-y-1 text-xs text-gray-600">
      <li class="flex justify-between">
        <span>Basic</span>
        <span class="font-medium text-gray-700">{stats.pokemonBasic}</span>
      </li>
      <li class="flex justify-between">
        <span>Stage 1</span>
        <span class="font-medium text-gray-700">{stats.pokemonStage1}</span>
      </li>
      <li class="flex justify-between">
        <span>Stage 2</span>
        <span class="font-medium text-gray-700">{stats.pokemonStage2}</span>
      </li>
    </ul>
  </div>

  <!-- Trainers Column -->
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <span class="font-bold text-gray-800">Trainers</span>
      <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
        {stats.trainers}
      </span>
    </div>
    <ul class="space-y-1 text-xs text-gray-600">
      <li class="flex justify-between">
        <span>Supporters</span>
        <span class="font-medium text-gray-700">{stats.supporters}</span>
      </li>
      <li class="flex justify-between">
        <span>Items</span>
        <span class="font-medium text-gray-700">{stats.items}</span>
      </li>
      <li class="flex justify-between">
        <span>Tools</span>
        <span class="font-medium text-gray-700">{stats.tools}</span>
      </li>
    </ul>
  </div>

  <!-- Energy Column -->
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <span class="font-bold text-gray-800">Energy</span>
      <span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
        {stats.energy}
      </span>
    </div>
    <ul class="space-y-1 text-xs text-gray-600">
      <li class="flex justify-between">
        <span>Basic</span>
        <span class="font-medium text-gray-700">{stats.basicEnergy}</span>
      </li>
      <li class="flex justify-between">
        <span>Special</span>
        <span class="font-medium text-gray-700">{stats.specialEnergy}</span>
      </li>
    </ul>
  </div>
</div>
