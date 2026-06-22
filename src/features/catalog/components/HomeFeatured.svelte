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
  import "../../../styles/home.css";

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

<div class="home-featured space-y-0">
  <section class="relative overflow-hidden px-4 pt-8 pb-16 md:pt-12 md:pb-20">
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="hero-blob-teal absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl"
        style="background: var(--ishos-teal);"
      ></div>
      <div
        class="hero-blob-pink absolute -bottom-16 -right-16 w-80 h-80 rounded-full blur-3xl"
        style="background: var(--ishos-pink);"
      ></div>
      <div
        class="hero-blob-blue absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl"
        style="background: var(--ishos-yellow);"
      ></div>
      <div class="stripe-bg absolute inset-0 opacity-40"></div>
    </div>

    <div class="relative max-w-3xl mx-auto text-center fade-up fade-up-1">
      <div class="section-pill mb-5">
        <span
          class="w-1.5 h-1.5 rounded-full inline-block mr-2 align-middle"
          style="background: var(--ishos-teal);"
        ></span>
        Desde 2021
      </div>

      <h1
        class="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 leading-tight"
      >
        <span
          class="text-transparent bg-clip-text"
          style="background-image: var(--brand-gradient);"
        >
          Isho's Factory
        </span>
      </h1>
      <p
        class="hero-kicker mt-3 text-sm font-medium uppercase tracking-[0.16em] text-base-content/65 md:text-base"
      >
        Tradicion desde 2021
      </p>
      <p class="hero-copy mt-2 text-sm text-base-content/75 md:text-base">
        Sabores artesanales listos para pedir en minutos.
      </p>
    </div>
  </section>

  <div class="wave-divider -mt-2" style="color: var(--ishos-teal);">
    <svg
      viewBox="0 0 1440 60"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      style="height:40px; width:100%;"
    >
      <path
        d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
        fill="var(--home-wave-fill)"
      ></path>
    </svg>
  </div>

  <!-- Special Offers (only if offers exist) -->
  {#if !loading && offers.length > 0}
    <div class="fade-up fade-up-2">
      <StoreOffers
        {offers}
        products={allProducts.length > 0 ? allProducts : featured}
        {ordersEnabled}
      />
    </div>
  {/if}

  <!-- Featured Products Section -->
  <section class="max-w-7xl mx-auto px-4 pt-2 pb-8 md:pt-3 md:pb-10">
    <div class="text-center mb-4 md:mb-6 fade-up fade-up-3">
      <div class="section-pill mb-3">Destacados</div>
      <h2 class="text-2xl md:text-3xl font-bold mb-1">Productos Destacados</h2>
      <p
        class="featured-subtitle text-base-content/70 font-medium text-sm md:text-base"
      >
        Nuestros sabores más queridos.
      </p>
    </div>

    {#if loading}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
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
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
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
  :global([data-theme="night"]) .home-featured .featured-subtitle {
    color: oklch(var(--bc) / 0.82);
  }
</style>
