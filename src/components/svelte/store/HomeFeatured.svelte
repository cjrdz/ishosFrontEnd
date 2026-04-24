<script lang="ts">
  import { onMount } from "svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { addCartItem } from "../../../lib/store/cart";
  import {
    fetchStoreSettings,
    listPublicProducts,
    type PublicProduct,
    type StoreOfferItem,
  } from "../../../lib/api/store";
  import StoreOffers from "./StoreOffers.svelte";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);
  let allProducts = $state<PublicProduct[]>([]);
  let ordersEnabled = $state(true);
  let offers = $state<StoreOfferItem[]>([]);
  const featuredSkeletonCards = Array.from({ length: 4 }, (_, index) => index);
  const activeOfferMap = $derived.by(() => {
    const now = Date.now();
    const map = new Map<string, StoreOfferItem>();
    for (const offer of offers) {
      if (new Date(offer.expires_at).getTime() > now) {
        map.set(offer.product_id, offer);
      }
    }
    return map;
  });

  onMount(() => {
    void loadFeatured();
  });

  async function loadFeatured() {
    loading = true;
    error = "";

    try {
      const [featuredRes, catalogRes, settings] = await Promise.all([
        fetch("/api/store/featured").then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as PublicProduct[];
        }),
        listPublicProducts(),
        fetchStoreSettings().catch(() => ({
          orders_enabled: true,
          offers: [] as StoreOfferItem[],
        })),
      ]);
      featured = featuredRes;
      allProducts = catalogRes.filter((item) => item.is_available);
      ordersEnabled = settings.orders_enabled;
      offers = settings.offers ?? [];
    } catch (requestError) {
      error =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar el menú.";
    } finally {
      loading = false;
    }
  }

  function getSafeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (
      url.startsWith("/") ||
      url.startsWith("http://") ||
      url.startsWith("https://")
    )
      return url;
    return undefined;
  }
</script>

<div class="home-featured space-y-1 md:space-y-3">
  <section class="max-w-7xl mx-auto px-4 pt-4 pb-2 md:pt-6 md:pb-4 text-center">
    <div
      class="hero-surface mx-auto max-w-3xl rounded-3xl border border-base-200/70 bg-base-100/70 px-4 py-5 shadow-sm backdrop-blur-sm md:px-8 md:py-7"
    >
      <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
        <span
          class="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary"
        >
          Isho's Factory
        </span>
      </h1>
      <p
        class="hero-kicker mt-3 text-sm font-medium uppercase tracking-[0.16em] text-base-content/55 md:text-base"
      >
        Tradicion desde 2021
      </p>
      <p class="hero-copy mt-2 text-sm text-base-content/65 md:text-base">
        Sabores artesanales listos para pedir en minutos.
      </p>
    </div>
  </section>

  <!-- Special Offers (only if offers exist) -->
  {#if !loading && offers.length > 0}
    <StoreOffers
      {offers}
      products={allProducts.length > 0 ? allProducts : featured}
      {ordersEnabled}
    />
  {/if}

  <!-- Featured Products Section -->
  <section class="max-w-7xl mx-auto px-4 pt-2 pb-8 md:pt-3 md:pb-10">
    <div class="text-center mb-4 md:mb-6">
      <h2 class="text-2xl md:text-3xl font-bold inline-block mb-1">
        Productos Destacados
      </h2>
      <p
        class="featured-subtitle text-base-content/60 font-medium text-sm md:text-base"
      >
        Nuestros sabores más queridos.
      </p>
    </div>

    {#if loading}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {#each featuredSkeletonCards as cardIndex (cardIndex)}
          <article
            class="card bg-base-100 w-full shadow-sm border border-base-200/50 overflow-hidden h-full rounded-2xl sm:rounded-3xl"
            aria-hidden="true"
          >
            <div class="skeleton w-full aspect-square"></div>
            <div class="card-body p-3 sm:p-4 md:p-5 space-y-2">
              <div class="skeleton h-4 w-3/4"></div>
              <div class="skeleton h-5 w-16"></div>
            </div>
          </article>
        {/each}
      </div>
    {:else if error}
      <div class="alert alert-error max-w-xl mx-auto rounded-xl shadow-sm">
        {error}
      </div>
    {:else}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {#each featured as product (product.id)}
          {@const offer = activeOfferMap.get(product.id)}
          <a href="/menu" class="h-full group block">
            <article
              class="featured-card card bg-base-100 w-full border border-base-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full rounded-2xl sm:rounded-3xl"
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
                      {offer.label || "Oferta"}
                    </span>
                  {/if}
                  {#if ordersEnabled}
                    <button
                      type="button"
                      class="absolute bottom-2.5 right-2.5 z-10 size-8 rounded-full bg-primary text-primary-content shadow-md flex items-center justify-center opacity-100 md:opacity-0 scale-90 md:group-hover:opacity-100 md:group-hover:scale-100 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label={`Agregar ${product.name} al pedido`}
                      onclick={(event) => {
                        event.preventDefault();
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
                      +
                    </button>
                  {/if}
                </figure>
              {/if}
              <div class="p-3 sm:p-4 md:p-5">
                <h3
                  class="text-sm md:text-base font-semibold leading-tight mb-1.5"
                >
                  {product.name}
                </h3>
                {#if offer?.discount_price}
                  <div class="flex items-baseline gap-2">
                    <span
                      class="price-before text-xs line-through text-base-content/40"
                      >{formatCurrency(product.price)}</span
                    >
                    <span class="text-base md:text-lg font-bold text-primary"
                      >{formatCurrency(offer.discount_price)}</span
                    >
                  </div>
                {:else}
                  <span class="text-base md:text-lg font-bold text-primary"
                    >{formatCurrency(product.price)}</span
                  >
                {/if}
              </div>
            </article>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  :global([data-theme="night"]) .home-featured .hero-surface {
    background-color: oklch(var(--b1) / 0.92);
    border-color: oklch(var(--bc) / 0.22);
    box-shadow: 0 14px 30px oklch(0 0 0 / 0.26);
  }

  :global([data-theme="night"]) .home-featured .hero-kicker {
    color: oklch(var(--bc) / 0.78);
  }

  :global([data-theme="night"]) .home-featured .hero-copy,
  :global([data-theme="night"]) .home-featured .featured-subtitle {
    color: oklch(var(--bc) / 0.82);
  }

  :global([data-theme="night"]) .home-featured .featured-card {
    background-color: oklch(var(--b1) / 0.95);
    border-color: oklch(var(--bc) / 0.2);
  }

  :global([data-theme="night"]) .home-featured .price-before {
    color: oklch(var(--bc) / 0.62);
  }
</style>
