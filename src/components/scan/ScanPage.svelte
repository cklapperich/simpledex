<script lang="ts">
  import { scanStore } from '../../stores/scan';
  import ScanSetup from './ScanSetup.svelte';
  import PermissionPrompt from './PermissionPrompt.svelte';
  import ScanInterface from './ScanInterface.svelte';

  $effect(() => {
    scanStore.checkSetupStatus();
  });
</script>

<div class="min-h-screen bg-gray-900 text-white">
  {#if !$scanStore.setupComplete}
    <ScanSetup />
  {:else if $scanStore.cameraPermission !== 'granted'}
    <PermissionPrompt />
  {:else}
    <ScanInterface />
  {/if}
</div>
