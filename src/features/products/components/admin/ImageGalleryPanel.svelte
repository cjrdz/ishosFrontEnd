<script lang="ts">
  import type { AdminImage } from "@features/admin-management";

  interface Props {
    open: boolean;
    galleryImages: AdminImage[];
    selectedImagePath: string;
    busy: boolean;
    galleryBusy: boolean;
    onClose: () => void;
    onReload: () => void | Promise<void>;
    onUpload: (file: File) => void | Promise<void>;
    onSelect: (imageName: string) => void;
    onDelete: (imageName: string) => void | Promise<void>;
  }

  let {
    open,
    galleryImages,
    selectedImagePath,
    busy,
    galleryBusy,
    onClose,
    onReload,
    onUpload,
    onSelect,
    onDelete,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let uploadInput = $state<HTMLInputElement | null>(null);
  let selectedUploadFile = $state<File | null>(null);
  let actionBusy = $state(false);

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function handleUploadSelection(event: Event) {
    const target = event.target as HTMLInputElement;
    selectedUploadFile = target.files?.[0] ?? null;
  }

  async function uploadSelectedImage() {
    if (!selectedUploadFile) return;
    actionBusy = true;
    try {
      await onUpload(selectedUploadFile);
      selectedUploadFile = null;
      if (uploadInput) uploadInput.value = "";
    } catch {
      // Error handled by parent
    } finally {
      actionBusy = false;
    }
  }

  function selectImage(imageName: string) {
    onSelect(imageName);
    onClose();
  }

  async function removeImage(imageName: string) {
    if (!confirm(`¿Eliminar imagen "${imageName}"?`)) return;
    actionBusy = true;
    try {
      await onDelete(imageName);
    } catch {
      // Error handled by parent
    } finally {
      actionBusy = false;
    }
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Seleccionar imagen del producto</h3>
      <button class="btn btn-sm btn-ghost" type="button" onclick={onClose}
        >Cerrar</button
      >
    </div>

    <div class="mt-4 rounded-lg border border-base-300/70 p-3 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">Galeria de imagenes (menu)</span>
        <button
          class="btn btn-xs btn-outline"
          type="button"
          onclick={onReload}
          disabled={busy || galleryBusy || actionBusy}
        >
          Recargar
        </button>
      </div>

      <div class="flex gap-2">
        <input
          class="file-input file-input-bordered file-input-sm w-full"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          bind:this={uploadInput}
          onchange={handleUploadSelection}
          disabled={busy || galleryBusy || actionBusy}
        />
        <button
          class="btn btn-sm btn-primary"
          type="button"
          onclick={uploadSelectedImage}
          disabled={busy || galleryBusy || actionBusy || !selectedUploadFile}
        >
          Subir
        </button>
      </div>
    </div>

    <div class="mt-4">
      {#if galleryImages.length === 0}
        <div class="text-sm text-base-content/70">
          No hay imagenes en el bucket.
        </div>
      {:else}
        <ul
          class="list rounded-box border border-base-300/70 max-h-[50vh] overflow-y-auto"
        >
          {#each galleryImages as image}
            <li class="list-row items-center gap-3">
              <img
                src={image.url}
                alt={image.name}
                class="size-14 rounded-box object-cover"
                loading="lazy"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{image.name}</div>
              </div>
              <button
                class={`btn btn-xs ${selectedImagePath === image.name ? "btn-success" : "btn-outline btn-accent"}`}
                type="button"
                onclick={() => selectImage(image.name)}
                disabled={busy || galleryBusy || actionBusy}
              >
                {selectedImagePath === image.name ? "Seleccionada" : "Usar"}
              </button>
              <button
                class="btn btn-xs btn-error"
                type="button"
                onclick={() => removeImage(image.name)}
                disabled={busy || galleryBusy || actionBusy}
              >
                Eliminar
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="modal-action mt-5">
      <button type="button" class="btn btn-ghost" onclick={onClose}
        >Cerrar</button
      >
    </div>
  </div>
</dialog>
