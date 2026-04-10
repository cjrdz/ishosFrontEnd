<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import {
    trackPublicOrder,
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

  const STATUS_ICONS_ACTIVE: Record<PublicOrderStatus, string> = {
    pendiente_revision: "line-md:watch-loop",
    recibida:           "line-md:confirm-circle",
    en_proceso:         "line-md:loading-twotone-loop",
    lista:              "line-md:bell-loop",
    entregada:          "line-md:check-all",
    cancelada:          "line-md:close-circle",
  };

  const STATUS_ICONS_STATIC: Record<PublicOrderStatus, string> = {
    pendiente_revision: "lucide:clock",
    recibida:           "lucide:check-circle",
    en_proceso:         "lucide:loader",
    lista:              "lucide:bell",
    entregada:          "lucide:check-check",
    cancelada:          "lucide:x-circle",
  };

  let trackingOrderNumber = $state("");
  let trackingToken = $state("");
  let trackingBusy = $state(false);
  let trackingError = $state("");
  let trackedOrder = $state<PublicOrderTrackingResponse | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    const url = new URL(window.location.href);
    const orderFromUrl = url.searchParams.get("order")?.trim() ?? url.searchParams.get("order_number")?.trim() ?? "";
    const tokenFromUrl = url.searchParams.get("token")?.trim() ?? url.searchParams.get("tracking_token")?.trim() ?? "";

    if (orderFromUrl && tokenFromUrl) {
      trackingOrderNumber = orderFromUrl;
      trackingToken = tokenFromUrl;
      saveTracking(orderFromUrl, tokenFromUrl);
      window.history.replaceState({}, "", url.pathname);
      void runTrackingLookup();
    } else {
    const persisted = getTracking();
    if (persisted) {
      trackingOrderNumber = persisted.orderNumber;
      trackingToken = persisted.token;
      void runTrackingLookup();
    }
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  async function runTrackingLookup() {
    const orderNumber = trackingOrderNumber.trim();
    const token = trackingToken.trim();

    if (!orderNumber) {
      trackingError = "Ingresa tu número de orden.";
      return;
    }

    if (!token) {
      trackingError = "El seguimiento solo está disponible desde el dispositivo donde realizaste el pedido. Si cambiaste de dispositivo, usa el enlace de seguimiento que te enviamos por WhatsApp.";
      return;
    }

    trackingError = "";
    trackingBusy = true;

    try {
      const order = await trackPublicOrder(orderNumber, token);

      if (!order) {
        trackedOrder = null;
        trackingError = "No encontramos la orden. Verifica el número o usa el dispositivo donde realizaste el pedido.";
        stopTrackingPolling();
        return;
      }

      trackedOrder = order;
      saveTracking(orderNumber, token);

      const hasActiveOrder = order.status !== "entregada" && order.status !== "cancelada";
      if (hasActiveOrder) {
        startTrackingPolling();
      } else {
        stopTrackingPolling();
      }
    } catch (error) {
      trackedOrder = null;
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
      <p class="text-sm text-base-content/70">Consulta el estado de tu pedido con tu número de orden.</p>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label class="form-control flex-1">
          <span class="label-text">Número de orden</span>
          <input
            class="input input-bordered w-full"
            bind:value={trackingOrderNumber}
            placeholder="ORD-20260223-1234"
          />
        </label>

        <div class="form-control">
          <button class="btn btn-outline w-full sm:w-auto" type="button" onclick={runTrackingLookup} disabled={trackingBusy}>
            {trackingBusy ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </div>

      {#if trackingError}
        <div class="alert alert-error mt-3">{trackingError}</div>
      {/if}

      {#if trackedOrder}
        <div class="mt-4 space-y-4">
          <div class="text-sm text-base-content/75">
            Mostrando el estado más reciente de tu orden.
          </div>

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
                    <span class="step-icon"><Icon icon={step === trackedOrder.status ? STATUS_ICONS_ACTIVE[step] : STATUS_ICONS_STATIC[step]} width="16" height="16" /></span>
                    {STATUS_LABELS[step]}
                  </li>
                {/each}
              </ul>
            {/if}
          </article>
        </div>
      {/if}
    </div>
  </section>
</div>
