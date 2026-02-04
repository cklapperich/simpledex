<script lang="ts">
  import { scanStore } from '../../stores/scan';

  const isDownloading = $derived($scanStore.downloadProgress !== null);
  const hasError = $derived($scanStore.downloadError !== null);
  const setupReason = $derived($scanStore.setupReason);
  const isUpdate = $derived(setupReason === 'update');

  function handleDownload() {
    scanStore.startDownload();
  }
</script>

<div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
  <div class="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
    <!-- Camera Icon -->
    <div class="mb-6">
      <div class="w-20 h-20 mx-auto bg-gray-700 rounded-full flex items-center justify-center">
        <svg
          class="w-10 h-10 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
    </div>

    <!-- Heading -->
    <h1 class="text-2xl font-bold text-white mb-2">
      {isUpdate ? 'Update Available' : 'Enable Card Scanner'}
    </h1>

    <!-- Size Estimate -->
    <p class="text-gray-400 mb-6">
      {isUpdate ? 'New scanner data available' : '~70MB download (one-time)'}
    </p>

    <!-- Error State -->
    {#if hasError}
      <div class="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
        <p class="text-red-300 text-sm mb-3">{$scanStore.downloadError}</p>
        <button
          onclick={handleDownload}
          class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Retry Download
        </button>
      </div>
    {:else if isDownloading}
      <!-- Progress Bar -->
      <div class="mb-6">
        <div class="flex justify-between text-sm text-gray-400 mb-2">
          <span>Downloading...</span>
          <span>{Math.round($scanStore.downloadProgress ?? 0)}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            class="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
            style="width: {$scanStore.downloadProgress ?? 0}%"
          ></div>
        </div>
        <p class="text-gray-500 text-sm mt-3">Please wait while the scanner downloads...</p>
      </div>
    {:else}
      <!-- Download Button -->
      <button
        onclick={handleDownload}
        class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25"
      >
        {isUpdate ? 'Update Scanner' : 'Download Scanner'}
      </button>
    {/if}

    <!-- Additional Info -->
    <p class="text-gray-500 text-xs mt-6">
      The scanner runs locally on your device for fast, offline card recognition.
    </p>
  </div>
</div>
