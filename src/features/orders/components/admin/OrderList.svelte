<script lang="ts">
  import type { Order } from "@features/admin-management";

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
    onCreateOrder: () => void;
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
    onCreateOrder,
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

  const rowLimitLabel = $derived(rowLimit <= 0 ? "Todos" : String(rowLimit));

  function setRowLimit(limit: number) {
    rowLimit = limit;
    onReload();
  }

  function setOrderStatusFilter(value: string) {
    onFilterChange(value);
    onReload();
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="card-title shrink-0 mr-1">Gestion de ordenes</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <input
        id="order-search"
        class="input input-sm input-bordered w-full sm:w-44"
        placeholder="Buscar ORD"
        value={orderSearch}
        oninput={(event) =>
          onSearchChange((event.currentTarget as HTMLInputElement).value)}
      />

      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-40 justify-between"
        >
          {orderStatusFilterLabel}
          <span class="opacity-50">▼</span>
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-52 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setOrderStatusFilter("")}
              >Todos</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("pendiente_revision")}
              >pendiente</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("recibida")}>recibida</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("en_proceso")}
              >preparando</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setOrderStatusFilter("lista")}
              >lista</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("entregada")}
              >entregada</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("cancelada")}
              >cancelada</button
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
          {rowLimitLabel}
          <span class="opacity-50">▼</span>
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
        >
          {#each rowLimitOptions as option}
            <li>
              <button type="button" onclick={() => setRowLimit(option)}
                >{option}</button
              >
            </li>
          {/each}
          <li>
            <button type="button" onclick={() => setRowLimit(0)}>Todos</button>
          </li>
        </ul>
      </div>

      <div
        class="flex items-center gap-1.5 text-sm text-base-content/80 font-medium shrink-0"
      >
        <span
          class="badge badge-info badge-sm font-semibold rounded-md text-white!"
          >{orders.length}</span
        >
        <span>ordenes</span>
      </div>

      <button
        class="btn btn-sm btn-primary shrink-0 ml-auto"
        type="button"
        onclick={onCreateOrder}
        disabled={busy}
      >
        + Crear orden
      </button>
    </div>

    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table w-full">
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
            <tr
              ><td colspan="4" class="text-center py-6 text-base-content/50"
                >No hay ordenes</td
              ></tr
            >
          {:else}
            {#each visibleOrders as order}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>
                  <button
                    class="font-medium text-left hover:underline"
                    type="button"
                    title="Ver detalle"
                    onclick={() => onOpenOrder(order.id)}
                  >
                    {order.order_number}
                  </button>
                </td>
                <td class="text-center align-middle">
                  <div class="font-medium xl:whitespace-nowrap">
                    {order.customer_name}
                  </div>
                </td>
                <td class="text-center align-middle">
                  <div class="flex flex-col items-center gap-1">
                    <span class={`badge ${statusBadgeClass[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                </td>
                <td class="text-center align-middle">
                  <div
                    class="flex flex-wrap md:flex-nowrap items-center justify-center gap-2"
                  >
                    <button
                      class="btn btn-xs sm:btn-sm btn-soft btn-info whitespace-nowrap"
                      onclick={() => onPrintOrder(order.id)}
                    >
                      Imprimir
                    </button>
                    <button
                      class="btn btn-xs sm:btn-sm btn-soft btn-accent whitespace-nowrap"
                      onclick={() => onStartEdit(order.id)}
                    >
                      Editar
                    </button>
                    {#if order.status === "pendiente_revision"}
                      <button
                        class="btn btn-xs sm:btn-sm btn-soft btn-success whitespace-nowrap"
                        onclick={() => onRequestApprove(order)}
                      >
                        Aprobar
                      </button>
                      <button
                        class="btn btn-xs sm:btn-sm btn-soft btn-error whitespace-nowrap"
                        onclick={() => onOpenReject(order.id)}
                      >
                        Rechazar
                      </button>
                    {/if}
                    {#if isAdmin}
                      <button
                        class="btn btn-xs sm:btn-sm btn-soft btn-error whitespace-nowrap"
                        onclick={() => onRequestDelete(order)}
                      >
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
