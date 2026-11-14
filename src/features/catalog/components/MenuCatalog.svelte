<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import ProductCard from "./shared/ProductCard.svelte";
  import ProductModal from "./shared/ProductModal.svelte";
  import { toSafeImageUrl } from "@shared/utils/formatters";
  import { flyTo, motionMs } from "@shared/motion/motion";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { isOfferActive, offerBasePrice } from "@features/catalog/lib/offers";
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
    type StorePublicSettings,
  } from "@features/catalog/lib/api";
  import { describeStoreStatus } from "@features/catalog/lib/store-status";
  import { addCartItem } from "@features/catalog/lib/cart";

  const ALL = "all";
  const CATEGORY_PARAM = "categoria";

  let loading = $state(true);
  let loadingError = $state("");
  let categories = $state<PublicCategory[]>([]);
  let products = $state<PublicProduct[]>([]);
  let settings = $state<StorePublicSettings | null>(null);
  let activeCategory = $state<string>(ALL);
  let query = $state("");
  let now = $state(new Date());

  let selectedProduct = $state<PublicProduct | null>(null);
  let selectedDraft = $state<ProductCustomizationDraft | null>(null);

  const skeletonCards = Array.from({ length: 8 }, (_, index) => index);

  const offers = $derived<StoreOfferItem[]>(settings?.offers ?? []);
  const status = $derived(describeStoreStatus(settings, now));
  const ordersEnabled = $derived(status.canOrder);

  /** Lowercase without accents, so "cafe" finds "Café". */
  function normalize(value: string): string {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  const searchTerm = $derived(normalize(query));

  const matchingProducts = $derived(
    searchTerm
      ? products.filter((product) =>
          normalize(
            `${product.name} ${product.description ?? ""} ${product.category_name ?? ""}`,
          ).includes(searchTerm),
        )
      : products,
  );

  /** Sections to render: every category with matches, or just the chosen one. */
  const sections = $derived(
    categories
      .filter(
        (category) => activeCategory === ALL || category.id === activeCategory,
      )
      .map((category) => ({
        category,
        items: matchingProducts.filter(
          (product) => product.category_id === category.id,
        ),
      }))
      .filter((section) => section.items.length > 0),
  );

  const categoryCounts = $derived(
    new Map(
      categories.map((category) => [
        category.id,
        matchingProducts.filter(
          (product) => product.category_id === category.id,
        ).length,
      ]),
    ),
  );

  onMount(() => {
    void loadStoreData();
    // Keep "cierra 9:00 pm" / closed state current while the page stays open.
    const timer = setInterval(() => {
      now = new Date();
    }, 60_000);
    return () => clearInterval(timer);
  });

  function readCategoryFromUrl(): string {
    const value = new URL(window.location.href).searchParams.get(
      CATEGORY_PARAM,
    );
    if (!value) return ALL;
    const match = categories.find(
      (category) => category.slug === value || category.id === value,
    );
    return match?.id ?? ALL;
  }

  async function loadStoreData() {
    loading = true;
    loadingError = "";

    try {
      const [allCategories, allProducts, storeSettings] = await Promise.all([
        listPublicCategories(),
        listPublicProducts(),
        fetchStoreSettings().catch(() => null),
      ]);

      categories = allCategories
        .filter((category) => category.is_active)
        .sort((left, right) => left.display_order - right.display_order);
      products = allProducts.filter((product) => product.is_available);
      settings = storeSettings;
      activeCategory = readCategoryFromUrl();
    } catch (error) {
      // Raw fetch/HTTP messages are English and technical; customers get a
      // plain Spanish message with a retry button instead.
      console.error("[menu] load failed", error);
      loadingError =
        "No pudimos cargar el menú. Revisa tu conexión e intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  function selectCategory(categoryId: string) {
    activeCategory = categoryId;
    const url = new URL(window.location.href);
    const slug = categories.find(
      (category) => category.id === categoryId,
    )?.slug;
    if (categoryId === ALL || !slug) url.searchParams.delete(CATEGORY_PARAM);
    else url.searchParams.set(CATEGORY_PARAM, slug);
    history.replaceState(history.state, "", url);
  }

  function openProductModal(product: PublicProduct) {
    selectedProduct = product;
    selectedDraft = { quantity: 1 };
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

  function quickAdd(product: PublicProduct, button: HTMLElement) {
    if (isProductConfigurable(product)) {
      openProductModal(product);
      return;
    }
    addCartItem({
      product_id: product.id,
      name: product.name,
      image_url: toSafeImageUrl(product.image_url),
      unit_price: offerBasePrice(product.id, offers) ?? product.price,
      quantity: 1,
    });
    void flyTo(button, document.querySelector("[data-cart-target]"));
  }

  function addConfiguredProduct(
    product: PublicProduct,
    draft: ProductCustomizationDraft,
  ) {
    addCartItem({
      product_id: product.id,
      name: product.name,
      image_url: toSafeImageUrl(product.image_url),
      unit_price: computeUnitPrice(
        product,
        draft,
        offerBasePrice(product.id, offers),
      ),
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

<div class="menu-page mx-auto max-w-7xl px-4 pb-20 pt-6 md:pt-8">
  <header class="mb-4">
    <h1 class="font-display font-bold text-6xl leading-none md:text-7xl">
      Menú
    </h1>
    <p class="mt-1 text-base-content/70">
      Helados, bowls y bebidas hechos al momento.
    </p>
  </header>

  {#if !loading && status.detail && !status.canOrder}
    <div
      class="mb-4 flex items-start gap-3 rounded-box border border-warning/50 bg-warning/15 p-4"
      role="status"
    >
      <Icon
        icon="lucide:clock"
        class="mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <div>
        <p class="font-semibold">{status.detail}</p>
        <p class="text-sm text-base-content/70">
          Puedes ver el menú mientras tanto.
        </p>
      </div>
    </div>
  {/if}

  <div class="menu-filters" class:menu-filters--ready={!loading}>
    <label class="input w-full md:max-w-sm">
      <Icon icon="lucide:search" class="size-4 opacity-60" aria-hidden="true" />
      <input
        type="search"
        placeholder="Buscar en el menú"
        aria-label="Buscar en el menú"
        autocomplete="off"
        enterkeyhint="search"
        bind:value={query}
        disabled={loading}
      />
    </label>

    {#if !loading && categories.length > 0}
      <div class="menu-chips" role="group" aria-label="Categorías">
        <button
          type="button"
          class="menu-chip"
          aria-pressed={activeCategory === ALL}
          onclick={() => selectCategory(ALL)}
        >
          Todo
        </button>
        {#each categories as category (category.id)}
          {@const count = categoryCounts.get(category.id) ?? 0}
          {#if count > 0 || activeCategory === category.id}
            <button
              type="button"
              class="menu-chip"
              aria-pressed={activeCategory === category.id}
              onclick={() => selectCategory(category.id)}
            >
              {category.name}
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="menu-grid mt-4" aria-busy="true" aria-label="Cargando menú">
      {#each skeletonCards as card (card)}
        <div class="space-y-2" aria-hidden="true">
          <div class="skeleton aspect-[4/3] w-full rounded-box"></div>
          <div class="skeleton h-4 w-3/4"></div>
          <div class="skeleton h-4 w-1/3"></div>
        </div>
      {/each}
    </div>
  {:else if loadingError}
    <div class="mx-auto mt-10 max-w-md text-center" role="alert">
      <Icon
        icon="lucide:wifi-off"
        class="mx-auto mb-3 size-10 text-base-content/50"
        aria-hidden="true"
      />
      <p class="mb-4 font-medium">{loadingError}</p>
      <button
        type="button"
        class="btn btn-primary"
        onclick={() => void loadStoreData()}>Reintentar</button
      >
    </div>
  {:else if sections.length === 0}
    <div class="mx-auto mt-10 max-w-md text-center">
      {#if searchTerm}
        <p class="mb-1 font-semibold">No encontramos “{query.trim()}”.</p>
        <p class="mb-4 text-base-content/70">
          Prueba con otra palabra o revisa todo el menú.
        </p>
        <button
          type="button"
          class="btn btn-outline"
          onclick={() => {
            query = "";
            selectCategory(ALL);
          }}>Ver todo el menú</button
        >
      {:else}
        <p class="font-medium text-base-content/80">
          No hay productos disponibles en esta categoría por ahora.
        </p>
      {/if}
    </div>
  {:else}
    <div class="space-y-10 pt-4">
      {#each sections as section (section.category.id)}
        <section
          aria-labelledby={`cat-${section.category.id}`}
          in:fade={{ duration: motionMs(220) }}
        >
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <h2
              id={`cat-${section.category.id}`}
              class="font-display font-bold text-4xl md:text-5xl"
            >
              {section.category.name}
            </h2>
            <span class="text-sm text-base-content/60"
              >{section.items.length}
              {section.items.length === 1 ? "opción" : "opciones"}</span
            >
          </div>
          <div class="menu-grid">
            {#each section.items as product (product.id)}
              <!-- Filtering slides the remaining cards into place. -->
              <div
                animate:flip={{ duration: motionMs(280) }}
                in:fade={{ duration: motionMs(200) }}
              >
                <ProductCard
                  {product}
                  offer={getOffer(product)}
                  imageUrl={toSafeImageUrl(product.image_url)}
                  {ordersEnabled}
                  variant="menu"
                  clickable={true}
                  showSeasonalBadge={hasSeasonalFlavors(product)}
                  showSelectButton={isProductConfigurable(product)}
                  onOpen={() => openProductModal(product)}
                  onAdd={(button) => quickAdd(product, button)}
                  onSelect={() => openProductModal(product)}
                />
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<ProductModal
  product={selectedProduct}
  {ordersEnabled}
  basePrice={selectedProduct
    ? offerBasePrice(selectedProduct.id, offers)
    : undefined}
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

<style>
  .menu-filters {
    display: grid;
    gap: 0.75rem;
    padding-block: 0.75rem;
  }

  /* Pin search + chips under the sticky navbar once there is a menu to scroll. */
  .menu-filters--ready {
    position: sticky;
    top: 4rem;
    z-index: 20;
    margin-inline: -1rem;
    padding-inline: 1rem;
    background: color-mix(in oklab, var(--color-base-200) 92%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--color-base-300);
  }

  .menu-chips {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    margin-inline: -1rem;
    padding-inline: 1rem;
    scroll-padding-inline: 1rem;
  }

  .menu-chips::-webkit-scrollbar {
    display: none;
  }

  .menu-chip {
    flex: none;
    min-height: 2.5rem;
    padding: 0 1rem;
    border-radius: 999px;
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .menu-chip:hover {
    border-color: var(--color-primary);
  }

  .menu-chip[aria-pressed="true"] {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-content);
  }

  .menu-chip:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 0.75rem;
  }

  @media (min-width: 768px) {
    .menu-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.5rem 1rem;
    }
  }

  @media (min-width: 1280px) {
    .menu-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .menu-chip {
      transition: none;
    }
  }
</style>
