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
    removeRecentTrackingOrder,
    getTracking,
    saveRecentTrackingOrder,
    saveRememberTrackingPreference,
    saveTracking,
    TRACKING_STATUS_FLOW,
    TRACKING_STATUS_LABELS,
    TRACKING_STATUS_ICONS_ACTIVE,
    TRACKING_STATUS_ICONS_STATIC,
  } from "@features/analytics/lib/tracking";
  import type { RecentTrackingOrder } from "@features/analytics/lib/tracking";
  import { subscribeOrderStatusSync } from "@features/orders/lib/status-sync";
  import { copyToClipboard } from "@features/orders/lib/token-helpers";
  import "../../../../styles/order-tracking.css";

  type RecentHistoryConfirmState =
    | { kind: "delete-one"; order: RecentTrackingOrder }
    | { kind: "clear-all"; count: number }
    | null;

  let trackingOrderNumber = $state("");
  let trackingToken = $state("");
  let trackingBusy = $state(false);
  let trackingRefreshing = $state(false);
  let trackingError = $state("");
  let trackedOrder = $state<PublicOrderTrackingResponse | null>(null);
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;
  let trackingCooldownUntil = $state(0);
  let cooldownNow = $state(Date.now());
  let productsExpanded = $state(false);
  let rememberTrackingOnDevice = $state(true);
  let recentTrackingOrders = $state<RecentTrackingOrder[]>([]);
  let recentHistoryActionMessage = $state("");
  let receiptActionMessage = $state("");
  let lastExternalRefreshAt = $state(0);
  let pendingRecentHistoryConfirm = $state<RecentHistoryConfirmState>(null);
  let shareMessage = $state("");

  const TRACKING_RATE_LIMIT_COOLDOWN_MS = 60000;
  const RECENT_TRACKING_RETENTION_DAYS = 30;
  const TRACKING_EXTERNAL_REFRESH_MIN_INTERVAL_MS = 5000;
  // Background refresh while the order is still in progress. 45s keeps a
  // customer at ~80 requests/hour, within the backend's per-IP tracking limit.
  const TRACKING_POLL_INTERVAL_MS = 45000;
  // Refresh on returning to the tab if the last lookup is older than this.
  const TRACKING_VISIBLE_REFRESH_MIN_AGE_MS = 15000;
  const TRACKING_FINAL_STATUSES = new Set(["entregada", "cancelada"]);
  let lastTrackingLookupAt = 0;
  // The order number + token that produced the order on screen. Background
  // refreshes and sharing use these, never the editable inputs, so typing a
  // different number can't refresh (or share) the wrong order.
  let loadedTracking: { orderNumber: string; token: string } | null = null;

  const trackedOrderItems = $derived(trackedOrder?.items ?? []);
  const trackingLookupActive = $derived(trackingBusy || trackingRefreshing);
  const trackingCooldownActive = $derived(trackingCooldownUntil > cooldownNow);
  const trackingCooldownSeconds = $derived(
    trackingCooldownActive
      ? Math.max(1, Math.ceil((trackingCooldownUntil - cooldownNow) / 1000))
      : 0,
  );
  const trackedOrderDelivered = $derived(trackedOrder?.status === "entregada");
  const statusIndex = $derived(
    trackedOrder ? stepIndex(trackedOrder.status) : -1,
  );
  const stepAnnouncement = $derived(
    trackedOrder
      ? `Estado actualizado a ${TRACKING_STATUS_LABELS[trackedOrder.status]}, paso ${statusIndex + 1} de ${TRACKING_STATUS_FLOW.length}`
      : "",
  );
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

    const runRefreshFromAdminEvent = () => {
      if (trackingBusy || trackingRefreshing) return;
      if (!trackingOrderNumber.trim() || !trackingToken.trim()) return;
      const now = Date.now();
      if (
        now - lastExternalRefreshAt <
        TRACKING_EXTERNAL_REFRESH_MIN_INTERVAL_MS
      )
        return;
      if (trackingCooldownUntil > now) return;
      if (!loadedTracking) return;
      lastExternalRefreshAt = now;
      void runTrackingLookup({ silent: true, target: loadedTracking });
    };

    const unsubscribeStatusSync = subscribeOrderStatusSync((event) => {
      const trackedNumber = trackedOrder?.order_number ?? trackingOrderNumber;
      if (!trackedNumber || event.orderNumber !== trackedNumber.trim()) return;
      runRefreshFromAdminEvent();
    });

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

    // Keep the status fresh without the customer reloading: poll while the
    // tab is visible and the order is not final, and refresh on tab return.
    const refreshInBackground = (minAgeMs: number) => {
      if (document.visibilityState !== "visible") return;
      if (!trackedOrder || TRACKING_FINAL_STATUSES.has(trackedOrder.status)) {
        return;
      }
      if (trackingBusy || trackingRefreshing) return;
      if (trackingCooldownUntil > Date.now()) return;
      if (Date.now() - lastTrackingLookupAt < minAgeMs) return;
      if (!loadedTracking) return;
      void runTrackingLookup({ silent: true, target: loadedTracking });
    };
    const pollTimer = setInterval(
      () => refreshInBackground(TRACKING_POLL_INTERVAL_MS - 1000),
      TRACKING_POLL_INTERVAL_MS,
    );
    const onVisibilityChange = () =>
      refreshInBackground(TRACKING_VISIBLE_REFRESH_MIN_AGE_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsubscribeStatusSync();
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (cooldownTimer) clearInterval(cooldownTimer);
    };
  });

  function startTrackingCooldown(
    durationMs: number = TRACKING_RATE_LIMIT_COOLDOWN_MS,
  ) {
    trackingCooldownUntil = Date.now() + durationMs;
    cooldownNow = Date.now();

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

  async function runTrackingLookup(options?: {
    silent?: boolean;
    /** Look up this order instead of the input fields (background refresh). */
    target?: { orderNumber: string; token: string };
  }) {
    const orderNumber =
      options?.target?.orderNumber ?? trackingOrderNumber.trim();
    const token = options?.target?.token ?? trackingToken.trim();
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

    if (!silent) {
      trackingError = "";
    }
    if (silent) {
      trackingRefreshing = true;
    } else {
      trackingBusy = true;
    }
    lastTrackingLookupAt = Date.now();

    try {
      const order = await trackPublicOrder(orderNumber, token);

      if (!order) {
        trackedOrder = null;
        trackingError =
          "No encontramos la orden. Verifica el número o usa el dispositivo donde realizaste el pedido.";
        return;
      }

      trackedOrder = order;
      loadedTracking = { orderNumber, token };
      trackingError = "";
      receiptActionMessage = "";
      clearTrackingCooldown();
      saveTracking(orderNumber, token);

      if (rememberTrackingOnDevice) {
        saveRecentTrackingOrder({
          orderNumber,
          token,
          customerName: order.customer_name?.trim() || undefined,
          status: order.status,
          totalAmount: order.total_amount,
          updatedAt: order.updated_at,
        });
        recentTrackingOrders = getRecentTrackingOrders();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        trackedOrder = null;
        trackingError =
          "Tu orden fue cancelada. Contáctanos para más información.";
        return;
      }

      if (error instanceof ApiError && error.status === 429) {
        startTrackingCooldown();
        // A background refresh keeps showing the last known status.
        if (!silent || !trackedOrder) {
          trackedOrder = null;
          trackingError =
            "Hiciste muchas consultas en poco tiempo. Espera 60 segundos e intenta de nuevo.";
        }
        return;
      }

      // Transient failures during a background refresh (network blip, server
      // restart) must not blank the order the customer is looking at.
      if (silent && trackedOrder) {
        return;
      }
      trackedOrder = null;

      trackingError =
        error instanceof Error
          ? error.message
          : "No se pudo consultar la orden.";
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

  function stepTimestamp(status: string): string {
    const ts = trackedOrder?.status_timestamps?.[status];
    if (ts) return formatDate(ts);
    if (status === trackedOrder?.status && trackedOrder?.updated_at) {
      return formatDate(trackedOrder.updated_at);
    }
    return "";
  }

  function formatMoney(value: number): string {
    return new Intl.NumberFormat("es-SV", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
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
    recentHistoryActionMessage = "Se borro todo el historial reciente.";
    recentTrackingOrders = [];
  }

  function removeRecentOrder(entry: RecentTrackingOrder) {
    removeRecentTrackingOrder(entry.orderNumber, entry.token);
    recentHistoryActionMessage = `Se elimino ${entry.orderNumber} del historial.`;
    recentTrackingOrders = getRecentTrackingOrders();
    pendingRecentHistoryConfirm = null;
  }

  function openRecentDeleteConfirm(entry: RecentTrackingOrder) {
    pendingRecentHistoryConfirm = {
      kind: "delete-one",
      order: entry,
    };
  }

  function openClearRecentConfirm() {
    pendingRecentHistoryConfirm = {
      kind: "clear-all",
      count: recentTrackingOrders.length,
    };
  }

  function cancelRecentHistoryConfirm() {
    pendingRecentHistoryConfirm = null;
  }

  function confirmRecentHistoryAction() {
    if (!pendingRecentHistoryConfirm) return;

    if (pendingRecentHistoryConfirm.kind === "delete-one") {
      removeRecentOrder(pendingRecentHistoryConfirm.order);
      return;
    }

    clearRecentOrders();
    pendingRecentHistoryConfirm = null;
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

        if (
          Array.isArray(item.customizations?.flavor_names) &&
          item.customizations.flavor_names.length > 0
        ) {
          lines.push(
            `  ${item.customizations.flavor_names.length === 1 ? "Sabor" : "Sabores"}: ${item.customizations.flavor_names.join(", ")}`,
          );
        } else if (item.customizations?.flavor_name) {
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

  /**
   * Shares (or copies) a link that opens this order's tracking on any device.
   * Same format as the WhatsApp link the backend sends.
   */
  async function shareTrackingLink() {
    if (!loadedTracking) return;
    const { orderNumber, token } = loadedTracking;
    const query = new URLSearchParams({ order: orderNumber, token });
    const url = `${window.location.origin}/order/tracking?${query.toString()}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Pedido ${orderNumber}`,
          text: "Sigue el estado de tu pedido en Isho's:",
          url,
        });
        return;
      } catch (shareError) {
        // User dismissed the share sheet: nothing to do.
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return;
        }
      }
    }

    const copied = await copyToClipboard(url, "link");
    shareMessage = copied
      ? "Enlace copiado. Ábrelo en otro dispositivo para seguir tu pedido."
      : "No se pudo copiar el enlace.";
    setTimeout(() => (shareMessage = ""), 4000);
  }

  function printTrackedOrderReceipt() {
    if (!trackedOrder) return;
    const receiptText = buildReceiptText(trackedOrder);

    // Print from a hidden iframe driven by this (CSP-hashed) bundle. A popup
    // opened with "noopener" is always null, and a document.write'd inline
    // <script> would be blocked by the page CSP it inherits.
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
</body>
</html>`;

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.title = "Comprobante para imprimir";
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
    });
    frame.addEventListener("load", () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        receiptActionMessage =
          "No se pudo preparar la impresión. Usa el botón “Comprobante” para descargarlo.";
        frame.remove();
        return;
      }
      printWindow.addEventListener("afterprint", () => frame.remove(), {
        once: true,
      });
      printWindow.focus();
      printWindow.print();
      receiptActionMessage = "Comprobante listo para imprimir.";
    });
    frame.srcdoc = html;
    document.body.appendChild(frame);
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

<div class="max-w-4xl mx-auto space-y-6 md:space-y-8 mb-12 md:mb-16">
  <!-- ── Header ── -->
  <section class="relative overflow-hidden text-center px-4 pt-2 pb-4">
    <div class="relative z-10 fade-up fade-up-1">
      <div class="section-pill mb-3">
        <span
          class="w-1.5 h-1.5 rounded-full inline-block mr-2 align-middle"
          style="background: var(--ishos-teal);"
        ></span>
        Seguimiento
      </div>
      <h1
        class="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight"
      >
        Sigue tu
        <span
          class="text-transparent bg-clip-text"
          style="background-image: var(--brand-gradient);"
        >
          Pedido
        </span>
      </h1>
      <p
        class="text-sm md:text-base text-base-content/60 mt-2 max-w-md mx-auto"
      >
        Ingresa tu número de orden para conocer su estado en tiempo real.
      </p>
    </div>
  </section>

  <!-- ── Search form ── -->
  <section
    class="bg-base-100 border border-base-200 shadow-sm rounded-2xl md:rounded-3xl p-5 md:p-8 relative overflow-hidden fade-up fade-up-2"
  >
    <!-- Inner accent bar -->
    <div
      class="absolute top-0 left-0 right-0 h-1"
      style="background: linear-gradient(90deg, var(--ishos-teal), var(--ishos-pink), var(--ishos-yellow));"
    ></div>

    <div class="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
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
            class="input input-bordered h-12 md:h-14 bg-base-100 focus:bg-base-200 w-full rounded-xl md:rounded-2xl pl-11 text-base md:text-lg font-medium transition-all"
            bind:value={trackingOrderNumber}
            placeholder="Ej. ORD-2026..."
          />
        </div>
      </label>

      <button
        class="btn btn-lg rounded-xl md:rounded-2xl min-w-32 shadow-sm hover:shadow-md transition-all text-white border-0"
        type="button"
        onclick={() => runTrackingLookup()}
        disabled={trackingLookupActive || trackingCooldownActive}
        style="background: var(--ishos-teal);"
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
      class="mt-4 rounded-xl md:rounded-2xl border border-base-200/70 bg-base-200/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <label class="label cursor-pointer justify-start gap-3 p-0">
        <input
          type="checkbox"
          class="toggle toggle-sm"
          checked={rememberTrackingOnDevice}
          onchange={(event) =>
            toggleRememberTrackingOnDevice(
              (event.currentTarget as HTMLInputElement).checked,
            )}
          style="--tglbg: var(--ishos-teal);"
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
            <span
              class="status tracking-status-ping"
              style="background: var(--ishos-teal);"
            ></span>
            <span class="status" style="background: var(--ishos-teal);"></span>
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
        class="alert alert-error shadow-sm rounded-xl md:rounded-2xl border-error/20 text-sm font-medium p-4 mt-5"
      >
        <Icon icon="lucide:alert-triangle" class="w-5 h-5 shrink-0" />
        <span>{trackingError}</span>
      </div>
    {/if}
  </section>

  {#if trackedOrder}
    <div class="mt-6 md:mt-8 space-y-5 md:space-y-6 fade-up fade-up-3">
      <!-- ── Order status card ── -->
      <article
        class="rounded-2xl md:rounded-3xl border border-base-200 bg-base-100 shadow-sm p-5 md:p-8 relative overflow-hidden"
      >
        <!-- Top accent -->
        <div
          class="absolute top-0 left-0 right-0 h-1"
          style="background: linear-gradient(90deg, var(--ishos-teal), var(--ishos-pink), var(--ishos-yellow));"
        ></div>

        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 md:mb-6"
        >
          <div>
            <h2
              class="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-1"
            >
              Orden
            </h2>
            <p
              class="text-lg md:text-xl font-extrabold text-base-content break-all"
            >
              {trackedOrder.order_number}
            </p>
            <button
              type="button"
              class="btn btn-ghost btn-xs rounded-full gap-1.5 mt-1 -ml-2"
              onclick={() => void shareTrackingLink()}
            >
              <Icon icon="lucide:share-2" width="12" height="12" />
              Compartir seguimiento
            </button>
            {#if shareMessage}
              <p class="text-xs text-success mt-1" role="status">
                {shareMessage}
              </p>
            {/if}
          </div>
          <div
            class={`badge badge-lg font-bold border-0 px-4 py-3 rounded-full ${trackedOrder.status === "entregada" ? "bg-success/15 text-success" : "text-white"}`}
            style={trackedOrder.status === "entregada"
              ? ""
              : "background: var(--ishos-teal);"}
          >
            {TRACKING_STATUS_LABELS[trackedOrder.status]}
          </div>
        </div>

        <div
          class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] gap-3 md:gap-4 mb-5 md:mb-6"
        >
          <div
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 bg-base-200/40 rounded-xl md:rounded-2xl p-4"
          >
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold text-base-content/50 uppercase"
                >Total</span
              >
              <span class="font-bold text-lg" style="color: var(--ishos-teal);"
                >{formatMoney(trackedOrder.total_amount)}</span
              >
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold text-base-content/50 uppercase"
                >Tipo</span
              >
              <span
                class="font-bold border border-base-300 rounded-full px-3 py-1 bg-base-100 w-fit text-sm"
                >{trackedOrder.order_type === "para_llevar"
                  ? "Para llevar"
                  : "En local"}</span
              >
            </div>
            <div class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-base-content/50 uppercase"
                >Cliente</span
              >
              <span class="font-semibold text-base-content"
                >{trackedOrder.customer_name?.trim() || "No disponible"}</span
              >
            </div>
          </div>

          <div
            class="bg-base-200/40 rounded-xl md:rounded-2xl p-4 flex flex-col justify-between gap-3"
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
                      class="status status-sm tracking-status-ping"
                      style="background: var(--ishos-teal);"
                    ></span>
                    <span
                      class="status status-sm"
                      style="background: var(--ishos-teal);"
                    ></span>
                  </span>
                  <span>Actualizando</span>
                </span>
              {/if}
            </div>
            <span class="font-semibold leading-snug text-base-content"
              >{formatDate(trackedOrder.updated_at)}</span
            >
          </div>
        </div>

        {#if trackedOrderItems.length > 0}
          <details
            class="collapse collapse-arrow bg-base-200/35 border border-base-200/70 rounded-xl md:rounded-2xl mb-5 md:mb-6"
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
              <span
                class="badge badge-outline rounded-full font-semibold"
                style="border-color: color-mix(in srgb, var(--ishos-teal) 40%, transparent); color: var(--ishos-teal);"
              >
                {formatMoney(trackedOrder.total_amount)}
              </span>
            </summary>
            <div class="collapse-content pt-0 space-y-3">
              {#each trackedOrderItems as item}
                {@const includedAddonSummary = itemIncludedAddonSummary(item)}
                {@const extraAddonSummary = itemExtraAddonSummary(item)}
                <div
                  class="rounded-xl md:rounded-2xl border border-base-200/80 bg-base-100 px-4 py-3 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <p class="font-bold text-base-content">
                        {item.quantity}x {item.product_name}
                      </p>
                      {#if Array.isArray(item.customizations?.flavor_names) && item.customizations.flavor_names.length > 0}
                        <p class="text-sm text-base-content/70 mt-1">
                          {item.customizations.flavor_names.length === 1
                            ? "Sabor"
                            : "Sabores"}:
                          {item.customizations.flavor_names.join(", ")}
                        </p>
                      {:else if item.customizations?.flavor_name}
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
                      <p class="font-bold" style="color: var(--ishos-teal);">
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
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-success/8 border border-success/20 rounded-xl md:rounded-2xl px-4 py-3 mb-5 md:mb-6"
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
                class="btn btn-ghost btn-xs rounded-full gap-1.5 hidden sm:inline-flex"
                type="button"
                onclick={printTrackedOrderReceipt}
              >
                <Icon icon="lucide:printer" width="12" height="12" />
                Imprimir
              </button>
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
            class="alert alert-warning rounded-xl md:rounded-2xl shadow-sm border-warning/20 font-medium"
          >
            <Icon icon="lucide:alert-triangle" class="w-5 h-5 shrink-0" />
            <span
              >Tu orden fue cancelada. Contáctanos para más información.</span
            >
          </div>
        {:else}
          <div
            class="w-full pt-2 sm:pt-4 pb-2"
            role="progressbar"
            aria-valuenow={statusIndex + 1}
            aria-valuemin={1}
            aria-valuemax={TRACKING_STATUS_FLOW.length}
            aria-label="Progreso del pedido"
          >
            <ul
              class="steps steps-vertical sm:steps-horizontal w-full order-steps order-steps--cozy"
            >
              {#each TRACKING_STATUS_FLOW as step, index}
                {@const reached = index <= stepIndex(trackedOrder.status)}
                {@const completed = index < stepIndex(trackedOrder.status)}
                {@const current = step === trackedOrder.status}
                <li
                  data-content=""
                  class={`step min-h-18! ${reached ? "step-primary" : ""}`}
                  aria-current={current ? "step" : undefined}
                >
                  <div
                    class="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 mt-2 sm:mt-4 sm:ml-2"
                  >
                    <span
                      class={`order-step-node ${current ? "order-step-node--current" : completed ? "order-step-node--complete" : "order-step-node--pending"}`}
                      style={current || completed
                        ? "--color-primary: var(--ishos-teal);"
                        : ""}
                    >
                      <Icon
                        icon={current
                          ? TRACKING_STATUS_ICONS_ACTIVE[step]
                          : TRACKING_STATUS_ICONS_STATIC[step]}
                        width="20"
                        height="20"
                      />
                    </span>
                    <span
                      class={`text-sm font-semibold ${current ? "text-primary" : completed ? "text-base-content" : "text-base-content/45"}`}
                      style={current ? "color: var(--ishos-teal);" : ""}
                      >{TRACKING_STATUS_LABELS[step]}</span
                    >
                    {#if stepTimestamp(step)}
                      <span class="order-step-timestamp text-base-content"
                        >{stepTimestamp(step)}</span
                      >
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
            <span
              class="order-steps-sr-only"
              aria-live="polite"
              aria-atomic="true">{stepAnnouncement}</span
            >
          </div>
        {/if}
      </article>

      <!-- ── Recent history ── -->
      {#if recentTrackingOrders.length > 0}
        <div class="space-y-3 fade-up fade-up-4">
          <div class="flex items-center justify-between gap-3 px-1">
            <h2
              class="text-xs font-bold uppercase tracking-wider text-base-content/50"
            >
              Historial en este dispositivo
            </h2>
            {#if recentTrackingOrders.length > 1}
              <button
                class="btn btn-ghost btn-xs text-error"
                type="button"
                onclick={openClearRecentConfirm}
              >
                Borrar todo
              </button>
            {/if}
          </div>

          {#if recentHistoryActionMessage}
            <div class="alert alert-success rounded-xl px-3 py-2 text-sm">
              <span>{recentHistoryActionMessage}</span>
            </div>
          {/if}

          <div class="space-y-2">
            {#each recentTrackingOrders.slice(0, 5) as recentOrder}
              <div
                class="rounded-xl bg-base-100 border border-base-200/60 px-3 py-2.5 flex items-center justify-between gap-3"
              >
                <div class="min-w-0">
                  <button
                    class="font-semibold text-sm break-all text-left hover:underline cursor-pointer"
                    type="button"
                    onclick={() => loadRecentOrder(recentOrder)}
                    disabled={trackingLookupActive || trackingCooldownActive}
                    title="Cargar pedido"
                    style="color: var(--ishos-teal);"
                  >
                    {recentOrder.orderNumber}
                  </button>
                  <p class="text-xs text-base-content/60 mt-0.5 truncate">
                    {TRACKING_STATUS_LABELS[recentOrder.status]} •
                    {formatMoney(recentOrder.totalAmount)}
                  </p>
                </div>
                <button
                  class="btn btn-ghost btn-xs rounded-full text-error shrink-0"
                  type="button"
                  onclick={() => openRecentDeleteConfirm(recentOrder)}
                  aria-label={`Eliminar ${recentOrder.orderNumber} del historial`}
                  title="Eliminar del historial"
                >
                  <Icon icon="lucide:trash-2" width="14" height="14" />
                </button>
              </div>
            {/each}
            {#if recentTrackingOrders.length > 5}
              <p class="text-xs text-center text-base-content/40">
                +{recentTrackingOrders.length - 5} mas
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if pendingRecentHistoryConfirm}
  <div
    class="modal modal-open modal-bottom sm:modal-middle"
    role="dialog"
    aria-modal="true"
    aria-label="Confirmar eliminacion de pedido reciente"
  >
    <div class="modal-box max-w-sm rounded-2xl border border-base-300/70">
      {#if pendingRecentHistoryConfirm.kind === "delete-one"}
        <h3 class="text-base font-bold">Eliminar pedido del historial?</h3>
        <p class="mt-2 text-sm text-base-content/75">
          Esta acción borrará
          <span class="font-semibold"
            >{pendingRecentHistoryConfirm.order.orderNumber}</span
          >
          de este dispositivo.
        </p>
      {:else}
        <h3 class="text-base font-bold">Borrar historial completo?</h3>
        <p class="mt-2 text-sm text-base-content/75">
          Esta acción eliminará
          <span class="font-semibold">{pendingRecentHistoryConfirm.count}</span>
          {pendingRecentHistoryConfirm.count === 1
            ? " pedido reciente"
            : " pedidos recientes"}
          de este dispositivo.
        </p>
      {/if}
      <div class="modal-action mt-5">
        <button
          class="btn btn-ghost btn-sm"
          type="button"
          onclick={cancelRecentHistoryConfirm}
        >
          Cancelar
        </button>
        <button
          class="btn btn-error btn-sm"
          type="button"
          onclick={confirmRecentHistoryAction}
        >
          {pendingRecentHistoryConfirm.kind === "clear-all"
            ? "Borrar todo"
            : "Eliminar"}
        </button>
      </div>
    </div>
    <button
      class="modal-backdrop"
      type="button"
      aria-label="Cerrar confirmacion"
      onclick={cancelRecentHistoryConfirm}
    ></button>
  </div>
{/if}

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
