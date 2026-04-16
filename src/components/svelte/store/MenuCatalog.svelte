<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import {
    listPublicCategories,
    listPublicProducts,
    type PublicCategory,
    type PublicProduct,
  } from "../../../lib/api/store";
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
    if (
      url.startsWith("/") ||
      url.startsWith("http://") ||
      url.startsWith("https://")
    ) {
      return url;
    }
    return undefined;
  }

  function hasSeasonalFlavors(product: PublicProduct): boolean {
    return (product.flavors ?? []).some(
      (flavor) => flavor.is_active && flavor.is_seasonal,
    );
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

<div class="space-y-8 pb-16">
  <section class="text-center px-4 pt-6 md:pt-10">
    <div class="mx-auto max-w-2xl mb-2">
      <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
        <span
          class="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary inline-block"
        >
          Nuestro Menú
        </span>
      </h1>
    </div>
  </section>

  <section id="menu" class="max-w-7xl mx-auto px-4 space-y-6 md:space-y-8">
    <div
      class="flex justify-start md:justify-center overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4 md:mx-0"
    >
      <div
        role="tablist"
        class="tabs tabs-box bg-base-100/50 backdrop-blur-sm border border-base-200/50 shadow-sm p-1.5 rounded-2xl flex-nowrap min-w-min"
      >
        <input
          type="radio"
          name={tabsGroupName}
          class="tab tab-md md:tab-lg font-medium whitespace-nowrap rounded-xl"
          aria-label="Todos"
          checked={activeCategory === "all"}
          onchange={() => {
            activeCategory = "all";
          }}
        />
        {#each categories as category (category.id)}
          <input
            type="radio"
            name={tabsGroupName}
            class="tab tab-md md:tab-lg font-medium whitespace-nowrap rounded-xl"
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
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 items-start pt-4"
      >
        {#each catalogSkeletonCards as cardIndex (cardIndex)}
          <article
            class="card bg-base-100 w-full shadow-md border border-base-200/50 overflow-hidden h-full rounded-2xl"
            aria-hidden="true"
          >
            <div class="skeleton w-full aspect-4/3"></div>
            <div class="card-body p-5 md:p-6 space-y-4">
              <div class="skeleton h-6 w-3/4"></div>
              <div class="space-y-2">
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-5/6"></div>
              </div>
              <div
                class="card-actions justify-between items-center mt-auto pt-4"
              >
                <div class="skeleton h-8 w-20"></div>
                <div class="skeleton h-8 w-28 rounded-lg"></div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else if loadingError}
      <div class="alert alert-error max-w-xl mx-auto rounded-xl shadow-sm mt-8">
        {loadingError}
      </div>
    {:else if visibleProducts.length === 0}
      <div
        class="alert max-w-xl mx-auto rounded-xl shadow-sm mt-8 text-center bg-base-100 border border-base-200"
      >
        <span class="w-full font-medium text-base-content/80"
          >No hay productos disponibles en esta categoría.</span
        >
      </div>
    {:else}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 items-start pt-4"
      >
        {#each visibleProducts as product (product.id)}
          <div
            class="h-full group"
            role="button"
            tabindex="0"
            onclick={() => openProductModal(product)}
            onkeydown={(event) => handleCardKeydown(event, product)}
          >
            <div
              class="card bg-base-100 w-full border border-base-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden h-full rounded-2xl flex flex-col relative cursor-pointer"
            >
              {#if getSafeImageUrl(product.image_url)}
                <figure
                  class="bg-base-200/50 w-full aspect-4/3 overflow-hidden relative"
                >
                  <img
                    src={getSafeImageUrl(product.image_url)}
                    alt={product.name}
                    class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div
                    class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  ></div>
                </figure>
              {/if}
              <div class="card-body p-5 md:p-6 flex flex-col flex-1">
                <h3 class="card-title text-xl font-bold leading-tight mb-1">
                  {product.name}
                </h3>
                <p
                  class="text-sm text-base-content/70 line-clamp-2 leading-relaxed mb-4"
                >
                  {product.description}
                </p>

                {#if hasSeasonalFlavors(product)}
                  <div class="mb-4 mt-auto">
                    <span
                      class="badge badge-warning badge-outline text-xs sm:text-sm font-medium"
                      >Sabores de temporada</span
                    >
                  </div>
                {:else}
                  <div class="mt-auto"></div>
                {/if}

                <div
                  class="card-actions justify-between items-center pt-4 border-t border-base-200/50 mt-1"
                >
                  <span class="text-2xl font-bold text-primary"
                    >{formatCurrency(product.price)}</span
                  >
                  <button
                    type="button"
                    class="btn btn-primary btn-sm rounded-full px-5 shadow-sm hover:shadow-md transition-all"
                    onclick={(event) => {
                      event.stopPropagation();
                      openProductModal(product);
                    }}
                  >
                    Seleccionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<!-- Product Details Modal -->
<dialog class="modal" bind:this={modalRef}>
  <div
    class="modal-box w-[calc(100%-1rem)] sm:w-[min(96vw,980px)] max-w-5xl p-0 relative overflow-hidden max-h-[92dvh] rounded-3xl shadow-2xl"
  >
    <button
      type="button"
      class="btn btn-sm sm:btn-md btn-circle btn-ghost bg-base-200/20 hover:bg-base-200 backdrop-blur-md absolute right-3 top-3 sm:right-4 sm:top-4 z-99"
      aria-label="Cerrar"
      onclick={() => modalRef?.close()}
    >
      <Icon icon="lucide:x" class="size-5" aria-hidden="true" />
    </button>
    {#if selectedProduct}
      <div class="grid gap-0 md:grid-cols-[1fr_1fr] h-full bg-base-100">
        <div
          class="bg-base-200/30 p-6 md:p-10 flex flex-col items-center justify-center relative min-h-[300px]"
        >
          {#if getSafeImageUrl(selectedProduct.image_url)}
            <div
              class="flip-3d-card w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px] mx-auto hover:scale-[1.02] transition-transform duration-300"
              data-flipped={showImageDetails ? "true" : "false"}
            >
              <button
                type="button"
                class="flip-3d-toggle w-full cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary/20 rounded-3xl"
                aria-label={showImageDetails
                  ? "Ver imagen del producto"
                  : "Ver descripcion del producto"}
                onclick={() => {
                  showImageDetails = !showImageDetails;
                }}
              >
                <div class="flip-3d-inner aspect-4/5 rounded-3xl">
                  <figure
                    class="flip-3d-face overflow-hidden rounded-3xl bg-base-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]"
                  >
                    <img
                      src={getSafeImageUrl(selectedProduct.image_url)}
                      alt={selectedProduct.name}
                      class="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  </figure>

                  <div
                    class="flip-3d-face flip-3d-back rounded-3xl overflow-hidden border border-base-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] bg-base-100"
                  >
                    <img
                      src={getSafeImageUrl(selectedProduct.image_url)}
                      alt={selectedProduct.name}
                      class="absolute inset-0 w-full h-full object-cover object-center opacity-[0.12] blur-sm scale-110"
                      loading="lazy"
                    />
                    <div
                      class="absolute inset-0 bg-base-100/60 backdrop-blur-sm"
                    ></div>
                    <div
                      class="relative z-10 h-full w-full p-6 sm:p-8 flex items-center justify-center text-center"
                    >
                      <div class="space-y-4">
                        <h4
                          class="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-base-content to-base-content/70"
                        >
                          {selectedProduct.name}
                        </h4>
                        <p
                          class="text-base sm:text-lg text-base-content/80 font-medium leading-relaxed"
                        >
                          {selectedProduct.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
            <div
              class="mt-6 flex items-center gap-2 text-base-content/50 bg-base-100/50 backdrop-blur-sm py-1.5 px-4 rounded-full text-sm font-medium"
            >
              <Icon icon="lucide:info" class="size-4" />
              <span>Toca la imagen para detalles</span>
            </div>
          {:else}
            <div
              class="w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px] aspect-4/5 rounded-3xl bg-base-200 border border-base-300 grid place-items-center text-base-content/50 shadow-inner"
            >
              <div class="flex flex-col items-center gap-2">
                <Icon icon="lucide:image-off" class="size-8 opacity-50" />
                <span class="font-medium">Sin imagen</span>
              </div>
            </div>
          {/if}
        </div>

        <div
          class="p-6 md:p-10 lg:p-12 space-y-6 md:space-y-8 overflow-y-auto max-h-[92dvh] flex flex-col"
        >
          <div class="space-y-3 pr-12">
            <h3
              class="text-3xl md:text-4xl font-bold leading-tight bg-clip-text text-transparent bg-linear-to-r from-base-content to-base-content/80"
            >
              {selectedProduct.name}
            </h3>
            <p class="text-2xl md:text-3xl font-extrabold text-primary">
              {formatCurrency(modalDisplayPrice)}
            </p>
            <p
              class="text-sm font-medium text-base-content/60 inline-flex items-center gap-1.5 mt-2 bg-base-200/50 py-1.5 px-3 rounded-lg"
            >
              <Icon icon="lucide:sliders-horizontal" class="size-4" />
              Personaliza sabores en el carrito
            </p>
          </div>

          <div
            class="form-control bg-base-200/30 p-5 rounded-2xl border border-base-200/50 space-y-3 mt-auto mb-2"
          >
            <span
              class="label-text font-bold text-base-content/80 uppercase tracking-wider text-xs px-1"
              >Cantidad</span
            >
            <div
              class="grid grid-cols-3 w-full bg-base-100 rounded-xl overflow-hidden shadow-sm border border-base-200/80"
            >
              <button
                class="btn btn-ghost hover:bg-base-200 rounded-none h-14"
                type="button"
                onclick={decreaseModalQty}
                aria-label="Reducir cantidad"
              >
                <Icon icon="lucide:minus" class="size-5" />
              </button>
              <div
                class="flex items-center justify-center font-bold text-xl h-14 border-x border-base-200/50 bg-base-50"
              >
                {normalizeQty(modalQty)}
              </div>
              <button
                class="btn btn-ghost hover:bg-base-200 rounded-none h-14"
                type="button"
                onclick={increaseModalQty}
                aria-label="Aumentar cantidad"
              >
                <Icon icon="lucide:plus" class="size-5" />
              </button>
            </div>
          </div>

          <div class="grid gap-3 pt-2">
            <button
              type="button"
              class="btn btn-primary btn-lg rounded-xl font-bold shadow-md hover:shadow-lg transition-all w-full leading-none"
              onclick={() => addSelectedToCart(false)}
            >
              <span class="mr-2">Agregar al pedido</span>
              <Icon icon="lucide:plus-circle" class="size-5" />
            </button>
            <button
              type="button"
              class="btn btn-outline btn-lg rounded-xl font-bold hover:bg-base-200 hover:text-base-content w-full leading-none"
              onclick={() => addSelectedToCart(true)}
            >
              <Icon
                icon="lucide:shopping-bag"
                class="size-5 mr-2"
                aria-hidden="true"
              />
              Ir al Carrito
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop bg-base-300/60 backdrop-blur-sm">
    <button>Cerrar</button>
  </form>
</dialog>
