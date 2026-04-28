<script lang="ts">
  import { onMount } from "svelte";
  import { toSafeImageUrl } from "@shared/utils/formatters";
  import { addCartItem } from "@features/catalog/lib/cart";
  import { buildActiveOfferMap } from "@features/catalog/lib/offers";
  import {
    fetchStoreSettings,
    listPublicProducts,
    type PublicProduct,
    type StoreOfferItem,
  } from "@features/catalog/lib/api";
  import ProductCard from "./shared/ProductCard.svelte";
  import StoreOffers from "./StoreOffers.svelte";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);
  let allProducts = $state<PublicProduct[]>([]);
  let ordersEnabled = $state(true);
  let offers = $state<StoreOfferItem[]>([]);
  const featuredSkeletonCards = Array.from({ length: 4 }, (_, index) => index);
  const activeOfferMap = $derived(buildActiveOfferMap(offers));

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
          <ProductCard
            {product}
            {offer}
            href="/menu"
            imageUrl={toSafeImageUrl(product.image_url)}
            {ordersEnabled}
            variant="featured"
            onAdd={() => {
              addCartItem({
                product_id: product.id,
                name: product.name,
                image_url: toSafeImageUrl(product.image_url),
                unit_price: product.price,
                quantity: 1,
              });
            }}
          />
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
</style>
