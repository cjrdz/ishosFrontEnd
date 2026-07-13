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

<div class="space-y-4">
  <!-- Search -->
  <div class="form-control">
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
  <div class="space-y-1.5">
    <span class="text-xs font-medium text-base-content/70">Categorías</span>
    <div class="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        class={`btn btn-xs ${
          selectedCategoryId === "all"
            ? "btn-primary"
            : "btn-outline btn-ghost border-base-300"
        }`}
        onclick={() => selectCategory("all")}
      >
        Todas
      </button>
      {#each activeCategories as category (category.id)}
        <button
          type="button"
          class={`btn btn-xs whitespace-nowrap ${
            selectedCategoryId === category.id
              ? "btn-primary"
              : "btn-outline btn-ghost border-base-300"
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
    <div class="space-y-1.5">
      <span class="text-xs font-medium text-base-content/70">Rápidos</span>
      <div class="flex flex-wrap gap-2">
        {#each recentProducts as product (product.id)}
          <button
            type="button"
            class={`btn btn-xs ${
              selectedProductId === product.id
                ? "btn-primary"
                : "btn-outline btn-ghost border-base-300"
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

  <!-- Product grid -->
  <div class="form-control space-y-1.5 min-w-0">
    <span class="label-text text-xs">Productos</span>
    {#if filteredProducts.length === 0}
      <div
        class="rounded-lg border border-base-300 bg-base-200/40 px-3 py-4 text-center text-sm text-base-content/60"
      >
        {products.length === 0 ? "Sin productos" : "Sin coincidencias"}
      </div>
    {:else}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto rounded-lg border border-base-300 bg-base-200/20 p-2"
        role="listbox"
        aria-label="Productos"
      >
        {#each filteredProducts as product (product.id)}
          <button
            type="button"
            class={`flex items-center gap-3 px-3 py-2.5 text-left rounded-lg border transition-colors ${
              selectedProductId === product.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-base-300 bg-base-100 hover:bg-base-200/70"
            }`}
            role="option"
            aria-selected={selectedProductId === product.id}
            onclick={() => onProductChange(product.id)}
          >
            {#if product.image_url}
              <img
                src={product.image_url}
                alt=""
                class="h-10 w-10 rounded-md object-cover border border-base-300 shrink-0"
              />
            {:else}
              <span
                class="h-10 w-10 rounded-md border border-base-300 bg-base-200/60 flex items-center justify-center shrink-0"
              >
                <Icon
                  icon="lucide:package"
                  class="h-5 w-5 text-base-content/40"
                />
              </span>
            {/if}
            <div class="min-w-0 flex-1">
              <span class="block w-full truncate text-sm font-medium">
                {product.name}
              </span>
              <span class="text-xs opacity-80">
                {formatCurrency(product.price)}
              </span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
