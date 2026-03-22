<script lang="ts">
  import { onMount } from "svelte";
  import {
    trackPublicOrdersByPhone,
    type PublicOrderStatus,
    type PublicOrderTrackingResponse,
  } from "../../../lib/api/store";
  import { getTracking, saveTracking } from "../../../lib/store/tracking";

  const STATUS_FLOW: PublicOrderStatus[] = [
    "pendiente_revision",
    "recibida",
    "en_proceso",
    "lista",
    "entregada",
  ];

  const STATUS_LABELS: Record<PublicOrderStatus, string> = {
    pendiente_revision: "Pendiente",
    recibida: "Aceptada",
    en_proceso: "Preparando",
    lista: "Lista",
    entregada: "Entregada",
    cancelada: "Cancelada",
  };

  const STATUS_ICONS: Record<PublicOrderStatus, string> = {
    pendiente_revision: "🧾",
    recibida: "✅",
    en_proceso: "👨‍🍳",
    lista: "🔔",
    entregada: "📦",
    cancelada: "❌",
  };

  let trackingOrderNumber = $state("");
  let trackingPhone = $state("");
  let trackingBusy = $state(false);
  let trackingError = $state("");
  let trackedOrders = $state<PublicOrderTrackingResponse[]>([]);
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const trackedCount = $derived(trackedOrders.length);

  onMount(() => {
    const persisted = getTracking();
    if (persisted) {
      trackingOrderNumber = persisted.orderNumber;
      trackingPhone = persisted.phone;
      void runTrackingLookup();
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  async function runTrackingLookup() {
    const orderNumber = trackingOrderNumber.trim();
    const customerPhone = trackingPhone.trim();

    if (!customerPhone) {
      trackingError = "Ingresa el teléfono para consultar tus pedidos.";
      return;
    }

    trackingError = "";
    trackingBusy = true;

    try {
      const history = await trackPublicOrdersByPhone(customerPhone, 20);
      let orders = history.orders ?? [];

      if (orderNumber) {
        orders = orders.filter((order) => order.order_number.toUpperCase() === orderNumber.toUpperCase());
      }

      if (orders.length === 0) {
        trackedOrders = [];
        trackingError = orderNumber
          ? "No encontramos esa orden para ese teléfono."
          : "No encontramos pedidos para ese teléfono.";
        stopTrackingPolling();
        return;
      }

      trackedOrders = orders;
      saveTracking(orderNumber || orders[0].order_number, customerPhone);

      const hasActiveOrder = orders.some((order) => order.status !== "entregada" && order.status !== "cancelada");
      if (hasActiveOrder) {
        startTrackingPolling();
      } else {
        stopTrackingPolling();
      }
    } catch (error) {
      trackedOrders = [];
      trackingError = error instanceof Error ? error.message : "No se pudo consultar la orden.";
      stopTrackingPolling();
    } finally {
      trackingBusy = false;
    }
  }

  function stepIndex(status: PublicOrderStatus): number {
    return STATUS_FLOW.findIndex((current) => current === status);
  }

  function formatDate(value: string): string {
    return new Date(value).toLocaleString("es-SV", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatMoney(value: number): string {
    return new Intl.NumberFormat("es-SV", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function startTrackingPolling() {
    stopTrackingPolling();
    pollTimer = setInterval(() => {
      void runTrackingLookup();
    }, 20000);
  }

  function stopTrackingPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
</script>

<div class="space-y-8">
  <section class="mb-6 flex items-center justify-between flex-wrap gap-2">
    <h1 class="text-4xl font-bold">Seguimiento de pedido</h1>
    <a href="/menu" class="btn btn-outline">Volver al menú</a>
  </section>

  <section class="card bg-base-100 shadow-xl border border-base-300 rounded-2xl">
    <div class="card-body p-8">
      <p class="text-sm text-base-content/70">Consulta el estado con tu número de orden y teléfono.</p>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label class="form-control">
          <span class="label-text">Número de orden</span>
          <input
            class="input input-bordered w-full"
            bind:value={trackingOrderNumber}
            placeholder="Opcional: ORD-20260223-1234"
          />
        </label>

        <label class="form-control">
          <span class="label-text">Teléfono</span>
          <input class="input input-bordered w-full" bind:value={trackingPhone} placeholder="+503 7000 0000" />
        </label>

        <div class="form-control justify-end sm:col-span-2 lg:col-span-1">
          <button class="btn btn-outline w-full lg:w-auto" type="button" onclick={runTrackingLookup} disabled={trackingBusy}>
            {trackingBusy ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </div>

      {#if trackingError}
        <div class="alert alert-error mt-3">{trackingError}</div>
      {/if}

      {#if trackedCount > 0}
        <div class="mt-4 space-y-4">
          <div class="text-sm text-base-content/75">
            Mostrando {trackedCount} pedido{trackedCount > 1 ? "s" : ""} para este teléfono.
          </div>

          {#each trackedOrders as trackedOrder}
            <article class="rounded-xl border border-base-300 bg-base-200/40 p-4">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span class="font-semibold">Orden:</span> {trackedOrder.order_number}
                </div>
                <div class="badge badge-outline">{STATUS_LABELS[trackedOrder.status]}</div>
              </div>

              <div class="mb-4 grid grid-cols-1 gap-2 text-xs text-base-content/70 sm:grid-cols-3">
                <div><span class="font-semibold">Total:</span> {formatMoney(trackedOrder.total_amount)}</div>
                <div><span class="font-semibold">Tipo:</span> {trackedOrder.order_type === "para_llevar" ? "Para llevar" : "En local"}</div>
                <div><span class="font-semibold">Actualizado:</span> {formatDate(trackedOrder.updated_at)}</div>
              </div>

              {#if trackedOrder.status === "cancelada"}
                <div class="alert alert-warning">Tu orden fue cancelada. Contáctanos para más información.</div>
              {:else}
                <ul class="steps steps-vertical xl:steps-horizontal w-full">
                  {#each STATUS_FLOW as step, index}
                    <li class={`step ${index <= stepIndex(trackedOrder.status) ? "step-primary" : ""}`}>
                      <span class="step-icon">{STATUS_ICONS[step]}</span>
                      {STATUS_LABELS[step]}
                    </li>
                  {/each}
                </ul>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </section>
</div>
