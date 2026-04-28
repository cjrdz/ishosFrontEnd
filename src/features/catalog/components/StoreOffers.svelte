<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import ProductCard from "./shared/ProductCard.svelte";
  import { toSafeImageUrl } from "@shared/utils/formatters";
  import { addCartItem } from "@features/catalog/lib/cart";
  import { resolveActiveOffers } from "@features/catalog/lib/offers";
  import type {
    StoreOfferItem,
    PublicProduct,
  } from "@features/catalog/lib/api";

  interface Props {
    offers: StoreOfferItem[];
    products: PublicProduct[];
    ordersEnabled: boolean;
  }

  let { offers, products, ordersEnabled }: Props = $props();

  // ── State ──────────────────────────────────────────────────────────
  let now = $state(Date.now());
  let activeIndex = $state(0);
  let trackEl = $state<HTMLDivElement | null>(null);
  let viewportEl = $state<HTMLDivElement | null>(null);
  let cardsPerView = $state(1);

  // Drag state
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragCurrentX = 0;
  let dragOffset = $state(0); // live pixel offset while dragging

  // Timers
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let slideTimer: ReturnType<typeof setInterval> | null = null;
  let isPaused = false;

  const AUTO_SLIDE_MS = 4500;
  const DRAG_THRESHOLD = 40; // px to commit a slide

  const activeOffers = $derived(resolveActiveOffers(offers, products, now));
  // How many "pages" are available given the current viewport width
  const maxIndex = $derived(Math.max(0, activeOffers.length - cardsPerView));
  const slideWidthPct = $derived(100 / cardsPerView);

  // ── Lifecycle ──────────────────────────────────────────────────────
  let resizeObserver: ResizeObserver | null = null;

  // Min card width (px) used to compute how many cards fit in the container.
  const MIN_CARD_WIDTH = 260;

  function computeCardsPerView(containerWidth: number): number {
    return Math.max(
      1,
      Math.min(2, Math.floor(containerWidth / MIN_CARD_WIDTH)),
    );
  }

  onMount(() => {
    if (viewportEl) {
      cardsPerView = computeCardsPerView(viewportEl.clientWidth);
    }
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const next = computeCardsPerView(width);
      if (next !== cardsPerView) {
        cardsPerView = next;
        if (activeIndex > maxIndex) activeIndex = maxIndex;
        startAutoSlide();
      }
    });
    if (viewportEl) resizeObserver.observe(viewportEl);
    clockTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
    startAutoSlide();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (clockTimer) clearInterval(clockTimer);
    stopAutoSlide();
  });

  // ── Auto-slide ─────────────────────────────────────────────────────
  function startAutoSlide() {
    stopAutoSlide();
    if (maxIndex < 1) return;
    slideTimer = setInterval(() => {
      if (!isPaused) goTo(activeIndex < maxIndex ? activeIndex + 1 : 0);
    }, AUTO_SLIDE_MS);
  }

  function stopAutoSlide() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────
  function goTo(index: number) {
    activeIndex = Math.max(0, Math.min(index, maxIndex));
  }

  function prev() {
    goTo(activeIndex > 0 ? activeIndex - 1 : maxIndex);
    startAutoSlide();
  }

  function next() {
    goTo(activeIndex < maxIndex ? activeIndex + 1 : 0);
    startAutoSlide();
  }

  // ── Drag / swipe ───────────────────────────────────────────────────
  function onDragStart(clientX: number) {
    isDragging = true;
    isPaused = true;
    dragStartX = clientX;
    dragCurrentX = clientX;
    dragOffset = 0;
  }

  function onDragMove(clientX: number) {
    if (!isDragging) return;
    dragCurrentX = clientX;
    dragOffset = dragCurrentX - dragStartX;
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    const delta = dragCurrentX - dragStartX;
    if (delta < -DRAG_THRESHOLD) next();
    else if (delta > DRAG_THRESHOLD) prev();
    dragOffset = 0;
    isPaused = false;
    startAutoSlide();
  }

  // Mouse events
  function handleMouseDown(e: MouseEvent) {
    onDragStart(e.clientX);
  }
  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      e.preventDefault();
      onDragMove(e.clientX);
    }
  }
  function handleMouseUp() {
    onDragEnd();
  }
  function handleMouseLeave() {
    if (isDragging) onDragEnd();
  }

  // Touch events
  function handleTouchStart(e: TouchEvent) {
    onDragStart(e.touches[0].clientX);
  }
  function handleTouchMove(e: TouchEvent) {
    onDragMove(e.touches[0].clientX);
  }
  function handleTouchEnd() {
    onDragEnd();
  }

  // Pause on hover (desktop)
  function handleMouseEnter() {
    isPaused = true;
  }
  function handleMouseExitArea() {
    if (!isDragging) isPaused = false;
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function formatCountdown(expiresMs: number): string {
    const diff = Math.max(0, expiresMs - now);
    const s = Math.floor(diff / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  function addOfferToCart(product: PublicProduct) {
    addCartItem({
      product_id: product.id,
      name: product.name,
      image_url: toSafeImageUrl(product.image_url),
      unit_price: product.price,
      quantity: 1,
    });
  }

  // Translate percentage including live drag offset
  const translateX = $derived(
    `calc(${-activeIndex * slideWidthPct}% + ${dragOffset}px)`,
  );
</script>

{#if activeOffers.length > 0}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section
    class="w-full max-w-2xl mx-auto px-4 py-4 select-none"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseExitArea}
    aria-label="Productos Especiales"
  >
    <!-- Header -->
    <div class="text-center mb-4">
      <h2 class="text-2xl font-extrabold tracking-tight">
        Productos Especiales
      </h2>
      <p class="text-sm text-base-content/60 mt-1">
        Ofertas activas con precio especial por tiempo limitado.
      </p>
    </div>

    <!-- Viewport — clips the track -->
    <div
      class="relative w-full overflow-hidden rounded-2xl"
      bind:this={viewportEl}
    >
      <!-- Track — slides horizontally -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        bind:this={trackEl}
        class="flex w-full"
        class:transition-transform={!isDragging}
        class:duration-300={!isDragging}
        class:ease-out={!isDragging}
        class:cursor-grabbing={isDragging}
        class:cursor-grab={!isDragging}
        style="transform: translateX({translateX});"
        role="list"
        onmousedown={handleMouseDown}
        onmousemove={handleMouseMove}
        onmouseup={handleMouseUp}
        onmouseleave={handleMouseLeave}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
      >
        {#each activeOffers as offer, index (`${offer.product_id}:${offer.expires_at}:${offer.label}:${index}`)}
          {@const product = offer.product!}

          <!-- Each slide occupies 1/cardsPerView of the track width -->
          <div
            class="shrink-0 flex justify-center px-2"
            style="width: {slideWidthPct}%"
            role="listitem"
            aria-label={product.name}
          >
            <!-- Inner cap: on single-card view prevent the card from stretching beyond a readable width -->
            <div
              class="w-full"
              style="max-width: {cardsPerView === 1 ? '20rem' : '100%'}"
            >
              <!-- Product card — badge, countdown and note render inside the card -->
              <ProductCard
                {product}
                {offer}
                imageUrl={toSafeImageUrl(product.image_url)}
                href="/menu"
                {ordersEnabled}
                variant="featured"
                countdown={formatCountdown(offer.expiresMs)}
                note={offer.note}
                onAdd={() => addOfferToCart(product)}
              />
            </div>
          </div>
        {/each}
      </div>

      <!-- Edge nav arrows (desktop only) -->
      {#if maxIndex > 0}
        <button
          class="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30
               btn btn-circle btn-sm bg-base-100/80 border-base-300/60
               backdrop-blur-sm shadow-md hover:bg-base-100"
          aria-label="Anterior"
          onclick={prev}
        >
          <Icon icon="lucide:chevron-left" class="size-4" />
        </button>
        <button
          class="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30
               btn btn-circle btn-sm bg-base-100/80 border-base-300/60
               backdrop-blur-sm shadow-md hover:bg-base-100"
          aria-label="Siguiente"
          onclick={next}
        >
          <Icon icon="lucide:chevron-right" class="size-4" />
        </button>
      {/if}
    </div>

    <!-- Dot indicators — one dot per page, not per offer -->
    {#if maxIndex > 0}
      <div class="flex items-center justify-center gap-2 mt-3" role="tablist">
        {#each { length: maxIndex + 1 } as _, i}
          <button
            class="h-1.75 rounded-full border-none p-0 cursor-pointer transition-all duration-200
                 {activeIndex === i
              ? 'w-[1.1rem] bg-primary'
              : 'w-1.75 bg-base-content/20 hover:bg-base-content/40'}"
            role="tab"
            aria-selected={activeIndex === i}
            aria-label={`Página ${i + 1}`}
            onclick={() => {
              goTo(i);
              startAutoSlide();
            }}
          ></button>
        {/each}
      </div>
    {/if}
  </section>
{/if}
