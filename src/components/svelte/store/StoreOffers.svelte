<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Icon from "../shared/AppIcon.svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { addCartItem } from "../../../lib/store/cart";
  import type { StoreOfferItem } from "../../../lib/api/store";
  import type { PublicProduct } from "../../../lib/api/store";

  interface Props {
    offers: StoreOfferItem[];
    products: PublicProduct[];
    ordersEnabled: boolean;
  }

  let { offers, products, ordersEnabled }: Props = $props();

  let now = $state(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;
  let flippedOfferId = $state<string | null>(null);

  const activeOffers = $derived(
    offers
      .map((offer) => {
        const product = products.find((p) => p.id === offer.product_id);
        const expiresMs = new Date(offer.expires_at).getTime();
        return { ...offer, product, expiresMs };
      })
      .filter((o) => o.product && o.expiresMs > now),
  );

  onMount(() => {
    timer = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  function formatCountdown(expiresMs: number): string {
    const diff = Math.max(0, expiresMs - now);
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
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

  function addOfferToCart(product: PublicProduct) {
    addCartItem({
      product_id: product.id,
      name: product.name,
      image_url: getSafeImageUrl(product.image_url),
      unit_price: product.price,
      quantity: 1,
    });
  }

  function addOfferAndGoToCart(product: PublicProduct) {
    addOfferToCart(product);
    window.location.href = "/order/cart#checkout";
  }

  function toggleOfferDetails(productId: string) {
    flippedOfferId = flippedOfferId === productId ? null : productId;
  }

  function handleOfferCardKeydown(event: KeyboardEvent, productId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleOfferDetails(productId);
    }
  }

  function hasDiscount(offer: StoreOfferItem): boolean {
    return typeof offer.discount_price === "number" && offer.discount_price > 0;
  }

  function hasOfferNote(offer: StoreOfferItem): boolean {
    return typeof offer.note === "string" && offer.note.trim().length > 0;
  }
</script>

{#if activeOffers.length > 0}
  <section class="max-w-7xl mx-auto px-4 py-6 md:py-10">
    <div class="text-center mb-5 md:mb-8">
      <h2 class="text-2xl md:text-3xl font-bold inline-block mb-1">
        Productos Especiales
      </h2>
      <p class="text-base-content/60 font-medium text-sm md:text-base">
        Aprovecha nuestros productos por tiempo limitado.
      </p>
    </div>

    <div
      class={`offers-scroll ${activeOffers.length <= 2 ? "md:justify-center" : ""}`}
    >
      {#each activeOffers as offer (offer.product_id)}
        {@const product = offer.product!}
        {@const canFlip = hasOfferNote(offer)}
        <div class="min-w-64 max-w-80 shrink-0">
          <div
            class="flip-3d-card h-full"
            data-flipped={canFlip && flippedOfferId === offer.product_id
              ? "true"
              : "false"}
          >
            {#if canFlip}
              <div
                class="flip-3d-toggle h-full rounded-3xl cursor-pointer focus:outline-none focus:ring-4 focus:ring-warning/30"
                role="button"
                tabindex={0}
                aria-label={flippedOfferId === offer.product_id
                  ? `Volver a la oferta de ${product.name}`
                  : `Ver detalles de la oferta de ${product.name}`}
                onclick={() => toggleOfferDetails(offer.product_id)}
                onkeydown={(event) =>
                  handleOfferCardKeydown(event, offer.product_id)}
              >
                <div class="flip-3d-inner h-full min-h-104 rounded-3xl">
                  <article
                    class="flip-3d-face overflow-hidden rounded-3xl border border-warning/30 bg-base-100 shadow-sm transition-shadow duration-300 hover:shadow-lg"
                  >
                    {#if getSafeImageUrl(product.image_url)}
                      <figure
                        class="relative aspect-4/3 w-full overflow-hidden bg-base-200/50"
                      >
                        <img
                          src={getSafeImageUrl(product.image_url)}
                          alt={product.name}
                          class="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                        <span
                          class="absolute left-3 top-3 badge badge-warning badge-sm font-semibold shadow-sm"
                        >
                          {offer.label}
                        </span>
                      </figure>
                    {:else}
                      <div
                        class="grid aspect-4/3 place-items-center bg-base-200/60 text-base-content/45"
                      >
                        <Icon icon="lucide:image-off" class="size-10" />
                      </div>
                    {/if}
                    <div class="flex h-full flex-col p-4 md:p-5">
                      <div
                        class="mb-3 flex items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2"
                      >
                        <span
                          class="text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-content/80"
                          >Expira en</span
                        >
                        <span
                          class="countdown-badge text-sm font-bold text-warning-content"
                          >{formatCountdown(offer.expiresMs)}</span
                        >
                      </div>
                      <h3
                        class="text-base font-semibold leading-tight md:text-lg"
                      >
                        {product.name}
                      </h3>
                      <p class="mt-2 line-clamp-2 text-sm text-base-content/65">
                        {offer.note ||
                          product.description ||
                          "Descubre esta oferta especial disponible por tiempo limitado."}
                      </p>

                      <div class="mt-auto space-y-3 pt-4">
                        <div class="flex items-end justify-between gap-3">
                          {#if hasDiscount(offer)}
                            <div class="flex items-baseline gap-2">
                              <span
                                class="text-xs md:text-sm line-through text-base-content/40"
                                >{formatCurrency(product.price)}</span
                              >
                              <span
                                class="text-lg font-bold text-primary md:text-2xl"
                                >{formatCurrency(
                                  offer.discount_price ?? 0,
                                )}</span
                              >
                            </div>
                          {:else}
                            <span
                              class="text-lg font-bold text-primary md:text-2xl"
                              >{formatCurrency(product.price)}</span
                            >
                          {/if}
                        </div>

                        {#if ordersEnabled}
                          <div class="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              class="btn btn-primary btn-sm rounded-full w-full"
                              onclick={(event) => {
                                event.stopPropagation();
                                addOfferToCart(product);
                              }}
                            >
                              Agregar
                            </button>
                            <button
                              type="button"
                              class="btn btn-outline btn-sm rounded-full w-full"
                              onclick={(event) => {
                                event.stopPropagation();
                                addOfferAndGoToCart(product);
                              }}
                            >
                              Pedir
                            </button>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </article>

                  <article
                    class="flip-3d-face flip-3d-back overflow-hidden rounded-3xl border border-warning/20 bg-base-100 shadow-lg"
                  >
                    {#if getSafeImageUrl(product.image_url)}
                      <img
                        src={getSafeImageUrl(product.image_url)}
                        alt={product.name}
                        class="absolute inset-0 h-full w-full object-cover object-center opacity-[0.14] blur-sm scale-110"
                        loading="lazy"
                      />
                    {/if}
                    <div
                      class="absolute inset-0 bg-base-100/92 backdrop-blur-md"
                    ></div>
                    <div
                      class="relative z-10 flex h-full flex-col p-5 text-left"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <h3 class="mt-2 text-xl font-black">
                            {product.name}
                          </h3>
                        </div>
                        <span class="badge badge-warning badge-outline"
                          >{offer.label}</span
                        >
                      </div>

                      <p class="mt-4 text-sm leading-6 text-base-content/70">
                        {offer.note ||
                          "Sin descripcion adicional disponible para esta oferta."}
                      </p>

                      {#if hasDiscount(offer)}
                        <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <div class="rounded-2xl bg-base-200/65 p-3">
                            <p
                              class="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45"
                            >
                              Precio base
                            </p>
                            <p class="mt-2 text-lg font-bold text-base-content">
                              {formatCurrency(product.price)}
                            </p>
                          </div>
                          <div class="rounded-2xl bg-warning/10 p-3">
                            <p
                              class="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning-content/70"
                            >
                              Oferta
                            </p>
                            <p class="mt-2 text-lg font-bold text-primary">
                              {formatCurrency(offer.discount_price ?? 0)}
                            </p>
                          </div>
                        </div>
                      {:else}
                        <div
                          class="mt-5 rounded-2xl border border-base-300 bg-base-200/55 p-3 text-sm"
                        >
                          <p
                            class="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45"
                          >
                            Precio
                          </p>
                          <p class="mt-2 text-lg font-bold text-primary">
                            {formatCurrency(product.price)}
                          </p>
                        </div>
                      {/if}

                      <div class="mt-auto space-y-3 pt-5">
                        <div
                          class="flex items-center justify-between gap-2 rounded-2xl border border-base-300 bg-base-100/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-base-content/60"
                        >
                          <span>Expira en</span>
                          <span
                            class="countdown-badge text-sm text-base-content"
                            >{formatCountdown(offer.expiresMs)}</span
                          >
                        </div>
                        <button
                          type="button"
                          class="btn btn-outline btn-sm rounded-full w-full"
                          onclick={(event) => {
                            event.stopPropagation();
                            toggleOfferDetails(offer.product_id);
                          }}
                        >
                          Volver a la tarjeta
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            {:else}
              <div class="flip-3d-toggle h-full rounded-3xl cursor-default">
                <div class="flip-3d-inner h-full min-h-104 rounded-3xl">
                  <article
                    class="flip-3d-face overflow-hidden rounded-3xl border border-warning/30 bg-base-100 shadow-sm transition-shadow duration-300 hover:shadow-lg"
                  >
                    {#if getSafeImageUrl(product.image_url)}
                      <figure
                        class="relative aspect-4/3 w-full overflow-hidden bg-base-200/50"
                      >
                        <img
                          src={getSafeImageUrl(product.image_url)}
                          alt={product.name}
                          class="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                        <span
                          class="absolute left-3 top-3 badge badge-warning badge-sm font-semibold shadow-sm"
                        >
                          {offer.label}
                        </span>
                      </figure>
                    {:else}
                      <div
                        class="grid aspect-4/3 place-items-center bg-base-200/60 text-base-content/45"
                      >
                        <Icon icon="lucide:image-off" class="size-10" />
                      </div>
                    {/if}
                    <div class="flex h-full flex-col p-4 md:p-5">
                      <div
                        class="mb-3 flex items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2"
                      >
                        <span
                          class="text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-content/80"
                          >Expira en</span
                        >
                        <span
                          class="countdown-badge text-sm font-bold text-warning-content"
                          >{formatCountdown(offer.expiresMs)}</span
                        >
                      </div>
                      <h3
                        class="text-base font-semibold leading-tight md:text-lg"
                      >
                        {product.name}
                      </h3>
                      <p class="mt-2 line-clamp-2 text-sm text-base-content/65">
                        {offer.note ||
                          product.description ||
                          "Descubre esta oferta especial disponible por tiempo limitado."}
                      </p>

                      <div class="mt-auto space-y-3 pt-4">
                        <div class="flex items-end justify-between gap-3">
                          {#if hasDiscount(offer)}
                            <div class="flex items-baseline gap-2">
                              <span
                                class="text-xs md:text-sm line-through text-base-content/40"
                                >{formatCurrency(product.price)}</span
                              >
                              <span
                                class="text-lg font-bold text-primary md:text-2xl"
                                >{formatCurrency(
                                  offer.discount_price ?? 0,
                                )}</span
                              >
                            </div>
                          {:else}
                            <span
                              class="text-lg font-bold text-primary md:text-2xl"
                              >{formatCurrency(product.price)}</span
                            >
                          {/if}
                        </div>

                        {#if ordersEnabled}
                          <div class="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              class="btn btn-primary btn-sm rounded-full w-full"
                              onclick={(event) => {
                                event.stopPropagation();
                                addOfferToCart(product);
                              }}
                            >
                              Agregar
                            </button>
                            <button
                              type="button"
                              class="btn btn-outline btn-sm rounded-full w-full"
                              onclick={(event) => {
                                event.stopPropagation();
                                addOfferAndGoToCart(product);
                              }}
                            >
                              Pedir
                            </button>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
