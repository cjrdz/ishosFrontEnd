<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { toSafeImageUrl } from "@shared/utils/formatters";
  import { flyTo } from "@shared/motion/motion";
  import { addCartItem } from "@features/catalog/lib/cart";
  import {
    buildActiveOfferMap,
    offerBasePrice,
  } from "@features/catalog/lib/offers";
  import {
    fetchStoreSettings,
    listPublicCategories,
    listPublicProducts,
    type PublicCategory,
    type PublicProduct,
    type StorePublicSettings,
  } from "@features/catalog/lib/api";
  import {
    describeStoreStatus,
    scheduleRows,
  } from "@features/catalog/lib/store-status";
  import ProductCard from "./shared/ProductCard.svelte";
  import ProductModal from "./shared/ProductModal.svelte";
  import StoreOffers from "./StoreOffers.svelte";
  import StoreHoursCard from "./StoreHoursCard.svelte";
  import { BRANCHES } from "@features/catalog/lib/branches";
  import {
    computeUnitPrice,
    isProductConfigurable,
    type ProductCustomizationDraft,
  } from "@features/catalog/lib/customization";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);
  let allProducts = $state<PublicProduct[]>([]);
  let categories = $state<PublicCategory[]>([]);
  let settings = $state<StorePublicSettings | null>(null);
  let now = $state(new Date());
  let selectedProduct = $state<PublicProduct | null>(null);
  let selectedDraft = $state<ProductCustomizationDraft | null>(null);
  let selectedBasePrice = $state<number | undefined>(undefined);

  const skeletonCards = Array.from({ length: 4 }, (_, index) => index);
  const offers = $derived(settings?.offers ?? []);
  const activeOfferMap = $derived(buildActiveOfferMap(offers));
  const status = $derived(describeStoreStatus(settings, now));
  const ordersEnabled = $derived(status.canOrder);
  const schedule = $derived(scheduleRows(settings?.hours, now));
  const todayRow = $derived(schedule.find((row) => row.isToday));

  onMount(() => {
    void loadHome();
    const timer = setInterval(() => {
      now = new Date();
    }, 60_000);
    return () => clearInterval(timer);
  });

  async function loadHome() {
    loading = true;
    error = "";

    try {
      const [featuredRes, catalogRes, categoryRes, storeSettings] =
        await Promise.all([
          fetch("/api/store/featured").then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return (await res.json()) as PublicProduct[];
          }),
          listPublicProducts(),
          listPublicCategories().catch(() => [] as PublicCategory[]),
          fetchStoreSettings().catch(() => null),
        ]);
      allProducts = catalogRes.filter((item) => item.is_available);
      featured = featuredRes.filter((item) => item.is_available).slice(0, 4);
      // Only categories that have something to order today.
      const stocked = new Set(allProducts.map((item) => item.category_id));
      categories = categoryRes
        .filter((category) => category.is_active && stocked.has(category.id))
        .sort((left, right) => left.display_order - right.display_order);
      settings = storeSettings;
    } catch (requestError) {
      console.error("[home] load failed", requestError);
      error =
        "No pudimos cargar los productos. Revisa tu conexión e intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  function openProductModal(
    product: PublicProduct,
    initialDraft?: ProductCustomizationDraft,
    basePrice?: number,
  ) {
    selectedProduct = product;
    selectedDraft = initialDraft ?? { quantity: 1 };
    // Same rule as the backend: an active offer sets the product's base price.
    selectedBasePrice = basePrice ?? offerBasePrice(product.id, offers);
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
      unit_price: computeUnitPrice(product, draft, selectedBasePrice),
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
    selectedBasePrice = undefined;
  }
</script>

<div class="mx-auto max-w-7xl space-y-12 px-4 pb-16 pt-4 md:space-y-16 md:pt-8">
  <section class="home-hero">
    <div class="relative z-[1] max-w-xl space-y-5">
      <p class="text-sm font-semibold uppercase tracking-wider opacity-80">
        Isho's Factory · Desde 2021
      </p>
      <h1 class="font-display font-bold text-6xl leading-[0.95] md:text-8xl">
        Helado hecho al momento, a tu gusto.
      </h1>
      <p class="text-lg opacity-90">
        Elige sabores, toppings y jaleas. Pide en línea para llevar o para
        disfrutar en el local.
      </p>

      <!-- The navbar already shows "Abierto"; repeat it here only when it matters. -->
      {#if !loading && status.tone !== "open"}
        <p class="home-hero-status" data-tone={status.tone}>
          <span class="dot" aria-hidden="true"></span>
          {status.detail ?? status.label}
        </p>
      {/if}

      <div class="flex flex-wrap gap-3">
        <a
          href="/menu"
          class="btn btn-lg rounded-full border-0 bg-base-100 text-primary hover:bg-base-200"
        >
          Ver el menú
          <Icon icon="lucide:arrow-right" class="size-5" aria-hidden="true" />
        </a>
        <a
          href="/about#contacto"
          class="btn btn-lg btn-ghost rounded-full text-inherit hover:bg-white/10"
        >
          Cómo llegar
        </a>
      </div>
    </div>

    <svg class="home-hero-art" viewBox="0 0 220 260" aria-hidden="true">
      <circle cx="110" cy="110" r="96" fill="#ffffff" opacity="0.08" />
      <circle cx="80" cy="86" r="42" fill="#f9b4da" />
      <circle cx="140" cy="86" r="42" fill="#f9e9a9" />
      <circle cx="110" cy="52" r="42" fill="#91e2d6" />
      <path d="M62 112h96l-48 140z" fill="#d9a35b" />
      <path
        d="M78 130l52 30M72 152l62 34M88 190l34 20M100 118l40 22"
        stroke="#b7833f"
        stroke-width="5"
        stroke-linecap="round"
      />
      <circle cx="96" cy="40" r="5" fill="#63001f" />
      <circle cx="122" cy="62" r="4" fill="#63001f" />
      <circle cx="152" cy="80" r="4" fill="#63001f" />
    </svg>
  </section>

  {#if categories.length > 0}
    <section aria-labelledby="home-categories">
      <h2
        id="home-categories"
        class="mb-3 font-display font-bold text-4xl md:text-5xl"
      >
        ¿Qué se te antoja?
      </h2>
      <div class="home-categories">
        {#each categories as category (category.id)}
          <a
            href={`/menu?categoria=${encodeURIComponent(category.slug)}`}
            class="home-category"
          >
            {category.name}
            <Icon
              icon="lucide:chevron-right"
              class="size-4 opacity-60"
              aria-hidden="true"
            />
          </a>
        {/each}
      </div>
    </section>
  {/if}

  {#if !loading && offers.length > 0}
    <StoreOffers
      {offers}
      products={allProducts.length > 0 ? allProducts : featured}
      {ordersEnabled}
      onConfigure={openProductModal}
    />
  {/if}

  <section aria-labelledby="home-featured">
    <div class="mb-4 flex items-baseline justify-between gap-3">
      <h2
        id="home-featured"
        class="font-display font-bold text-4xl md:text-5xl"
      >
        Los favoritos
      </h2>
      <a href="/menu" class="link link-hover font-medium text-primary">
        Ver todo el menú
      </a>
    </div>

    {#if loading}
      <div class="home-grid" aria-busy="true" aria-label="Cargando productos">
        {#each skeletonCards as card (card)}
          <div class="space-y-2" aria-hidden="true">
            <div class="skeleton aspect-[4/3] w-full rounded-box"></div>
            <div class="skeleton h-4 w-3/4"></div>
            <div class="skeleton h-4 w-1/3"></div>
          </div>
        {/each}
      </div>
    {:else if error}
      <div
        class="rounded-box border border-base-300 p-6 text-center"
        role="alert"
      >
        <p class="mb-3 font-medium">{error}</p>
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => void loadHome()}>Reintentar</button
        >
      </div>
    {:else if featured.length === 0}
      <p class="text-base-content/70">
        Pronto tendremos favoritos aquí. Mientras tanto, <a
          href="/menu"
          class="link text-primary">mira el menú completo</a
        >.
      </p>
    {:else}
      <div class="home-grid">
        {#each featured as product (product.id)}
          <ProductCard
            {product}
            offer={activeOfferMap.get(product.id)}
            imageUrl={toSafeImageUrl(product.image_url)}
            {ordersEnabled}
            variant="menu"
            clickable={true}
            showSelectButton={isProductConfigurable(product)}
            onOpen={() => openProductModal(product)}
            onAdd={(button) => quickAdd(product, button)}
            onSelect={() => openProductModal(product)}
          />
        {/each}
      </div>
    {/if}
  </section>

  <section class="grid gap-4 md:grid-cols-2" aria-label="Visítanos">
    <StoreHoursCard />

    <div
      class="flex flex-col justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-5 md:p-6"
    >
      <div>
        <div class="mb-3 flex items-center gap-2">
          <Icon
            icon="lucide:map-pin"
            class="size-5 text-primary"
            aria-hidden="true"
          />
          <h2 class="text-lg font-bold">Visítanos</h2>
        </div>
        <p class="text-base-content/75">
          Dos sucursales en Ahuachapán, El Salvador.
          {#if todayRow}
            Hoy: {todayRow.hours}.
          {/if}
        </p>
      </div>
      <ul class="divide-y divide-base-300 rounded-field border border-base-300">
        {#each BRANCHES as branch (branch.name)}
          <li class="flex items-center justify-between gap-3 px-3 py-2.5">
            <span class="min-w-0">
              <span class="block font-semibold">{branch.name}</span>
              <span class="block text-sm text-base-content/65"
                >{branch.area}</span
              >
            </span>
            <a
              href={branch.maps}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline btn-sm shrink-0 rounded-full"
              aria-label={`Cómo llegar a ${branch.name}`}
            >
              <Icon
                icon="lucide:navigation"
                class="size-4"
                aria-hidden="true"
              />
              Cómo llegar
            </a>
          </li>
        {/each}
      </ul>
      <a
        href="/about#sucursales"
        class="link link-hover self-start text-sm font-medium text-primary"
        >Ver mapas de las sucursales</a
      >
    </div>
  </section>
</div>

<ProductModal
  product={selectedProduct}
  {ordersEnabled}
  initialDraft={selectedDraft ?? undefined}
  basePrice={selectedBasePrice}
  imageUrl={selectedProduct
    ? toSafeImageUrl(selectedProduct.image_url)
    : undefined}
  onClose={() => {
    selectedProduct = null;
    selectedDraft = null;
    selectedBasePrice = undefined;
  }}
  onConfirm={(draft) => {
    if (!selectedProduct) return;
    addConfiguredProduct(selectedProduct, draft);
  }}
/>

<style>
  @keyframes heroRise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .home-hero {
    animation: heroRise 600ms var(--ease-out) both;
    position: relative;
    overflow: hidden;
    display: grid;
    align-items: center;
    gap: 1.5rem;
    padding: 1.75rem 1.5rem 0;
    border-radius: var(--radius-box);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  /* Dark mode: a deep teal panel instead of a bright slab of light. */
  :global([data-theme="night"]) .home-hero {
    background: linear-gradient(135deg, #15524d 0%, #0e3633 100%);
    color: #eaf6f4;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.06),
      0 12px 32px rgb(0 0 0 / 0.35);
  }

  @media (min-width: 768px) {
    .home-hero {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 3.5rem 3.5rem;
    }
  }

  .home-hero-art {
    animation: heroRise 700ms 120ms var(--ease-out) both;
    width: min(45%, 10rem);
    justify-self: end;
    margin: -1rem 0 -2rem;
  }

  @media (min-width: 768px) {
    .home-hero-art {
      width: 17rem;
      margin: -1rem 0 -6rem;
    }
  }

  .home-hero-status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: color-mix(in oklab, black 18%, transparent);
    font-weight: 600;
  }

  .home-hero-status .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: #7ef0c2;
  }

  .home-hero-status[data-tone="closing"] .dot {
    background: var(--color-warning);
  }

  .home-hero-status[data-tone="closed"] .dot {
    background: #ffb4ab;
  }

  .home-categories {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    margin-inline: -1rem;
    padding: 0.25rem 1rem;
  }

  .home-categories::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 768px) {
    .home-categories {
      flex-wrap: wrap;
      overflow: visible;
    }
  }

  .home-category {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.75rem;
    padding: 0 1.1rem;
    border-radius: 999px;
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    font-weight: 500;
    transition: border-color var(--dur-fast) var(--ease-out);
  }

  .home-category:hover {
    border-color: var(--color-primary);
  }

  .home-category:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .home-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 0.75rem;
  }

  @media (min-width: 768px) {
    .home-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1.5rem 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-hero,
    .home-hero-art {
      animation: none;
    }
  }
</style>
