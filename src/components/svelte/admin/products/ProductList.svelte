<script lang="ts">
  import type { Product } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface Props {
    products: Product[];
    filteredProducts: Product[];
    busy: boolean;
    productVisibilityFilterLabel: string;
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
    onFilterChange,
    onToggleAvailability,
    onEdit,
    onRequestDelete,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let productRowLimit = $state<number>(5);

  const visibleProducts = $derived(
    productRowLimit <= 0 ? filteredProducts : filteredProducts.slice(0, productRowLimit),
  );

  const productRowLimitLabel = $derived(
    productRowLimit <= 0 ? "Todos" : String(productRowLimit),
  );

  function setProductRowLimit(limit: number) {
    productRowLimit = limit;
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <h4 class="card-title text-base">Listado de productos</h4>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="label-text text-sm whitespace-nowrap">Filtrar</span>
          <div class="dropdown dropdown-right dropdown-center">
            <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-32 justify-between">
              {productVisibilityFilterLabel}
            </div>
            <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300">
              <li><button type="button" onclick={() => onFilterChange("all")}>Todos</button></li>
              <li><button type="button" onclick={() => onFilterChange("active")}>Activos</button></li>
              <li><button type="button" onclick={() => onFilterChange("inactive")}>Inactivos</button></li>
            </ul>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
          <div class="dropdown dropdown-right dropdown-center">
            <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-28 justify-between">
              {productRowLimitLabel}
            </div>
            <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-40 p-2 shadow-sm border border-base-300">
              {#each rowLimitOptions as option}
                <li><button type="button" onclick={() => setProductRowLimit(option)}>{option}</button></li>
              {/each}
              <li><button type="button" onclick={() => setProductRowLimit(0)}>Todos</button></li>
            </ul>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm md:justify-end">
          <span class="text-base-content/80">Total</span>
          <span class="badge badge-info badge-sm font-semibold rounded-md">{filteredProducts.length}</span>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
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
            <tr><td colspan="5" class="text-center">No hay productos</td></tr>
          {:else}
            {#each visibleProducts as product}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>
                  <div class="font-medium">{product.name}</div>
                </td>
                <td class="text-center align-middle">{product.category_name || "-"}</td>
                <td class="text-center align-middle">{formatCurrency(product.price)}</td>
                <td class="text-center align-middle">
                  <label class="label cursor-pointer justify-center gap-2">
                    <input
                      class="toggle toggle-xs"
                      type="checkbox"
                      checked={product.is_available}
                      onchange={(event) => onToggleAvailability(product, (event.currentTarget as HTMLInputElement).checked)}
                      disabled={busy}
                    />
                    <span class="label-text text-xs">{product.is_available ? "SI" : "NO"}</span>
                  </label>
                </td>
                <td class="text-center align-middle">
                  <div class="flex w-full flex-wrap items-center justify-center gap-2">
                    <button class="btn btn-sm btn-soft btn-accent" onclick={() => onEdit(product)}>Editar</button>
                    <button class="btn btn-sm btn-soft btn-error" onclick={() => onRequestDelete(product)}>Eliminar</button>
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
