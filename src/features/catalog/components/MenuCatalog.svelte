<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { animate } from "motion";
  import Icon from "@shared/components/AppIcon.svelte";
  import ProductCard from "./shared/ProductCard.svelte";
  import ProductModal from "./shared/ProductModal.svelte";
  import { toSafeImageUrl } from "@shared/utils/formatters";
  import { isOfferActive } from "@features/catalog/lib/offers";
  import {
    computeUnitPrice,
    isProductConfigurable,
    type ProductCustomizationDraft,
  } from "@features/catalog/lib/customization";
  import {
    listPublicCategories,
    listPublicProducts,
    fetchStoreSettings,
    type PublicCategory,
    type PublicProduct,
    type StoreOfferItem,
  } from "@features/catalog/lib/api";
  import { addCartItem } from "@features/catalog/lib/cart";
  import "../../../styles/menu.css";

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
  let sidebarTabsRef = $state<HTMLElement | null>(null);
  let showSidebar = $state(true);
  let isMobileDrawerOpen = $state(false);

  let selectedProduct = $state<PublicProduct | null>(null);
  let selectedDraft = $state<ProductCustomizationDraft | null>(null);
  const catalogSkeletonCards = Array.from({ length: 8 }, (_, index) => index);
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

  const SIDEBAR_VISIBILITY_KEY = "ishos:menu-sidebar-visible";

  const CATEGORY_ICON_MAP: Record<string, string> = {
    all: "lucide:layout-grid",
    extras: "lucide:plus",
    "vasos y tarrinas": "lucide:glass-water",
    "conos y barquillos": "lucide:ice-cream-cone",
    bowls: "lucide:soup",
    "para compartir": "lucide:users",
    "para llevar": "lucide:shopping-bag",
    chocobananos: "lucide:banana",
    especiales: "lucide:star",
    bebidas: "lucide:cup-soda",
  };

  function getCategoryIcon(tab: { id: string; label: string }): string {
    const normalizedId = tab.id.toLowerCase().trim();
    const normalizedLabel = tab.label.toLowerCase().trim();
    return (
      CATEGORY_ICON_MAP[normalizedId] ??
      CATEGORY_ICON_MAP[normalizedLabel] ??
      "lucide:circle-dot"
    );
  }

  function toggleSidebar() {
    showSidebar = !showSidebar;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_VISIBILITY_KEY, String(showSidebar));
    }
  }

  function openMobileDrawer() {
    isMobileDrawerOpen = true;
  }

  function closeMobileDrawer() {
    isMobileDrawerOpen = false;
  }

  function selectCategoryFromDrawer(categoryId: string) {
    setActiveCategory(categoryId);
    closeMobileDrawer();
  }

  function handleDrawerKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeMobileDrawer();
    }
  }

  $effect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isMobileDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  });

  const visibleProducts = $derived(
    displayedCategory === "all"
      ? products
      : products.filter((product) => product.category_id === displayedCategory),
  );

  onMount(() => {
    void loadStoreData();

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
      if (stored !== null) {
        showSidebar = stored === "true";
      }
    }
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

  function openProductModal(
    product: PublicProduct,
    initialDraft?: ProductCustomizationDraft,
  ) {
    selectedProduct = product;
    selectedDraft = initialDraft ?? { quantity: 1 };
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

  function handleTabsKeydown(event: KeyboardEvent) {
    const tablist = event.currentTarget as HTMLElement | null;
    if (!tablist) return;

    const isVertical = tablist.getAttribute("aria-orientation") === "vertical";
    const nextKeys = isVertical ? ["ArrowDown"] : ["ArrowRight"];
    const prevKeys = isVertical ? ["ArrowUp"] : ["ArrowLeft"];

    if (![...nextKeys, ...prevKeys, "Home", "End"].includes(event.key)) return;

    const tabButtons = Array.from(
      tablist.querySelectorAll<HTMLButtonElement>("[role='tab']"),
    );

    if (!tabButtons.length) return;

    const focusedIndex = tabButtons.findIndex(
      (button) => button === document.activeElement,
    );
    const currentIndex = focusedIndex >= 0 ? focusedIndex : 0;

    let targetIndex = currentIndex;
    if (nextKeys.includes(event.key))
      targetIndex = (currentIndex + 1) % tabButtons.length;
    if (prevKeys.includes(event.key)) {
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

    void runCategoryTransition(categoryId);
  }

  function addConfiguredProduct(
    product: PublicProduct,
    draft: ProductCustomizationDraft,
  ) {
    addCartItem({
      product_id: product.id,
      name: product.name,
      image_url: toSafeImageUrl(product.image_url),
      unit_price: computeUnitPrice(product, draft),
      quantity: draft.quantity,
      flavor_id: draft.flavor_id || undefined,
      flavor_ids: draft.flavor_ids || undefined,
      included_addon_ids: draft.included_addon_ids,
      extra_addon_ids: draft.extra_addon_ids,
      topping_selection: draft.topping_selection,
      jalea_selection: draft.jalea_selection,
    });

    selectedProduct = null;
    selectedDraft = null;
  }
</script>

<div class="space-y-5 pb-16 overflow-x-clip">
  <section
    class="relative overflow-hidden text-center px-4 pt-3 pb-4 md:pt-4 md:pb-5"
  >
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="hero-blob-teal absolute -top-8 -left-8 w-48 h-48 rounded-full blur-3xl"
        style="background: var(--ishos-teal);"
      ></div>
      <div
        class="hero-blob-pink absolute -bottom-6 -right-6 w-40 h-40 rounded-full blur-3xl"
        style="background: var(--ishos-pink);"
      ></div>
      <div class="stripe-bg absolute inset-0 opacity-40"></div>
    </div>
    <div class="relative mx-auto max-w-2xl fade-up fade-up-1">
      <div class="section-pill">Nuestro Menú</div>
    </div>
  </section>

  <div class="wave-divider -mt-2" style="color: var(--ishos-teal);">
    <svg
      viewBox="0 0 1440 60"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      style="height:24px; width:100%;"
    >
      <path
        d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
        fill="var(--menu-wave-fill)"
      ></path>
    </svg>
  </div>

  {#snippet categoryList(onselect: (categoryId: string) => void)}
    <div
      role="tablist"
      aria-label="Categorias del menu"
      aria-orientation="vertical"
      class="flex flex-col gap-1"
      tabindex="0"
      bind:this={sidebarTabsRef}
      onkeydown={handleTabsKeydown}
    >
      {#each categoryTabs as tab (tab.id)}
        <button
          type="button"
          role="tab"
          data-tab-id={tab.id}
          class="w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium transition-colors flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 {activeCategory ===
          tab.id
            ? 'menu-category-active'
            : 'hover:bg-base-200/50'}"
          aria-selected={activeCategory === tab.id}
          tabindex={activeCategory === tab.id ? 0 : -1}
          onclick={() => onselect(tab.id)}
          style="-webkit-tap-highlight-color: transparent;"
        >
          <Icon
            icon={getCategoryIcon(tab)}
            class="size-4 flex-shrink-0"
            aria-hidden="true"
          />
          <span class="truncate">{tab.label}</span>
        </button>
      {/each}
    </div>
  {/snippet}

  <section id="menu" class="max-w-7xl mx-auto px-2 space-y-4 md:space-y-5">
    {#snippet catalogContent()}
      {#if loading}
        <div
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 items-start pt-4 md:pt-0"
        >
          {#each catalogSkeletonCards as cardIndex (cardIndex)}
            <article
              class="card bg-base-100 w-full shadow-sm border border-base-200/50 overflow-hidden h-full rounded-2xl sm:rounded-3xl aspect-[3/4] relative"
              aria-hidden="true"
            >
              <div class="skeleton w-full h-full absolute inset-0"></div>
              <div
                class="absolute left-0 right-0 bottom-0 p-2 bg-base-100/40 backdrop-blur-sm border-t border-base-200/50"
              >
                <div class="skeleton h-4 w-3/4 mb-1"></div>
                <div class="flex items-center justify-between">
                  <div class="skeleton h-4 w-14"></div>
                  <div class="skeleton h-6 w-16 rounded-full"></div>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {:else if loadingError}
        <div
          class="alert alert-error max-w-xl mx-auto rounded-xl shadow-sm mt-8"
        >
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
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 items-start pt-1"
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
                if (isProductConfigurable(product)) {
                  openProductModal(product);
                  return;
                }

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
    {/snippet}

    {#if !loading}
      <div class="lg:hidden flex flex-col gap-2 mb-4">
        <button
          type="button"
          class="btn btn-outline btn-sm w-fit"
          onclick={openMobileDrawer}
        >
          <Icon icon="lucide:panel-left" class="size-4" aria-hidden="true" />
          Categorías
        </button>
        <div>
          <h2 class="text-2xl font-bold leading-tight">
            {activeCategory === "all"
              ? "Todos los productos"
              : activeCategoryLabel}
          </h2>
        </div>
      </div>
    {/if}

    {#if loading}
      {@render catalogContent()}
    {:else}
      <div class="flex flex-col md:flex-row gap-0 items-start">
        {#if showSidebar}
          <aside
            class="hidden lg:block w-56 flex-shrink-0 sticky top-4 self-start mr-6"
          >
            <div class="flex items-center justify-between mb-3 px-1">
              <h3 class="text-xs font-bold uppercase tracking-wider opacity-60">
                Categorías
              </h3>
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-square"
                onclick={toggleSidebar}
                aria-label="Ocultar categorías"
              >
                <Icon
                  icon="lucide:panel-left-close"
                  class="size-4"
                  aria-hidden="true"
                />
              </button>
            </div>
            {@render categoryList(setActiveCategory)}
          </aside>
        {/if}

        <div class="flex-1 min-w-0 w-full">
          <div class="hidden lg:flex items-center justify-between mb-4 gap-4">
            <div class="flex items-center gap-4">
              {#if !showSidebar}
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  onclick={toggleSidebar}
                >
                  <Icon
                    icon="lucide:panel-left"
                    class="size-4"
                    aria-hidden="true"
                  />
                  Categorías
                </button>
              {/if}
              <div>
                <h2 class="text-2xl font-bold leading-tight">
                  {activeCategory === "all"
                    ? "Todos los productos"
                    : activeCategoryLabel}
                </h2>
              </div>
            </div>
          </div>

          {@render catalogContent()}
        </div>
      </div>
    {/if}
  </section>

  {#if isMobileDrawerOpen}
    <div
      class="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Categorías"
      tabindex="-1"
      onkeydown={handleDrawerKeydown}
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/40 backdrop-blur-sm border-0 p-0 m-0"
        aria-label="Cerrar categorías"
        onclick={closeMobileDrawer}
        transition:fade={{ duration: 200 }}
      ></button>
      <aside
        class="absolute left-0 top-0 bottom-0 w-[280px] bg-base-100 shadow-xl p-4 flex flex-col"
        transition:fly={{ x: -280, duration: 300 }}
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xs font-bold uppercase tracking-wider opacity-60">
            Categorías
          </h3>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-square"
            onclick={closeMobileDrawer}
            aria-label="Cerrar categorías"
          >
            <Icon icon="lucide:x" class="size-5" aria-hidden="true" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto">
          {@render categoryList(selectCategoryFromDrawer)}
        </div>
      </aside>
    </div>
  {/if}
</div>

<ProductModal
  product={selectedProduct}
  {ordersEnabled}
  initialDraft={selectedDraft}
  imageUrl={selectedProduct
    ? toSafeImageUrl(selectedProduct.image_url)
    : undefined}
  onClose={() => {
    selectedProduct = null;
    selectedDraft = null;
  }}
  onConfirm={(draft) => {
    if (!selectedProduct) return;
    addConfiguredProduct(selectedProduct, draft);
  }}
/>
