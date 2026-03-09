<script lang="ts">
  import type { Employee, Order, Product } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface CreateOrderPayload {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
    order_type: "en_local" | "para_llevar";
    table_number?: number;
    notes?: string;
    items: Array<{ product_id: string; quantity: number }>;
  }

  interface Props {
    isAdmin: boolean;
    orders: Order[];
    products: Product[];
    employees: Employee[];
    selectedOrder: Order | null;
    busy: boolean;
    moduleError: string;
    orderStatusFilter: string;
    onFilterChange: (status: string) => void;
    onReload: () => void;
    onOpenOrder: (id: string) => Promise<Order | null>;
    onApprove: (id: string, reason?: string) => void;
    onReject: (id: string, reason: string) => void;
    onStatusChange: (id: string, status: "recibida" | "en_proceso" | "lista" | "entregada") => Promise<Order | null>;
    onUpdateOrder: (id: string, payload: {
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
      order_type: "en_local" | "para_llevar";
      table_number?: number;
      notes?: string;
    }) => Promise<Order | null>;
    onDelete: (id: string) => void;
    onCreate: (payload: CreateOrderPayload) => Promise<boolean>;
  }

  let {
    isAdmin,
    orders,
    products,
    employees,
    selectedOrder,
    busy,
    moduleError,
    orderStatusFilter,
    onFilterChange,
    onReload,
    onOpenOrder,
    onApprove,
    onReject,
    onStatusChange,
    onUpdateOrder,
    onDelete,
    onCreate,
  }: Props = $props();

  let confirmDialog: HTMLDialogElement | null = null;
  let orderEditorDialog: HTMLDialogElement | null = null;
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);

  let rejectDialog: HTMLDialogElement | null = null;
  let rejectTargetId = $state<string | null>(null);
  let rejectReason = $state("");
  let rejectError = $state("");
  let reactivateDialog: HTMLDialogElement | null = null;
  let reactivateTargetId = $state<string | null>(null);
  let reactivateReason = $state("");
  let reactivateError = $state("");
  let printPromptDialog: HTMLDialogElement | null = null;
  let printTarget = $state<Order | null>(null);
  let pendingStatusChange = $state<null | { id: string; status: "recibida" | "en_proceso" | "lista" | "entregada" }>(null);
  let editOrderId = $state<string | null>(null);
  let editError = $state("");
  let editNotice = $state("");
  let orderSearch = $state("");
  let orderForm = $state({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "efectivo" as "efectivo" | "tarjeta" | "transferencia" | "otro",
    order_type: "para_llevar" as "en_local" | "para_llevar",
    table_number: "" as "" | number,
    notes: "",
    product_id: "",
    quantity: 1,
  });

  $effect(() => {
    if (!orderForm.product_id && products.length > 0) {
      orderForm.product_id = products[0].id;
    }
  });

  $effect(() => {
    if (orderForm.order_type === "para_llevar") {
      orderForm.table_number = "";
    }
  });

  const selectedProduct = $derived(
    products.find((product) => product.id === orderForm.product_id) || null,
  );
  const normalizedOrderSearch = $derived(orderSearch.trim().toLowerCase());
  const filteredOrders = $derived(
    !normalizedOrderSearch
      ? orders
      : orders.filter((order) => order.order_number.toLowerCase().includes(normalizedOrderSearch)),
  );

  const pricePreview = $derived(selectedProduct ? selectedProduct.price : 0);
  const totalPreview = $derived((selectedProduct ? selectedProduct.price : 0) * Number(orderForm.quantity || 0));
  const isEditing = $derived(!!editOrderId);
  const employeeById = $derived(
    employees.reduce((acc, employee) => {
      acc[employee.id] = employee.name || employee.email;
      return acc;
    }, {} as Record<string, string>),
  );

  const linearStatuses: Array<"pendiente_revision" | "recibida" | "en_proceso" | "lista" | "entregada"> = [
    "pendiente_revision",
    "recibida",
    "en_proceso",
    "lista",
    "entregada",
  ];

  const statusLabels: Record<Order["status"], string> = {
    pendiente_revision: "pendiente",
    recibida: "aceptada",
    en_proceso: "preparando",
    lista: "lista",
    entregada: "entregada",
    cancelada: "rechazada",
  };

  const statusBadgeClass: Record<Order["status"], string> = {
    pendiente_revision: "badge-warning",
    recibida: "badge-success",
    en_proceso: "badge-info",
    lista: "badge-accent",
    entregada: "badge-primary",
    cancelada: "badge-error",
  };

  const statusStepIcons: Record<(typeof linearStatuses)[number], string> = {
    pendiente_revision: "🧾",
    recibida: "✅",
    en_proceso: "👨‍🍳",
    lista: "🔔",
    entregada: "📦",
  };

  const canceledFlow: Array<"pendiente_revision" | "cancelada"> = [
    "pendiente_revision",
    "cancelada",
  ];

  const canceledStepLabels: Record<(typeof canceledFlow)[number], string> = {
    pendiente_revision: "pendiente",
    cancelada: "denegada",
  };

  const canceledStepIcons: Record<(typeof canceledFlow)[number], string> = {
    pendiente_revision: "🧾",
    cancelada: "⛔",
  };

  const orderStatusFilterLabel = $derived(
    orderStatusFilter === ""
      ? "Todos"
      : orderStatusFilter === "pendiente_revision"
        ? "pendiente_revision"
        : orderStatusFilter === "recibida"
          ? "recibida"
          : orderStatusFilter === "en_proceso"
            ? "preparando"
            : orderStatusFilter === "lista"
              ? "lista"
              : orderStatusFilter === "entregada"
                ? "entregada"
                : orderStatusFilter === "cancelada"
                  ? "cancelada"
                  : "Todos",
  );

  function kitchenBadge(order: Order): { text: string; className: string } | null {
    if (order.status === "recibida") {
      return { text: "Nueva orden", className: "badge badge-success badge-outline" };
    }
    return null;
  }

  function isStepReached(current: Order["status"], step: (typeof linearStatuses)[number]) {
    if (current === "cancelada") return false;
    return linearStatuses.indexOf(current as (typeof linearStatuses)[number]) >= linearStatuses.indexOf(step);
  }

  function amountColumnLabel(status: Order["status"]) {
    return status === "lista" || status === "entregada" ? "Total" : "Subtotal";
  }

  function orderTypeLabel(orderType: Order["order_type"]) {
    return orderType === "en_local" ? "En local" : "Para llevar";
  }

  function createdByLabel(order: Order) {
    if (!order.created_by_user_id) return "Cliente";
    return employeeById[order.created_by_user_id] || "Empleado";
  }

  function resetOrderForm() {
    editOrderId = null;
    editError = "";
    editNotice = "";
    orderForm = {
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      payment_method: "efectivo",
      order_type: "para_llevar",
      table_number: "",
      notes: "",
      product_id: products[0]?.id || "",
      quantity: 1,
    };
  }

  function openCreateOrderModal() {
    resetOrderForm();
    orderEditorDialog?.showModal();
  }

  function closeOrderEditor() {
    orderEditorDialog?.close();
    resetOrderForm();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    editError = "";
    editNotice = "";
    if (editOrderId) {
      const normalizedTableNumber =
        orderForm.order_type === "en_local" && orderForm.table_number !== ""
          ? Number(orderForm.table_number)
          : undefined;
      const updated = await onUpdateOrder(editOrderId, {
        customer_name: orderForm.customer_name.trim(),
        customer_phone: orderForm.customer_phone.trim(),
        customer_email: orderForm.customer_email.trim() || undefined,
        payment_method: orderForm.payment_method,
        order_type: orderForm.order_type,
        table_number: Number.isFinite(normalizedTableNumber) ? normalizedTableNumber : undefined,
        notes: orderForm.notes.trim() || undefined,
      });
      if (updated) {
        editNotice = "Orden actualizada correctamente";
        closeOrderEditor();
      } else {
        editError = "No se pudo actualizar la orden";
      }
      return;
    }

    const created = await onCreate({
      customer_name: orderForm.customer_name.trim(),
      customer_phone: orderForm.customer_phone.trim(),
      customer_email: orderForm.customer_email.trim() || undefined,
      payment_method: orderForm.payment_method,
      order_type: orderForm.order_type,
      table_number: orderForm.order_type === "en_local" && orderForm.table_number !== ""
        ? Number(orderForm.table_number)
        : undefined,
      notes: orderForm.notes.trim() || undefined,
      items: [
        {
          product_id: orderForm.product_id,
          quantity: Number(orderForm.quantity),
        },
      ],
    });

    if (created) {
      closeOrderEditor();
    } else {
      editError = "No se pudo crear la orden";
    }
  }

  function openConfirm(title: string, message: string, action: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmAction = action;
    confirmDialog?.showModal();
  }

  function confirmNow() {
    const action = confirmAction;
    confirmAction = null;
    confirmDialog?.close();
    if (action) action();
  }

  function closeConfirm() {
    confirmAction = null;
    confirmDialog?.close();
  }

  function openReject(orderId: string) {
    rejectTargetId = orderId;
    rejectReason = "";
    rejectError = "";
    rejectDialog?.showModal();
  }

  function confirmReject() {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      rejectError = "Debes indicar el motivo de rechazo";
      return;
    }
    onReject(rejectTargetId, rejectReason.trim());
    rejectDialog?.close();
    rejectTargetId = null;
    rejectReason = "";
    rejectError = "";
  }

  function closeReject() {
    rejectDialog?.close();
    rejectTargetId = null;
    rejectReason = "";
    rejectError = "";
  }

  function openReactivate(orderId: string) {
    reactivateTargetId = orderId;
    reactivateReason = "";
    reactivateError = "";
    reactivateDialog?.showModal();
  }

  function confirmReactivate() {
    if (!reactivateTargetId) return;
    if (!reactivateReason.trim()) {
      reactivateError = "Debes indicar el motivo de reactivacion";
      return;
    }
    onApprove(reactivateTargetId, reactivateReason.trim());
    closeReactivate();
  }

  function closeReactivate() {
    reactivateDialog?.close();
    reactivateTargetId = null;
    reactivateReason = "";
    reactivateError = "";
  }

  async function startEdit(orderId: string) {
    editNotice = "";
    editError = "";
    const order = await onOpenOrder(orderId);
    if (!order) return;
    editOrderId = order.id;
    orderForm = {
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email ?? "",
      payment_method: order.payment_method,
      order_type: order.order_type,
      table_number: order.table_number ?? "",
      notes: order.notes ?? "",
      product_id: orderForm.product_id,
      quantity: orderForm.quantity,
    };
    orderEditorDialog?.showModal();
  }

  function cancelEdit() {
    closeOrderEditor();
  }

  function openPrintPrompt(order: Order) {
    printTarget = order;
    pendingStatusChange = { id: order.id, status: "lista" };
    printPromptDialog?.showModal();
  }

  async function handleStatusChangeFromList(orderId: string, status: "recibida" | "en_proceso" | "lista" | "entregada") {
    const updated = await onStatusChange(orderId, status);
    if (!updated) return;
    await onOpenOrder(orderId);
  }

  function handleStepClick(order: Order, stepStatus: (typeof linearStatuses)[number]) {
    if (order.status === "cancelada" || order.status === stepStatus) return;
    if (stepStatus === "lista") {
      openPrintPrompt(order);
      return;
    }
    const nextStatus = stepStatus === "pendiente_revision" ? "en_proceso" : stepStatus;
    handleStatusChangeFromList(order.id, nextStatus);
  }

  function canChangeToStep(order: Order, stepStatus: (typeof linearStatuses)[number]) {
    return order.status !== "cancelada" && order.status !== stepStatus && stepStatus !== "pendiente_revision";
  }

  function closePrintPrompt() {
    printPromptDialog?.close();
    printTarget = null;
    pendingStatusChange = null;
  }

  function renderReceipt(order: Order) {
    const itemsMarkup = (order.items || []).map((item) => {
      return `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${formatCurrency(item.subtotal)}</td></tr>`;
    }).join("");

    const itemsTable = itemsMarkup || `<tr><td colspan="3">Sin items</td></tr>`;

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Recibo ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #ddd; padding: 6px 0; text-align: left; }
      .meta { font-size: 12px; color: #555; margin-top: 6px; }
      .total { font-weight: bold; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>Recibo de orden ${order.order_number}</h1>
    <div class="meta">Cliente: ${order.customer_name}</div>
    <div class="meta">Telefono: ${order.customer_phone}</div>
    <div class="meta">Metodo pago: ${order.payment_method}</div>
    <table>
      <thead><tr><th>Producto</th><th>Cantidad</th><th>${amountColumnLabel(order.status)}</th></tr></thead>
      <tbody>${itemsTable}</tbody>
    </table>
    <div class="total">Total: ${formatCurrency(order.total_amount)}</div>
  </body>
</html>`;
  }

  function printReceipt(order: Order) {
    const receipt = renderReceipt(order);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = receipt;
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
    };
    document.body.appendChild(iframe);
  }

  async function applyStatusChange() {
    if (!pendingStatusChange) return;
    const { id, status } = pendingStatusChange;
    closePrintPrompt();
    const updated = await onStatusChange(id, status);
    if (!updated) return;
    await onOpenOrder(id);
  }

</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="card-title">Gestion de ordenes</h2>
          <p class="text-sm text-base-content/70">Crea ordenes nuevas o busca rapidamente por numero.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button class="btn btn-primary" type="button" onclick={openCreateOrderModal} disabled={busy}>
            Crear orden
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label for="order-search" class="label-text text-sm whitespace-nowrap">Buscar por numero</label>
            <input
              id="order-search"
              class="input input-sm input-bordered w-56 md:w-64"
              placeholder="ORD-20260223-2029"
              bind:value={orderSearch}
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
                <li><button type="button" onclick={() => onFilterChange("pendiente_revision")}>pendiente_revision</button></li>
                <li><button type="button" onclick={() => onFilterChange("recibida")}>recibida</button></li>
                <li><button type="button" onclick={() => onFilterChange("en_proceso")}>preparando</button></li>
                <li><button type="button" onclick={() => onFilterChange("lista")}>lista</button></li>
                <li><button type="button" onclick={() => onFilterChange("entregada")}>entregada</button></li>
                <li><button type="button" onclick={() => onFilterChange("cancelada")}>cancelada</button></li>
              </ul>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick={onReload} disabled={busy}>Actualizar</button>
        </div>
        <div class="text-sm text-base-content/70 whitespace-nowrap">
          {filteredOrders.length} de {orders.length} orden(es)
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
        <table class="table">
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
              {#each filteredOrders as order}
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
                    <div class="font-medium">{order.customer_name}</div>
                  </td>
                  <td class="text-center align-middle">
                    <div class="flex flex-col items-center gap-1">
                      <span class={`badge ${statusBadgeClass[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                  </td>
                  <td class="text-center align-middle">
                    <div class="flex w-full flex-wrap items-center justify-center gap-2">
                      <button
                        class="btn btn-sm btn-soft btn-info"
                        onclick={async () => {
                          const detail = await onOpenOrder(order.id);
                          if (detail) {
                            printReceipt(detail);
                          }
                        }}
                      >
                        Imprimir
                      </button>
                      <button class="btn btn-sm btn-soft btn-accent" onclick={() => startEdit(order.id)}>Editar</button>
                      {#if order.status === "pendiente_revision"}
                        <button
                          class="btn btn-sm btn-soft btn-success"
                          onclick={() =>
                            openConfirm(
                              "Aprobar orden",
                              `Confirmar aprobacion de ${order.order_number}?`,
                              () => onApprove(order.id),
                            )}
                        >
                          Aprobar
                        </button>
                        <button class="btn btn-sm btn-soft btn-error" onclick={() => openReject(order.id)}>Rechazar</button>
                      {/if}

                      {#if isAdmin}
                        <button
                          class="btn btn-sm btn-soft btn-error"
                          onclick={() =>
                            openConfirm(
                              "Eliminar orden",
                              `Seguro que deseas eliminar ${order.order_number}?`,
                              () => onDelete(order.id),
                            )}
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

  {#if selectedOrder}
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h3 class="card-title">Detalle de orden: {selectedOrder.order_number}</h3>
        <div class="grid gap-3 md:grid-cols-[1fr_1fr_0.9fr] text-sm">
          <div class="space-y-2">
            <p><strong>Cliente:</strong> {selectedOrder.customer_name}</p>
            <p><strong>Metodo pago:</strong> {selectedOrder.payment_method}</p>
            <p><strong>Mesa:</strong> {selectedOrder.order_type === "en_local" ? (selectedOrder.table_number ?? "Sin mesa") : "No aplica"}</p>
          </div>
          <div class="space-y-2">
            <p><strong>Telefono:</strong> {selectedOrder.customer_phone}</p>
            <p><strong>Tipo:</strong> {selectedOrder.order_type ? orderTypeLabel(selectedOrder.order_type) : "No definido"}</p>
            <p><strong>Creada por:</strong> {createdByLabel(selectedOrder)}</p>
          </div>
          <div class="space-y-2">
            <p><strong>Notas:</strong></p>
            <div class="rounded-lg border border-base-300/60 bg-base-200/40 p-3 text-sm max-h-28 overflow-y-auto">
              {selectedOrder.notes?.trim() ? selectedOrder.notes : "Sin notas"}
            </div>
          </div>
          <div class="md:col-span-3">
            {#if selectedOrder.status === "cancelada"}
              <div class="flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-left"><strong>Estado:</strong></p>
                  <span class="badge badge-error badge-outline">Orden denegada</span>
                  {#if selectedOrder.rejection_reason}
                    <span class="text-xs text-base-content/60">Motivo: {selectedOrder.rejection_reason}</span>
                  {/if}
                  {#if isAdmin}
                    <button
                      class="btn btn-xs btn-soft btn-success"
                      onclick={() => openReactivate(selectedOrder.id)}
                    >
                      Aceptar
                    </button>
                  {/if}
                </div>
                <ul class="steps steps-sm w-full max-w-2xl mt-2">
                  {#each canceledFlow as stepStatus}
                    <li class="step step-primary text-center">
                      <span class="step-icon">{canceledStepIcons[stepStatus]}</span>
                      <span>{canceledStepLabels[stepStatus]}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {:else}
              <div class="grid gap-3 md:grid-cols-[200px_minmax(240px,1fr)_200px] items-center">
                <div class="text-left">
                  <p><strong>Estado:</strong></p>
                </div>
                <div>
                  <ul class="steps steps-sm w-full max-w-3xl mx-auto">
                    {#each linearStatuses as stepStatus}
                      <li class={`step ${isStepReached(selectedOrder.status, stepStatus) ? "step-primary" : ""} text-center`}>
                        <span class="step-icon">{statusStepIcons[stepStatus]}</span>
                        <button
                          class="cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit disabled:cursor-default"
                          type="button"
                          onclick={() => handleStepClick(selectedOrder, stepStatus)}
                          disabled={!canChangeToStep(selectedOrder, stepStatus)}
                          aria-label={`Actualizar estado a ${statusLabels[stepStatus]}`}
                        >
                          {statusLabels[stepStatus]}
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
                <div class="flex justify-end">
                  <div class="flex items-center gap-2">
                    {#if kitchenBadge(selectedOrder)}
                      <span class={kitchenBadge(selectedOrder)?.className}>{kitchenBadge(selectedOrder)?.text}</span>
                    {/if}
                    {#if selectedOrder.status === "recibida" && isAdmin}
                      <button class="btn btn-xs btn-soft btn-error" onclick={() => openReject(selectedOrder.id)}>
                        Rechazar
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
        <div class="overflow-x-auto mt-2">
          <table class="table table-sm">
            <thead class="bg-base-200/60 text-base-content">
              <tr>
                <th class="w-[55%] font-bold">Producto</th>
                <th class="w-[15%] text-center font-bold">Cantidad</th>
                <th class="w-[30%] text-right font-bold">{amountColumnLabel(selectedOrder.status)}</th>
              </tr>
            </thead>
            <tbody>
              {#if !selectedOrder.items || selectedOrder.items.length === 0}
                <tr><td colspan="3">Sin items</td></tr>
              {:else}
                {#each selectedOrder.items as item}
                  <tr>
                    <td>{item.product_name}</td>
                    <td class="text-center">{item.quantity}</td>
                    <td class="text-right">{formatCurrency(item.subtotal)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</section>

<dialog class="modal" bind:this={orderEditorDialog} onclose={resetOrderForm}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar orden" : "Crear orden manual"}</h3>
      {#if isEditing && selectedOrder && selectedOrder.id === editOrderId}
        <span class="text-xs text-base-content/60">{selectedOrder.order_number}</span>
      {/if}
    </div>
    <form class="grid md:grid-cols-[1.15fr_0.85fr] gap-6 mt-5" onsubmit={handleSubmit}>
      <div class="grid gap-5">
        <div class="grid md:grid-cols-2 gap-5">
          <div class="form-control">
            <span id="order-customer-name-label" class="label-text mb-1">Nombre cliente</span>
            <input id="order-customer-name" class="input input-bordered" bind:value={orderForm.customer_name} required aria-labelledby="order-customer-name-label" />
          </div>
          <div class="form-control">
            <span id="order-customer-phone-label" class="label-text mb-1">Telefono</span>
            <input id="order-customer-phone" class="input input-bordered" bind:value={orderForm.customer_phone} required aria-labelledby="order-customer-phone-label" />
          </div>
          <div class="form-control">
            <span id="order-customer-email-label" class="label-text mb-1">Correo (opcional)</span>
            <input id="order-customer-email" class="input input-bordered" type="email" bind:value={orderForm.customer_email} aria-labelledby="order-customer-email-label" />
          </div>
          <div class="form-control">
            <span id="order-payment-method-label" class="label-text mb-1">Metodo de pago</span>
            <select id="order-payment-method" class="select select-bordered" bind:value={orderForm.payment_method} aria-labelledby="order-payment-method-label">
              <option value="efectivo">efectivo</option>
              <option value="tarjeta">tarjeta</option>
              <option value="transferencia">transferencia</option>
              <option value="otro">otro</option>
            </select>
          </div>
          <div class="form-control">
            <span id="order-type-label" class="label-text mb-1">Tipo de orden</span>
            <select id="order-type" class="select select-bordered" bind:value={orderForm.order_type} aria-labelledby="order-type-label">
              <option value="para_llevar">para llevar</option>
              <option value="en_local">en local</option>
            </select>
          </div>
          <div class="form-control">
            <span id="order-table-number-label" class="label-text mb-1">Mesa</span>
            <input
              id="order-table-number"
              class="input input-bordered"
              type="number"
              min="1"
              placeholder={orderForm.order_type === "en_local" ? "Numero de mesa" : "No aplica"}
              bind:value={orderForm.table_number}
              required={orderForm.order_type === "en_local"}
              disabled={orderForm.order_type !== "en_local"}
              aria-labelledby="order-table-number-label"
            />
          </div>
          <div class="form-control">
            <span id="order-product-label" class="label-text mb-1">Producto</span>
            <select id="order-product" class="select select-bordered" bind:value={orderForm.product_id} required disabled={isEditing} aria-labelledby="order-product-label">
              {#if products.length === 0}
                <option value="" disabled>Sin productos</option>
              {:else}
                {#each products as product}
                  <option value={product.id}>{product.name}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div class="form-control">
            <span id="order-quantity-label" class="label-text mb-1">Cantidad</span>
            <input id="order-quantity" class="input input-bordered" type="number" min="1" bind:value={orderForm.quantity} required disabled={isEditing} aria-labelledby="order-quantity-label" />
          </div>
        </div>
        <div class="text-sm text-base-content/70">
          {#if isEditing}
            {#if selectedOrder && selectedOrder.id === editOrderId}
              <p>Total actual: <strong>{formatCurrency(selectedOrder.total_amount)}</strong></p>
            {/if}
          {:else}
            <p>Precio unitario: <strong>{formatCurrency(pricePreview)}</strong></p>
            <p>Total estimado: <strong>{formatCurrency(totalPreview)}</strong></p>
          {/if}
        </div>
        {#if editError}
          <div class="text-sm text-error">{editError}</div>
        {/if}
        {#if editNotice}
          <div class="alert alert-success py-2">
            <span>{editNotice}</span>
          </div>
        {/if}
        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {isEditing ? "Guardar cambios" : "Crear orden"}
          </button>
          <button class="btn btn-error btn-outline" type="button" onclick={cancelEdit}>
            {isEditing ? "Cancelar edicion" : "Cancelar"}
          </button>
        </div>
      </div>
      <div class="form-control self-start pt-6">
        <textarea id="order-notes" class="textarea w-full min-h-55" rows="10" placeholder="Notas" bind:value={orderForm.notes} aria-label="Notas"></textarea>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeOrderEditor}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={confirmDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">{confirmTitle || "Confirmar accion"}</h3>
    <p class="py-2 text-sm text-base-content/70">{confirmMessage}</p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeConfirm}>Cancelar</button>
      <button class="btn btn-primary" type="button" onclick={confirmNow} disabled={busy}>Confirmar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog class="modal" bind:this={rejectDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Rechazar orden</h3>
    <p class="text-sm text-base-content/70">Indica el motivo del rechazo para dejar registro.</p>
    <textarea
      class="textarea textarea-bordered w-full mt-3"
      rows="4"
      placeholder="Motivo"
      bind:value={rejectReason}
    ></textarea>
    {#if rejectError}
      <p class="mt-2 text-sm text-error">{rejectError}</p>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeReject}>Cancelar</button>
      <button class="btn btn-error" type="button" onclick={confirmReject} disabled={busy}>Rechazar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog class="modal" bind:this={printPromptDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Orden lista</h3>
    <p class="text-sm text-base-content/70">
      {#if printTarget}
        La orden {printTarget.order_number} paso a estado lista. Deseas imprimir el recibo?
      {/if}
    </p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closePrintPrompt}>Cancelar</button>
      <button class="btn btn-primary" type="button" onclick={applyStatusChange} disabled={busy}>
        Actualizar
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog class="modal" bind:this={reactivateDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Aceptar orden rechazada</h3>
    <p class="text-sm text-base-content/70">Indica el motivo de reactivacion para dejar registro.</p>
    <textarea
      class="textarea textarea-bordered w-full mt-3"
      rows="4"
      placeholder="Motivo de reactivacion"
      bind:value={reactivateReason}
    ></textarea>
    {#if reactivateError}
      <p class="mt-2 text-sm text-error">{reactivateError}</p>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeReactivate}>Cancelar</button>
      <button class="btn btn-success" type="button" onclick={confirmReactivate} disabled={busy}>Aceptar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
