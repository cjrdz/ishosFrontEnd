<script lang="ts">
  import { onMount } from "svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { listPublicCategories, listPublicProducts, type PublicCategory, type PublicProduct } from "../../../lib/api/store";
  import { addCartItem } from "../../../lib/storefront/cart";

  let loading = $state(true);
  let loadingError = $state("");
  let categories = $state<PublicCategory[]>([]);
  let products = $state<PublicProduct[]>([]);
  let activeCategory = $state<string>("all");

  let selectedProduct = $state<PublicProduct | null>(null);
  let modalQty = $state(1);
  let modalNotes = $state("");
  let modalRef = $state<HTMLDialogElement | null>(null);
  const tabsGroupName = "store_menu_tabs";
  const MAX_NOTES_LENGTH = 300;

  const visibleProducts = $derived(
    activeCategory === "all"
      ? products
      : products.filter((product) => product.category_id === activeCategory),
  );

  onMount(() => {
    void loadStoreData();
  });

  async function loadStoreData() {
    loading = true;
    loadingError = "";

    try {
      const [allCategories, allProducts] = await Promise.all([
        listPublicCategories(),
        listPublicProducts(),
      ]);

      categories = allCategories
        .filter((category) => category.is_active)
        .sort((left, right) => left.display_order - right.display_order);
      products = allProducts.filter(
        (product) => product.is_available && product.stock_status === "in_stock",
      );
    } catch (error) {
      loadingError =
        error instanceof Error
          ? error.message
          : "No se pudo cargar el menú en este momento.";
    } finally {
      loading = false;
    }
  }

  function openProductModal(product: PublicProduct) {
    selectedProduct = product;
    modalQty = 1;
    modalNotes = "";
    modalRef?.showModal();
  }

  function handleCardKeydown(event: KeyboardEvent, product: PublicProduct) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductModal(product);
    }
  }

  function normalizeQty(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
  }

  function getSafeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return undefined;
  }

  function addSelectedToCart(goCheckout = false) {
    if (!selectedProduct) return;

    const safeQty = normalizeQty(modalQty);
    const notes = modalNotes.trim().slice(0, MAX_NOTES_LENGTH) || undefined;

    modalQty = safeQty;

    addCartItem({
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      image_url: getSafeImageUrl(selectedProduct.image_url),
      unit_price: selectedProduct.price,
      quantity: safeQty,
      notes,
    });

    modalRef?.close();

    if (goCheckout) {
      window.location.href = "/order/cart#checkout";
    }
  }
</script>

<div class="space-y-8">
  <section class="mb-8 text-center">
    <div class="mx-auto max-w-2xl">
      <h1 class="text-4xl font-bold mb-4">Nuestro Menú</h1>
      <p class="text-lg text-base-content/70">Helados artesanales hechos con amor en El Salvador</p>
    </div>
  </section>

  <section id="menu" class="space-y-4">
    <div class="flex justify-center mb-8">
      <div role="tablist" class="tabs tabs-box bg-base-100 w-fit">
        <input
          type="radio"
          name={tabsGroupName}
          class="tab tab-lg"
          aria-label="Todo"
          checked={activeCategory === "all"}
          onchange={() => {
            activeCategory = "all";
          }}
        />
        {#each categories as category (category.id)}
          <input
            type="radio"
            name={tabsGroupName}
            class="tab tab-lg"
            aria-label={category.name}
            checked={activeCategory === category.id}
            onchange={() => {
              activeCategory = category.id;
            }}
          />
        {/each}
      </div>
    </div>

    {#if loading}
      <div class="skeleton h-48 w-full rounded-xl"></div>
    {:else if loadingError}
      <div class="alert alert-error">{loadingError}</div>
    {:else if visibleProducts.length === 0}
      <div class="alert">No hay productos disponibles en esta categoría.</div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
        {#each visibleProducts as product (product.id)}
          <div
            class="hover-3d h-full"
            role="button"
            tabindex="0"
            onclick={() => openProductModal(product)}
            onkeydown={(event) => handleCardKeydown(event, product)}
          >
            <div class="card card-sm bg-base-200 w-full max-w-64 mx-auto shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden text-left h-full">
              {#if getSafeImageUrl(product.image_url)}
                <figure class="bg-base-100 w-full aspect-3/4 overflow-hidden">
                  <img
                    src={getSafeImageUrl(product.image_url)}
                    alt={product.name}
                    class="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                </figure>
              {/if}
              <div class="card-body p-4">
                <h3 class="card-title">{product.name}</h3>
                <p class="text-sm text-base-content/70">{product.description}</p>
                <div class="card-actions justify-between items-center mt-2">
                  <span class="text-2xl font-bold text-primary">{formatCurrency(product.price)}</span>
                  <button type="button" class="btn btn-primary btn-sm" onclick={(event) => { event.stopPropagation(); openProductModal(product); }}>
                    Seleccionar
                  </button>
                </div>
              </div>
            </div>

            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<dialog class="modal" bind:this={modalRef}>
  <div class="modal-box max-w-3xl p-0">
    {#if selectedProduct}
      <div class="grid gap-0 md:grid-cols-2">
        <div class="bg-base-200 p-5 md:p-6 flex items-center justify-center">
          {#if getSafeImageUrl(selectedProduct.image_url)}
            <div class="hover-3d w-full max-w-sm rounded-2xl">
              <figure class="w-full aspect-4/5 overflow-hidden rounded-2xl bg-base-100">
                <img
                  src={getSafeImageUrl(selectedProduct.image_url)}
                  alt={selectedProduct.name}
                  class="w-full h-full object-cover object-center"
                  loading="lazy"
                />
              </figure>

              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          {:else}
            <div class="w-full max-w-sm aspect-4/5 rounded-2xl bg-base-100 grid place-items-center text-base-content/50">
              Sin imagen disponible
            </div>
          {/if}
        </div>

        <div class="p-5 md:p-6 space-y-4">
          <div class="space-y-2">
            <h3 class="text-2xl font-bold leading-tight">{selectedProduct.name}</h3>
            <p class="text-sm text-base-content/70">{selectedProduct.description}</p>
            <p class="text-xl font-semibold text-primary">{formatCurrency(selectedProduct.price)}</p>
          </div>

          <label class="form-control">
            <span class="label-text font-medium">Cantidad</span>
            <input
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="input input-bordered w-full"
              bind:value={modalQty}
              onchange={() => {
                modalQty = normalizeQty(modalQty);
              }}
            />
          </label>

          <label class="form-control">
            <span class="label-text font-medium">Notas del producto (opcional)</span>
            <textarea class="textarea textarea-bordered w-full" rows="3" placeholder="Ej: sin topping, extra servilletas" bind:value={modalNotes}></textarea>
          </label>

          <div class="rounded-lg bg-base-200 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-base-content/70">Subtotal</span>
            <span class="font-semibold text-lg text-primary">{formatCurrency(selectedProduct.price * normalizeQty(modalQty))}</span>
          </div>

          <div class="flex flex-col sm:flex-row gap-2 pt-1">
            <button type="button" class="btn btn-primary flex-1" onclick={() => addSelectedToCart(false)}>Agregar al carrito</button>
            <button type="button" class="btn btn-outline sm:min-w-40" onclick={() => addSelectedToCart(true)}>Ir a checkout</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>Cerrar</button>
  </form>
</dialog>
