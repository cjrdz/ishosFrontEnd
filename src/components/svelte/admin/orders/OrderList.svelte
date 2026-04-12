<script lang="ts">
  import type { Order } from "../../../../lib/api/admin";

  interface Props {
    orders: Order[];
    filteredOrders: Order[];
    busy: boolean;
    isAdmin: boolean;
    orderSearch: string;
    orderStatusFilterLabel: string;
    statusLabels: Record<Order["status"], string>;
    statusBadgeClass: Record<Order["status"], string>;
    onSearchChange: (value: string) => void;
    onFilterChange: (value: string) => void;
    onReload: () => void;
    onOpenOrder: (orderId: string) => void;
    onPrintOrder: (orderId: string) => void;
    onStartEdit: (orderId: string) => void;
    onRequestApprove: (order: Order) => void;
    onOpenReject: (orderId: string) => void;
    onRequestDelete: (order: Order) => void;
  }

  let {
    orders,
    filteredOrders,
    busy,
    isAdmin,
    orderSearch,
    orderStatusFilterLabel,
    statusLabels,
    statusBadgeClass,
    onSearchChange,
    onFilterChange,
    onReload,
    onOpenOrder,
    onPrintOrder,
    onStartEdit,
    onRequestApprove,
    onOpenReject,
    onRequestDelete,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let rowLimit = $state<number>(5);

  const visibleOrders = $derived(
    rowLimit <= 0 ? filteredOrders : filteredOrders.slice(0, rowLimit),
  );

  const rowLimitLabel = $derived(
    rowLimit <= 0 ? "Todos" : String(rowLimit),
  );

  function setRowLimit(limit: number) {
    rowLimit = limit;
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div class="grid w-full gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
        <div class="flex items-center gap-2 sm:col-span-2 xl:col-span-1">
          <label for="order-search" class="label-text text-sm whitespace-nowrap">Buscar por numero</label>
          <input
            id="order-search"
            class="input input-sm input-bordered w-full sm:w-56 md:w-64"
            placeholder="ORD-20260223-2029"
            value={orderSearch}
            oninput={(event) => onSearchChange((event.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="label-text text-sm whitespace-nowrap">Filtrar por estado</span>
          <div class="dropdown dropdown-right dropdown-center">
            <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-40 justify-between">
              {orderStatusFilterLabel}
            </div>
            <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-sm border border-base-300">
              <li><button type="button" onclick={() => onFilterChange("")}>Todos</button></li>
              <li><button type="button" onclick={() => onFilterChange("pendiente_revision")}>pendiente</button></li>
              <li><button type="button" onclick={() => onFilterChange("recibida")}>recibida</button></li>
              <li><button type="button" onclick={() => onFilterChange("en_proceso")}>preparando</button></li>
              <li><button type="button" onclick={() => onFilterChange("lista")}>lista</button></li>
              <li><button type="button" onclick={() => onFilterChange("entregada")}>entregada</button></li>
              <li><button type="button" onclick={() => onFilterChange("cancelada")}>cancelada</button></li>
            </ul>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
          <div class="dropdown dropdown-right dropdown-center">
            <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-28 justify-between">
              {rowLimitLabel}
            </div>
            <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-40 p-2 shadow-sm border border-base-300">
              {#each rowLimitOptions as option}
                <li><button type="button" onclick={() => setRowLimit(option)}>{option}</button></li>
              {/each}
              <li><button type="button" onclick={() => setRowLimit(0)}>Todos</button></li>
            </ul>
          </div>
        </div>
        <button class="btn btn-sm btn-primary w-full sm:w-auto" onclick={onReload} disabled={busy}>Actualizar</button>
      </div>
      <div class="flex items-center gap-2 text-sm md:justify-end">
        <span class="text-base-content/80">Total</span>
        <span class="badge badge-info badge-sm font-semibold rounded-md">{orders.length}</span>
      </div>
    </div>

    <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
      <table class="table min-w-[820px]">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Numero</th>
            <th class="text-center font-bold">Cliente</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredOrders.length === 0}
            <tr><td colspan="4" class="text-center">No hay ordenes</td></tr>
          {:else}
            {#each visibleOrders as order}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>
                  <button
                    class="font-medium text-left hover:underline whitespace-nowrap"
                    type="button"
                    title="Ver detalle"
                    onclick={() => onOpenOrder(order.id)}
                  >
                    {order.order_number}
                  </button>
                </td>
                <td class="text-center align-middle">
                  <div class="font-medium whitespace-nowrap">{order.customer_name}</div>
                </td>
                <td class="text-center align-middle">
                  <div class="flex flex-col items-center gap-1">
                    <span class={`badge ${statusBadgeClass[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                </td>
                <td class="text-center align-middle">
                  <div class="flex w-full flex-nowrap items-center justify-center gap-2">
                    <button class="btn btn-xs sm:btn-sm btn-soft btn-info whitespace-nowrap" onclick={() => onPrintOrder(order.id)}>
                      Imprimir
                    </button>
                    <button class="btn btn-xs sm:btn-sm btn-soft btn-accent whitespace-nowrap" onclick={() => onStartEdit(order.id)}>Editar</button>
                    {#if order.status === "pendiente_revision"}
                      <button class="btn btn-xs sm:btn-sm btn-soft btn-success whitespace-nowrap" onclick={() => onRequestApprove(order)}>
                        Aprobar
                      </button>
                      <button class="btn btn-xs sm:btn-sm btn-soft btn-error whitespace-nowrap" onclick={() => onOpenReject(order.id)}>Rechazar</button>
                    {/if}
                    {#if isAdmin}
                      <button class="btn btn-xs sm:btn-sm btn-soft btn-error whitespace-nowrap" onclick={() => onRequestDelete(order)}>
                        Eliminar
                      </button>
                    {/if}
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
