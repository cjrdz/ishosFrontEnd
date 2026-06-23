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
  widthClass="max-w-5xl"
  {onClose}
>
  <form
    class="grid items-start gap-6 md:grid-cols-[1.15fr_0.85fr]"
    onsubmit={onSubmit}
  >
    <div class="grid gap-5">
      <div class="grid items-start gap-4 md:grid-cols-2">
        <div class="form-control md:col-span-2">
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

        <div class="form-control md:col-span-2">
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

        <div class="form-control md:col-span-2">
          <span class="label-text text-xs mb-1">Asignacion global</span>
          <div class="space-y-2 rounded-lg border border-base-300/70 p-3">
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
        </div>

        <div class="form-control md:col-span-2">
          <span class="label-text text-xs mb-1"
            >Configuracion de Inventario</span
          >
          <div class="space-y-3 rounded-lg border border-base-300/70 p-3">
            <!-- Ball Based Toggle -->
            <label class="label cursor-pointer justify-start gap-2 p-0">
              <input
                class="toggle toggle-sm"
                type="checkbox"
                bind:checked={form.ball_based}
              />
              <span class="label-text text-sm">Basado en bolas</span>
            </label>

            {#if form.ball_based}
              <!-- Ball Quantity -->
              <div class="space-y-2">
                <span class="text-sm text-base-content/70"
                  >Cantidad de bolas</span
                >
                <div class="flex flex-wrap gap-2">
                  {#each ballQuantityOptions as qty (qty)}
                    <label
                      class="label cursor-pointer gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 hover:bg-base-200/50"
                    >
                      <input
                        type="radio"
                        class="radio radio-sm"
                        name="ball_quantity"
                        value={qty}
                        checked={form.ball_quantity === qty}
                        onchange={() => (form.ball_quantity = qty)}
                      />
                      <span class="label-text">{qty}</span>
                    </label>
                  {/each}
                  <label
                    class="label cursor-pointer gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 hover:bg-base-200/50"
                  >
                    <input
                      type="radio"
                      class="radio radio-sm"
                      name="ball_quantity"
                      value="custom"
                      checked={isCustomBallQuantity}
                      onchange={() => (form.ball_quantity = "custom")}
                    />
                    <span class="label-text">Custom</span>
                  </label>
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

              <!-- Mixed Flavors -->
              {#if showMixedFlavors}
                <label class="label cursor-pointer justify-start gap-2 p-0">
                  <input
                    class="toggle toggle-sm"
                    type="checkbox"
                    bind:checked={form.allows_mixed_flavors}
                  />
                  <span class="label-text text-sm">Permitir sabores mixtos</span
                  >
                </label>
              {/if}
            {/if}

            <!-- Stock Status -->
            <div class="form-control w-full">
              <span class="label-text mb-1 text-xs">Estado de stock</span>
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
        </div>

        <div class="form-control md:col-span-2">
          <span class="label-text text-xs mb-1">Imagen del producto</span>
          <div class="rounded-lg border border-base-300/70 p-3 space-y-3">
            {#if selectedGalleryImage}
              <div
                class="flex items-center gap-3 rounded-lg border border-base-300/70 p-2"
              >
                <img
                  src={selectedGalleryImage.url}
                  alt={selectedGalleryImage.name}
                  class="h-12 w-12 rounded object-cover border border-base-300/70"
                  loading="lazy"
                />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">
                    {selectedGalleryImage.name}
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-sm text-base-content/70">
                No hay imagen seleccionada.
              </p>
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
        </div>
      </div>

      <AdminFormActions
        submitLabel={isEditing ? "Actualizar" : "Crear"}
        onCancel={onClose}
        {busy}
      />
    </div>

    <div class="form-control self-start pt-0">
      <span id="product-description-label" class="label-text text-xs mb-1"
        >Descripcion</span
      >
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
</AdminModalShell>
