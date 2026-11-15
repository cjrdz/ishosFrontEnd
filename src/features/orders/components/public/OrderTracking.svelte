<script lang="ts">
  import { onMount } from "svelte";
  import "../../../../styles/order-steps.css";
  import Icon from "@shared/components/AppIcon.svelte";
  import { ApiError } from "@core/errors";
  import {
    fetchStoreSettings,
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
    trackingHeadline,
  } from "@features/analytics/lib/tracking";
  import { celebrate, motionMs } from "@shared/motion/motion";
  import { fly } from "svelte/transition";
  import { showToast } from "@shared/toast/toast";
  import type { RecentTrackingOrder } from "@features/analytics/lib/tracking";
  import { subscribeOrderStatusSync } from "@features/orders/lib/status-sync";
  import { copyToClipboard } from "@features/orders/lib/token-helpers";
  import { printOrderReceipt } from "@features/orders/lib/receipt-renderer";
  import { downloadReceiptPdf } from "@features/orders/lib/receipt-pdf";

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
  let headlineRef = $state<HTMLElement | null>(null);

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
  const headline = $derived(
    trackedOrder
      ? trackingHeadline(trackedOrder.status, trackedOrder.order_type)
      : null,
  );
  // 0–100 along the flow; "Recibida" already shows some progress.
  const progressPercent = $derived(
    statusIndex < 0
      ? 0
      : Math.round(((statusIndex + 1) / TRACKING_STATUS_FLOW.length) * 100),
  );

  /** The order changed status while the customer watched this page. */
  function onStatusChanged(order: PublicOrderTrackingResponse) {
    if (order.status !== "lista") return;
    showToast(trackingHeadline("lista", order.order_type).title, {
      tone: "success",
      durationMs: 6000,
    });
    // Let the new headline render before bursting from it.
    requestAnimationFrame(() => celebrate(headlineRef));
    navigator.vibrate?.([120, 60, 120]);
  }

  const stepAnnouncement = $derived(
    trackedOrder
      ? `Estado actualizado a ${TRACKING_STATUS_LABELS[trackedOrder.status]}, paso ${statusIndex + 1} de ${TRACKING_STATUS_FLOW.length}`
      : "",
  );
  /** The admin switched public tracking off (store settings). */
  let trackingDisabled = $state(false);

  onMount(() => {
    void fetchStoreSettings()
      .then((settings) => {
        trackingDisabled = !settings.tracking_enabled;
      })
      .catch(() => {});
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

      const previousStatus =
        trackedOrder?.order_number === order.order_number
          ? trackedOrder.status
          : null;
      trackedOrder = order;
      loadedTracking = { orderNumber, token };
      if (previousStatus && previousStatus !== order.status) {
        onStatusChanged(order);
      }
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
    printOrderReceipt(trackedOrder, "80", ["customer"]);
    receiptActionMessage = "Comprobante listo para imprimir.";
  }

  let receiptDownloading = $state(false);

  async function downloadTrackedOrderReceipt() {
    if (!trackedOrder || receiptDownloading) return;
    receiptDownloading = true;
    try {
      await downloadReceiptPdf(
        trackedOrder,
        TRACKING_STATUS_LABELS[trackedOrder.status],
      );
      receiptActionMessage = "Comprobante descargado.";
    } catch {
      receiptActionMessage = "No se pudo generar el PDF. Intenta imprimirlo.";
    } finally {
      receiptDownloading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto space-y-6 md:space-y-8 mb-12 md:mb-16">
  <header>
    <h1 class="font-display font-bold text-6xl leading-none md:text-7xl">
      Sigue tu pedido
    </h1>
    <p class="mt-1 text-base-content/70">
      Ingresa tu número de orden para ver su estado en tiempo real.
    </p>
  </header>

  {#if trackingDisabled}
    <div
      class="rounded-box border border-base-300 bg-base-100 p-6 text-center"
      role="status"
    >
      <Icon
        icon="lucide:clock"
        class="mx-auto mb-3 size-10 text-ink-muted"
        aria-hidden="true"
      />
      <p class="text-lg font-semibold">
        El seguimiento en línea todavía no está disponible.
      </p>
      <p class="mt-1 text-ink-muted">
        Pregunta por tu orden en la sucursal o escríbenos por WhatsApp.
      </p>
      <a href="/menu" class="btn btn-primary mt-5 rounded-full px-8"
        >Ver el menú</a
      >
    </div>
  {:else}
    <!-- ── Search form ── -->
    <section class="rounded-box border border-base-300 bg-base-100 p-5 md:p-8">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
        <label class="form-control flex-1">
          <span
            class="label-text font-bold text-base-content/80 ml-1 mb-1 hidden"
            >Número de orden</span
          >
          <div class="relative">
            <div
              class="absolute inset-y-0 left-0 z-10 pl-4 flex items-center pointer-events-none text-ink-muted"
            >
              <Icon icon="lucide:search" width="20" height="20" />
            </div>
            <input
              class="input input-bordered h-12 md:h-14 bg-base-100 focus:bg-base-200 w-full rounded-xl md:rounded-2xl pl-11 text-base md:text-lg font-medium transition-all"
              bind:value={trackingOrderNumber}
              placeholder="Ej. ORD-20261026-1234"
              aria-label="Número de orden"
              aria-describedby="tracking-help"
              autocomplete="off"
            />
          </div>
          <span id="tracking-help" class="mt-2 ml-1 text-sm text-ink-muted">
            Lo ves al confirmar tu pedido y en el enlace que te enviamos por
            WhatsApp.
          </span>
        </label>

        <button
          class="btn btn-primary btn-lg min-w-32 rounded-full"
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
        class="mt-4 rounded-xl md:rounded-2xl border border-base-200/70 bg-base-200/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
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
        <p class="text-xs text-ink-muted">
          Historial local y opcional. Se elimina automáticamente en
          {RECENT_TRACKING_RETENTION_DAYS} días.
        </p>
      </div>

      <div class="mt-3 min-h-6 flex items-center justify-end">
        {#if trackingLookupActive}
          <p class="flex items-center gap-2 text-sm text-ink-muted">
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
          class="alert alert-error shadow-sm rounded-xl md:rounded-2xl border-error/20 text-sm font-medium p-4 mt-5"
        >
          <Icon icon="lucide:alert-triangle" class="w-5 h-5 shrink-0" />
          <span>{trackingError}</span>
        </div>
      {/if}
    </section>

    {#if trackedOrder}
      <div class="mt-6 md:mt-8 space-y-5 md:space-y-6">
        <!-- ── Order status card ── -->
        <article
          class="rounded-box border border-base-300 bg-base-100 p-5 md:p-8"
        >
          {#if headline}
            <div class="mb-6 flex items-start gap-4" bind:this={headlineRef}>
              <span
                class={`grid size-14 shrink-0 place-items-center rounded-full ${trackedOrder.status === "cancelada" ? "bg-error/15 text-error" : trackedOrder.status === "lista" || trackedOrder.status === "entregada" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}
                aria-hidden="true"
              >
                <Icon
                  icon={TRACKING_STATUS_ICONS_ACTIVE[trackedOrder.status]}
                  width="28"
                  height="28"
                />
              </span>
              {#key trackedOrder.status}
                <div
                  class="min-w-0"
                  in:fly={{ y: 10, duration: motionMs(350) }}
                >
                  <p
                    class="font-display font-bold text-4xl leading-none md:text-5xl"
                    aria-live="polite"
                  >
                    {headline.title}
                  </p>
                  <p class="mt-1 text-base-content/70">{headline.body}</p>
                </div>
              {/key}
            </div>
            {#if trackedOrder.status !== "cancelada"}
              <div
                class="tracking-progress mb-6"
                class:tracking-progress--done={trackedOrder.status ===
                  "lista" || trackedOrder.status === "entregada"}
                aria-hidden="true"
                style={`--progress: ${progressPercent}%`}
              >
                <span></span>
              </div>
            {/if}
          {/if}

          <div
            class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 md:mb-6"
          >
            <div>
              <h2
                class="text-xs font-bold text-ink-muted uppercase tracking-widest mb-1"
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
                class="btn btn-ghost btn-sm min-h-11 rounded-full gap-1.5 mt-1 -ml-2"
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
              class={`badge badge-lg rounded-full border-0 px-4 py-3 font-semibold ${trackedOrder.status === "entregada" || trackedOrder.status === "lista" ? "bg-success/15 text-success" : "bg-primary text-primary-content"}`}
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
                <span class="text-xs font-bold text-ink-muted uppercase"
                  >Total</span
                >
                <span class="font-bold text-lg tabular-nums"
                  >{formatMoney(trackedOrder.total_amount)}</span
                >
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold text-ink-muted uppercase"
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
                <span class="text-xs font-bold text-ink-muted uppercase"
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
                <span class="text-xs font-bold text-ink-muted uppercase"
                  >Actualizado</span
                >
                {#if trackingRefreshing}
                  <span class="flex items-center gap-2 text-xs text-ink-muted">
                    <span
                      class="inline-grid *:[grid-area:1/1]"
                      aria-hidden="true"
                    >
                      <span
                        class="status status-sm status-primary tracking-status-ping"
                      ></span>
                      <span class="status status-sm status-primary"></span>
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
                    class="text-sm font-bold uppercase tracking-wider text-ink-muted"
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
                  style="border-color: color-mix(in srgb, var(--color-primary) 40%, transparent); color: var(--color-primary);"
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
                          <p class="text-sm text-ink-muted mt-1">
                            Incluidos: {includedAddonSummary.join(", ")}
                          </p>
                        {/if}
                        {#if extraAddonSummary.length > 0}
                          <p class="text-sm text-ink-muted mt-1">
                            Extras: {extraAddonSummary.join(", ")}
                          </p>
                        {/if}
                        {#if item.customizations?.notes}
                          <p class="text-sm text-ink-muted mt-1 italic">
                            Nota: {item.customizations.notes}
                          </p>
                        {/if}
                      </div>
                      <div class="text-right shrink-0">
                        <p
                          class="font-bold"
                          style="color: var(--color-primary);"
                        >
                          {formatMoney(item.subtotal)}
                        </p>
                        <p class="text-xs text-ink-muted mt-1">
                          {formatMoney(item.unit_price)} c/u
                        </p>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </details>
          {/if}

          {#if trackedOrder.status !== "cancelada"}
            <div
              class={`mb-5 flex flex-col justify-between gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center md:mb-6 md:rounded-2xl ${
                trackedOrderDelivered
                  ? "border-success/20 bg-success/8"
                  : "border-base-300 bg-base-200/50"
              }`}
            >
              <div class="flex items-center gap-2.5">
                <Icon
                  icon={trackedOrderDelivered
                    ? "lucide:check-check"
                    : "lucide:receipt-text"}
                  width="18"
                  height="18"
                  class={`shrink-0 ${trackedOrderDelivered ? "text-success" : "text-primary"}`}
                />
                <div>
                  <p class="text-sm font-semibold text-base-content">
                    {trackedOrderDelivered
                      ? "Pedido entregado"
                      : "Comprobante de tu pedido"}
                  </p>
                  <p class="text-xs text-base-content/70" aria-live="polite">
                    {receiptActionMessage || "Descárgalo en PDF o imprímelo."}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  class="btn btn-ghost btn-sm min-h-11 hidden gap-1.5 rounded-full sm:inline-flex"
                  type="button"
                  onclick={printTrackedOrderReceipt}
                >
                  <Icon icon="lucide:printer" width="14" height="14" />
                  Imprimir
                </button>
                <button
                  class={`btn btn-sm min-h-11 flex-1 gap-1.5 rounded-full sm:flex-none ${trackedOrderDelivered ? "btn-success" : "btn-primary"}`}
                  type="button"
                  onclick={() => void downloadTrackedOrderReceipt()}
                  disabled={receiptDownloading}
                >
                  {#if receiptDownloading}
                    <span class="loading loading-spinner loading-xs"></span>
                  {:else}
                    <Icon icon="lucide:file-down" width="14" height="14" />
                  {/if}
                  Descargar PDF
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
                        class={`text-sm font-semibold ${current ? "text-primary" : completed ? "text-base-content" : "text-ink-muted"}`}
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
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3 px-1">
              <h2
                class="text-xs font-bold uppercase tracking-wider text-ink-muted"
              >
                Historial en este dispositivo
              </h2>
              {#if recentTrackingOrders.length > 1}
                <button
                  class="btn btn-ghost btn-sm min-h-11 text-error"
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
                      style="color: var(--color-primary);"
                    >
                      {recentOrder.orderNumber}
                    </button>
                    <p class="text-xs text-ink-muted mt-0.5 truncate">
                      {TRACKING_STATUS_LABELS[recentOrder.status]} •
                      {formatMoney(recentOrder.totalAmount)}
                    </p>
                  </div>
                  <button
                    class="btn btn-ghost btn-sm min-h-11 rounded-full text-error shrink-0"
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
                <p class="text-xs text-center text-ink-muted">
                  +{recentTrackingOrders.length - 5} mas
                </p>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
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
          class="btn btn-ghost btn-sm min-h-11"
          type="button"
          onclick={cancelRecentHistoryConfirm}
        >
          Cancelar
        </button>
        <button
          class="btn btn-error btn-sm min-h-11"
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
      aria-label="Cerrar confirmación"
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

  .tracking-progress {
    height: 0.5rem;
    border-radius: 999px;
    background: var(--color-base-300);
    overflow: hidden;
  }

  .tracking-progress span {
    display: block;
    height: 100%;
    width: var(--progress);
    border-radius: inherit;
    background: var(--color-primary);
    transition: width 700ms var(--ease-out);
  }

  .tracking-progress--done span {
    background: var(--color-success);
  }

  @media (prefers-reduced-motion: reduce) {
    .tracking-status-ping {
      animation: none;
    }
    .tracking-progress span {
      transition: none;
    }
  }
</style>
