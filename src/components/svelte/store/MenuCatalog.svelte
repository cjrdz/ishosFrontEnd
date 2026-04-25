<script lang="ts">
  import { onMount, tick } from "svelte";
  import { animate } from "motion";
  import Icon from "../shared/AppIcon.svelte";
  import ProductCard from "./shared/ProductCard.svelte";
  import ProductModal from "./shared/ProductModal.svelte";
  import { toSafeImageUrl } from "../../../lib/utils/formatters";
  import { isOfferActive } from "../../../lib/store/offers";
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

  function hasSeasonalFlavors(product: PublicProduct): boolean {
    return (product.flavors ?? []).some(
      (flavor) => flavor.is_active && flavor.is_seasonal,
    );
  }

  function getOffer(product: PublicProduct): StoreOfferItem | undefined {
    return offers.find(
      (offer) => offer.product_id === product.id && isOfferActive(offer),
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
      image_url: toSafeImageUrl(selectedProduct.image_url),
      unit_price: selectedProduct.price,
      quantity: safeQty,
    });

    selectedProduct = null;

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
          <ProductCard
            {product}
            {offer}
            imageUrl={toSafeImageUrl(product.image_url)}
            {ordersEnabled}
            variant="menu"
            clickable={true}
            showSeasonalBadge={hasSeasonalFlavors(product)}
            showSelectButton={true}
            onOpen={() => openProductModal(product)}
            onAdd={() => {
              addCartItem({
                product_id: product.id,
                name: product.name,
                image_url: toSafeImageUrl(product.image_url),
                unit_price: product.price,
                quantity: 1,
              });
            }}
            onSelect={() => openProductModal(product)}
          />
        {/each}
      </div>
    {/if}
  </section>
</div>

<ProductModal
  product={selectedProduct}
  quantity={modalQty}
  displayPrice={modalDisplayPrice}
  {ordersEnabled}
  {showImageDetails}
  imageUrl={selectedProduct
    ? toSafeImageUrl(selectedProduct.image_url)
    : undefined}
  onClose={() => {
    selectedProduct = null;
    showImageDetails = false;
  }}
  onToggleImageDetails={() => {
    showImageDetails = !showImageDetails;
  }}
  onDecreaseQty={decreaseModalQty}
  onIncreaseQty={increaseModalQty}
  onAdd={() => addSelectedToCart(false)}
  onCheckout={() => addSelectedToCart(true)}
/>

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
