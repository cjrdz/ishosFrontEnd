<script lang="ts">
  import { formatCurrency } from "@shared/utils/formatters";
  import type { Category, Product } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    products: Product[];
    categories: Category[];
    /** Product open in the configuration panel, if any. */
    activeProductId: string;
    recentProducts: Product[];
    /** Units of each product already in the order. */
    countsById: Record<string, number>;
    /** Products sold out at this location: shown greyed out, not pickable. */
    soldOutIds?: string[];
    onPick: (productId: string) => void;
  }

  let {
    products,
    categories,
    activeProductId,
    recentProducts,
    countsById,
    soldOutIds = [],
    onPick,
  }: Props = $props();

  const soldOut = $derived(new Set(soldOutIds));

  let selectedCategoryId = $state<string>("all");
  let productSearch = $state("");
  let searchRef = $state<HTMLInputElement | null>(null);

  const normalizedSearch = $derived(
    productSearch.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );

  const activeCategories = $derived(
    categories
      .filter(
        (c) => c.is_active && products.some((p) => p.category_id === c.id),
      )
      .sort((a, b) => a.display_order - b.display_order),
  );

  const filteredProducts = $derived(
    products.filter((product) => {
      const matchesCategory =
        normalizedSearch !== "" ||
        selectedCategoryId === "all" ||
        product.category_id === selectedCategoryId;
      const name = product.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return (
        matchesCategory &&
        (!normalizedSearch || name.includes(normalizedSearch))
      );
    }),
  );

  function onSearchKeydown(event: KeyboardEvent) {
    // Enter picks the only (or first) match, so typing "cono" + Enter is enough.
    if (event.key === "Enter") {
      event.preventDefault();
      const first = filteredProducts.find((p) => !soldOut.has(p.id));
      if (first) onPick(first.id);
    } else if (event.key === "Escape" && productSearch) {
      event.stopPropagation();
      productSearch = "";
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
  <label class="input input-bordered flex w-full shrink-0 items-center gap-2">
    <Icon
      icon="lucide:search"
      class="size-4 text-ink-muted"
      aria-hidden="true"
    />
    <input
      bind:this={searchRef}
      type="search"
      class="grow"
      placeholder="Buscar producto…"
      bind:value={productSearch}
      onkeydown={onSearchKeydown}
      aria-label="Buscar producto"
    />
    {#if productSearch}
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle size-11"
        onclick={() => {
          productSearch = "";
          searchRef?.focus();
        }}
        aria-label="Limpiar búsqueda"
      >
        <Icon icon="lucide:x" class="size-3.5" aria-hidden="true" />
      </button>
    {/if}
  </label>

  <div
    class="flex shrink-0 flex-wrap gap-1.5"
    role="group"
    aria-label="Categorías"
  >
    <button
      type="button"
      class={`btn btn-sm rounded-full ${selectedCategoryId === "all" ? "btn-primary" : "btn-ghost border-base-300"}`}
      aria-pressed={selectedCategoryId === "all"}
      onclick={() => (selectedCategoryId = "all")}
    >
      Todas
    </button>
    {#each activeCategories as category (category.id)}
      <button
        type="button"
        class={`btn btn-sm rounded-full ${selectedCategoryId === category.id ? "btn-primary" : "btn-ghost border-base-300"}`}
        aria-pressed={selectedCategoryId === category.id}
        onclick={() => (selectedCategoryId = category.id)}
      >
        {category.name}
      </button>
    {/each}
  </div>

  {#if recentProducts.length > 0 && !normalizedSearch}
    <div class="flex shrink-0 flex-wrap items-center gap-1.5">
      <span class="text-xs font-medium text-base-content/70">Recientes</span>
      {#each recentProducts as product (product.id)}
        <button
          type="button"
          class="btn btn-sm min-h-11 gap-1 rounded-full btn-ghost border-base-300"
          onclick={() => onPick(product.id)}
        >
          <Icon icon="lucide:history" class="size-3" aria-hidden="true" />
          {product.name}
        </button>
      {/each}
    </div>
  {/if}

  <div class="min-h-0 flex-1 overflow-y-auto pr-1">
    {#if filteredProducts.length === 0}
      <div
        class="rounded-box border border-dashed border-base-300 px-3 py-8 text-center text-sm text-base-content/70"
      >
        {products.length === 0
          ? "No hay productos disponibles"
          : `Sin resultados para “${productSearch}”`}
      </div>
    {:else}
      <ul
        class="product-grid"
        aria-label={`Productos (${filteredProducts.length})`}
      >
        {#each filteredProducts as product (product.id)}
          {@const active = activeProductId === product.id}
          {@const count = countsById[product.id] ?? 0}
          {@const unavailable = soldOut.has(product.id)}
          <li>
            <button
              type="button"
              class="product-tile"
              class:product-tile-active={active}
              class:product-tile-soldout={unavailable}
              aria-pressed={active}
              disabled={unavailable}
              title={unavailable ? `${product.name} · Agotado` : undefined}
              onclick={() => onPick(product.id)}
            >
              {#if product.image_url}
                <img
                  src={product.image_url}
                  alt=""
                  class="product-tile-img"
                  loading="lazy"
                />
              {:else}
                <span
                  class="product-tile-img grid place-items-center bg-base-200"
                >
                  <Icon
                    icon="lucide:ice-cream-cone"
                    class="size-5 text-ink-muted"
                    aria-hidden="true"
                  />
                </span>
              {/if}
              <span class="min-w-0 flex-1 text-left">
                <span
                  class="block text-sm font-semibold leading-tight line-clamp-2"
                  >{product.name}</span
                >
                {#if unavailable}
                  <span class="badge badge-sm border-0 bg-error/15 text-error"
                    >Agotado</span
                  >
                {:else}
                  <span class="text-sm tabular-nums text-base-content/70"
                    >{formatCurrency(product.price)}</span
                  >
                {/if}
              </span>
              {#if count > 0}
                <span
                  class="badge badge-primary badge-sm tabular-nums"
                  aria-label={`${count} en la orden`}>{count}</span
                >
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .product-tile-soldout {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.5rem;
  }

  .product-tile {
    display: flex;
    width: 100%;
    min-height: 4rem;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-field);
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    transition:
      border-color 0.15s,
      background-color 0.15s,
      transform 0.1s;
  }

  .product-tile:hover {
    border-color: color-mix(
      in oklab,
      var(--color-primary) 55%,
      var(--color-base-300)
    );
  }

  .product-tile:active {
    transform: scale(0.98);
  }

  .product-tile:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .product-tile-active {
    border-color: var(--color-primary);
    background: color-mix(
      in oklab,
      var(--color-primary) 10%,
      var(--color-base-100)
    );
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .product-tile-img {
    width: 2.75rem;
    height: 2.75rem;
    flex: none;
    border-radius: calc(var(--radius-field) * 0.75);
    object-fit: cover;
  }

  @media (prefers-reduced-motion: reduce) {
    .product-tile {
      transition: none;
    }
    .product-tile:active {
      transform: none;
    }
  }
</style>
