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
  import ProductModal from "./shared/ProductModal.svelte";
  import ProductSlider from "./shared/ProductSlider.svelte";
  import StoreOffers from "./StoreOffers.svelte";
  import {
    computeUnitPrice,
    isProductConfigurable,
    type ProductCustomizationDraft,
  } from "@features/catalog/lib/customization";
  import "../../../styles/home.css";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);
  let allProducts = $state<PublicProduct[]>([]);
  let ordersEnabled = $state(true);
  let offers = $state<StoreOfferItem[]>([]);
  let selectedProduct = $state<PublicProduct | null>(null);
  let selectedDraft = $state<ProductCustomizationDraft | null>(null);
  let selectedBasePrice = $state<number | undefined>(undefined);
  const featuredSkeletonCards = Array.from({ length: 4 }, (_, index) => index);
  const activeOfferMap = $derived(buildActiveOfferMap(offers));
  const featuredSliderItems = $derived(
    featured.map((product) => ({ id: product.id, product })),
  );

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

  function openProductModal(
    product: PublicProduct,
    initialDraft?: ProductCustomizationDraft,
    basePrice?: number,
  ) {
    selectedProduct = product;
    selectedDraft = initialDraft ?? { quantity: 1 };
    selectedBasePrice = basePrice;
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

<div class="home-featured space-y-0">
  <section class="relative overflow-hidden px-4 pt-4 pb-8 md:pt-6 md:pb-10">
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="hero-blob-teal absolute -top-16 -left-16 w-72 h-72 rounded-full blur-3xl"
        style="background: var(--ishos-teal);"
      ></div>
      <div
        class="hero-blob-pink absolute -bottom-12 -right-12 w-56 h-56 rounded-full blur-3xl"
        style="background: var(--ishos-pink);"
      ></div>
      <div
        class="hero-blob-blue absolute top-1/3 right-1/4 w-48 h-48 rounded-full blur-3xl"
        style="background: var(--ishos-yellow);"
      ></div>
      <div class="stripe-bg absolute inset-0 opacity-40"></div>
    </div>

    <div class="relative max-w-3xl mx-auto text-center fade-up fade-up-1">
      <div class="section-pill mb-3">
        <span
          class="w-1.5 h-1.5 rounded-full inline-block mr-2 align-middle"
          style="background: var(--ishos-teal);"
        ></span>
        Desde 2021
      </div>

      <h1
        class="text-3xl md:text-4xl font-bold tracking-tight mb-2 leading-tight"
      >
        <span
          class="text-transparent bg-clip-text"
          style="background-image: var(--brand-gradient);"
        >
          Isho's Factory
        </span>
      </h1>
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
        onConfigure={openProductModal}
      />
    </div>
  {/if}

  <!-- Featured Products Section -->
  <section class="max-w-7xl mx-auto px-4 pt-2 pb-8 md:pt-3 md:pb-10">
    <div class="text-center mb-4 md:mb-6 fade-up fade-up-3">
      <div class="section-pill mb-3">Destacados</div>
      <h2 class="text-2xl md:text-3xl font-bold mb-1">Productos Destacados</h2>
    </div>

    {#if loading}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        {#each featuredSkeletonCards as cardIndex (cardIndex)}
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
    {:else if error}
      <div class="alert alert-error max-w-xl mx-auto rounded-xl shadow-sm">
        {error}
      </div>
    {:else}
      <ProductSlider
        items={featuredSliderItems}
        ariaLabel="Productos Destacados"
        maxCards={4}
      >
        {#snippet card(item, index)}
          {@const product = item.product}
          {@const offer = activeOfferMap.get(product.id)}
          <ProductCard
            {product}
            {offer}
            href="/menu"
            imageUrl={toSafeImageUrl(product.image_url)}
            {ordersEnabled}
            variant="featured"
            showSelectButton={true}
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
        {/snippet}
      </ProductSlider>
    {/if}
  </section>

  <!-- About / Contact CTA Section -->
  <section class="relative overflow-hidden">
    <div class="stripe-bg absolute inset-0 opacity-30"></div>
    <div
      class="absolute inset-x-0 top-0 h-px"
      style="background: linear-gradient(90deg, transparent, var(--ishos-teal), var(--ishos-pink), var(--ishos-yellow), transparent);"
    ></div>

    <div
      class="relative max-w-3xl mx-auto px-4 py-10 md:py-14 text-center fade-up fade-up-4"
    >
      <div class="section-pill mb-3">Conócenos</div>
      <h2 class="text-xl md:text-2xl font-bold text-base-content mb-2">
        ¿Quieres saber más de <span style="color: var(--ishos-teal);"
          >Isho's Factory</span
        >?
      </h2>
      <p
        class="text-sm md:text-base text-base-content/60 mb-5 max-w-md mx-auto leading-relaxed"
      >
        Descubre nuestra historia, valores y cómo contactarnos.
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href="/about"
          class="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style="background: var(--ishos-teal);"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
          Conocer más
        </a>
        <a
          href="/about#contacto"
          class="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold border transition-colors hover:bg-base-100/50"
          style="border-color: color-mix(in srgb, var(--ishos-teal) 40%, transparent); color: var(--ishos-teal);"
        >
          Contáctanos
        </a>
      </div>
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
