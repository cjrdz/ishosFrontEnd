<script lang="ts">
  import { onMount } from "svelte";
  import { trackPublicOrder, type PublicOrderStatus, type PublicOrderTrackingResponse } from "../../../lib/api/store";
  import { getTracking, saveTracking } from "../../../lib/storefront/tracking";

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
  let trackedOrder = $state<PublicOrderTrackingResponse | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const currentStepIndex = $derived(
    trackedOrder ? STATUS_FLOW.findIndex((status) => status === trackedOrder!.status) : -1,
  );

  onMount(() => {
    const persisted = getTracking();
    if (persisted) {
      trackingOrderNumber = persisted.orderNumber;
      trackingPhone = persisted.phone;
      void runTrackingLookup();
      startTrackingPolling();
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  async function runTrackingLookup() {
    if (!trackingOrderNumber.trim() || !trackingPhone.trim()) {
      trackingError = "Ingresa número de orden y teléfono.";
      return;
    }

    trackingError = "";
    trackingBusy = true;

    try {
      trackedOrder = await trackPublicOrder(trackingOrderNumber.trim(), trackingPhone.trim());
      saveTracking(trackingOrderNumber.trim(), trackingPhone.trim());

      if (trackedOrder.status === "entregada" || trackedOrder.status === "cancelada") {
        stopTrackingPolling();
      }
    } catch (error) {
      trackedOrder = null;
      trackingError = error instanceof Error ? error.message : "No se pudo consultar la orden.";
    } finally {
      trackingBusy = false;
    }
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

      <div class="grid gap-3 md:grid-cols-3">
        <label class="form-control">
          <span class="label-text">Número de orden</span>
          <input class="input input-bordered" bind:value={trackingOrderNumber} placeholder="ORD-20260223-1234" />
        </label>

        <label class="form-control">
          <span class="label-text">Teléfono</span>
          <input class="input input-bordered" bind:value={trackingPhone} placeholder="+503 7000 0000" />
        </label>

        <div class="form-control justify-end">
          <button class="btn btn-outline" type="button" onclick={runTrackingLookup} disabled={trackingBusy}>
            {trackingBusy ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </div>

      {#if trackingError}
        <div class="alert alert-error mt-3">{trackingError}</div>
      {/if}

      {#if trackedOrder}
        <div class="mt-4 space-y-3">
          <div class="text-sm">
            <span class="font-semibold">Orden:</span> {trackedOrder.order_number} ·
            <span class="font-semibold">Estado:</span> {STATUS_LABELS[trackedOrder.status]}
          </div>

          {#if trackedOrder.status === "cancelada"}
            <div class="alert alert-warning">Tu orden fue cancelada. Contáctanos para más información.</div>
          {:else}
            <ul class="steps steps-vertical md:steps-horizontal w-full">
              {#each STATUS_FLOW as step, index}
                <li class={`step ${index <= currentStepIndex ? "step-primary" : ""}`}>
                  <span class="step-icon">{STATUS_ICONS[step]}</span>
                  {STATUS_LABELS[step]}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  </section>
</div>
