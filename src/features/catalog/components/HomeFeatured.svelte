<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency, toSafeImageUrl } from "@shared/utils/formatters";
  import BrandStamp from "@shared/components/BrandStamp.svelte";
  import { BRAND_MISSION } from "@shared/lib/brand";
  import { flavorColor } from "@features/catalog/lib/flavor-colors";
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
    formatScheduleClock,
  } from "@features/catalog/lib/store-status";
  import ProductCard from "./shared/ProductCard.svelte";
  import ProductModal from "./shared/ProductModal.svelte";
  import StoreOffers from "./StoreOffers.svelte";
  import StoreHoursCard from "./StoreHoursCard.svelte";
  import StoreLocationsList from "@features/catalog/components/StoreLocationsList.svelte";
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

  /** "Hoy de 2:00 pm a 9:00 pm" from today's configured ranges. */
  const todayHours = $derived.by(() => {
    const ranges = settings?.hours?.configured ? settings.hours.today : [];
    if (!ranges?.length) return "";
    return `Hoy de ${ranges
      .map(
        (r) =>
          `${formatScheduleClock(r.open)} a ${formatScheduleClock(r.close)}`,
      )
      .join(" y ")}`;
  });

  /** Hero line: today's hours while open (also when orders are in-store
   *  only: the shops are open), otherwise why we're closed. */
  const heroStatus = $derived.by(() => {
    if (status.tone === "closed" && !status.inStoreOnly) {
      return { tone: "closed", text: status.detail ?? status.label };
    }
    if (status.tone === "closing") {
      return { tone: "closing", text: status.label };
    }
    if (!todayHours) return null;
    return {
      tone: "open",
      text: status.inStoreOnly
        ? `${todayHours} · pedidos en sucursal`
        : todayHours,
    };
  });

  /** Active flavours offered by any available product (★ = de temporada). */
  const houseFlavors = $derived.by(() => {
    const seen = new Map<
      string,
      { id: string; name: string; seasonal: boolean; order: number }
    >();
    for (const product of allProducts) {
      for (const flavor of product.flavors ?? []) {
        if (!flavor.is_active || seen.has(flavor.id)) continue;
        seen.set(flavor.id, {
          id: flavor.id,
          name: flavor.name,
          seasonal: flavor.is_seasonal,
          order: flavor.display_order,
        });
      }
    }
    return [...seen.values()]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .slice(0, 12);
  });

  /** Printed-menu block: up to 4 items per category, in category order. */
  const menuGroups = $derived.by(() =>
    categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        items: allProducts
          .filter((product) => product.category_id === category.id)
          .slice(0, 4)
          .map((product) => ({
            id: product.id,
            name: product.name,
            price: offerBasePrice(product.id, offers) ?? product.price,
          })),
      }))
      .filter((group) => group.items.length > 0)
      .slice(0, 4),
  );

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

<section class="hero rays" aria-labelledby="hero-title">
  <div class="hero__inner">
    <div class="hero__copy">
      <p class="brand-label">
        <span class="brand-label__num">19</span>GELATOS &amp; SORBETES<span
          class="brand-label__num">68</span
        >
      </p>
      <h1 id="hero-title" class="hero__title">
        Sabores que<br />cuentan <span class="marker">historias</span>
      </h1>
      <p class="hero__lead">
        Gelatos artesanales y sorbetes naturales con la receta de la familia,
        hechos cada día en Ahuachapán.
      </p>
      <div class="hero__actions">
        <a
          href="/menu"
          class="btn btn-primary btn-lg min-h-13 rounded-full px-7"
        >
          Ver el menú
          <Icon icon="lucide:arrow-right" class="size-5" aria-hidden="true" />
        </a>
        <a
          href="#visitanos"
          class="btn btn-lg hero__outline min-h-13 rounded-full"
        >
          Cómo llegar
        </a>
      </div>
      {#if !loading && heroStatus}
        <p class="hero__status" data-tone={heroStatus.tone}>
          <span class="dot" aria-hidden="true"></span>
          {heroStatus.text}
        </p>
      {/if}
    </div>

    <figure class="hero__art">
      <img
        src="/images/brand/paletero-dia.webp"
        alt="Ilustración del paletero con su carretón de sorbete"
        width="771"
        height="900"
        class="art-day"
        fetchpriority="high"
      />
      <img
        src="/images/brand/paletero-noche.webp"
        alt="Ilustración del paletero con su carretón de sorbete"
        width="771"
        height="900"
        class="art-night"
      />
      <figcaption class="hero__caption" aria-hidden="true">
        la receta<br />de la familia
        <svg
          width="62"
          height="44"
          viewBox="0 0 70 48"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M4 8c22-4 44 6 56 30"></path>
          <path d="M50 34l10 5 1-11"></path>
        </svg>
      </figcaption>
    </figure>
  </div>
</section>
<div class="scallops" aria-hidden="true"></div>

<div class="home">
  {#if categories.length > 0}
    <section aria-labelledby="home-categories">
      <h2 id="home-categories" class="section-title">¿Qué se te antoja?</h2>
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
    <div class="section-head">
      <h2 id="home-featured" class="section-title">Los favoritos</h2>
      <a href="/menu" class="section-link">Ver todo el menú →</a>
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
        class="rounded-box border border-base-300 bg-base-100 p-6 text-center"
        role="alert"
      >
        <p class="mb-3 font-medium">{error}</p>
        <button
          type="button"
          class="btn btn-primary min-h-11 rounded-full"
          onclick={() => void loadHome()}>Reintentar</button
        >
      </div>
    {:else if featured.length === 0}
      <p class="text-ink-muted">
        Pronto tendremos favoritos aquí. Mientras tanto, <a
          href="/menu"
          class="section-link">mira el menú completo</a
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

  {#if houseFlavors.length > 0}
    <section aria-labelledby="home-flavors">
      <div class="section-head">
        <h2 id="home-flavors" class="section-title">Sabores de la casa</h2>
        {#if houseFlavors.some((f) => f.seasonal)}
          <p class="text-ink-muted">
            ★ De temporada: cambian con la fruta del mercado.
          </p>
        {/if}
      </div>
      <ul class="flavors">
        {#each houseFlavors as flavor (flavor.id)}
          <li class="flavor">
            <span
              class="flavor__scoop"
              style={`--scoop: ${flavorColor(flavor.name)}`}
            >
              {#if flavor.seasonal}
                <span class="flavor__star" aria-hidden="true">★</span>
              {/if}
            </span>
            <span class="flavor__name">{flavor.name}</span>
            {#if flavor.seasonal}
              <span class="flavor__note">de temporada</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if menuGroups.length > 0}
    <section aria-labelledby="home-menu" class="printed-menu">
      <div class="section-head">
        <h2 id="home-menu" class="section-title">Sorbetes &amp; Gelato</h2>
        <a href="/menu" class="section-link">Ver el menú completo →</a>
      </div>
      <div class="printed-menu__grid">
        {#each menuGroups as group (group.id)}
          <div>
            <h3 class="menu-bar">
              <a href={`/menu?categoria=${encodeURIComponent(group.slug)}`}
                >{group.name}</a
              >
            </h3>
            <ul class="printed-menu__list">
              {#each group.items as item (item.id)}
                <li>
                  <span class="font-medium">{item.name}</span>
                  <span class="leader" aria-hidden="true"></span>
                  <span class="printed-menu__price"
                    >{formatCurrency(item.price)}</span
                  >
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
      {#if status.inStoreOnly}
        <p class="printed-menu__note">
          Por ahora los pedidos son en la sucursal: arma tu orden aquí y
          muéstrala en caja, o escríbenos por WhatsApp.
        </p>
      {/if}
    </section>
  {/if}
</div>

<section class="story" aria-labelledby="story-title">
  <div class="story__inner">
    <div class="story__art rays rays--cream">
      <img
        src="/images/brand/frutera-dia.webp"
        alt="Ilustración de la frutera en moto con su canasta de fruta fresca"
        width="760"
        height="706"
        loading="lazy"
        class="art-day"
      />
      <img
        src="/images/brand/frutera-noche.webp"
        alt="Ilustración de la frutera en moto con su canasta de fruta fresca"
        width="760"
        height="706"
        loading="lazy"
        class="art-night"
      />
    </div>
    <div class="story__copy">
      <h2 id="story-title" class="story__title">
        Llevo frutas frescas<br />para crear
        <span class="marker">sabores nuevos</span>
      </h2>
      <p class="story__text">{BRAND_MISSION}</p>
      <div class="story__actions">
        <BrandStamp />
        <a
          href="/about"
          class="btn btn-outline btn-lg story__btn min-h-12 rounded-full"
        >
          Nuestra historia
        </a>
      </div>
    </div>
  </div>
</section>

<div class="home">
  <section id="visitanos" aria-labelledby="visit-title" class="scroll-mt-24">
    <h2 id="visit-title" class="section-title">Visítanos</h2>
    <p class="mb-6 text-ink-muted">
      Nuestras sucursales en Ahuachapán: el mismo menú y los mismos precios.
    </p>
    <StoreLocationsList variant="cards" />
    <div class="mt-6">
      <StoreHoursCard />
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
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* ── Hero ─────────────────────────────────────────────── */
  .hero {
    color: var(--brand-hero-ink);
    overflow: hidden;
  }
  .hero__inner {
    max-width: 75rem;
    margin: 0 auto;
    padding: 2.5rem 1rem 0;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem 2.5rem;
  }
  .hero__copy {
    flex: 1 1 30rem;
    min-width: 0;
    padding-bottom: 2.5rem;
    animation: rise 600ms var(--ease-out) both;
  }
  .hero__title {
    margin: 1.125rem 0 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(3.5rem, 8vw, 7.25rem);
    line-height: 0.88;
    color: var(--brand-head);
  }
  .hero__lead {
    margin: 1.25rem 0 0;
    max-width: 32rem;
    font-size: 1.1875rem;
    line-height: 1.55;
  }
  .hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.75rem;
  }
  .min-h-13 {
    min-height: 3.25rem;
  }
  .hero__outline {
    background: transparent;
    border: 2px solid currentColor;
    color: inherit;
  }
  .hero__outline:hover {
    background: color-mix(in oklab, currentColor 10%, transparent);
  }
  .hero__status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1.125rem 0 0;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    font-size: 0.9375rem;
    font-weight: 700;
    background: var(--st-ready);
    color: var(--st-ready-ink);
  }
  .hero__status[data-tone="closing"] {
    background: var(--st-review);
    color: var(--st-review-ink);
  }
  .hero__status[data-tone="closed"] {
    background: var(--brand-pink-tint);
    color: var(--brand-head);
  }
  .hero__status .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: currentColor;
  }
  .hero__art {
    flex: 0 1 26rem;
    min-width: 16rem;
    margin: 0;
    position: relative;
    display: flex;
    justify-content: center;
    animation: rise 700ms 120ms var(--ease-out) both;
  }
  .hero__art img {
    width: min(100%, 27.5rem);
    height: auto;
  }
  @media (max-width: 639px) {
    .hero__art img {
      width: min(80%, 16rem);
    }
  }
  .hero__caption {
    position: absolute;
    top: 2%;
    left: -2.5rem;
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1;
    color: var(--brand-head);
    transform: rotate(-6deg);
  }
  .hero__caption svg {
    margin-top: 1.5rem;
  }
  @media (max-width: 1023px) {
    .hero__caption {
      display: none;
    }
  }

  /* ── Sections ─────────────────────────────────────────── */
  .home {
    max-width: 75rem;
    margin: 0 auto;
    padding: 3rem 1rem 1rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 3.5rem;
  }
  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1.5rem;
    margin-bottom: 1.25rem;
  }
  .section-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(2.5rem, 5vw, 3.75rem);
    line-height: 1;
    color: var(--brand-head);
  }
  section > .section-title {
    margin-bottom: 1rem;
  }
  .section-link {
    font-weight: 700;
    color: var(--brand-price);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }
  .section-link:hover {
    color: var(--brand-head);
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
    color: var(--brand-head);
    font-weight: 700;
    transition:
      border-color var(--dur-fast) var(--ease-out),
      background-color var(--dur-fast) var(--ease-out);
  }
  .home-category:hover {
    border-color: var(--brand-head);
    background: var(--brand-pink-tint);
  }
  .home-category:focus-visible {
    outline: 3px solid var(--color-primary);
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

  /* Flavour scoops */
  .flavors {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem 1.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .flavor {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 5.75rem;
    text-align: center;
  }
  .flavor__scoop {
    position: relative;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 50%;
    background: var(--scoop);
    border: 3px solid var(--brand-scoop-line);
    box-shadow: inset -8px -8px 0 rgb(0 0 0 / 0.08);
  }
  .flavor__star {
    position: absolute;
    right: -0.5rem;
    top: -0.375rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--brand-cream-tint);
    color: var(--st-review-ink);
    font-size: 0.75rem;
    font-weight: 900;
    border: 2px solid var(--color-base-200);
  }
  .flavor__name {
    font-weight: 700;
  }
  .flavor__note {
    margin-top: -0.4rem;
    font-size: 0.8125rem;
    color: var(--brand-ink-muted);
  }

  /* Printed menu */
  .printed-menu {
    border-radius: 1.75rem;
    background: var(--color-base-100);
    border: 1px solid var(--color-base-300);
    padding: clamp(1.25rem, 4vw, 3rem);
  }
  .printed-menu__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 2rem 2.5rem;
  }
  .printed-menu .menu-bar a {
    color: inherit;
    text-decoration: none;
  }
  .printed-menu .menu-bar a:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .printed-menu__list {
    display: grid;
    gap: 0.75rem;
    margin: 0.875rem 0 0;
    padding: 0;
    list-style: none;
  }
  .printed-menu__list li {
    display: flex;
    align-items: baseline;
    font-size: 1.0625rem;
  }
  .printed-menu__price {
    font-weight: 900;
    color: var(--brand-price);
  }
  .printed-menu__note {
    margin: 1.75rem 0 0;
    padding: 0.875rem 1.125rem;
    border-radius: 0.875rem;
    background: var(--brand-pink-tint);
    color: var(--brand-head);
    font-weight: 500;
  }

  /* ── Story ────────────────────────────────────────────── */
  .story {
    margin-top: 3.5rem;
    background: color-mix(
      in oklab,
      var(--color-base-200) 85%,
      var(--color-base-300)
    );
  }
  .story__inner {
    max-width: 75rem;
    margin: 0 auto;
    padding: 3.5rem 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2rem 3.5rem;
  }
  .story__art {
    --rays-at: 50% 115%;
    flex: 1 1 20rem;
    display: flex;
    justify-content: center;
    padding: 2rem 1rem 0;
    border-radius: 1.75rem;
    overflow: hidden;
  }
  .story__art img {
    width: min(100%, 23.75rem);
    height: auto;
  }
  .story__copy {
    flex: 999 1 24rem;
    min-width: 0;
  }
  .story__title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(2.75rem, 5vw, 4.5rem);
    line-height: 0.95;
    color: var(--brand-head);
  }
  .story__text {
    margin: 1.25rem 0 0;
    max-width: 38rem;
    font-size: 1.125rem;
    line-height: 1.65;
  }
  .story__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.25rem;
    margin-top: 1.75rem;
  }
  .story__btn {
    border-width: 2px;
    border-color: var(--brand-head);
    color: var(--brand-head);
    background: transparent;
  }
  .story__btn:hover {
    background: var(--brand-pink-tint);
  }

  @media (prefers-reduced-motion: reduce) {
    .hero__copy,
    .hero__art {
      animation: none;
    }
  }
</style>
