<script lang="ts">
  /**
   * Frames a product photo to the card's 4:3 ratio before upload: drag to
   * position, slider to zoom. The frame shows exactly what the card will show.
   * Exports a 1200×900 WebP (JPEG where WebP encoding isn't supported).
   */
  import { onDestroy } from "svelte";

  interface Props {
    file: File;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: (file: File) => void | Promise<void>;
  }

  let { file, busy = false, onCancel, onConfirm }: Props = $props();

  const ASPECT = 4 / 3;
  const OUTPUT_WIDTH = 1200;

  let frame = $state<HTMLDivElement | null>(null);
  let img = $state<HTMLImageElement | null>(null);
  let naturalWidth = $state(0);
  let naturalHeight = $state(0);
  let frameWidth = $state(0);
  let zoom = $state(1);
  let x = $state(0);
  let y = $state(0);
  let error = $state("");

  const url = $derived(URL.createObjectURL(file));
  let previousUrl: string | null = null;
  $effect(() => {
    if (previousUrl && previousUrl !== url) URL.revokeObjectURL(previousUrl);
    previousUrl = url;
  });
  onDestroy(() => {
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  });

  const frameHeight = $derived(frameWidth / ASPECT);
  /** Scale at which the photo just covers the frame. */
  const coverScale = $derived(
    naturalWidth && naturalHeight
      ? Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight)
      : 1,
  );
  const scale = $derived(coverScale * zoom);

  function clamp(nextX: number, nextY: number) {
    const minX = frameWidth - naturalWidth * scale;
    const minY = frameHeight - naturalHeight * scale;
    x = Math.min(0, Math.max(minX, nextX));
    y = Math.min(0, Math.max(minY, nextY));
  }

  function center() {
    x = (frameWidth - naturalWidth * scale) / 2;
    y = (frameHeight - naturalHeight * scale) / 2;
  }

  function onLoad() {
    if (!img) return;
    naturalWidth = img.naturalWidth;
    naturalHeight = img.naturalHeight;
    zoom = 1;
    center();
  }

  // Keep the point under the frame's centre steady while zooming.
  function setZoom(next: number) {
    const cx = (frameWidth / 2 - x) / scale;
    const cy = (frameHeight / 2 - y) / scale;
    zoom = next;
    const nextScale = coverScale * next;
    clamp(frameWidth / 2 - cx * nextScale, frameHeight / 2 - cy * nextScale);
  }

  let drag: { startX: number; startY: number; x: number; y: number } | null =
    null;

  function onPointerDown(event: PointerEvent) {
    drag = { startX: event.clientX, startY: event.clientY, x, y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag) return;
    clamp(
      drag.x + event.clientX - drag.startX,
      drag.y + event.clientY - drag.startY,
    );
  }

  function onKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 20 : 6;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    clamp(x + move[0], y + move[1]);
  }

  async function exportCrop(): Promise<File> {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = Math.round(OUTPUT_WIDTH / ASPECT);
    const context = canvas.getContext("2d");
    if (!context || !img) throw new Error("canvas unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(
      img,
      -x / scale,
      -y / scale,
      frameWidth / scale,
      frameHeight / scale,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const toBlob = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    let blob = await toBlob("image/webp");
    let extension = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob("image/jpeg");
      extension = "jpg";
    }
    if (!blob) throw new Error("encode failed");
    const base = file.name.replace(/\.[^.]+$/, "") || "producto";
    return new File([blob], `${base}.${extension}`, { type: blob.type });
  }

  async function confirm() {
    error = "";
    try {
      await onConfirm(await exportCrop());
    } catch {
      error = "No se pudo preparar la imagen. Prueba con otra foto.";
    }
  }

  $effect(() => {
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      frameWidth = entry.contentRect.width;
      if (naturalWidth) clamp(x, y);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  });
</script>

<div class="space-y-3 rounded-box border border-base-300 p-3">
  <p class="text-sm font-medium">Encuadra la foto como se verá en la tarjeta</p>
  <div
    bind:this={frame}
    class="cropper-frame"
    role="slider"
    tabindex="0"
    aria-label="Posición de la imagen. Usa las flechas para moverla."
    aria-valuenow={Math.round(zoom * 100)}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={() => (drag = null)}
    onpointercancel={() => (drag = null)}
    onkeydown={onKeydown}
  >
    <img
      bind:this={img}
      src={url}
      alt=""
      draggable="false"
      onload={onLoad}
      style={`width:${naturalWidth * scale}px;height:${naturalHeight * scale}px;transform:translate(${x}px, ${y}px)`}
    />
  </div>
  <label class="flex items-center gap-3 text-sm">
    <span class="shrink-0">Zoom</span>
    <input
      type="range"
      class="range range-primary range-xs"
      min="1"
      max="3"
      step="0.01"
      value={zoom}
      oninput={(event) =>
        setZoom(Number((event.currentTarget as HTMLInputElement).value))}
    />
  </label>
  {#if error}
    <p class="text-sm text-error" role="alert">{error}</p>
  {/if}
  <div class="flex justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      onclick={onCancel}
      disabled={busy}>Cancelar</button
    >
    <button
      type="button"
      class="btn btn-primary btn-sm"
      onclick={() => void confirm()}
      disabled={busy || !naturalWidth}
    >
      {busy ? "Subiendo…" : "Recortar y subir"}
    </button>
  </div>
</div>

<style>
  .cropper-frame {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border-radius: var(--radius-box);
    background: var(--color-base-200);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .cropper-frame:active {
    cursor: grabbing;
  }
  .cropper-frame:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .cropper-frame img {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    transform-origin: 0 0;
    pointer-events: none;
  }
</style>
