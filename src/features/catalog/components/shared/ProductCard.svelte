<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import ProductArt from "./ProductArt.svelte";
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
    /** Product needs choices (flavours, toppings) before it can be added. */
    showSelectButton?: boolean;
    countdown?: string;
    note?: string;
    onOpen?: () => void;
    onAdd?: (button: HTMLElement) => void;
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
    seasonalLabel = "De temporada",
    showSelectButton = false,
    countdown,
    note,
    onOpen = () => {},
    onAdd = () => {},
    onSelect = () => {},
  }: Props = $props();

  const hasDiscount = $derived(
    typeof offer?.discount_price === "number" &&
      offer.discount_price > 0 &&
      offer.discount_price < product.price,
  );
  const soldOut = $derived(
    !product.is_available || product.stock_status === "out_of_stock",
  );
  const lowStock = $derived(!soldOut && product.stock_status === "low_stock");
  const canOrder = $derived(ordersEnabled && !soldOut);
  const actionLabel = $derived(
    showSelectButton
      ? `Elegir opciones de ${product.name}`
      : `Agregar ${product.name}`,
  );

  let imgFailed = $state(false);
  $effect(() => {
    imageUrl;
    imgFailed = false;
  });

  function handleAction(event: MouseEvent) {
    event.stopPropagation();
    if (href) event.preventDefault();
    if (showSelectButton) onSelect();
    else onAdd(event.currentTarget as HTMLElement);
  }
</script>

<div class="pc-root group" class:pc-root--sold-out={soldOut}>
  {#if href}
    <a {href} class="pc-card pc-card--{variant}" aria-label={product.name}>
      {@render cardInner()}
    </a>
  {:else}
    <article class="pc-card pc-card--{variant}">
      {#if clickable && !soldOut}
        <button
          type="button"
          class="pc-open"
          aria-label={`Ver ${product.name}`}
          onclick={onOpen}
        ></button>
      {/if}
      {@render cardInner()}
    </article>
  {/if}
</div>

{#snippet cardInner()}
  <figure class="pc-figure">
    {#if imageUrl && !imgFailed}
      <img
        src={imageUrl}
        alt=""
        class="pc-img"
        loading="lazy"
        decoding="async"
        width="400"
        height="300"
        onerror={() => (imgFailed = true)}
      />
    {:else}
      <ProductArt
        name={product.name}
        category={product.category_name}
        scoops={product.ball_quantity}
        seed={product.id}
      />
    {/if}

    {#if soldOut}
      <span class="pc-badge pc-badge--muted">Agotado</span>
    {:else if offer}
      <span class="pc-badge pc-badge--offer">{offer.label || "Oferta"}</span>
    {:else if lowStock}
      <span class="pc-badge pc-badge--warn">Últimas unidades</span>
    {/if}

    {#if countdown && !soldOut}
      <span class="pc-countdown" aria-label={`Termina en ${countdown}`}>
        <Icon icon="lucide:clock-3" class="size-3" />{countdown}
      </span>
    {/if}
  </figure>

  <div class="pc-body">
    <h3 class="pc-name">{product.name}</h3>
    {#if note}
      <p class="pc-note">{note}</p>
    {:else if showSeasonalBadge}
      <p class="pc-note pc-note--season">
        <Icon icon="lucide:leaf" class="size-3.5" />{seasonalLabel}
      </p>
    {/if}
    <div class="pc-foot">
      <p class="pc-price">
        {#if hasDiscount}
          <span class="pc-price-now"
            >{formatCurrency(offer?.discount_price ?? 0)}</span
          >
          <s class="pc-price-was">{formatCurrency(product.price)}</s>
        {:else}
          <span class="pc-price-now">{formatCurrency(product.price)}</span>
        {/if}
      </p>
      {#if canOrder}
        <button
          type="button"
          class="pc-add"
          aria-label={actionLabel}
          title={actionLabel}
          onclick={handleAction}
        >
          <Icon icon="lucide:plus" class="size-5" />
        </button>
      {/if}
    </div>
  </div>
{/snippet}

<style>
  .pc-root {
    position: relative;
    height: 100%;
  }
  .pc-card {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border-radius: var(--radius-box);
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    color: var(--color-base-content);
    text-decoration: none;
    box-shadow:
      0 1px 2px rgb(16 40 38 / 0.05),
      0 4px 14px rgb(16 40 38 / 0.05);
    transition:
      transform var(--dur-panel) var(--ease-out),
      box-shadow var(--dur-panel) var(--ease-out),
      border-color var(--dur-panel) var(--ease-out);
  }
  @media (hover: hover) {
    .pc-root:not(.pc-root--sold-out) .pc-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgb(16 40 38 / 0.12);
      border-color: color-mix(
        in oklab,
        var(--color-primary) 35%,
        var(--color-base-300)
      );
    }
  }
  :global([data-theme="night"]) .pc-card {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.05),
      0 8px 24px rgb(0 0 0 / 0.32);
  }
  @media (hover: hover) {
    :global([data-theme="night"])
      .pc-root:not(.pc-root--sold-out)
      .pc-card:hover {
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 0.06),
        0 16px 36px rgb(0 0 0 / 0.5);
    }
  }
  /* Whole card opens the product; the add button sits above this layer. */
  .pc-open {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: 0;
    background: transparent;
    cursor: pointer;
    border-radius: inherit;
  }
  .pc-open:focus-visible,
  .pc-card:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 2px;
  }

  .pc-figure {
    position: relative;
    margin: 0;
    aspect-ratio: 4 / 3;
    max-width: 100%;
    overflow: hidden;
    background: var(--color-base-200);
  }
  .pc-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pc-root--sold-out .pc-figure,
  .pc-root--sold-out .pc-name,
  .pc-root--sold-out .pc-price {
    opacity: 0.5;
  }

  .pc-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    padding: 3px 9px;
    border-radius: 999px;
  }
  .pc-badge--offer {
    background: var(--color-secondary);
    color: var(--color-secondary-content);
  }
  .pc-badge--muted {
    background: var(--color-neutral);
    color: var(--color-neutral-content);
  }
  .pc-badge--warn {
    background: var(--color-warning);
    color: var(--color-warning-content);
  }
  .pc-countdown {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--color-base-100);
    color: var(--color-base-content);
  }

  .pc-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px 12px;
    flex: 1;
  }
  .pc-name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pc-note {
    margin: 0;
    font-size: 0.78rem;
    color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .pc-note--season {
    color: color-mix(
      in oklab,
      var(--color-success) 90%,
      var(--color-base-content)
    );
  }
  .pc-foot {
    margin-top: auto;
    padding-top: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .pc-price {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .pc-price-now {
    font-weight: 700;
    font-size: 1.02rem;
    color: var(--color-primary);
  }
  .pc-price-was {
    font-size: 0.8rem;
    color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
  }
  .pc-add {
    position: relative;
    z-index: 2;
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    cursor: pointer;
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .pc-add:active {
    transform: scale(0.92);
  }
  .pc-add:focus-visible {
    outline: 3px solid var(--color-secondary);
    outline-offset: 2px;
  }
</style>
