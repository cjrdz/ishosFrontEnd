<script lang="ts">
  import { onMount, tick } from "svelte";
  import { animate } from "motion";
  import Icon from "../shared/AppIcon.svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import {
    listPublicCategories,
    listPublicProducts,
    fetchStoreSettings,
    type PublicCategory,
    type PublicProduct,
    type StoreOfferItem,
  } from "../../../lib/api/store";
  import { addCartItem } from "../../../lib/store/cart";

  let loading = $state(true);
  let loadingError = $state("");
  let categories = $state<PublicCategory[]>([]);
  let products = $state<PublicProduct[]>([]);
  let activeCategory = $state<string>("all");
  let displayedCategory = $state<string>("all");
  let ordersEnabled = $state(true);
  let offers = $state<StoreOfferItem[]>([]);
  let isCategoryTransitioning = $state(false);
  let pendingCategory = $state<string | null>(null);
  let catalogGridRef = $state<HTMLElement | null>(null);
  let tabsListRef = $state<HTMLElement | null>(null);
  let activeTabBubbleRef = $state<HTMLElement | null>(null);
  let mobileTabsMeasureRef = $state<HTMLElement | null>(null);
  let mobileCategoryDetailsRef = $state<HTMLDetailsElement | null>(null);
  let mobileMenuPanelRef = $state<HTMLElement | null>(null);
  let useMobileDropdown = $state(false);
  let isMobileCategoryMenuOpen = $state(false);

  let selectedProduct = $state<PublicProduct | null>(null);
  let modalQty = $state(1);
  let showImageDetails = $state(false);
  let modalRef = $state<HTMLDialogElement | null>(null);
  const catalogSkeletonCards = Array.from({ length: 10 }, (_, index) => index);
  const categoryTabs = $derived([
    { id: "all", label: "Todos" },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
    })),
  ]);
  const activeCategoryLabel = $derived(
    categoryTabs.find((tab) => tab.id === activeCategory)?.label ??
      "Categorias",
  );

  const visibleProducts = $derived(
    displayedCategory === "all"
      ? products
      : products.filter((product) => product.category_id === displayedCategory),
  );
  const modalDisplayPrice = $derived(
    selectedProduct ? selectedProduct.price * normalizeQty(modalQty) : 0,
  );

  onMount(() => {
    void loadStoreData();

    const handleWindowResize = () => {
      evaluateCategoryLayoutMode();
      moveActiveTabBubble(true);
    };

    window.addEventListener("resize", handleWindowResize);

    void tick().then(() => {
      evaluateCategoryLayoutMode();
      moveActiveTabBubble(true);
    });

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  });

  $effect(() => {
    activeCategory;
    categoryTabs.length;
    void syncTabBubble();
    void tick().then(evaluateCategoryLayoutMode);
  });

  async function loadStoreData() {
    loading = true;
    loadingError = "";

    try {
      const [allCategories, allProducts, storeSettings] = await Promise.all([
        listPublicCategories(),
        listPublicProducts(),
        fetchStoreSettings().catch(() => ({
          orders_enabled: true,
          offers: [] as StoreOfferItem[],
        })),
      ]);

      categories = allCategories
        .filter((category) => category.is_active)
        .sort((left, right) => left.display_order - right.display_order);
      products = allProducts.filter((product) => product.is_available);
      ordersEnabled = storeSettings.orders_enabled;
      offers = storeSettings.offers ?? [];
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

  function getOffer(product: PublicProduct): StoreOfferItem | undefined {
    return offers.find(
      (o) =>
        o.product_id === product.id &&
        new Date(o.expires_at).getTime() > Date.now(),
    );
  }

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function getActiveTabButton(): HTMLButtonElement | null {
    if (!tabsListRef) return null;

    const tabButtons =
      tabsListRef.querySelectorAll<HTMLButtonElement>("[data-tab-id]");
    for (const button of tabButtons) {
      if (button.dataset.tabId === activeCategory) return button;
    }

    return null;
  }

  function moveActiveTabBubble(immediate = false) {
    if (!tabsListRef || !activeTabBubbleRef) return;

    const activeButton = getActiveTabButton();
    if (!activeButton) return;

    const listRect = tabsListRef.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const x = buttonRect.left - listRect.left;
    const y = buttonRect.top - listRect.top;
    const width = buttonRect.width;
    const height = buttonRect.height;

    const shouldReduceMotion = immediate || prefersReducedMotion();

    if (shouldReduceMotion) {
      activeTabBubbleRef.style.transform = `translate(${x}px, ${y}px)`;
      activeTabBubbleRef.style.width = `${width}px`;
      activeTabBubbleRef.style.height = `${height}px`;
      activeTabBubbleRef.style.opacity = "1";
      return;
    }

    void animate(
      activeTabBubbleRef,
      { x, y, width, height, opacity: 1 },
      { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    );
  }

  async function syncTabBubble() {
    await tick();
    moveActiveTabBubble();
  }

  function handleTabsKeydown(event: KeyboardEvent) {
    if (!tabsListRef) return;

    const horizontalKeys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!horizontalKeys.includes(event.key)) return;

    const tabButtons = Array.from(
      tabsListRef.querySelectorAll<HTMLButtonElement>("[role='tab']"),
    );

    if (!tabButtons.length) return;

    const focusedIndex = tabButtons.findIndex(
      (button) => button === document.activeElement,
    );
    const currentIndex = focusedIndex >= 0 ? focusedIndex : 0;

    let targetIndex = currentIndex;
    if (event.key === "ArrowRight")
      targetIndex = (currentIndex + 1) % tabButtons.length;
    if (event.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
    }
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = tabButtons.length - 1;

    event.preventDefault();

    const targetButton = tabButtons[targetIndex];
    const targetCategory = targetButton.dataset.tabId;
    targetButton.focus();

    if (targetCategory) {
      setActiveCategory(targetCategory);
    }
  }

  async function runCategoryTransition(nextCategory: string) {
    isCategoryTransitioning = true;

    // Fade out in-place (no layout shift)
    if (catalogGridRef) {
      await animate(
        catalogGridRef,
        { opacity: 0 },
        { duration: 0.2, ease: [0.4, 0, 1, 1] },
      );
    }

    // Swap the displayed category and wait for Svelte to update the DOM
    displayedCategory = nextCategory;
    await tick();

    // Fade in the new content
    if (catalogGridRef) {
      await animate(
        catalogGridRef,
        { opacity: [0, 1] },
        { duration: 0.35, ease: [0, 0, 0.2, 1] },
      );
    }

    isCategoryTransitioning = false;

    // Process any category that was clicked while transitioning
    if (pendingCategory && pendingCategory !== displayedCategory) {
      const queuedCategory = pendingCategory;
      pendingCategory = null;
      void runCategoryTransition(queuedCategory);
    } else {
      pendingCategory = null;
    }
  }

  function setActiveCategory(categoryId: string) {
    if (activeCategory === categoryId) return;

    activeCategory = categoryId;

    if (isCategoryTransitioning) {
      pendingCategory = categoryId;
      return;
    }

    void tick().then(() => moveActiveTabBubble());
    void runCategoryTransition(categoryId);
  }

  function evaluateCategoryLayoutMode() {
    if (typeof window === "undefined") return;

    if (window.innerWidth >= 768) {
      useMobileDropdown = false;
      return;
    }

    const requiredWidth = mobileTabsMeasureRef?.scrollWidth ?? 0;
    const availableWidth = window.innerWidth - 16;
    useMobileDropdown = requiredWidth > availableWidth;
  }

  function selectCategoryFromMobileMenu(categoryId: string) {
    mobileCategoryDetailsRef?.removeAttribute("open");
    isMobileCategoryMenuOpen = false;
    setActiveCategory(categoryId);
  }

  async function animateMobileMenuOpen() {
    await tick();
    if (!mobileMenuPanelRef) return;
    if (prefersReducedMotion()) return;

    void animate(
      mobileMenuPanelRef,
      { opacity: [0, 1], transform: ["scale(0.985)", "scale(1)"] },
      { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
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

<div class="space-y-5 pb-16">
  <section class="text-center px-4 pt-4 md:pt-3">
    <div class="mx-auto max-w-2xl mb-1">
      <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight">
        <span
          class="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary inline-block"
        >
          Nuestro Menú
        </span>
      </h1>
    </div>
  </section>

  <section id="menu" class="max-w-7xl mx-auto px-2 space-y-4 md:space-y-5">
    <div class="md:hidden px-2" aria-hidden="true">
      <div class="absolute -z-10 pointer-events-none opacity-0">
        <div
          class="inline-flex items-center gap-1 p-1.5"
          bind:this={mobileTabsMeasureRef}
        >
          {#each categoryTabs as tab (tab.id)}
            <span
              class="h-9 px-3.5 rounded-xl text-sm md:text-[0.95rem] font-semibold whitespace-nowrap inline-flex items-center"
            >
              {tab.label}
            </span>
          {/each}
        </div>
      </div>
    </div>

    {#if useMobileDropdown}
      <div class="md:hidden px-2 relative z-30">
        <details
          class="group relative w-full max-w-xs mx-auto rounded-[1.15rem] p-0.5 bg-linear-to-r from-primary/18 via-secondary/16 to-primary/18 border border-primary/18 dark:border-primary/20 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_10px_20px_-18px_rgba(37,99,235,0.45)]"
          bind:this={mobileCategoryDetailsRef}
          ontoggle={() => {
            isMobileCategoryMenuOpen = !!mobileCategoryDetailsRef?.open;
            if (isMobileCategoryMenuOpen) {
              void animateMobileMenuOpen();
            }
          }}
        >
          <summary
            class="list-none cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-2xl font-semibold mobile-category-trigger bg-base-100/72 dark:bg-base-100/10 backdrop-blur-xl border border-base-200/48 dark:border-base-200/10"
          >
            <span class="mobile-category-trigger">{activeCategoryLabel}</span>
            <Icon
              icon="lucide:chevron-down"
              class={`size-4 text-black dark:text-white transition-transform duration-200 ${isMobileCategoryMenuOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </summary>
          <ul
            class="menu absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 p-2 rounded-2xl bg-base-100/90 dark:bg-base-100/18 backdrop-blur-xl border border-base-200/70 dark:border-base-200/12 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.45)]"
            bind:this={mobileMenuPanelRef}
          >
            {#each categoryTabs as tab (tab.id)}
              <li>
                <button
                  type="button"
                  class={activeCategory === tab.id
                    ? "font-semibold mobile-category-option mobile-category-option-active bg-base-200/75 dark:bg-base-200/25 rounded-xl"
                    : "mobile-category-option rounded-xl"}
                  onclick={() => selectCategoryFromMobileMenu(tab.id)}
                >
                  {tab.label}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      </div>
    {/if}

    {#if !useMobileDropdown}
      <div class="flex justify-center overflow-x-auto pb-2 hide-scrollbar px-1">
        <div
          class="rounded-[1.15rem] p-0.5 bg-linear-to-r from-primary/18 via-secondary/16 to-primary/18 border border-primary/18 dark:border-primary/20 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_10px_20px_-18px_rgba(37,99,235,0.45)]"
        >
          <div
            role="tablist"
            aria-label="Categorias del menu"
            class="relative inline-flex items-center gap-1 bg-base-100/72 dark:bg-base-100/10 backdrop-blur-xl border border-base-200/48 dark:border-base-200/10 p-1.5 rounded-2xl flex-nowrap min-w-min"
            bind:this={tabsListRef}
            tabindex="0"
            onkeydown={handleTabsKeydown}
          >
            <span
              class="pointer-events-none absolute left-0 top-0 rounded-xl bg-base-100/55 dark:bg-base-100/14 backdrop-blur-lg border border-white/55 dark:border-white/16 shadow-[0_6px_14px_-10px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.24)_inset] opacity-0"
              bind:this={activeTabBubbleRef}
              aria-hidden="true"
            ></span>

            {#each categoryTabs as tab (tab.id)}
              <button
                type="button"
                role="tab"
                data-tab-id={tab.id}
                class="relative z-10 h-9 md:h-10 px-3.5 md:px-4.5 rounded-xl text-sm md:text-[0.95rem] font-semibold tracking-[0.01em] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-[transform,color,opacity] duration-200 hover:scale-[1.01] active:scale-[0.99]"
                aria-selected={activeCategory === tab.id}
                tabindex={activeCategory === tab.id ? 0 : -1}
                onclick={() => setActiveCategory(tab.id)}
                style="-webkit-tap-highlight-color: transparent;"
              >
                <span
                  class={activeCategory === tab.id
                    ? "category-tab-label category-tab-label-active"
                    : "category-tab-label"}
                >
                  {tab.label}
                </span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if loading}
      <div
        class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 items-start pt-4"
      >
        {#each catalogSkeletonCards as cardIndex (cardIndex)}
          <article
            class="card bg-base-100 w-full shadow-sm border border-base-200/50 overflow-hidden h-full rounded-2xl sm:rounded-3xl"
            aria-hidden="true"
          >
            <div class="skeleton w-full aspect-4/3"></div>
            <div class="card-body p-3 sm:p-4 md:p-5 space-y-2">
              <div class="skeleton h-4 w-3/4"></div>
              <div class="skeleton h-5 w-16"></div>
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
        class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 items-start pt-1"
        bind:this={catalogGridRef}
      >
        {#each visibleProducts as product (product.id)}
          {@const offer = getOffer(product)}
          <div
            class="h-full group"
            role="button"
            tabindex="0"
            onclick={() => openProductModal(product)}
            onkeydown={(event) => handleCardKeydown(event, product)}
          >
            <div
              class="card bg-base-100 w-full border border-base-200 shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden h-full rounded-2xl sm:rounded-3xl flex flex-col relative cursor-pointer"
            >
              {#if getSafeImageUrl(product.image_url)}
                <figure
                  class="bg-base-200/50 w-full aspect-square overflow-hidden relative"
                >
                  <img
                    src={getSafeImageUrl(product.image_url)}
                    alt={product.name}
                    class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {#if offer}
                    <span
                      class="absolute top-2 left-2 badge badge-warning badge-sm font-semibold shadow-sm"
                    >
                      {offer.label}
                    </span>
                  {/if}
                  {#if ordersEnabled}
                    <button
                      type="button"
                      class="absolute bottom-2.5 right-2.5 z-10 size-8 rounded-full bg-primary text-primary-content shadow-md flex items-center justify-center opacity-100 md:opacity-0 scale-90 md:group-hover:opacity-100 md:group-hover:scale-100 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label={`Agregar ${product.name} al pedido`}
                      onclick={(event) => {
                        event.stopPropagation();
                        addCartItem({
                          product_id: product.id,
                          name: product.name,
                          image_url: getSafeImageUrl(product.image_url),
                          unit_price: product.price,
                          quantity: 1,
                        });
                      }}
                    >
                      <Icon icon="lucide:plus" class="size-4" />
                    </button>
                  {/if}
                </figure>
              {/if}
              <div class="card-body p-3 sm:p-4 md:p-5 flex flex-col flex-1">
                <h3 class="text-sm md:text-base font-bold leading-tight mb-1">
                  {product.name}
                </h3>

                {#if hasSeasonalFlavors(product)}
                  <div class="mb-2 mt-auto">
                    <span
                      class="badge badge-warning badge-outline text-xs font-medium"
                      >Temporada</span
                    >
                  </div>
                {:else}
                  <div class="mt-auto"></div>
                {/if}

                <div
                  class="card-actions justify-between items-center pt-2 border-t border-base-200/50 mt-1"
                >
                  <div class="flex items-baseline gap-1">
                    {#if offer?.discount_price}
                      <span class="text-xs line-through text-base-content/40"
                        >{formatCurrency(product.price)}</span
                      >
                      <span class="text-base md:text-2xl font-bold text-primary"
                        >{formatCurrency(offer.discount_price)}</span
                      >
                    {:else}
                      <span class="text-base md:text-2xl font-bold text-primary"
                        >{formatCurrency(product.price)}</span
                      >
                    {/if}
                  </div>
                  {#if ordersEnabled}
                    <button
                      type="button"
                      class="btn btn-primary btn-xs md:btn-sm rounded-full px-3 md:px-5 shadow-sm hover:shadow-md transition-shadow duration-300"
                      onclick={(event) => {
                        event.stopPropagation();
                        openProductModal(product);
                      }}
                    >
                      Seleccionar
                    </button>
                  {/if}
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
    class="modal-box w-[calc(100%-0.5rem)] sm:w-[min(96vw,980px)] max-w-5xl p-0 relative overflow-y-auto overflow-x-hidden max-h-[92dvh] rounded-2xl sm:rounded-3xl shadow-2xl"
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
      <div
        class="flex flex-col md:grid md:grid-cols-[1fr_1fr] md:h-full bg-base-100"
      >
        <div
          class="bg-base-200/30 p-3 sm:p-5 md:p-8 flex flex-col items-center justify-center relative"
        >
          {#if getSafeImageUrl(selectedProduct.image_url)}
            <div
              class="flip-3d-card w-full max-w-50 sm:max-w-70 md:max-w-90 mx-auto hover:scale-[1.02] transition-transform duration-300"
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
                <div
                  class="flip-3d-inner aspect-square sm:aspect-4/5 rounded-2xl sm:rounded-3xl"
                >
                  <figure
                    class="flip-3d-face overflow-hidden rounded-2xl sm:rounded-3xl bg-base-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]"
                  >
                    <img
                      src={getSafeImageUrl(selectedProduct.image_url)}
                      alt={selectedProduct.name}
                      class="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  </figure>

                  <div
                    class="flip-3d-face flip-3d-back rounded-2xl sm:rounded-3xl overflow-hidden border border-base-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] bg-base-100"
                  >
                    <div
                      class="h-full w-full p-6 sm:p-8 flex items-center justify-center text-center"
                    >
                      <div class="space-y-3">
                        <h4
                          class="text-xl sm:text-2xl font-bold text-base-content"
                        >
                          {selectedProduct.name}
                        </h4>
                        <p
                          class="text-sm sm:text-base text-base-content/70 leading-relaxed"
                        >
                          {selectedProduct.description ||
                            "Sin descripcion disponible."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
            <div
              class="mt-3 sm:mt-5 flex items-center gap-2 text-base-content/50 bg-base-100/50 backdrop-blur-sm py-1 px-3 sm:py-1.5 sm:px-4 rounded-full text-[11px] sm:text-sm font-medium"
            >
              <Icon icon="lucide:info" class="size-3.5 sm:size-4" />
              <span>Toca la tarjeta para detalles</span>
            </div>
          {:else}
            <div
              class="w-full max-w-50 sm:max-w-70 md:max-w-90 aspect-square sm:aspect-4/5 rounded-2xl sm:rounded-3xl bg-base-200 border border-base-300 grid place-items-center text-base-content/50 shadow-inner"
            >
              <div class="flex flex-col items-center gap-2">
                <Icon icon="lucide:image-off" class="size-8 opacity-50" />
                <span class="font-medium">Sin imagen</span>
              </div>
            </div>
          {/if}
        </div>

        <div
          class="p-4 sm:p-5 md:p-8 lg:p-10 space-y-3 sm:space-y-5 md:space-y-6 flex flex-col"
        >
          <div class="space-y-1.5 sm:space-y-2 pr-10 sm:pr-12">
            <h3
              class="text-xl sm:text-2xl md:text-3xl font-bold leading-tight bg-clip-text text-transparent bg-linear-to-r from-base-content to-base-content/80"
            >
              {selectedProduct.name}
            </h3>
            <p
              class="text-lg sm:text-xl md:text-2xl font-extrabold text-primary"
            >
              {formatCurrency(modalDisplayPrice)}
            </p>
            {#if selectedProduct.description}
              <p class="text-sm text-base-content/70 leading-relaxed">
                {selectedProduct.description}
              </p>
            {/if}
            <p
              class="text-xs sm:text-sm font-medium text-base-content/60 inline-flex items-center gap-1.5 mt-2 bg-base-200/50 py-1.5 px-3 rounded-lg"
            >
              <Icon icon="lucide:sliders-horizontal" class="size-4" />
              Personaliza sabores en el carrito
            </p>
          </div>

          <div
            class="form-control bg-base-200/30 p-3 sm:p-4 rounded-2xl border border-base-200/50 space-y-2 sm:space-y-3 mt-auto"
          >
            <span
              class="label-text font-bold text-base-content/80 uppercase tracking-wider text-xs px-1"
              >Cantidad</span
            >
            <div
              class="grid grid-cols-3 w-full bg-base-100 rounded-xl overflow-hidden shadow-sm border border-base-200/80"
            >
              <button
                class="btn btn-ghost hover:bg-base-200 rounded-none h-12 sm:h-14"
                type="button"
                onclick={decreaseModalQty}
                aria-label="Reducir cantidad"
              >
                <Icon icon="lucide:minus" class="size-5" />
              </button>
              <div
                class="flex items-center justify-center font-bold text-lg sm:text-xl h-12 sm:h-14 border-x border-base-200/50 bg-base-50"
              >
                {normalizeQty(modalQty)}
              </div>
              <button
                class="btn btn-ghost hover:bg-base-200 rounded-none h-12 sm:h-14"
                type="button"
                onclick={increaseModalQty}
                aria-label="Aumentar cantidad"
              >
                <Icon icon="lucide:plus" class="size-5" />
              </button>
            </div>
          </div>

          <div class="grid gap-2 sm:gap-3 pt-1 sm:pt-2">
            {#if ordersEnabled}
              <button
                type="button"
                class="btn btn-primary btn-md sm:btn-lg rounded-xl font-bold shadow-md hover:shadow-lg transition-all w-full leading-none"
                onclick={() => addSelectedToCart(false)}
              >
                <span class="mr-2">Agregar al pedido</span>
                <Icon icon="lucide:plus-circle" class="size-5" />
              </button>
              <button
                type="button"
                class="btn btn-outline btn-md sm:btn-lg rounded-xl font-bold hover:bg-base-200 hover:text-base-content w-full leading-none"
                onclick={() => addSelectedToCart(true)}
              >
                <Icon
                  icon="lucide:shopping-bag"
                  class="size-5 mr-2"
                  aria-hidden="true"
                />
                Ir al Carrito
              </button>
            {:else}
              <div class="store-paused-banner text-center text-sm font-medium">
                ¡Gracias por escoger nuestros productos 🙂!
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop bg-base-300/60 backdrop-blur-sm">
    <button>Cerrar</button>
  </form>
</dialog>

<style>
  .category-tab-label,
  .mobile-category-trigger,
  .mobile-category-option {
    color: inherit;
    opacity: 0.8;
    transition:
      color 0.2s ease,
      opacity 0.2s ease;
  }

  .category-tab-label-active,
  .category-tab-label:hover,
  .mobile-category-option-active,
  .mobile-category-option:hover {
    opacity: 1;
  }
</style>
