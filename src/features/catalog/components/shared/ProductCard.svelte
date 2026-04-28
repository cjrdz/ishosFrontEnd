<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
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

  // Unified card: always full-height, image fills, info overlays from bottom.
  // The outer wrapper handles link/button semantics; the article is purely visual.
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
</script>

<!--
  Single unified wrapper pattern:
  - href   → <a>
  - clickable → <div> + invisible overlay <button>
  - default → <div>
  All three share the same inner <article> markup — no duplication.
-->
<div
  class="pc-root h-full group"
  class:pc-root--featured={variant === "featured"}
>
  {#if href}
    <a {href} class="pc-link" aria-label={product.name}>
      <article class="pc-card pc-card--{variant}">
        {@render cardInner()}
      </article>
    </a>
  {:else if clickable}
    <!-- Invisible full-card button sits above everything except the add/select controls -->
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
  <!-- Image layer -->
  {#if imageUrl}
    <figure class="pc-figure" aria-hidden="true">
      <img src={imageUrl} alt={product.name} class="pc-img" loading="lazy" />
      <!-- Gradient: stronger at bottom for legible text, lighter at top -->
      <div class="pc-gradient"></div>
    </figure>
  {:else}
    <div class="pc-no-image">
      <Icon icon="lucide:image-off" class="size-10 opacity-30" />
    </div>
  {/if}

  <!-- Offer badge (single source of truth — do not add a second badge in the parent) -->
  {#if offer}
    <span class="badge badge-warning badge-sm absolute left-3 top-3 z-20">
      {offer.label || "Oferta"}
    </span>
  {/if}

  <!-- Urgency countdown chip — rendered inside the card so it is clipped by overflow:hidden -->
  {#if countdown}
    <div class="pc-countdown" aria-label="Tiempo restante">
      <Icon icon="lucide:clock-3" class="size-3" />
      <span>{countdown}</span>
    </div>
  {/if}

  <!-- Seasonal badge -->
  {#if showSeasonalBadge}
    <span class="badge badge-primary badge-sm absolute right-3 top-3 z-20">
      {seasonalLabel}
    </span>
  {/if}

  <!-- Add-to-cart fab -->
  {#if ordersEnabled && !showSelectButton}
    <button
      type="button"
      class="pc-add-btn"
      aria-label={`Agregar ${product.name} al pedido`}
      onclick={handleAdd}
    >
      <Icon icon="lucide:plus" class="size-4" />
    </button>
  {/if}

  <!-- Info bar at bottom -->
  <div class="pc-info {imageUrl ? 'pc-info--over-image' : 'pc-info--plain'}">
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

        {#if ordersEnabled && showSelectButton}
          <button type="button" class="pc-select-btn" onclick={handleSelect}>
            Seleccionar
          </button>
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
    max-width: 17.5rem;
    margin-inline: auto;
  }

  /* Featured variant fills its carousel slot fully */
  .pc-root--featured {
    max-width: 100%;
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
    outline: 2px solid oklch(var(--p) / 0.5);
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
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 24rem;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid oklch(var(--b2) / 0.7);
    background-color: oklch(var(--b1));
    box-shadow:
      0 1px 3px oklch(0% 0 0 / 0.07),
      0 1px 2px oklch(0% 0 0 / 0.06);
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
    /* Featured cards have slightly softer shadow at rest */
    box-shadow: 0 1px 2px oklch(0% 0 0 / 0.06);
  }

  /* Hover: lift + subtle scale on the whole group */
  .pc-root:hover .pc-card,
  .pc-link:hover .pc-card {
    box-shadow:
      0 4px 16px oklch(0% 0 0 / 0.12),
      0 2px 6px oklch(0% 0 0 / 0.08);
    transform: translateY(-2px);
  }

  /* ── Image & gradient ────────────────────────────────────────── */
  .pc-figure {
    position: absolute;
    inset: 0;
    overflow: hidden;
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

  /* Two-stop gradient: readable text without killing the image */
  .pc-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      oklch(0% 0 0 / 0.82) 0%,
      oklch(0% 0 0 / 0.28) 45%,
      transparent 100%
    );
  }

  /* Fallback when no image */
  .pc-no-image {
    flex: 1;
    display: grid;
    place-items: center;
    background-color: oklch(var(--b2) / 0.6);
  }

  /* ── Add FAB ─────────────────────────────────────────────────── */
  .pc-add-btn {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    z-index: 20;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    border: none;
    background-color: oklch(var(--p));
    color: oklch(var(--pc));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px oklch(var(--p) / 0.45);
    /* Always visible on touch, fade+scale in on hover for pointer devices */
    opacity: 1;
    transform: scale(1);
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .pc-add-btn {
      opacity: 0;
      transform: scale(0.8);
    }
    .pc-root:hover .pc-add-btn,
    .pc-link:hover .pc-add-btn {
      opacity: 1;
      transform: scale(1);
    }
  }
  .pc-add-btn:hover {
    box-shadow: 0 4px 14px oklch(var(--p) / 0.55);
    transform: scale(1.08);
  }
  .pc-add-btn:focus-visible {
    outline: 2px solid oklch(var(--p) / 0.5);
    outline-offset: 2px;
  }

  /* ── Info bar ────────────────────────────────────────────────── */
  .pc-info {
    position: relative;
    z-index: 20;
    margin-top: auto;
  }

  .pc-info--over-image {
    /* Floating frosted-glass pill at the card bottom */
    padding: 0 0.5rem 0.5rem;
  }

  .pc-info--plain {
    padding: 0.75rem;
    border-top: 1px solid oklch(var(--b2) / 0.5);
  }

  .pc-info-inner {
    padding: 0.625rem 0.75rem 0.625rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  /* Frosted pill only when sitting over image */
  .pc-info--over-image .pc-info-inner {
    background-color: oklch(var(--b1) / 0.18);
    backdrop-filter: blur(10px) saturate(1.4);
    -webkit-backdrop-filter: blur(10px) saturate(1.4);
    border-radius: 0.875rem;
    border: 1px solid oklch(1 0 0 / 0.1);
  }

  .pc-name {
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
    color: white;
    margin: 0;
  }

  .pc-info--plain .pc-name {
    color: oklch(var(--bc));
  }

  /* ── Pricing ─────────────────────────────────────────────────── */
  .pc-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .pc-prices {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
  }

  .pc-price-main {
    font-size: 1.125rem;
    font-weight: 800;
    color: white;
    line-height: 1;
  }
  @media (min-width: 768px) {
    .pc-price-main {
      font-size: 1.25rem;
    }
  }

  .pc-info--plain .pc-price-main {
    color: oklch(var(--p));
  }

  .pc-price-before {
    font-size: 0.75rem;
    text-decoration: line-through;
    color: oklch(1 0 0 / 0.55);
  }

  .pc-info--plain .pc-price-before {
    color: oklch(var(--bc) / 0.4);
  }

  /* ── Select button ───────────────────────────────────────────── */
  .pc-select-btn {
    flex-shrink: 0;
    padding: 0.3rem 0.875rem;
    border-radius: 9999px;
    border: none;
    background-color: oklch(var(--p));
    color: oklch(var(--pc));
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      box-shadow 0.2s ease,
      transform 0.15s ease;
    position: relative;
    z-index: 20;
  }
  .pc-select-btn:hover {
    box-shadow: 0 3px 10px oklch(var(--p) / 0.4);
    transform: translateY(-1px);
  }
  @media (min-width: 768px) {
    .pc-select-btn {
      padding: 0.35rem 1.1rem;
      font-size: 0.8125rem;
    }
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
    background: oklch(0 0 0 / 0.42);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid oklch(1 0 0 / 0.1);
    color: white;
    font-size: 0.68rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
    pointer-events: none;
  }

  /* ── Offer note ──────────────────────────────────────────────── */
  .pc-note {
    font-size: 0.7rem;
    color: oklch(1 0 0 / 0.72);
    line-height: 1.3;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pc-info--plain .pc-note {
    color: oklch(var(--bc) / 0.6);
  }

  /* ── Dark-theme overrides ────────────────────────────────────── */
  :global([data-theme="night"]) .pc-card {
    background-color: oklch(var(--b1) / 0.95);
    border-color: oklch(var(--bc) / 0.18);
  }

  :global([data-theme="night"]) .pc-info--over-image .pc-info-inner {
    background-color: oklch(var(--b1) / 0.35);
    border-color: oklch(1 0 0 / 0.06);
  }

  :global([data-theme="night"]) .pc-price-before {
    color: oklch(var(--bc) / 0.55);
  }
</style>
