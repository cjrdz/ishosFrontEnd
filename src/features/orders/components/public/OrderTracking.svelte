<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { ApiError } from "@core/errors";
  import {
    trackPublicOrder,
    type PublicOrderStatus,
    type PublicOrderTrackingResponse,
  } from "@features/catalog";
  import {
    clearRecentTrackingOrders,
    getRecentTrackingOrders,
    getRememberTrackingPreference,
    getTracking,
    saveRecentTrackingOrder,
    saveRememberTrackingPreference,
    saveTracking,
    type RecentTrackingOrder,
    TRACKING_STATUS_FLOW,
    TRACKING_STATUS_LABELS,
    TRACKING_STATUS_ICONS_ACTIVE,
    TRACKING_STATUS_ICONS_STATIC,
  } from "@features/analytics";

  let trackingOrderNumber = $state("");
  let trackingToken = $state("");
  let trackingBusy = $state(false);
  let trackingRefreshing = $state(false);
  let trackingError = $state("");
  let trackedOrder = $state<PublicOrderTrackingResponse | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;
  let trackingCooldownUntil = $state(0);
  let cooldownNow = $state(Date.now());
  let productsExpanded = $state(false);
  let rememberTrackingOnDevice = $state(true);
  let recentTrackingOrders = $state<RecentTrackingOrder[]>([]);
  let receiptActionMessage = $state("");

  const TRACKING_POLL_INTERVAL_MS = 20000;
  const TRACKING_RATE_LIMIT_COOLDOWN_MS = 60000;
  const RECENT_TRACKING_RETENTION_DAYS = 30;

  const trackedOrderItems = $derived(trackedOrder?.items ?? []);
  const trackingLookupActive = $derived(trackingBusy || trackingRefreshing);
  const trackingCooldownActive = $derived(trackingCooldownUntil > cooldownNow);
  const trackingCooldownSeconds = $derived(
    trackingCooldownActive
      ? Math.max(1, Math.ceil((trackingCooldownUntil - cooldownNow) / 1000))
      : 0,
  );
  const trackedOrderDelivered = $derived(trackedOrder?.status === "entregada");

  onMount(() => {
    rememberTrackingOnDevice = getRememberTrackingPreference();
    recentTrackingOrders = getRecentTrackingOrders();

    const url = new URL(window.location.href);
    const orderFromUrl =
      url.searchParams.get("order")?.trim() ??
      url.searchParams.get("order_number")?.trim() ??
      "";
    const tokenFromUrl =
      url.searchParams.get("token")?.trim() ??
      url.searchParams.get("tracking_token")?.trim() ??
      "";

    if (orderFromUrl && tokenFromUrl) {
      trackingOrderNumber = orderFromUrl;
      trackingToken = tokenFromUrl;
      saveTracking(orderFromUrl, tokenFromUrl);
      window.history.replaceState({}, "", url.pathname);
      void runTrackingLookup({ silent: true });
    } else {
      const persisted = getTracking();
      if (persisted) {
        trackingOrderNumber = persisted.orderNumber;
        trackingToken = persisted.token;
        void runTrackingLookup({ silent: true });
      }
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (cooldownTimer) clearInterval(cooldownTimer);
    };
  });

  function startTrackingCooldown(
    durationMs: number = TRACKING_RATE_LIMIT_COOLDOWN_MS,
  ) {
    trackingCooldownUntil = Date.now() + durationMs;
    cooldownNow = Date.now();
    stopTrackingPolling();

    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      cooldownNow = Date.now();
      if (trackingCooldownUntil <= cooldownNow && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = undefined;
      }
    }, 1000);
  }

  function clearTrackingCooldown() {
    trackingCooldownUntil = 0;
    cooldownNow = Date.now();
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = undefined;
    }
  }

  async function runTrackingLookup(options?: { silent?: boolean }) {
    const orderNumber = trackingOrderNumber.trim();
    const token = trackingToken.trim();
    const silent = options?.silent ?? false;

    if (trackingCooldownUntil > Date.now()) {
      if (!silent) {
        trackingError = `Hiciste muchas consultas. Intenta de nuevo en ${trackingCooldownSeconds}s.`;
      }
      return;
    }

    if (!orderNumber) {
      trackingError = "Ingresa tu número de orden.";
      return;
    }

    if (!token) {
      trackingError =
        "El seguimiento solo está disponible desde el dispositivo donde realizaste el pedido. Si cambiaste de dispositivo, usa el enlace de seguimiento que te enviamos por WhatsApp.";
      return;
    }

    trackingError = "";
    if (silent) {
      trackingRefreshing = true;
    } else {
      trackingBusy = true;
    }

    try {
      const order = await trackPublicOrder(orderNumber, token);

      if (!order) {
        trackedOrder = null;
        trackingError =
          "No encontramos la orden. Verifica el número o usa el dispositivo donde realizaste el pedido.";
        stopTrackingPolling();
        return;
      }

      trackedOrder = order;
      receiptActionMessage = "";
      clearTrackingCooldown();
      saveTracking(orderNumber, token);

      if (rememberTrackingOnDevice) {
        saveRecentTrackingOrder({
          orderNumber,
          token,
          status: order.status,
          totalAmount: order.total_amount,
          updatedAt: order.updated_at,
        });
        recentTrackingOrders = getRecentTrackingOrders();
      }

      const hasActiveOrder =
        order.status !== "entregada" && order.status !== "cancelada";
      if (hasActiveOrder) {
        startTrackingPolling();
      } else {
        stopTrackingPolling();
      }
    } catch (error) {
      trackedOrder = null;

      if (error instanceof ApiError && error.status === 404) {
        trackingError =
          "Tu orden fue cancelada. Contáctanos para más información.";
        stopTrackingPolling();
        return;
      }

      if (error instanceof ApiError && error.status === 429) {
        startTrackingCooldown();
        trackingError =
          "Hiciste muchas consultas en poco tiempo. Espera 60 segundos e intenta de nuevo.";
        stopTrackingPolling();
        return;
      }

      trackingError =
        error instanceof Error
          ? error.message
          : "No se pudo consultar la orden.";
      stopTrackingPolling();
    } finally {
      if (silent) {
        trackingRefreshing = false;
      } else {
        trackingBusy = false;
      }
    }
  }

  function stepIndex(status: PublicOrderStatus): number {
    return TRACKING_STATUS_FLOW.findIndex((current) => current === status);
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
      void runTrackingLookup({ silent: true });
    }, TRACKING_POLL_INTERVAL_MS);
  }

  function stopTrackingPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = undefined;
  }

  function itemIncludedAddonSummary(
    item: PublicOrderTrackingResponse["items"][number],
  ): string[] {
    const customizations = item.customizations;
    if (!customizations) return [];
    return Array.from(new Set(customizations.included_addon_names ?? []));
  }

  function itemExtraAddonSummary(
    item: PublicOrderTrackingResponse["items"][number],
  ): string[] {
    const customizations = item.customizations;
    if (!customizations) return [];

    if (Array.isArray(customizations.extra_addon_names)) {
      return Array.from(new Set(customizations.extra_addon_names));
    }

    // Backward compatibility: legacy orders only stored addon_names.
    return Array.from(new Set(customizations.addon_names ?? []));
  }

  function loadRecentOrder(entry: RecentTrackingOrder) {
    trackingOrderNumber = entry.orderNumber;
    trackingToken = entry.token;
    void runTrackingLookup();
  }

  function toggleRememberTrackingOnDevice(enabled: boolean) {
    rememberTrackingOnDevice = enabled;
    saveRememberTrackingPreference(enabled);
  }

  function clearRecentOrders() {
    clearRecentTrackingOrders();
    recentTrackingOrders = [];
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildReceiptText(order: PublicOrderTrackingResponse): string {
    const items = order.items
      .map((item) => {
        const lines = [
          `${item.quantity}x ${item.product_name}`,
          `  Unitario: ${formatMoney(item.unit_price)}`,
          `  Subtotal: ${formatMoney(item.subtotal)}`,
        ];

        if (item.customizations?.flavor_name) {
          lines.push(`  Sabor: ${item.customizations.flavor_name}`);
        }

        const included = itemIncludedAddonSummary(item);
        if (included.length > 0) {
          lines.push(`  Incluidos: ${included.join(", ")}`);
        }

        const extras = itemExtraAddonSummary(item);
        if (extras.length > 0) {
          lines.push(`  Extras: ${extras.join(", ")}`);
        }

        if (item.customizations?.notes) {
          lines.push(`  Nota: ${item.customizations.notes}`);
        }

        return lines.join("\n");
      })
      .join("\n\n");

    return [
      "ISHOS Factory - Comprobante de pedido",
      "",
      `Orden: ${order.order_number}`,
      `Estado: ${TRACKING_STATUS_LABELS[order.status]}`,
      `Tipo: ${order.order_type === "para_llevar" ? "Para llevar" : "En local"}`,
      `Creado: ${formatDate(order.created_at)}`,
      `Actualizado: ${formatDate(order.updated_at)}`,
      "",
      "Productos:",
      items,
      "",
      `Total: ${formatMoney(order.total_amount)}`,
      "",
      "Gracias por la compra de tu producto en Ishos.",
    ].join("\n");
  }

  function printTrackedOrderReceipt() {
    if (!trackedOrder) return;
    const receiptText = buildReceiptText(trackedOrder);
    const printWindow = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=900,height=900",
    );

    if (!printWindow) {
      receiptActionMessage =
        "No se pudo abrir la ventana de impresion. Revisa si el navegador bloqueo ventanas emergentes.";
      return;
    }

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante ${escapeHtml(trackedOrder.order_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1b1b1b; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
      background: #f4f4f5;
      border-radius: 12px;
      padding: 16px;
    }
  </style>
</head>
<body>
  <h1>Comprobante de pedido</h1>
  <pre>${escapeHtml(receiptText)}</pre>
  <script>
    window.addEventListener("load", () => {
      window.print();
    });
  <\/script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    receiptActionMessage = "Comprobante listo para imprimir.";
  }

  function downloadTrackedOrderReceipt() {
    if (!trackedOrder) return;
    const receiptText = buildReceiptText(trackedOrder);
    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comprobante-${trackedOrder.order_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    receiptActionMessage = "Comprobante descargado.";
  }
</script>

<div class="max-w-4xl mx-auto space-y-6 md:space-y-8 mb-16">
  <section
    class="flex flex-col md:flex-row md:items-center justify-between gap-4"
  >
    <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
      Sigue tu <span
        class="bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary"
        >Pedido</span
      >
    </h1>
    <a
      href="/menu"
      class="btn btn-outline rounded-full font-medium shadow-sm hover:shadow-md"
      >← Volver al menú</a
    >
  </section>

  <section
    class="bg-base-100/50 backdrop-blur-xl border border-base-200/60 shadow-2xl rounded-[2.5rem] p-6 md:p-10"
  >
    <p class="text-base font-medium text-base-content/70 mb-6">
      Ingresa el número de tu orden para conocer su estado en tiempo real.
    </p>

    <div class="flex flex-col sm:flex-row sm:items-center gap-4">
      <label class="form-control flex-1">
        <span class="label-text font-bold text-base-content/80 ml-1 mb-1 hidden"
          >Número de orden</span
        >
        <div class="relative">
          <div
            class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/50"
          >
            <Icon icon="lucide:search" width="20" height="20" />
          </div>
          <input
            class="input input-bordered h-14 bg-base-100 focus:bg-base-200 w-full rounded-2xl pl-11 text-lg font-medium transition-all"
            bind:value={trackingOrderNumber}
            placeholder="Ej. ORD-2026..."
          />
        </div>
      </label>

      <button
        class="btn btn-primary btn-lg rounded-2xl min-w-32 shadow-lg hover:shadow-xl transition-all"
        type="button"
        onclick={() => runTrackingLookup()}
        disabled={trackingLookupActive || trackingCooldownActive}
      >
        {#if trackingCooldownActive}
          Espera {trackingCooldownSeconds}s
        {:else if trackingBusy}
          Buscando...
        {:else}
          Consultar
        {/if}
      </button>
    </div>

    <div
      class="mt-4 rounded-2xl border border-base-200/70 bg-base-200/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <label class="label cursor-pointer justify-start gap-3 p-0">
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          checked={rememberTrackingOnDevice}
          onchange={(event) =>
            toggleRememberTrackingOnDevice(
              (event.currentTarget as HTMLInputElement).checked,
            )}
        />
        <span class="label-text font-medium text-sm">
          Recordar mis pedidos en este dispositivo
        </span>
      </label>
      <p class="text-xs text-base-content/60">
        Historial local y opcional. Se elimina automaticamente en
        {RECENT_TRACKING_RETENTION_DAYS} dias.
      </p>
    </div>

    <div class="mt-3 min-h-6 flex items-center justify-end">
      {#if trackingLookupActive}
        <p class="flex items-center gap-2 text-sm text-base-content/65">
          <span class="inline-grid *:[grid-area:1/1]" aria-hidden="true">
            <span class="status status-primary tracking-status-ping"></span>
            <span class="status status-primary"></span>
          </span>
          <span
            >{trackingBusy
              ? "Consultando pedido..."
              : "Actualizando estado..."}</span
          >
        </p>
      {/if}
    </div>

    {#if trackingError}
      <div
        class="alert alert-error shadow-sm rounded-2xl border-error/20 text-sm font-medium p-4 mt-6"
      >
        <span class="text-xl">⚠️</span>
        <span>{trackingError}</span>
      </div>
    {/if}

    {#if recentTrackingOrders.length > 0}
      <section
        class="mt-6 rounded-3xl border border-base-200/70 bg-base-200/25 p-4 md:p-5"
      >
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2
              class="text-sm font-bold uppercase tracking-wider text-base-content/60"
            >
              Pedidos recientes en este dispositivo
            </h2>
            <p class="text-xs text-base-content/60 mt-1">
              Solo visibles en este navegador. Puedes borrarlos cuando quieras.
            </p>
          </div>
          <button
            class="btn btn-ghost btn-xs text-error"
            type="button"
            onclick={clearRecentOrders}
          >
            Borrar historial
          </button>
        </div>

        <div class="space-y-2">
          {#each recentTrackingOrders as recentOrder}
            <div
              class="rounded-2xl bg-base-100 border border-base-200/80 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <p class="font-semibold text-sm break-all">
                  {recentOrder.orderNumber}
                </p>
                <p class="text-xs text-base-content/60 mt-1">
                  {TRACKING_STATUS_LABELS[recentOrder.status]} •
                  {formatMoney(recentOrder.totalAmount)} •
                  {formatDate(recentOrder.updatedAt)}
                </p>
              </div>
              <button
                class="btn btn-outline btn-sm rounded-full"
                type="button"
                onclick={() => loadRecentOrder(recentOrder)}
                disabled={trackingLookupActive || trackingCooldownActive}
              >
                Cargar pedido
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if trackedOrder}
      <div class="mt-8 space-y-6">
        <div
          class="divider text-base-content/40 font-bold uppercase tracking-wider text-sm mb-2"
        >
          Estado Reciente
        </div>

        <article
          class="rounded-4xl border border-base-200/80 bg-base-100 shadow-md p-6 lg:p-8 relative overflow-hidden"
        >
          <!-- Background decoration -->
          <div
            class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"
          ></div>

          <div
            class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10"
          >
            <div>
              <h3
                class="text-sm font-bold text-base-content/50 uppercase tracking-widest mb-1"
              >
                Orden
              </h3>
              <p
                class="text-xl md:text-2xl font-extrabold text-base-content break-all"
              >
                {trackedOrder.order_number}
              </p>
            </div>
            <div
              class={`badge badge-lg font-bold border-0 px-4 py-3 ${trackedOrder.status === "entregada" ? "bg-success/20 text-success-content" : "bg-primary/20 text-primary"}`}
            >
              {TRACKING_STATUS_LABELS[trackedOrder.status]}
            </div>
          </div>

          <div
            class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] gap-4 mb-6 relative z-10"
          >
            <div
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-base-200/40 rounded-2xl p-4"
            >
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold text-base-content/50 uppercase"
                  >Total</span
                >
                <span class="font-bold text-lg text-primary"
                  >{formatMoney(trackedOrder.total_amount)}</span
                >
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold text-base-content/50 uppercase"
                  >Tipo</span
                >
                <span
                  class="font-bold border border-base-300 rounded-full px-3 py-1 bg-base-100 w-fit"
                  >{trackedOrder.order_type === "para_llevar"
                    ? "Para llevar"
                    : "En local"}</span
                >
              </div>
            </div>

            <div
              class="bg-base-200/40 rounded-2xl p-4 flex flex-col justify-between gap-3"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-bold text-base-content/50 uppercase"
                  >Actualizado</span
                >
                {#if trackingRefreshing}
                  <span
                    class="flex items-center gap-2 text-xs text-base-content/60"
                  >
                    <span
                      class="inline-grid *:[grid-area:1/1]"
                      aria-hidden="true"
                    >
                      <span
                        class="status status-primary status-sm tracking-status-ping"
                      ></span>
                      <span class="status status-primary status-sm"></span>
                    </span>
                    <span>Actualizando</span>
                  </span>
                {/if}
              </div>
              <span class="font-semibold leading-snug"
                >{formatDate(trackedOrder.updated_at)}</span
              >
            </div>
          </div>

          {#if trackedOrderItems.length > 0}
            <details
              class="collapse collapse-arrow bg-base-200/35 border border-base-200/70 rounded-2xl mb-6 relative z-10"
              open={productsExpanded}
              ontoggle={(event) => {
                productsExpanded = (event.currentTarget as HTMLDetailsElement)
                  .open;
              }}
            >
              <summary
                class="collapse-title flex items-center justify-between gap-4 pe-10"
              >
                <div>
                  <p
                    class="text-sm font-bold uppercase tracking-wider text-base-content/55"
                  >
                    Productos del pedido
                  </p>
                  <p class="text-sm text-base-content/70">
                    {trackedOrderItems.length}
                    {trackedOrderItems.length === 1 ? "producto" : "productos"}
                  </p>
                </div>
                <span class="badge badge-primary badge-outline rounded-full">
                  {formatMoney(trackedOrder.total_amount)}
                </span>
              </summary>
              <div class="collapse-content pt-0 space-y-3">
                {#each trackedOrderItems as item}
                  {@const includedAddonSummary = itemIncludedAddonSummary(item)}
                  {@const extraAddonSummary = itemExtraAddonSummary(item)}
                  <div
                    class="rounded-2xl border border-base-200/80 bg-base-100 px-4 py-3 shadow-sm"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <p class="font-bold text-base-content">
                          {item.quantity}x {item.product_name}
                        </p>
                        {#if item.customizations?.flavor_name}
                          <p class="text-sm text-base-content/70 mt-1">
                            Sabor: {item.customizations.flavor_name}
                          </p>
                        {/if}
                        {#if includedAddonSummary.length > 0}
                          <p class="text-sm text-base-content/65 mt-1">
                            Incluidos: {includedAddonSummary.join(", ")}
                          </p>
                        {/if}
                        {#if extraAddonSummary.length > 0}
                          <p class="text-sm text-base-content/65 mt-1">
                            Extras: {extraAddonSummary.join(", ")}
                          </p>
                        {/if}
                        {#if item.customizations?.notes}
                          <p class="text-sm text-base-content/65 mt-1 italic">
                            Nota: {item.customizations.notes}
                          </p>
                        {/if}
                      </div>
                      <div class="text-right shrink-0">
                        <p class="font-bold text-primary">
                          {formatMoney(item.subtotal)}
                        </p>
                        <p class="text-xs text-base-content/50 mt-1">
                          {formatMoney(item.unit_price)} c/u
                        </p>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </details>
          {/if}

          {#if trackedOrderDelivered}
            <div
              class="flex items-center justify-between gap-3 bg-success/8 border border-success/20 rounded-2xl px-4 py-3 mb-6 relative z-10"
            >
              <div class="flex items-center gap-2">
                <Icon
                  icon="lucide:check-check"
                  width="16"
                  height="16"
                  class="text-success shrink-0"
                />
                <span class="text-sm font-semibold text-base-content"
                  >Pedido entregado</span
                >
              </div>
              <div class="flex items-center gap-2 shrink-0">
                {#if receiptActionMessage}
                  <span class="text-xs text-success hidden sm:inline"
                    >{receiptActionMessage}</span
                  >
                {/if}
                <button
                  class="btn btn-success btn-xs rounded-full gap-1.5"
                  type="button"
                  onclick={downloadTrackedOrderReceipt}
                >
                  <Icon icon="lucide:download" width="12" height="12" />
                  Comprobante
                </button>
              </div>
            </div>
          {/if}

          {#if trackedOrder.status === "cancelada"}
            <div
              class="alert alert-warning rounded-2xl shadow-sm border-warning/20 font-medium"
            >
              <span class="text-xl">⚠️</span>
              <span
                >Tu orden fue cancelada. Contáctanos para más información.</span
              >
            </div>
          {:else}
            <div class="w-full relative z-10 pt-2 sm:pt-4 pb-2">
              <!-- Mobile: clean custom vertical timeline -->
              <div class="sm:hidden px-1 pt-1">
                {#each TRACKING_STATUS_FLOW as step, index}
                  {@const active = index <= stepIndex(trackedOrder.status)}
                  {@const isCurrent = step === trackedOrder.status}
                  <div class="flex gap-3 relative">
                    {#if index < TRACKING_STATUS_FLOW.length - 1}
                      <div
                        class={`absolute left-4.75 top-10 w-0.5 h-[calc(100%-2rem)] ${index < stepIndex(trackedOrder.status) ? "bg-primary/40" : "bg-base-200"}`}
                      ></div>
                    {/if}
                    <div
                      class={`shrink-0 z-10 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${isCurrent ? "bg-primary text-primary-content shadow-lg shadow-primary/30 scale-110" : active ? "bg-primary/15 text-primary" : "bg-base-200 text-base-content/30"}`}
                    >
                      <Icon
                        icon={isCurrent
                          ? TRACKING_STATUS_ICONS_ACTIVE[step]
                          : TRACKING_STATUS_ICONS_STATIC[step]}
                        width="18"
                        height="18"
                      />
                    </div>
                    <div class="flex-1 flex items-center pb-5">
                      <span
                        class={`font-bold text-sm ${isCurrent ? "text-primary" : active ? "text-primary/70" : "text-base-content/35"}`}
                        >{TRACKING_STATUS_LABELS[step]}</span
                      >
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Desktop: DaisyUI horizontal steps -->
              <ul class="hidden sm:flex steps steps-horizontal w-full">
                {#each TRACKING_STATUS_FLOW as step, index}
                  {@const active = index <= stepIndex(trackedOrder.status)}
                  <li
                    data-content={active ? "✓" : ""}
                    class={`step font-bold ${active ? "step-primary text-primary" : "text-base-content/40"}`}
                  >
                    <div class="flex flex-col items-center gap-2 mt-4 ml-2">
                      <span
                        class={`p-3 rounded-full flex shrink-0 items-center justify-center transition-all duration-300 ${active ? (step === trackedOrder.status ? "bg-primary text-primary-content shadow-lg shadow-primary/40 scale-110" : "bg-primary/10 text-primary") : "bg-base-200/50 text-base-content/30 border border-base-200"}`}
                      >
                        <Icon
                          icon={step === trackedOrder.status
                            ? TRACKING_STATUS_ICONS_ACTIVE[step]
                            : TRACKING_STATUS_ICONS_STATIC[step]}
                          width="24"
                          height="24"
                        />
                      </span>
                      <span class="text-sm mt-1"
                        >{TRACKING_STATUS_LABELS[step]}</span
                      >
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </article>
      </div>
    {/if}
  </section>
</div>

<style>
  .tracking-status-ping {
    animation: trackingStatusPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes trackingStatusPing {
    0% {
      transform: scale(1);
      opacity: 0.9;
    }
    70%,
    100% {
      transform: scale(1.9);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tracking-status-ping {
      animation: none;
    }
  }
</style>
