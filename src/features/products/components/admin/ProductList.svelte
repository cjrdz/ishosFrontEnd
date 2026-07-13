<script lang="ts">
  import {
    getCurrentRowsPerTable,
    type Product,
    type StoreOfferItem,
    type Category,
  } from "@features/admin-management";
  import { formatCurrency } from "@shared/utils/formatters";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    products: Product[];
    categories: Category[];
    busy: boolean;
    offerByProductId: Map<string, StoreOfferItem>;
    onCreateProduct: () => void;
    onToggleAvailability: (product: Product, checked: boolean) => void;
    onEdit: (product: Product) => void;
    onRequestDelete: (product: Product) => void;
    onOpenOfferPanel: (product: Product) => void;
  }

  let {
    products,
    categories,
    busy,
    offerByProductId,
    onCreateProduct,
    onToggleAvailability,
    onEdit,
    onRequestDelete,
    onOpenOfferPanel,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let productRowLimit = $state<number>(5);

  let searchQuery = $state("");
  let debouncedSearchQuery = $state("");
  let searchTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchInput(value: string) {
    searchQuery = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearchQuery = value;
    }, 200);
  }

  let categoryFilter = $state<string>("all");
  let availabilityFilter = $state<"all" | "active" | "inactive">("all");
  let offerFilter = $state<"all" | "with" | "without">("all");

  $effect(() => {
    productRowLimit = getCurrentRowsPerTable("productos");
  });

  function normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const filteredProducts = $derived(
    products.filter((product) => {
      const matchesSearch =
        !debouncedSearchQuery ||
        normalizeText(product.name).includes(
          normalizeText(debouncedSearchQuery),
        );
      const matchesCategory =
        categoryFilter === "all" || product.category_id === categoryFilter;
      const matchesAvailability =
        availabilityFilter === "all"
          ? true
          : availabilityFilter === "active"
            ? product.is_available
            : !product.is_available;
      const hasOffer = offerByProductId.has(product.id);
      const matchesOffer =
        offerFilter === "all"
          ? true
          : offerFilter === "with"
            ? hasOffer
            : !hasOffer;
      return (
        matchesSearch && matchesCategory && matchesAvailability && matchesOffer
      );
    }),
  );

  const visibleProducts = $derived(
    productRowLimit <= 0
      ? filteredProducts
      : filteredProducts.slice(0, productRowLimit),
  );

  const categoryFilterLabel = $derived(
    categoryFilter === "all"
      ? "Categorias"
      : (categories.find((category) => category.id === categoryFilter)?.name ??
          "Categoria"),
  );

  const availabilityFilterLabel = $derived(
    availabilityFilter === "all"
      ? "Estado"
      : availabilityFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  const offerFilterLabel = $derived(
    offerFilter === "all"
      ? "Oferta"
      : offerFilter === "with"
        ? "Con oferta"
        : "Sin oferta",
  );

  const rowLimitLabel = $derived(
    productRowLimit <= 0 ? "Todos" : String(productRowLimit),
  );

  function setProductRowLimit(limit: number) {
    productRowLimit = limit;
  }

  function setCategoryFilter(value: string) {
    categoryFilter = value;
  }

  function setAvailabilityFilter(value: "all" | "active" | "inactive") {
    availabilityFilter = value;
  }

  function setOfferFilter(value: "all" | "with" | "without") {
    offerFilter = value;
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <!-- Toolbar: title, search, filters, create -->
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="card-title shrink-0 mr-1">Productos</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <input
        class="input input-sm input-bordered w-full sm:w-36 md:w-44 lg:w-52"
        type="text"
        placeholder="Buscar producto"
        value={searchQuery}
        oninput={(event) =>
          handleSearchInput((event.currentTarget as HTMLInputElement).value)}
      />

      <!-- Category dropdown -->
      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-32 md:w-36 justify-between"
        >
          {categoryFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-52 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setCategoryFilter("all")}
              >Todos</button
            >
          </li>
          {#each categories as category (category.id)}
            <li>
              <button
                type="button"
                onclick={() => setCategoryFilter(category.id)}
                >{category.name}</button
              >
            </li>
          {/each}
        </ul>
      </div>

      <!-- Availability dropdown -->
      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-24 md:w-28 justify-between"
        >
          {availabilityFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setAvailabilityFilter("all")}
              >Todos</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setAvailabilityFilter("active")}>Activos</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setAvailabilityFilter("inactive")}
              >Inactivos</button
            >
          </li>
        </ul>
      </div>

      <!-- Offer dropdown -->
      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-24 md:w-28 justify-between"
        >
          {offerFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-44 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setOfferFilter("all")}
              >Todos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setOfferFilter("with")}
              >Con oferta</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setOfferFilter("without")}
              >Sin oferta</button
            >
          </li>
        </ul>
      </div>

      <button
        class="btn btn-sm btn-primary shrink-0 w-full sm:w-auto sm:ml-auto"
        type="button"
        onclick={onCreateProduct}
        disabled={busy}
      >
        <Icon icon="lucide:plus" class="h-4 w-4" />
        Producto
      </button>
    </div>

    <!-- Table -->
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table w-full">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Nombre</th>
            <th class="text-center font-bold">Categoria</th>
            <th class="text-center font-bold">Precio</th>
            <th class="text-center font-bold">Oferta</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredProducts.length === 0}
            <tr
              ><td colspan="6" class="text-center py-6 text-base-content/50"
                >No hay productos</td
              ></tr
            >
          {:else}
            {#each visibleProducts as product (product.id)}
              {@const offer = offerByProductId.get(product.id)}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>
                  <div class="font-medium">{product.name}</div>
                </td>
                <td class="text-center align-middle"
                  >{product.category_name || "-"}</td
                >
                <td class="text-center align-middle"
                  >{formatCurrency(product.price)}</td
                >
                <td class="text-center align-middle">
                  {#if offer}
                    <span class="inline-flex items-center gap-1.5 text-sm">
                      <span class="w-2 h-2 rounded-full bg-primary"></span>
                      Activa
                    </span>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1.5 text-sm text-base-content/60"
                    >
                      <span class="w-2 h-2 rounded-full bg-error"></span>
                      Inactiva
                    </span>
                  {/if}
                </td>
                <td class="text-center align-middle">
                  <input
                    class="toggle toggle-sm {product.is_available
                      ? 'toggle-primary'
                      : 'toggle-inactive'}"
                    type="checkbox"
                    checked={product.is_available}
                    onchange={(event) =>
                      onToggleAvailability(
                        product,
                        (event.currentTarget as HTMLInputElement).checked,
                      )}
                    disabled={busy}
                    aria-label={product.is_available ? "Activo" : "Inactivo"}
                  />
                </td>
                <td class="text-center align-middle">
                  <div
                    class="flex flex-wrap md:flex-nowrap items-center justify-center gap-1"
                  >
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-success"
                      type="button"
                      onclick={() => onOpenOfferPanel(product)}
                      disabled={busy}
                      aria-label="Editar oferta"
                    >
                      <Icon icon="lucide:tag" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                      type="button"
                      onclick={() => onEdit(product)}
                      disabled={busy}
                      aria-label="Editar producto"
                    >
                      <Icon icon="lucide:pencil" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-error/70 hover:text-error hover:bg-error/10"
                      type="button"
                      onclick={() => onRequestDelete(product)}
                      disabled={busy}
                      aria-label="Eliminar producto"
                    >
                      <Icon icon="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300/50 pt-3"
    >
      <span class="text-sm text-base-content/60">
        Mostrando {visibleProducts.length} de {filteredProducts.length}
      </span>

      <div class="flex items-center gap-2">
        <span class="text-sm text-base-content/60">Filas</span>
        <div class="dropdown w-full sm:w-auto dropdown-top dropdown-end">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm btn-outline w-full sm:w-24 justify-between"
          >
            {rowLimitLabel}
            <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-32 p-2 mb-1 shadow-xl border border-base-300"
          >
            {#each rowLimitOptions as option}
              <li>
                <button type="button" onclick={() => setProductRowLimit(option)}
                  >{option}</button
                >
              </li>
            {/each}
            <li>
              <button type="button" onclick={() => setProductRowLimit(0)}
                >Todos</button
              >
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .toggle-inactive {
    --input-color: color-mix(in oklab, var(--color-error) 50%, transparent);
  }
</style>
