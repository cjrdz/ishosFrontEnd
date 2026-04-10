<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { listPublicCategories, listPublicProducts, type PublicCategory, type PublicProduct } from "../../../lib/api/store";
  import { addCartItem } from "../../../lib/store/cart";

  let loading = $state(true);
  let loadingError = $state("");
  let categories = $state<PublicCategory[]>([]);
  let products = $state<PublicProduct[]>([]);
  let activeCategory = $state<string>("all");

  let selectedProduct = $state<PublicProduct | null>(null);
  let modalQty = $state(1);
  let showImageDetails = $state(false);
  let modalRef = $state<HTMLDialogElement | null>(null);
  const tabsGroupName = "store_menu_tabs";
  const catalogSkeletonCards = Array.from({ length: 10 }, (_, index) => index);

  const visibleProducts = $derived(
    activeCategory === "all"
      ? products
      : products.filter((product) => product.category_id === activeCategory),
  );
  const modalDisplayPrice = $derived(
    selectedProduct ? selectedProduct.price * normalizeQty(modalQty) : 0,
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
      products = allProducts.filter((product) => product.is_available);
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
    showImageDetails = false;
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

  function increaseModalQty() {
    modalQty = normalizeQty(modalQty) + 1;
  }

  function decreaseModalQty() {
    modalQty = Math.max(1, normalizeQty(modalQty) - 1);
  }

  function getSafeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return undefined;
  }

  function hasSeasonalFlavors(product: PublicProduct): boolean {
    return (product.flavors ?? []).some((flavor) => flavor.is_active && flavor.is_seasonal);
  }

  function addSelectedToCart(goCheckout = false) {
    if (!selectedProduct) return;

    const safeQty = normalizeQty(modalQty);

    modalQty = safeQty;

    addCartItem({
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      image_url: getSafeImageUrl(selectedProduct.image_url),
      unit_price: selectedProduct.price,
      quantity: safeQty,
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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
        {#each catalogSkeletonCards as cardIndex (cardIndex)}
          <article class="card card-sm bg-base-200 w-full max-w-64 mx-auto shadow-md overflow-hidden text-left h-full" aria-hidden="true">
            <div class="skeleton w-full aspect-3/4"></div>
            <div class="card-body p-4 space-y-3">
              <div class="skeleton h-5 w-3/4"></div>
              <div class="space-y-2">
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-5/6"></div>
              </div>
              <div class="card-actions justify-between items-center mt-2">
                <div class="skeleton h-8 w-20"></div>
                <div class="skeleton h-8 w-28 rounded-lg"></div>
              </div>
            </div>
          </article>
        {/each}
      </div>
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
                {#if hasSeasonalFlavors(product)}
                  <div class="badge badge-warning badge-outline">Sabores de temporada</div>
                {/if}
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
  <div class="modal-box w-[calc(100%-0.75rem)] sm:w-[min(96vw,980px)] max-w-6xl p-0 relative overflow-hidden max-h-[92dvh]">
    <button
      type="button"
      class="btn btn-md btn-circle btn-primary text-primary-content shadow-md absolute right-2 top-2 sm:right-3 sm:top-3 z-10"
      aria-label="Cerrar"
      onclick={() => modalRef?.close()}
    >
      X
    </button>
    {#if selectedProduct}
      <div class="grid gap-0 md:grid-cols-[1.15fr_1fr] h-full">
        <div class="bg-base-200 p-3 sm:p-5 md:p-8 flex flex-col items-center justify-center gap-3">
          {#if getSafeImageUrl(selectedProduct.image_url)}
            <div class="flip-3d-card w-full max-w-[280px] sm:max-w-[340px] md:max-w-[420px]" data-flipped={showImageDetails ? "true" : "false"}>
              <button
                type="button"
                class="flip-3d-toggle"
                aria-label={showImageDetails ? "Ver imagen del producto" : "Ver descripcion del producto"}
                onclick={() => {
                  showImageDetails = !showImageDetails;
                }}
              >
                <div class="flip-3d-inner aspect-[4/5]">
                  <figure class="flip-3d-face overflow-hidden rounded-2xl bg-base-100 shadow-lg">
                    <img
                      src={getSafeImageUrl(selectedProduct.image_url)}
                      alt={selectedProduct.name}
                      class="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  </figure>

                  <div class="flip-3d-face flip-3d-back rounded-2xl overflow-hidden border border-base-300/60 shadow-lg">
                    <img
                      src={getSafeImageUrl(selectedProduct.image_url)}
                      alt={selectedProduct.name}
                      class="absolute inset-0 w-full h-full object-cover object-center opacity-55"
                      loading="lazy"
                    />
                    <div class="absolute inset-0 bg-base-100/25"></div>
                    <div class="relative z-10 h-full w-full p-5 flex items-center justify-center text-center">
                      <div class="space-y-3 rounded-2xl bg-base-100/55 backdrop-blur-md border border-base-content/10 p-4 sm:p-5">
                        <h4 class="text-xl font-bold">{selectedProduct.name}</h4>
                        <p class="text-sm text-base-content/75">{selectedProduct.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
            <p class="text-xs text-base-content/60">Toca la tarjeta para ver descripcion</p>
          {:else}
            <div class="w-full max-w-[280px] sm:max-w-[340px] md:max-w-[420px] aspect-[4/5] rounded-2xl bg-base-100 grid place-items-center text-base-content/50">
              Sin imagen disponible
            </div>
          {/if}
        </div>

        <div class="p-4 sm:p-5 md:p-7 space-y-4 sm:space-y-5 overflow-y-auto max-h-[92dvh]">
          <div class="space-y-2 sm:space-y-3 pr-8 sm:pr-10">
            <h3 class="text-2xl font-bold leading-tight">{selectedProduct.name}</h3>
            <p class="text-xl font-semibold text-primary">{formatCurrency(modalDisplayPrice)}</p>
            <p class="text-xs text-base-content/60">Personaliza sabores y extras en el carrito.</p>
          </div>

          <div class="form-control space-y-1">
            <span class="label-text font-medium">Cantidad</span>
            <div class="join w-full">
              <button class="btn btn-md join-item" type="button" onclick={decreaseModalQty} aria-label="Reducir cantidad">-</button>
              <span class="btn btn-md join-item no-animation flex-1 text-base">{normalizeQty(modalQty)}</span>
              <button class="btn btn-md join-item" type="button" onclick={increaseModalQty} aria-label="Aumentar cantidad">+</button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" class="btn btn-primary" onclick={() => addSelectedToCart(false)}>Agregar</button>
            <button type="button" class="btn btn-outline gap-2" onclick={() => addSelectedToCart(true)}>
              <Icon icon="lucide:shopping-cart" class="size-4" aria-hidden="true" />
              Pagar
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>Cerrar</button>
  </form>
</dialog>
