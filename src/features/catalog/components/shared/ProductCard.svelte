<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import "../../../../styles/product-card.css";
  import type {
    PublicProduct,
    StoreOfferItem,
  } from "@features/catalog/lib/api";

  interface Props {
    product: PublicProduct;
    offer?: StoreOfferItem;
    imageUrl?: string;
    ordersEnabled?: boolean;
    href?: string;
    variant?: "menu" | "featured";
    clickable?: boolean;
    showSeasonalBadge?: boolean;
    seasonalLabel?: string;
    showSelectButton?: boolean;
    countdown?: string;
    note?: string;
    onOpen?: () => void;
    onAdd?: () => void;
    onSelect?: () => void;
  }

  let {
    product,
    offer,
    imageUrl,
    ordersEnabled = true,
    href,
    variant = "menu",
    clickable = false,
    showSeasonalBadge = false,
    seasonalLabel = "Temporada",
    showSelectButton = false,
    countdown,
    note,
    onOpen = () => {},
    onAdd = () => {},
    onSelect = () => {},
  }: Props = $props();

  const hasDiscount = $derived(
    typeof offer?.discount_price === "number" && offer.discount_price > 0,
  );

  function handleOpen() {
    if (clickable) onOpen();
  }

  function handleAdd(event: MouseEvent) {
    event.stopPropagation();
    if (href) event.preventDefault();
    onAdd();
  }

  function handleSelect(event: MouseEvent) {
    event.stopPropagation();
    onSelect();
  }

  let imgFailed = $state(false);
  function handleImgError() {
    imgFailed = true;
  }
  $effect(() => {
    imageUrl;
    imgFailed = false;
  });
</script>

<!--
  Single unified wrapper pattern:
  - href   → <a>
  - clickable → <div> + invisible overlay <button>
  - default → <div>
  All three share the same inner <article> markup — no duplication.
-->
<div class="pc-root h-full group">
  {#if href}
    <a {href} class="pc-link" aria-label={product.name}>
      <article class="pc-card pc-card--{variant}">
        {@render cardInner()}
      </article>
    </a>
  {:else if clickable}
    <button
      type="button"
      class="pc-overlay-btn"
      aria-label={`Ver detalles de ${product.name}`}
      onclick={handleOpen}
    ></button>
    <article class="pc-card pc-card--{variant}">
      {@render cardInner()}
    </article>
  {:else}
    <article class="pc-card pc-card--{variant}">
      {@render cardInner()}
    </article>
  {/if}
</div>

{#snippet cardInner()}
  <!-- Image fills the card; card height set by aspect ratio -->
  <figure class="pc-figure" aria-hidden="true">
    {#if imageUrl && !imgFailed}
      <img
        src={imageUrl}
        alt={product.name}
        class="pc-img"
        loading="lazy"
        onerror={handleImgError}
      />
      <!-- Gradient ensures text stays readable without killing image visibility -->
      <div class="pc-gradient"></div>
    {:else}
      <div
        class="pc-no-image"
        role="img"
        aria-label={`Imagen no disponible para ${product.name}`}
      >
        <Icon
          icon="lucide:image-off"
          class="size-10 opacity-30"
          aria-hidden="true"
        />
      </div>
    {/if}
  </figure>

  <!-- Stock status badge -->
  {#if product.stock_status === "out_of_stock"}
    <span class="badge badge-error badge-sm absolute left-3 top-3 z-20">
      Agotado
    </span>
  {:else if product.stock_status === "low_stock"}
    <span class="badge badge-warning badge-sm absolute left-3 top-3 z-20">
      Stock bajo
    </span>
  {/if}

  <!-- Offer badge -->
  {#if offer}
    <span class="badge badge-warning badge-sm absolute left-3 top-3 z-20">
      {offer.label || "Oferta"}
    </span>
  {/if}

  <!-- Seasonal badge -->
  {#if showSeasonalBadge}
    <span class="badge badge-primary badge-sm absolute right-3 top-3 z-20">
      {seasonalLabel}
    </span>
  {/if}

  <!-- Countdown chip -->
  {#if countdown}
    <div class="pc-countdown" aria-label="Tiempo restante">
      <Icon icon="lucide:clock-3" class="size-3" />
      <span>{countdown}</span>
    </div>
  {/if}

  <!-- Floating info pill at the bottom; gradient + subtle blur keeps image visible -->
  <div class="pc-info">
    <div class="pc-info-inner">
      <h3 class="pc-name">{product.name}</h3>

      {#if note}
        <p class="pc-note">{note}</p>
      {/if}

      <div class="pc-price-row">
        <div class="pc-prices">
          {#if hasDiscount}
            <span class="pc-price-before">{formatCurrency(product.price)}</span>
            <span class="pc-price-main"
              >{formatCurrency(offer?.discount_price ?? 0)}</span
            >
          {:else}
            <span class="pc-price-main">{formatCurrency(product.price)}</span>
          {/if}
        </div>

        {#if ordersEnabled}
          {#if showSelectButton}
            <button type="button" class="pc-action-btn" onclick={handleSelect}>
              Seleccionar
            </button>
          {:else}
            <button type="button" class="pc-action-btn" onclick={handleAdd}>
              Agregar
            </button>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/snippet}

<style>
  /* ── Root wrapper ────────────────────────────────────────────── */
  .pc-root {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* Full-card invisible overlay for clickable cards */
  .pc-overlay-btn {
    position: absolute;
    inset: 0;
    z-index: 10;
    border-radius: 1.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .pc-overlay-btn:focus-visible {
    outline: 2px solid var(--ishos-teal);
    outline-offset: 2px;
  }

  /* ── Link wrapper ────────────────────────────────────────────── */
  .pc-link {
    display: block;
    height: 100%;
    text-decoration: none;
  }

  /* ── Card shell ──────────────────────────────────────────────── */
  .pc-card {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    /* Taller ratio so products feel substantial and images show fully */
    aspect-ratio: 3 / 4;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid oklch(var(--b2) / 0.7);
    background-color: oklch(var(--b2) / 0.55);
    box-shadow: var(--pc-card-shadow);
    transition:
      box-shadow 0.25s ease,
      transform 0.25s ease;
    isolation: isolate;
  }
  @media (min-width: 640px) {
    .pc-card {
      border-radius: 1.5rem;
    }
  }

  .pc-card--featured {
    box-shadow: 0 1px 2px oklch(0% 0 0 / 0.06);
  }

  /* Hover: lift + subtle scale on the whole group */
  .pc-root:hover .pc-card,
  .pc-link:hover .pc-card {
    box-shadow: var(--pc-card-shadow-hover);
    transform: translateY(-2px) scale(1.01);
  }

  /* ── Image ───────────────────────────────────────────────────── */
  .pc-figure {
    position: absolute;
    inset: 0;
    overflow: hidden;
    margin: 0;
  }

  .pc-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: transform 0.5s ease;
    display: block;
  }
  .pc-root:hover .pc-img,
  .pc-link:hover .pc-img {
    transform: scale(1.04);
  }

  /* Gradient keeps text legible while letting the image show through */
  .pc-gradient {
    position: absolute;
    inset: 0;
    background: var(--pc-gradient-overlay);
    pointer-events: none;
  }

  /* Fallback when no image */
  .pc-no-image {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
  }

  .pc-no-image :global(svg) {
    opacity: 0.25;
  }

  /* ── Countdown chip ─────────────────────────────────────────── */
  .pc-countdown {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    background: var(--pc-countdown-bg);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--pc-countdown-border);
    color: var(--pc-text-over-image);
    font-size: 0.68rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
    pointer-events: none;
    text-shadow: 0 1px 2px oklch(0% 0 0 / 0.35);
  }

  /* ── Floating info pill ──────────────────────────────────────── */
  .pc-info {
    position: absolute;
    left: 0.5rem;
    right: 0.5rem;
    bottom: 0.5rem;
    z-index: 20;
  }

  .pc-info-inner {
    padding: 0.625rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background-color: var(--pc-pill-bg);
    backdrop-filter: blur(10px) saturate(1.4);
    -webkit-backdrop-filter: blur(10px) saturate(1.4);
    border-radius: 0.875rem;
    border: 1px solid var(--pc-pill-border);
  }

  .pc-name {
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--pc-text-over-image);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 0 1px 3px oklch(0% 0 0 / 0.45);
  }
  @media (min-width: 640px) {
    .pc-name {
      font-size: 1rem;
    }
  }

  .pc-note {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--pc-note-over);
    line-height: 1.35;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 0 1px 3px oklch(0% 0 0 / 0.55);
  }

  /* ── Pricing ─────────────────────────────────────────────────── */
  .pc-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.125rem;
  }

  .pc-prices {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .pc-price-main {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--pc-text-over-image);
    line-height: 1;
    text-shadow: 0 1px 3px oklch(0% 0 0 / 0.45);
  }
  @media (min-width: 640px) {
    .pc-price-main {
      font-size: 1.15rem;
    }
  }

  .pc-price-before {
    font-size: 0.75rem;
    text-decoration: line-through;
    color: var(--pc-price-strikethrough-over);
    text-shadow: 0 1px 2px oklch(0% 0 0 / 0.35);
  }

  /* ── Action button ───────────────────────────────────────────── */
  .pc-action-btn {
    flex-shrink: 0;
    padding: 0.35rem 0.875rem;
    border-radius: 9999px;
    border: 1px solid oklch(1 0 0 / 0.25);
    background-color: var(--ishos-teal);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px oklch(0% 0 0 / 0.25);
    transition:
      box-shadow 0.2s ease,
      transform 0.15s ease,
      filter 0.2s ease;
    position: relative;
    z-index: 20;
  }
  .pc-action-btn:hover {
    box-shadow: 0 4px 12px oklch(0% 0 0 / 0.35);
    transform: translateY(-1px);
    filter: brightness(1.08);
  }
  .pc-action-btn:focus-visible {
    outline: 2px solid var(--ishos-teal);
    outline-offset: 2px;
  }
  @media (min-width: 640px) {
    .pc-action-btn {
      padding: 0.4rem 1rem;
      font-size: 0.8125rem;
    }
  }

  /* ── Dark-theme overrides ────────────────────────────────────── */
  :global([data-theme="night"]) .pc-card {
    border-color: oklch(var(--bc) / 0.18);
  }

  :global([data-theme="night"]) .pc-info-inner {
    background-color: oklch(var(--b1) / 0.35);
    border-color: oklch(1 0 0 / 0.06);
  }

  :global([data-theme="night"]) .pc-price-before {
    color: oklch(1 0 0 / 0.55);
  }
</style>
