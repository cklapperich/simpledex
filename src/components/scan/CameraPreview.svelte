<script lang="ts">
  import { scanStore } from '../../stores/scan';

  let videoElement: HTMLVideoElement | null = $state(null);
  let canvasElement: HTMLCanvasElement | null = $state(null);
  let stream: MediaStream | null = $state(null);

  $effect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        stream = mediaStream;

        if (videoElement) {
          videoElement.srcObject = mediaStream;
        }

        scanStore.setCameraActive(true);
      } catch (error) {
        console.error('Failed to access camera:', error);
        scanStore.setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      scanStore.setCameraActive(false);
    };
  });

  /**
   * Capture the viewfinder region from the camera feed.
   * Returns the original card rectangle - no preprocessing applied.
   * Preprocessing happens in the inference layer.
   */
  export function capture(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!videoElement || !canvasElement) {
        reject(new Error('Video or canvas element not available'));
        return;
      }

      const ctx = canvasElement.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Get container (displayed) dimensions
      const containerWidth = videoElement.clientWidth;
      const containerHeight = videoElement.clientHeight;

      // Get native video dimensions
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      // Calculate viewfinder frame dimensions (matching ViewfinderOverlay CSS)
      const frameHeight = Math.min(containerWidth * 1.05, containerHeight * 0.7);
      const frameWidth = Math.min(containerWidth * 0.75, containerHeight * 0.5);

      // Frame is centered in container
      const frameLeft = (containerWidth - frameWidth) / 2;
      const frameTop = (containerHeight - frameHeight) / 2;

      // Calculate how video is scaled with object-fit: cover
      const containerAspect = containerWidth / containerHeight;
      const videoAspect = videoWidth / videoHeight;

      let scale: number;
      let videoOffsetX = 0;
      let videoOffsetY = 0;

      if (videoAspect > containerAspect) {
        scale = videoHeight / containerHeight;
        const scaledVideoWidth = videoWidth / scale;
        videoOffsetX = (scaledVideoWidth - containerWidth) / 2 * scale;
      } else {
        scale = videoWidth / containerWidth;
        const scaledVideoHeight = videoHeight / scale;
        videoOffsetY = (scaledVideoHeight - containerHeight) / 2 * scale;
      }

      // Map frame coordinates to video coordinates
      const srcX = videoOffsetX + frameLeft * scale;
      const srcY = videoOffsetY + frameTop * scale;
      const srcWidth = frameWidth * scale;
      const srcHeight = frameHeight * scale;

      // Capture at reasonable resolution maintaining original aspect ratio
      const maxDim = 512;
      const aspect = srcWidth / srcHeight;
      let canvasWidth: number;
      let canvasHeight: number;
      if (aspect > 1) {
        canvasWidth = maxDim;
        canvasHeight = Math.round(maxDim / aspect);
      } else {
        canvasHeight = maxDim;
        canvasWidth = Math.round(maxDim * aspect);
      }

      canvasElement.width = canvasWidth;
      canvasElement.height = canvasHeight;

      // Draw the viewfinder region (original aspect ratio, no preprocessing)
      ctx.drawImage(
        videoElement,
        srcX, srcY, srcWidth, srcHeight,
        0, 0, canvasWidth, canvasHeight
      );

      canvasElement.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/jpeg',
        0.9
      );
    });
  }
</script>

<div class="camera-container">
  <video
    bind:this={videoElement}
    autoplay
    playsinline
    muted
  ></video>
  <canvas bind:this={canvasElement} class="hidden-canvas"></canvas>
</div>

<style>
  .camera-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hidden-canvas {
    position: absolute;
    left: -9999px;
    top: -9999px;
    visibility: hidden;
  }
</style>
