<script lang="ts">
  import { scanStore } from '../../stores/scan';

  let isRequesting = $state(false);

  async function requestCameraPermission() {
    isRequesting = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Stop the stream immediately - we just needed to check permission
      stream.getTracks().forEach(track => track.stop());

      scanStore.setCameraPermission('granted');
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        scanStore.setCameraPermission('denied');
      } else {
        // Other errors (e.g., no camera available) also result in denied state
        scanStore.setCameraPermission('denied');
      }
    } finally {
      isRequesting = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
  {#if $scanStore.cameraPermission === 'pending'}
    <div class="mb-6">
      <svg class="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <h2 class="text-xl font-semibold text-white mb-2">Camera Access Required</h2>
      <p class="text-gray-400 mb-6 max-w-sm">
        To scan cards, we need access to your camera. Your camera feed stays on your device and is never uploaded.
      </p>
    </div>

    <button
      onclick={requestCameraPermission}
      disabled={isRequesting}
      class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white font-medium rounded-lg transition-colors flex items-center gap-2"
    >
      {#if isRequesting}
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Requesting...
      {:else}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
        Allow Camera Access
      {/if}
    </button>
  {:else if $scanStore.cameraPermission === 'denied'}
    <div class="mb-6">
      <svg class="w-20 h-20 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      <h2 class="text-xl font-semibold text-white mb-2">Camera Access Denied</h2>
      <p class="text-gray-400 mb-6 max-w-sm">
        Camera permission was denied. To use the card scanner, you'll need to enable camera access in your browser settings.
      </p>
    </div>

    <div class="bg-gray-800 rounded-lg p-4 max-w-md text-left">
      <h3 class="text-white font-medium mb-3">How to enable camera access:</h3>
      <ol class="text-gray-400 text-sm space-y-2 list-decimal list-inside">
        <li>Click the lock or camera icon in your browser's address bar</li>
        <li>Find "Camera" in the permissions list</li>
        <li>Change the setting to "Allow"</li>
        <li>Refresh this page</li>
      </ol>
    </div>

    <button
      onclick={requestCameraPermission}
      disabled={isRequesting}
      class="mt-6 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-wait text-white font-medium rounded-lg transition-colors"
    >
      {#if isRequesting}
        Checking...
      {:else}
        Try Again
      {/if}
    </button>
  {/if}
</div>
