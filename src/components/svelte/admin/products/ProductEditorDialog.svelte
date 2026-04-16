<script lang="ts">
  import type { AdminImage, Category } from "../../../../lib/api/admin";
  import Icon from "@iconify/svelte";

  interface ProductFormState {
    id: string;
    name: string;
    description: string;
    price: string;
    category_id: string;
    image_path: string;
    is_available: boolean;
  }

  interface Props {
    open: boolean;
    isEditing: boolean;
    busy: boolean;
    galleryBusy: boolean;
    galleryActionBusy: boolean;
    categories: Category[];
    form: ProductFormState;
    selectedGalleryImage: AdminImage | null;
    onSubmit: (event: SubmitEvent) => void;
    onClose: () => void;
    onOpenImageGalleryModal: () => void;
    onClearSelectedImage: () => void;
    onOpenFlavorAssignmentForEditingProduct: () => void;
    onOpenAddonAssignmentForEditingProduct: () => void;
  }

  let {
    open,
    isEditing,
    busy,
    galleryBusy,
    galleryActionBusy,
    categories,
    form,
    selectedGalleryImage,
    onSubmit,
    onClose,
    onOpenImageGalleryModal,
    onClearSelectedImage,
    onOpenFlavorAssignmentForEditingProduct,
    onOpenAddonAssignmentForEditingProduct,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto p-0">
    <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4">
      <div class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon icon="lucide:package" width="16" height="16" class="text-primary" />
        </div>
        <h3 class="font-bold text-base leading-tight">{isEditing ? "Editar producto" : "Crear producto"}</h3>
      </div>
      <div class="flex items-center gap-2">
        {#if isEditing}
          <button class="btn btn-sm btn-soft btn-info" type="button" onclick={onOpenFlavorAssignmentForEditingProduct}>
            Editar sabores
          </button>
          <button class="btn btn-sm btn-soft btn-secondary" type="button" onclick={onOpenAddonAssignmentForEditingProduct}>
            Editar complementos
          </button>
        {/if}
        <button class="btn btn-ghost btn-sm btn-circle" type="button" onclick={onClose} aria-label="Cerrar">
          <Icon icon="lucide:x" width="16" height="16" />
        </button>
      </div>
    </div>

    <form class="p-5 grid items-start gap-6 md:grid-cols-[1.15fr_0.85fr]" onsubmit={onSubmit}>
      <div class="grid gap-5">
        <div class="grid items-start gap-5 md:grid-cols-2">
          <div class="form-control w-full md:col-span-2">
            <span id="product-name-label" class="label-text mb-1">Nombre</span>
            <input id="product-name" class="input input-bordered w-full" placeholder="Helado de vainilla" bind:value={form.name} required aria-labelledby="product-name-label" />
          </div>

          <div class="form-control w-full">
            <span id="product-price-label" class="label-text mb-1">Precio</span>
            <input id="product-price" class="input input-bordered w-full" placeholder="0.00" type="number" min="0" step="0.01" bind:value={form.price} required aria-labelledby="product-price-label" />
          </div>

          <div class="form-control w-full">
            <span id="product-category-label" class="label-text mb-1">Categoria</span>
            <select id="product-category" class="select select-bordered w-full" bind:value={form.category_id} required aria-labelledby="product-category-label">
              {#if categories.length === 0}
                <option value="" disabled>Sin categorias</option>
              {:else}
                {#each categories as category}
                  <option value={category.id}>{category.name}</option>
                {/each}
              {/if}
            </select>
          </div>

          <div class="form-control w-full md:col-span-2">
            <span class="label-text mb-1">Estado</span>
            <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
              <input id="product-is-available" class="toggle toggle-sm" type="checkbox" bind:checked={form.is_available} aria-labelledby="product-is-available-label" />
              <span id="product-is-available-label" class="label-text">Disponible</span>
            </label>
          </div>

          <div class="form-control w-full md:col-span-2">
            <span class="label-text mb-1">Imagen del producto</span>
            <div class="rounded-lg border border-base-300/70 p-3 space-y-3">
              {#if selectedGalleryImage}
                <div class="flex items-center gap-3 rounded-lg border border-base-300/70 p-2">
                  <img
                    src={selectedGalleryImage.url}
                    alt={selectedGalleryImage.name}
                    class="h-12 w-12 rounded object-cover border border-base-300/70"
                    loading="lazy"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium">{selectedGalleryImage.name}</div>
                  </div>
                </div>
              {:else}
                <p class="text-sm text-base-content/70">No hay imagen seleccionada.</p>
              {/if}

              <div class="flex flex-wrap gap-2">
                <button
                  class="btn btn-outline btn-sm"
                  type="button"
                  onclick={onOpenImageGalleryModal}
                  disabled={busy || galleryBusy || galleryActionBusy}
                >
                  Seleccionar imagen
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  onclick={onClearSelectedImage}
                  disabled={busy || galleryBusy || galleryActionBusy || !form.image_path}
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {isEditing ? "Actualizar" : "Crear"}
          </button>
          <button class="btn btn-ghost" type="button" onclick={onClose}>Cancelar</button>
        </div>
      </div>

      <div class="form-control w-full self-start pt-0">
        <span id="product-description-label" class="label-text mb-1">Descripcion</span>
        <textarea
          id="product-description"
          class="textarea textarea-bordered w-full h-50 resize-none"
          placeholder="Descripcion del producto"
          bind:value={form.description}
          required
          aria-labelledby="product-description-label"
        ></textarea>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>
