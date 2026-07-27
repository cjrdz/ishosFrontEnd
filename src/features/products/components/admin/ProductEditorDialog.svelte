<script lang="ts">
  import type { AdminImage, Category } from "@features/admin-management";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";

  interface ProductFormState {
    id: string;
    name: string;
    description: string;
    price: string;
    category_id: string;
    image_path: string;
    is_available: boolean;
    exclude_global_flavors: boolean;
    exclude_global_addons: boolean;
    ball_based: boolean;
    ball_quantity: number | "custom";
    custom_ball_quantity: string;
    allows_mixed_flavors: boolean;
    free_toppings: number | "custom";
    custom_free_toppings: string;
    stock_status: string;
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
  }: Props = $props();

  const ballQuantityOptions = [1, 2, 3];
  const freeToppingsOptions = [1, 2, 3];
  const stockStatusOptions = [
    { value: "auto", label: "Automatico (desde inventario)" },
    { value: "in_stock", label: "En stock" },
    { value: "low_stock", label: "Stock bajo" },
    { value: "out_of_stock", label: "Agotado" },
  ];

  const isCustomBallQuantity = $derived(form.ball_quantity === "custom");
  const effectiveBallQuantity = $derived(
    isCustomBallQuantity
      ? Number(form.custom_ball_quantity) || 0
      : typeof form.ball_quantity === "number"
        ? form.ball_quantity
        : 0,
  );
  const showMixedFlavors = $derived(
    form.ball_based && effectiveBallQuantity > 1,
  );

  const isCustomFreeToppings = $derived(form.free_toppings === "custom");
  const effectiveFreeToppings = $derived(
    isCustomFreeToppings
      ? Number(form.custom_free_toppings) || 0
      : typeof form.free_toppings === "number"
        ? form.free_toppings
        : 1,
  );

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

<AdminModalShell
  bind:dialogRef
  title={isEditing ? "Editar producto" : "Crear producto"}
  icon="lucide:package"
  widthClass="max-w-4xl"
  {onClose}
>
  <form class="grid items-stretch gap-5 md:grid-cols-2" onsubmit={onSubmit}>
    <!-- Left column -->
    <div class="space-y-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-sm">Información básica</legend>
        <div class="space-y-3">
          <div class="form-control">
            <span id="product-name-label" class="label-text text-xs mb-1"
              >Nombre</span
            >
            <input
              id="product-name"
              class="input input-bordered input-sm w-full"
              placeholder="Helado de vainilla"
              bind:value={form.name}
              required
              aria-labelledby="product-name-label"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <span id="product-price-label" class="label-text text-xs mb-1"
                >Precio</span
              >
              <input
                id="product-price"
                class="input input-bordered input-sm w-full"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                bind:value={form.price}
                required
                aria-labelledby="product-price-label"
              />
            </div>

            <div class="form-control">
              <span id="product-category-label" class="label-text text-xs mb-1"
                >Categoria</span
              >
              <select
                id="product-category"
                class="select select-bordered select-sm w-full"
                bind:value={form.category_id}
                required
                aria-labelledby="product-category-label"
              >
                {#if categories.length === 0}
                  <option value="" disabled>Sin categorias</option>
                {:else}
                  {#each categories as category}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                {/if}
              </select>
            </div>
          </div>

          <div class="form-control">
            <span class="label-text text-xs mb-1">Estado</span>
            <label
              class="label h-9 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3"
            >
              <input
                id="product-is-available"
                class="toggle toggle-sm"
                type="checkbox"
                bind:checked={form.is_available}
                aria-labelledby="product-is-available-label"
              />
              <span id="product-is-available-label" class="label-text text-sm"
                >Disponible</span
              >
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend text-sm">Asignación global</legend>
        <div class="space-y-2">
          <label class="label cursor-pointer justify-start gap-2 p-0">
            <input
              class="checkbox checkbox-sm"
              type="checkbox"
              bind:checked={form.exclude_global_flavors}
            />
            <span class="label-text text-sm"
              >Excluir este producto de sabores globales</span
            >
          </label>
          <label class="label cursor-pointer justify-start gap-2 p-0">
            <input
              class="checkbox checkbox-sm"
              type="checkbox"
              bind:checked={form.exclude_global_addons}
            />
            <span class="label-text text-sm"
              >Excluir este producto de complementos globales</span
            >
          </label>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend text-sm"
          >Configuración de inventario</legend
        >
        <div class="space-y-3">
          <label class="label cursor-pointer justify-start gap-2 p-0">
            <input
              class="toggle toggle-sm"
              type="checkbox"
              bind:checked={form.ball_based}
            />
            <span class="label-text text-sm">Basado en bolas</span>
          </label>

          {#if form.ball_based}
            <div class="space-y-2">
              <span class="label-text text-xs">Cantidad de bolas</span>
              <div class="join">
                {#each ballQuantityOptions as qty (qty)}
                  <input
                    class="join-item btn btn-sm"
                    type="radio"
                    name="ball_quantity"
                    value={qty}
                    checked={form.ball_quantity === qty}
                    onchange={() => (form.ball_quantity = qty)}
                    aria-label={String(qty)}
                  />
                {/each}
                <input
                  class="join-item btn btn-sm"
                  type="radio"
                  name="ball_quantity"
                  value="custom"
                  checked={isCustomBallQuantity}
                  onchange={() => (form.ball_quantity = "custom")}
                  aria-label="Custom"
                />
              </div>
              {#if isCustomBallQuantity}
                <input
                  type="number"
                  class="input input-bordered input-sm w-full"
                  placeholder="Ej: 5"
                  min="1"
                  bind:value={form.custom_ball_quantity}
                />
              {/if}
            </div>

            {#if showMixedFlavors}
              <label class="label cursor-pointer justify-start gap-2 p-0">
                <input
                  class="toggle toggle-sm"
                  type="checkbox"
                  bind:checked={form.allows_mixed_flavors}
                />
                <span class="label-text text-sm">Permitir sabores mixtos</span>
              </label>
            {/if}

            <div class="space-y-2">
              <span class="label-text text-xs"
                >Toppings gratuitos incluidos</span
              >
              <div class="join">
                {#each freeToppingsOptions as qty (qty)}
                  <input
                    class="join-item btn btn-sm"
                    type="radio"
                    name="free_toppings"
                    value={qty}
                    checked={form.free_toppings === qty}
                    onchange={() => (form.free_toppings = qty)}
                    aria-label={String(qty)}
                  />
                {/each}
                <input
                  class="join-item btn btn-sm"
                  type="radio"
                  name="free_toppings"
                  value="custom"
                  checked={isCustomFreeToppings}
                  onchange={() => (form.free_toppings = "custom")}
                  aria-label="Custom"
                />
              </div>
              {#if isCustomFreeToppings}
                <input
                  type="number"
                  class="input input-bordered input-sm w-full"
                  placeholder="Ej: 5"
                  min="0"
                  bind:value={form.custom_free_toppings}
                />
              {/if}
            </div>
          {/if}

          <div class="form-control w-full">
            <span class="label-text text-xs mb-1">Estado de stock</span>
            <select
              class="select select-bordered select-sm w-full"
              bind:value={form.stock_status}
            >
              {#each stockStatusOptions as opt (opt.value)}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>
      </fieldset>
    </div>

    <!-- Right column -->
    <div class="flex flex-col gap-4 h-full">
      <fieldset class="fieldset flex-1 flex flex-col">
        <legend class="fieldset-legend text-sm">Descripción</legend>
        <div class="form-control flex-1 flex flex-col">
          <textarea
            id="product-description"
            class="textarea textarea-bordered w-full flex-1 min-h-[180px] resize-none"
            placeholder="Descripcion del producto"
            bind:value={form.description}
            required
            aria-labelledby="product-description-label"
          ></textarea>
          <span id="product-description-label" class="sr-only">Descripcion</span
          >
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend text-sm">Imagen del producto</legend>
        <div class="space-y-3">
          {#if selectedGalleryImage}
            <div
              class="flex items-center gap-3 rounded-lg border border-base-300/70 p-2"
            >
              <img
                src={selectedGalleryImage.url}
                alt={selectedGalleryImage.name}
                class="h-14 w-14 rounded-lg object-cover border border-base-300/70"
                loading="lazy"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">
                  {selectedGalleryImage.name}
                </div>
              </div>
            </div>
          {:else}
            <div
              class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-base-300/70 p-4 text-center"
            >
              <span class="text-sm text-base-content/60">
                No hay imagen seleccionada.
              </span>
            </div>
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
              disabled={busy ||
                galleryBusy ||
                galleryActionBusy ||
                !form.image_path}
            >
              Quitar
            </button>
          </div>
        </div>
      </fieldset>
    </div>

    <!-- Actions -->
    <div class="md:col-span-2 border-t border-base-200 pt-4">
      <AdminFormActions
        submitLabel={isEditing ? "Actualizar" : "Crear"}
        onCancel={onClose}
        {busy}
      />
    </div>
  </form>
</AdminModalShell>
