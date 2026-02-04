# Plan 1: Camera Scan UI

## Overview
Add camera scan UI to SimpleDex. Defers model/embeddings download until user explicitly enables the feature.

## User Flow
1. Click camera icon in sidebar → "Setup Scanner" screen
2. Click "Download Scanner" button → Progress bar (model + embeddings)
3. Download complete → Camera activates with viewfinder
4. Take photos → Queue processes in background
5. View results → Add to collection or reject
6. Next visit → Check cache, skip download if ready

---

## Files to Create

### Store: `src/stores/scan.ts`
```typescript
interface ScanState {
  // Setup state
  setupComplete: boolean;        // Model + embeddings downloaded
  downloadProgress: number | null; // 0-100 during download
  downloadError: string | null;

  // Camera state
  cameraPermission: 'pending' | 'granted' | 'denied';
  cameraActive: boolean;

  // Queue state
  queueItems: QueueItem[];
}

interface QueueItem {
  id: string;
  imageBlob: Blob;
  thumbnailUrl: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  result?: ScanResult;
  error?: string;
}

interface ScanResult {
  matches: Array<{
    cardId: string;
    score: number;
    card: Card;  // Enriched from cardMap
  }>;
}
```

**Methods:**
- `checkSetupStatus()` - Check if model/embeddings cached
- `startDownload()` - Trigger download (calls inferencing service)
- `setDownloadProgress(progress)` - Update progress bar
- `addToQueue(blob)` - Add captured image
- `setResult(id, result)` - Set match results
- `removeFromQueue(id)` - Remove after add/reject

### Components: `src/components/scan/`

**`ScanPage.svelte`** - Main container with 3 states:
```svelte
{#if !$scanStore.setupComplete}
  <ScanSetup />
{:else if $scanStore.cameraPermission !== 'granted'}
  <PermissionPrompt />
{:else}
  <ScanInterface />
{/if}
```

**`ScanSetup.svelte`** - Download/setup screen:
- Icon + "Enable Card Scanner" heading
- Size estimate: "~70MB download (one-time)"
- "Download Scanner" button
- Progress bar during download
- Error state with retry

**`PermissionPrompt.svelte`** - Camera permission request:
- "Allow Camera Access" button
- Instructions if denied

**`ScanInterface.svelte`** - Active scanning UI:
- CameraPreview + ViewfinderOverlay
- CaptureButton (floating)
- QueuePanel (side/bottom drawer)

**`CameraPreview.svelte`** - Video element:
- `getUserMedia({ video: { facingMode: 'environment' } })`
- Capture to 224x224 JPEG blob

**`ViewfinderOverlay.svelte`** - Card frame overlay:
- Pokemon card aspect ratio (2.5:3.5)
- Corner brackets + "Position card in frame"

**`CaptureButton.svelte`** - Large circular button

**`QueuePanel.svelte`** - Thumbnail queue:
- Shows pending/processing/complete status
- Click thumbnail to view result

**`ResultCard.svelte`** - Single result display:
- Top match with confidence %
- "Show alternatives" expandable
- "Add to Collection" / "Reject" buttons

---

## Files to Modify

### `src/stores/view.ts`
```typescript
export type View = 'search' | 'about' | 'decks' | 'deckbuilder' | 'shared' | 'scan';
```

### `src/components/Sidebar.svelte`
Add camera button after Search:
```svelte
<button
  onclick={() => navigateTo('scan')}
  class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 {$activeView === 'scan'
    ? 'bg-blue-600 text-white'
    : 'text-gray-300 hover:bg-gray-700'}"
  title="Scan Card"
>
  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
</button>
```

### `src/components/BottomNav.svelte`
Add scan button for mobile (same icon + "Scan" label)

### `src/App.svelte`
Add routing:
```svelte
{:else if $activeView === 'scan'}
  <ScanPage />
```

---

## Dependencies on Other Plans

- **Plan 2 (Inferencing)**: ScanSetup calls `scannerService.download()` and `scannerService.isReady()`
- **Plan 2 (Inferencing)**: Queue processor calls `scannerService.findMatches(blob)`

For now, stub these with mock implementations:
```typescript
// src/services/scanner/index.ts (stub)
export const scannerService = {
  isReady: () => Promise.resolve(false),
  download: (onProgress) => Promise.resolve(), // mock
  findMatches: (blob) => Promise.resolve([])   // mock
};
```

---

## Integration Points

### Collection Store (`src/stores/collection.ts`)
```typescript
// In ResultCard.svelte
import { collection } from '../../stores/collection';

function handleAdd(cardId: string) {
  collection.increment(cardId);
  scanStore.removeFromQueue(itemId);
}
```

### Card Data (`src/stores/cards.ts`)
```typescript
// Enrich results with card details
import { cardMap } from '../../stores/cards';
const card = $cardMap.get(match.cardId);
```

---

## Implementation Order

1. Add 'scan' to view.ts, add sidebar/bottomnav buttons
2. Create scan store with state management
3. Create ScanPage with setup/permission/interface states
4. Create ScanSetup with download button (stubbed service)
5. Create PermissionPrompt with camera request
6. Create CameraPreview + ViewfinderOverlay + CaptureButton
7. Create QueuePanel + ResultCard
8. Wire up collection integration

---

## Verification

1. Click camera icon → See setup screen
2. Click download → Progress bar (mocked for now)
3. Grant camera permission → See live preview
4. Tap capture → Photo appears in queue
5. Mock result appears → Add/reject works
6. Collection updates correctly
