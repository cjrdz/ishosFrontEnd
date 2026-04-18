<script lang="ts">
  import type { Product } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface Props {
    products: Product[];
    filteredProducts: Product[];
    busy: boolean;
    productVisibilityFilterLabel: string;
    onOpenGlobalFlavors: () => void;
    onOpenGlobalAddons: () => void;
    onCreateProduct: () => void;
    onFilterChange: (value: "all" | "active" | "inactive") => void;
    onToggleAvailability: (product: Product, checked: boolean) => void;
    onEdit: (product: Product) => void;
    onRequestDelete: (product: Product) => void;
  }

  let {
    products,
    filteredProducts,
    busy,
    productVisibilityFilterLabel,
    onOpenGlobalFlavors,
    onOpenGlobalAddons,
    onCreateProduct,
    onFilterChange,
    onToggleAvailability,
    onEdit,
    onRequestDelete,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let productRowLimit = $state<number>(5);

  const visibleProducts = $derived(
    productRowLimit <= 0
      ? filteredProducts
      : filteredProducts.slice(0, productRowLimit),
  );

  const productRowLimitLabel = $derived(
    productRowLimit <= 0 ? "Todos" : String(productRowLimit),
  );

  function setProductRowLimit(limit: number) {
    productRowLimit = limit;
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="card-title shrink-0 mr-1">Gestion de productos</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-40 justify-between"
        >
          {productVisibilityFilterLabel}
          <span class="opacity-50">▼</span>
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-52 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => onFilterChange("all")}
              >Todos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => onFilterChange("active")}
              >Activos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => onFilterChange("inactive")}
              >Inactivos</button
            >
          </li>
        </ul>
      </div>

      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-24 justify-between"
        >
          {productRowLimitLabel}
          <span class="opacity-50">▼</span>
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
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

      <div
        class="flex items-center gap-1.5 text-sm text-base-content/80 font-medium shrink-0"
      >
        <span
          class="badge badge-info badge-sm font-semibold rounded-md text-white!"
          >{filteredProducts.length}</span
        >
        <span>productos</span>
      </div>

      <button
        class="btn btn-sm btn-outline shrink-0 ml-auto"
        type="button"
        onclick={onOpenGlobalFlavors}
      >
        Sabores globales
      </button>
      <button
        class="btn btn-sm btn-outline shrink-0"
        type="button"
        onclick={onOpenGlobalAddons}
      >
        Complementos globales
      </button>
      <button
        class="btn btn-sm btn-primary shrink-0"
        type="button"
        onclick={onCreateProduct}
        disabled={busy}
      >
        + Crear producto
      </button>
    </div>

    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Nombre</th>
            <th class="text-center font-bold">Categoria</th>
            <th class="text-center font-bold">Precio</th>
            <th class="text-center font-bold">Disponibilidad</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredProducts.length === 0}
            <tr
              ><td colspan="5" class="text-center py-6 text-base-content/50"
                >No hay productos</td
              ></tr
            >
          {:else}
            {#each visibleProducts as product}
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
                  <label class="label cursor-pointer justify-center gap-2">
                    <input
                      class="toggle toggle-xs"
                      type="checkbox"
                      checked={product.is_available}
                      onchange={(event) =>
                        onToggleAvailability(
                          product,
                          (event.currentTarget as HTMLInputElement).checked,
                        )}
                      disabled={busy}
                    />
                    <span class="label-text text-xs"
                      >{product.is_available ? "SI" : "NO"}</span
                    >
                  </label>
                </td>
                <td class="text-center align-middle">
                  <div
                    class="flex w-full flex-wrap items-center justify-center gap-2"
                  >
                    <button
                      class="btn btn-sm btn-soft btn-accent"
                      onclick={() => onEdit(product)}>Editar</button
                    >
                    <button
                      class="btn btn-sm btn-soft btn-error"
                      onclick={() => onRequestDelete(product)}>Eliminar</button
                    >
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
