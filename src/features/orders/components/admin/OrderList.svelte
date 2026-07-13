<script lang="ts">
  import type { Order } from "@features/admin-management";
  import { getCurrentRowsPerTable } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import { isOrderEditable } from "../../lib/order-status";

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
    onRequestArchive: (order: Order) => void;
    onRequestUnarchive: (order: Order) => void;
    onRequestDelete: (order: Order) => void;
    showArchived: boolean;
    onToggleArchivedView: () => void;
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
    onRequestArchive,
    onRequestUnarchive,
    onRequestDelete,
    showArchived,
    onToggleArchivedView,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let rowLimit = $state<number>(5);

  $effect(() => {
    rowLimit = getCurrentRowsPerTable("ordenes");
  });

  const visibleOrders = $derived(
    rowLimit <= 0 ? filteredOrders : filteredOrders.slice(0, rowLimit),
  );

  const rowLimitLabel = $derived(rowLimit <= 0 ? "Todos" : String(rowLimit));

  function setRowLimit(limit: number) {
    rowLimit = limit;
  }

  function setOrderStatusFilter(value: string) {
    onFilterChange(value);
    onReload();
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="card-title shrink-0 mr-1">Ordenes</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <input
        id="order-search"
        class="input input-sm input-bordered w-full sm:w-36 md:w-44 lg:w-52"
        placeholder="Buscar ORD"
        value={orderSearch}
        oninput={(event) =>
          onSearchChange((event.currentTarget as HTMLInputElement).value)}
      />

      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-32 md:w-36 justify-between"
        >
          {orderStatusFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-44 p-2 mt-1 shadow-xl border border-base-300"
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
              >Pendiente</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("recibida")}>Recibida</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("en_proceso")}
              >Preparando</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setOrderStatusFilter("lista")}
              >Lista</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("entregada")}
              >Entregada</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setOrderStatusFilter("cancelada")}
              >Cancelada</button
            >
          </li>
        </ul>
      </div>

      <button
        class="btn btn-sm btn-outline shrink-0 w-full sm:w-auto"
        type="button"
        onclick={onToggleArchivedView}
        disabled={busy}
        aria-label={showArchived ? "Ocultar archivadas" : "Ver archivadas"}
        title={showArchived ? "Ocultar archivadas" : "Ver archivadas"}
      >
        <Icon
          icon={showArchived ? "lucide:archive-x" : "lucide:archive"}
          class="h-4 w-4"
        />
        {showArchived ? "Ver activas" : "Ver archivadas"}
      </button>

      <button
        class="btn btn-sm btn-primary shrink-0 w-full sm:w-auto sm:ml-auto"
        type="button"
        onclick={onCreateOrder}
        disabled={busy}
      >
        <Icon icon="lucide:plus" class="h-4 w-4" />
        Orden
      </button>
    </div>

    <!-- Table -->
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table w-full">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Numero</th>
            <th class="font-bold">Cliente</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-right font-bold">Total</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredOrders.length === 0}
            <tr
              ><td colspan="5" class="text-center py-6 text-base-content/50"
                >No hay ordenes</td
              ></tr
            >
          {:else}
            {#each visibleOrders as order (order.id)}
              <tr
                class="hover:bg-base-300/40 transition-colors cursor-pointer"
                role="button"
                tabindex="0"
                onclick={() => onOpenOrder(order.id)}
                onkeydown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenOrder(order.id);
                  }
                }}
              >
                <td>
                  <button
                    class="font-medium text-left hover:underline"
                    type="button"
                    title="Ver detalle"
                    onclick={(event) => {
                      event.stopPropagation();
                      onOpenOrder(order.id);
                    }}
                  >
                    {order.order_number}
                  </button>
                </td>
                <td>
                  <div class="font-medium">{order.customer_name}</div>
                </td>
                <td class="text-center align-middle">
                  <span class={`badge ${statusBadgeClass[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </td>
                <td class="text-right align-middle"
                  >{formatCurrency(order.total_amount)}</td
                >
                <td class="text-center align-middle">
                  <div
                    class="flex flex-wrap md:flex-nowrap items-center justify-center gap-1"
                    role="group"
                    aria-label="Acciones de orden"
                  >
                    {#if order.status === "pendiente_revision"}
                      <button
                        class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-success"
                        type="button"
                        onclick={(event: MouseEvent) => {
                          event.stopPropagation();
                          onRequestApprove(order);
                        }}
                        disabled={busy}
                        aria-label="Aprobar orden"
                        title="Aprobar"
                      >
                        <Icon icon="lucide:check" class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-error"
                        type="button"
                        onclick={(event: MouseEvent) => {
                          event.stopPropagation();
                          onOpenReject(order.id);
                        }}
                        disabled={busy}
                        aria-label="Rechazar orden"
                        title="Rechazar"
                      >
                        <Icon icon="lucide:x" class="h-4 w-4" />
                      </button>
                    {/if}
                    {#if isOrderEditable(order.status)}
                      <button
                        class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                        type="button"
                        onclick={(event: MouseEvent) => {
                          event.stopPropagation();
                          onStartEdit(order.id);
                        }}
                        disabled={busy}
                        aria-label="Editar orden"
                        title="Editar"
                      >
                        <Icon icon="lucide:pencil" class="h-4 w-4" />
                      </button>
                    {/if}
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                      type="button"
                      onclick={(event: MouseEvent) => {
                        event.stopPropagation();
                        onPrintOrder(order.id);
                      }}
                      disabled={busy}
                      aria-label="Imprimir orden"
                      title="Imprimir"
                    >
                      <Icon icon="lucide:printer" class="h-4 w-4" />
                    </button>
                    {#if isAdmin}
                      {#if order.is_archived}
                        <button
                          class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-warning"
                          type="button"
                          onclick={(event: MouseEvent) => {
                            event.stopPropagation();
                            onRequestUnarchive(order);
                          }}
                          disabled={busy}
                          aria-label="Desarchivar orden"
                          title="Desarchivar"
                        >
                          <Icon icon="lucide:archive-restore" class="h-4 w-4" />
                        </button>
                      {:else}
                        <button
                          class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-warning"
                          type="button"
                          onclick={(event: MouseEvent) => {
                            event.stopPropagation();
                            onRequestArchive(order);
                          }}
                          disabled={busy}
                          aria-label="Archivar orden"
                          title="Archivar"
                        >
                          <Icon icon="lucide:archive" class="h-4 w-4" />
                        </button>
                      {/if}
                      <button
                        class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-error"
                        type="button"
                        onclick={(event: MouseEvent) => {
                          event.stopPropagation();
                          onRequestDelete(order);
                        }}
                        disabled={busy}
                        aria-label="Eliminar orden"
                        title="Eliminar"
                      >
                        <Icon icon="lucide:trash-2" class="h-4 w-4" />
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

    <!-- Footer -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300/50 pt-3"
    >
      <span class="text-sm text-base-content/60">
        Mostrando {visibleOrders.length} de {filteredOrders.length}
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
                <button type="button" onclick={() => setRowLimit(option)}
                  >{option}</button
                >
              </li>
            {/each}
            <li>
              <button type="button" onclick={() => setRowLimit(0)}>Todos</button
              >
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
