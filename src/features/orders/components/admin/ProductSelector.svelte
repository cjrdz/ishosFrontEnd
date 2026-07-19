<script lang="ts">
  import { formatCurrency } from "@shared/utils/formatters";
  import type { Category, Product } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    products: Product[];
    categories: Category[];
    selectedProductId: string;
    recentProducts: Product[];
    onProductChange: (productId: string) => void;
  }

  let {
    products,
    categories,
    selectedProductId,
    recentProducts,
    onProductChange,
  }: Props = $props();

  let selectedCategoryId = $state<string>("all");
  let productSearch = $state("");

  const normalizedSearch = $derived(productSearch.trim().toLowerCase());

  const activeCategories = $derived(
    categories
      .filter((c) => c.is_active)
      .sort((a, b) => a.display_order - b.display_order),
  );

  const filteredProducts = $derived(
    products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === "all" ||
        product.category_id === selectedCategoryId;
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    }),
  );

  function selectCategory(categoryId: string) {
    selectedCategoryId = categoryId;
  }

  function clearSearch() {
    productSearch = "";
  }
</script>

<div class="flex flex-col h-full space-y-3">
  <!-- Search -->
  <div class="form-control shrink-0">
    <span id="order-product-label" class="label-text text-xs mb-1"
      >Buscar producto</span
    >
    <div class="relative">
      <input
        id="order-product-search"
        type="text"
        class="input input-bordered input-sm w-full pr-8"
        placeholder="Buscar por nombre..."
        bind:value={productSearch}
        aria-labelledby="order-product-label"
      />
      {#if productSearch}
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
          onclick={clearSearch}
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      {/if}
    </div>
  </div>

  <!-- Categories -->
  <div class="space-y-1 shrink-0">
    <span class="text-xs font-medium text-base-content/70">Categorías</span>
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
      <button
        type="button"
        class={`btn btn-xs whitespace-nowrap ${
          selectedCategoryId === "all" ? "btn-primary" : "btn-ghost"
        }`}
        onclick={() => selectCategory("all")}
      >
        Todas
      </button>
      {#each activeCategories as category (category.id)}
        <button
          type="button"
          class={`btn btn-xs whitespace-nowrap ${
            selectedCategoryId === category.id ? "btn-primary" : "btn-ghost"
          }`}
          onclick={() => selectCategory(category.id)}
        >
          {category.name}
        </button>
      {/each}
    </div>
  </div>

  <!-- Recent products -->
  {#if recentProducts.length > 0}
    <div class="space-y-1 shrink-0">
      <span class="text-xs font-medium text-base-content/70">Rápidos</span>
      <div class="flex flex-wrap gap-1.5">
        {#each recentProducts as product (product.id)}
          <button
            type="button"
            class={`btn btn-xs gap-1 ${
              selectedProductId === product.id ? "btn-primary" : "btn-ghost"
            }`}
            onclick={() => onProductChange(product.id)}
          >
            <Icon icon="lucide:history" class="h-3 w-3" />
            {product.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Product list -->
  <div class="form-control space-y-1 min-w-0 flex-1 min-h-0">
    <span class="label-text text-xs">Productos ({filteredProducts.length})</span
    >
    {#if filteredProducts.length === 0}
      <div
        class="rounded-lg border border-base-300 bg-base-200/40 px-3 py-4 text-center text-sm text-base-content/60"
      >
        {products.length === 0 ? "Sin productos" : "Sin coincidencias"}
      </div>
    {:else}
      <ul
        class="list bg-base-200/20 rounded-lg border border-base-300 flex-1 min-h-0 overflow-y-auto"
        role="listbox"
        aria-label="Productos"
      >
        {#each filteredProducts as product (product.id)}
          {@const isSelected = selectedProductId === product.id}
          <li
            class="list-row gap-3 cursor-pointer rounded-lg transition-colors p-2.5 hover:bg-base-200/70 ${isSelected
              ? 'bg-primary/10'
              : ''}"
            role="option"
            aria-selected={isSelected}
            tabindex="0"
            onclick={() => onProductChange(product.id)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onProductChange(product.id);
              }
            }}
          >
            {#if product.image_url}
              <img
                src={product.image_url}
                alt=""
                class="h-9 w-9 rounded-md object-cover border border-base-300 shrink-0"
              />
            {:else}
              <span
                class="h-9 w-9 rounded-md border border-base-300 bg-base-200/60 flex items-center justify-center shrink-0"
              >
                <Icon
                  icon="lucide:package"
                  class="h-4 w-4 text-base-content/40"
                />
              </span>
            {/if}
            <div
              class="list-col-grow min-w-0 flex items-center justify-between gap-2"
            >
              <div class="min-w-0">
                <p
                  class={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}
                  title={product.name}
                >
                  {product.name}
                </p>
              </div>
              <span class="text-xs text-base-content/60 whitespace-nowrap">
                {formatCurrency(product.price)}
              </span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
