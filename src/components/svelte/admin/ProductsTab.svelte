<script lang="ts">
  import type { AdminImage, Category, Product } from "../../../lib/api/admin";
  import { formatCurrency } from "../../../lib/utils/formatters";

  interface Props {
    categories: Category[];
    products: Product[];
    galleryImages: AdminImage[];
    busy: boolean;
    galleryBusy: boolean;
    moduleError: string;
    onCreate: (payload: {
      name: string;
      description: string;
      price: number;
      category_id: string;
      image_path?: string;
      stock_status: Product["stock_status"];
      is_available: boolean;
    }) => void;
    onUpdate: (id: string, payload: {
      name: string;
      description: string;
      price: number;
      category_id: string;
      image_path?: string;
      stock_status: Product["stock_status"];
      is_available: boolean;
    }) => void;
    onDelete: (id: string) => void;
    onReloadGallery: () => void | Promise<void>;
    onUploadGalleryImage: (file: File) => Promise<string | null>;
    onDeleteGalleryImage: (path: string) => Promise<boolean>;
  }

  let {
    categories,
    products,
    galleryImages,
    busy,
    galleryBusy,
    moduleError,
    onCreate,
    onUpdate,
    onDelete,
    onReloadGallery,
    onUploadGalleryImage,
    onDeleteGalleryImage,
  }: Props = $props();
  let productEditorDialog: HTMLDialogElement | null = null;
  let imageGalleryDialog: HTMLDialogElement | null = null;
  let confirmDialog: HTMLDialogElement | null = null;
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let uploadInput: HTMLInputElement | null = null;
  let selectedUploadFile = $state<File | null>(null);
  let galleryActionBusy = $state(false);
  let editingProductId = $state<string | null>(null);

  let productVisibilityFilter = $state<"all" | "active" | "inactive">("all");
  const filteredProducts = $derived(
    productVisibilityFilter === "all"
      ? products
      : products.filter((product) =>
          productVisibilityFilter === "active" ? product.is_available : !product.is_available,
        ),
  );
  const productVisibilityFilterLabel = $derived(
    productVisibilityFilter === "all"
      ? "Todos"
      : productVisibilityFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  let form = $state({
    id: "",
    name: "",
    description: "",
    price: "",
    category_id: "",
    image_path: "",
    stock_status: "in_stock" as "in_stock" | "out_of_stock" | "discontinued",
    is_available: true,
  });

  const isEditing = $derived(!!editingProductId);
  const selectedGalleryImage = $derived(galleryImages.find((image) => image.name === form.image_path) ?? null);

  $effect(() => {
    if (!form.category_id && categories.length > 0) {
      form.category_id = categories[0].id;
    }
  });

  function resetForm() {
    editingProductId = null;
    selectedUploadFile = null;
    form = {
      id: "",
      name: "",
      description: "",
      price: "",
      category_id: categories[0]?.id || "",
      image_path: "",
      stock_status: "in_stock",
      is_available: true,
    };
  }

  function handleUploadSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    selectedUploadFile = input.files?.[0] ?? null;
  }

  async function openImageGalleryModal() {
    await onReloadGallery();
    imageGalleryDialog?.showModal();
  }

  function closeImageGalleryModal() {
    imageGalleryDialog?.close();
  }

  async function uploadSelectedImage() {
    if (!selectedUploadFile) return;
    galleryActionBusy = true;
    try {
      const uploadedPath = await onUploadGalleryImage(selectedUploadFile);
      if (uploadedPath) {
        form.image_path = uploadedPath;
      }
      selectedUploadFile = null;
      if (uploadInput) {
        uploadInput.value = "";
      }
    } finally {
      galleryActionBusy = false;
    }
  }

  function selectGalleryImage(path: string) {
    form.image_path = path;
    closeImageGalleryModal();
  }

  function clearSelectedImage() {
    form.image_path = "";
  }

  async function removeGalleryImage(path: string) {
    if (!window.confirm("Eliminar esta imagen del bucket?")) return;
    galleryActionBusy = true;
    try {
      const deleted = await onDeleteGalleryImage(path);
      if (deleted && form.image_path === path) {
        form.image_path = "";
      }
    } finally {
      galleryActionBusy = false;
    }
  }

  function openCreateProductModal() {
    resetForm();
    productEditorDialog?.showModal();
  }

  function closeProductEditor() {
    productEditorDialog?.close();
    resetForm();
  }

  function editProduct(product: Product) {
    editingProductId = product.id;
    form = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: String(product.price),
      category_id: product.category_id || categories[0]?.id || "",
      image_path: product.image_path || "",
      stock_status: product.stock_status,
      is_available: product.is_available,
    };
    productEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category_id: form.category_id,
      image_path: form.image_path.trim() || undefined,
      stock_status: form.stock_status,
      is_available: form.is_available,
    };

    if (form.id) {
      onUpdate(form.id, payload);
    } else {
      onCreate(payload);
    }

    closeProductEditor();
  }

  function openConfirm(title: string, message: string, action: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmAction = action;
    confirmDialog?.showModal();
  }

  function confirmNow() {
    const action = confirmAction;
    confirmAction = null;
    confirmDialog?.close();
    if (action) action();
  }

  function closeConfirm() {
    confirmAction = null;
    confirmDialog?.close();
  }

  function requestDeleteProduct(product: Product) {
    openConfirm(
      "Eliminar producto",
      `Seguro que deseas eliminar ${product.name}?`,
      () => onDelete(product.id),
    );
  }

  function toggleProductAvailability(product: Product, checked: boolean) {
    const nextAvailability = checked;
    if (nextAvailability === product.is_available) return;

    onUpdate(product.id, {
      name: product.name,
      description: product.description,
      price: product.price,
      category_id: product.category_id || "",
      image_path: product.image_path || undefined,
      stock_status: product.stock_status,
      is_available: nextAvailability,
    });
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="card-title">Gestion de productos</h2>
          <p class="text-sm text-base-content/70">Administra productos, precios y disponibilidad de forma ordenada.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button class="btn btn-primary" type="button" onclick={openCreateProductModal} disabled={busy}>
            Crear producto
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 class="card-title text-base">Listado de productos</h4>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
            <div class="dropdown dropdown-right dropdown-center">
              <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-32 justify-between">
                {productVisibilityFilterLabel}
              </div>
              <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300">
                <li><button type="button" onclick={() => (productVisibilityFilter = "all")}>Todos</button></li>
                <li><button type="button" onclick={() => (productVisibilityFilter = "active")}>Activos</button></li>
                <li><button type="button" onclick={() => (productVisibilityFilter = "inactive")}>Inactivos</button></li>
              </ul>
            </div>
          </div>
          <div class="text-sm text-base-content/70 whitespace-nowrap">{filteredProducts.length} de {products.length} producto(s)</div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
        <table class="table">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Nombre</th>
              <th class="text-center font-bold">Categoria</th>
              <th class="text-center font-bold">Precio</th>
              <th class="text-center font-bold">Stock</th>
              <th class="text-center font-bold">Disponibilidad</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredProducts.length === 0}
              <tr><td colspan="6" class="text-center">No hay productos</td></tr>
            {:else}
              {#each filteredProducts as product}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>
                    <div class="font-medium">{product.name}</div>
                  </td>
                  <td class="text-center align-middle">{product.category_name || "-"}</td>
                  <td class="text-center align-middle">{formatCurrency(product.price)}</td>
                  <td class="text-center align-middle">
                    <span class={`badge ${product.stock_status === "in_stock" ? "badge-success" : product.stock_status === "out_of_stock" ? "badge-warning" : "badge-ghost"}`}>
                      {product.stock_status}
                    </span>
                  </td>
                  <td class="text-center align-middle">
                    <label class="label cursor-pointer justify-center gap-2">
                      <input
                        class="toggle toggle-xs"
                        type="checkbox"
                        checked={product.is_available}
                        onchange={(event) => toggleProductAvailability(product, (event.currentTarget as HTMLInputElement).checked)}
                        disabled={busy}
                      />
                      <span class="label-text text-xs">{product.is_available ? "SI" : "NO"}</span>
                    </label>
                  </td>
                  <td class="text-center align-middle">
                    <div class="flex w-full flex-wrap items-center justify-center gap-2">
                      <button class="btn btn-sm btn-soft btn-accent" onclick={() => editProduct(product)}>Editar</button>
                      <button class="btn btn-sm btn-soft btn-error" onclick={() => requestDeleteProduct(product)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<dialog class="modal" bind:this={productEditorDialog} onclose={resetForm}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar producto" : "Crear producto"}</h3>
    </div>

    <form class="mt-5 grid items-start gap-6 md:grid-cols-[1.15fr_0.85fr]" onsubmit={submit}>
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

          <div class="form-control w-full">
            <span id="product-stock-label" class="label-text mb-1">Stock</span>
            <select id="product-stock" class="select select-bordered w-full" bind:value={form.stock_status} aria-labelledby="product-stock-label">
              <option value="in_stock">in_stock</option>
              <option value="out_of_stock">out_of_stock</option>
              <option value="discontinued">discontinued</option>
            </select>
          </div>

          <div class="form-control w-full">
            <span class="label-text mb-1">Disponibilidad</span>
            <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
              <input id="product-is-available" class="toggle" type="checkbox" bind:checked={form.is_available} aria-labelledby="product-is-available-label" />
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
                  onclick={openImageGalleryModal}
                  disabled={busy || galleryBusy || galleryActionBusy}
                >
                  Seleccionar imagen
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  onclick={clearSelectedImage}
                  disabled={busy || galleryBusy || galleryActionBusy || !form.image_path}
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {isEditing ? "Actualizar" : "Crear"}
          </button>
          <button class="btn btn-ghost" type="button" onclick={closeProductEditor}>Cancelar</button>
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
    <button type="button" onclick={closeProductEditor}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={imageGalleryDialog}>
  <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">Seleccionar imagen del producto</h3>
      <button class="btn btn-sm btn-ghost" type="button" onclick={closeImageGalleryModal}>Cerrar</button>
    </div>

    <div class="mt-4 rounded-lg border border-base-300/70 p-3 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">Galeria de imagenes (menu)</span>
        <button
          class="btn btn-xs btn-outline"
          type="button"
          onclick={onReloadGallery}
          disabled={busy || galleryBusy || galleryActionBusy}
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
          disabled={busy || galleryBusy || galleryActionBusy}
        />
        <button
          class="btn btn-sm btn-primary"
          type="button"
          onclick={uploadSelectedImage}
          disabled={busy || galleryBusy || galleryActionBusy || !selectedUploadFile}
        >
          Subir
        </button>
      </div>
    </div>

    <div class="mt-4">
      {#if galleryImages.length === 0}
        <div class="text-sm text-base-content/70">No hay imagenes en el bucket.</div>
      {:else}
        <ul class="list rounded-box border border-base-300/70 max-h-[50vh] overflow-y-auto">
          {#each galleryImages as image}
            <li class="list-row items-center gap-3">
              <img src={image.url} alt={image.name} class="size-14 rounded-box object-cover" loading="lazy" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{image.name}</div>
              </div>
              <button
                class={`btn btn-xs ${form.image_path === image.name ? "btn-success" : "btn-outline btn-accent"}`}
                type="button"
                onclick={() => selectGalleryImage(image.name)}
                disabled={busy || galleryBusy || galleryActionBusy}
              >
                {form.image_path === image.name ? "Seleccionada" : "Usar"}
              </button>
              <button
                class="btn btn-xs btn-error"
                type="button"
                onclick={() => removeGalleryImage(image.name)}
                disabled={busy || galleryBusy || galleryActionBusy}
              >
                Eliminar
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeImageGalleryModal}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={confirmDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">{confirmTitle || "Confirmar accion"}</h3>
    <p class="py-2 text-sm text-base-content/70">{confirmMessage}</p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeConfirm}>Cancelar</button>
      <button class="btn btn-primary" type="button" onclick={confirmNow} disabled={busy}>Confirmar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="button" onclick={closeConfirm}>close</button></form>
</dialog>
