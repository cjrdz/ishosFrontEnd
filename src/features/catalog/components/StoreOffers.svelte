<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import ProductCard from "./shared/ProductCard.svelte";
  import ProductSlider from "./shared/ProductSlider.svelte";
  import { toSafeImageUrl } from "@shared/utils/formatters";
  import { addCartItem } from "@features/catalog/lib/cart";
  import { flyTo } from "@shared/motion/motion";
  import { resolveActiveOffers } from "@features/catalog/lib/offers";
  import { isProductConfigurable } from "@features/catalog/lib/customization";
  import type {
    StoreOfferItem,
    PublicProduct,
  } from "@features/catalog/lib/api";
  import type { ProductCustomizationDraft } from "@features/catalog/lib/customization";

  interface Props {
    offers: StoreOfferItem[];
    products: PublicProduct[];
    ordersEnabled: boolean;
    onConfigure?: (
      product: PublicProduct,
      initialDraft?: ProductCustomizationDraft,
    ) => void;
  }

  let { offers, products, ordersEnabled, onConfigure }: Props = $props();

  let now = $state(Date.now());
  let clockTimer: ReturnType<typeof setInterval> | null = null;

  const activeOffers = $derived(resolveActiveOffers(offers, products, now));

  const sliderItems = $derived(
    activeOffers.map((offer) => ({
      id: `${offer.product_id}:${offer.expires_at}:${offer.label}`,
      offer,
    })),
  );

  onMount(() => {
    clockTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (clockTimer) clearInterval(clockTimer);
  });

  function formatCountdown(expiresMs: number): string {
    const diff = Math.max(0, expiresMs - now);
    const s = Math.floor(diff / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  function addOfferToCart(
    product: PublicProduct,
    offer: StoreOfferItem,
    button?: HTMLElement,
  ) {
    const initialDraft: ProductCustomizationDraft = {
      quantity: 1,
      flavor_id: offer.flavor_id || undefined,
      flavor_ids: offer.flavor_ids || undefined,
    };
    const offerPrice =
      typeof offer.discount_price === "number" && offer.discount_price > 0
        ? offer.discount_price
        : undefined;

    if (isProductConfigurable(product)) {
      onConfigure?.(product, initialDraft, offerPrice);
      return;
    }

    addCartItem({
      product_id: product.id,
      name: product.name,
      image_url: toSafeImageUrl(product.image_url),
      unit_price: offerPrice ?? product.price,
      quantity: 1,
      flavor_id: initialDraft.flavor_id,
      flavor_ids: initialDraft.flavor_ids,
    });
    void flyTo(button, document.querySelector("[data-cart-target]"));
  }
</script>

{#if activeOffers.length > 0}
  <section aria-labelledby="store-offers-title">
    <div class="mb-2">
      <h2
        id="store-offers-title"
        class="font-display font-bold text-4xl md:text-5xl"
      >
        Ofertas por tiempo limitado
      </h2>
      <p class="mt-1 text-base-content/70">
        Precio especial mientras dure el contador.
      </p>
    </div>

    <ProductSlider
      items={sliderItems}
      ariaLabel="Ofertas por tiempo limitado"
      maxCards={4}
    >
      {#snippet card(item, index)}
        {@const offer = item.offer}
        {@const product = offer.product!}
        <ProductCard
          {product}
          {offer}
          imageUrl={toSafeImageUrl(product.image_url)}
          href="/menu"
          {ordersEnabled}
          variant="featured"
          countdown={formatCountdown(offer.expiresMs)}
          note={offer.note}
          onAdd={(button) => addOfferToCart(product, offer, button)}
        />
      {/snippet}
    </ProductSlider>
  </section>
{/if}
