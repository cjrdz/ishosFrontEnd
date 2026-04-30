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
  } from "@features/analytics";
  import type { RecentTrackingOrder } from "@features/analytics/lib/tracking";
  import { subscribeOrderStatusSync } from "@features/orders/lib/status-sync";

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
  let recentFilterQuery = $state("");
  let recentSort = $state<"newest" | "oldest" | "name-asc" | "name-desc">(
    "newest",
  );
  let recentHistoryActionMessage = $state("");
  let receiptActionMessage = $state("");
  let lastExternalRefreshAt = $state(0);
  let pendingRecentHistoryConfirm = $state<RecentHistoryConfirmState>(null);

  const TRACKING_RATE_LIMIT_COOLDOWN_MS = 60000;
  const RECENT_TRACKING_RETENTION_DAYS = 30;
  const TRACKING_EXTERNAL_REFRESH_MIN_INTERVAL_MS = 5000;

  const trackedOrderItems = $derived(trackedOrder?.items ?? []);
  const trackingLookupActive = $derived(trackingBusy || trackingRefreshing);
  const trackingCooldownActive = $derived(trackingCooldownUntil > cooldownNow);
  const trackingCooldownSeconds = $derived(
    trackingCooldownActive
      ? Math.max(1, Math.ceil((trackingCooldownUntil - cooldownNow) / 1000))
      : 0,
  );
  const trackedOrderDelivered = $derived(trackedOrder?.status === "entregada");
  const filteredRecentTrackingOrders = $derived.by(() => {
    const query = recentFilterQuery.trim().toLowerCase();

    return [...recentTrackingOrders]
      .filter((entry) => {
        if (!query) return true;

        const orderNumber = entry.orderNumber.toLowerCase();
        const statusLabel = TRACKING_STATUS_LABELS[entry.status].toLowerCase();
        const customerName = entry.customerName?.toLowerCase() ?? "";
        return (
          orderNumber.includes(query) ||
          statusLabel.includes(query) ||
          customerName.includes(query)
        );
      })
      .sort((a, b) => {
        if (recentSort === "oldest") {
          return (
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          );
        }

        if (recentSort === "name-asc") {
          return (a.customerName ?? "").localeCompare(
            b.customerName ?? "",
            "es",
            {
              sensitivity: "base",
            },
          );
        }

        if (recentSort === "name-desc") {
          return (b.customerName ?? "").localeCompare(
            a.customerName ?? "",
            "es",
            {
              sensitivity: "base",
            },
          );
        }

        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  });

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
      lastExternalRefreshAt = now;
      void runTrackingLookup({ silent: true });
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

    return () => {
      unsubscribeStatusSync();
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
          customerName: order.customer_name?.trim() || undefined,
          status: order.status,
          totalAmount: order.total_amount,
          updatedAt: order.updated_at,
        });
        recentTrackingOrders = getRecentTrackingOrders();
      }
    } catch (error) {
      trackedOrder = null;

      if (error instanceof ApiError && error.status === 404) {
        trackingError =
          "Tu orden fue cancelada. Contáctanos para más información.";
        return;
      }

      if (error instanceof ApiError && error.status === 429) {
        startTrackingCooldown();
        trackingError =
          "Hiciste muchas consultas en poco tiempo. Espera 60 segundos e intenta de nuevo.";
        return;
      }

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
      <section class="mt-6">
        <div
          class="collapse collapse-arrow rounded-3xl border border-base-200/70 bg-base-200/25"
        >
          <input type="checkbox" checked />
          <div class="collapse-title pe-12">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2
                  class="text-sm font-bold uppercase tracking-wider text-base-content/60"
                >
                  Pedidos recientes en este dispositivo
                </h2>
                <p class="text-xs text-base-content/60 mt-1">
                  Solo visibles en este navegador. Puedes borrarlos cuando
                  quieras.
                </p>
              </div>
            </div>
          </div>
          <div class="collapse-content pt-0 pb-4 md:pb-5">
            <div
              class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
            >
              <label class="input input-sm w-full sm:flex-1">
                <Icon icon="lucide:search" width="14" height="14" />
                <input
                  type="text"
                  placeholder="Filtrar por orden, cliente o estado"
                  bind:value={recentFilterQuery}
                />
              </label>

              <label class="select select-sm w-full sm:w-56">
                <span class="label text-xs text-base-content/60">Orden</span>
                <select bind:value={recentSort}>
                  <option value="newest">Mas recientes</option>
                  <option value="oldest">Mas antiguos</option>
                  <option value="name-asc">Nombre A-Z</option>
                  <option value="name-desc">Nombre Z-A</option>
                </select>
              </label>

              <button
                class="btn btn-ghost btn-xs text-error"
                type="button"
                onclick={(event) => {
                  event.stopPropagation();
                  openClearRecentConfirm();
                }}
              >
                Borrar historial
              </button>
            </div>

            {#if recentHistoryActionMessage}
              <div
                class="alert alert-success mb-3 rounded-xl px-3 py-2 text-sm"
              >
                <span>{recentHistoryActionMessage}</span>
              </div>
            {/if}
            <div class="space-y-2">
              {#if filteredRecentTrackingOrders.length === 0}
                <div
                  class="rounded-xl border border-dashed border-base-300/80 px-3 py-4 text-sm text-base-content/60"
                >
                  No hay pedidos que coincidan con los filtros actuales.
                </div>
              {/if}

              {#each filteredRecentTrackingOrders as recentOrder}
                <div
                  class="rounded-2xl bg-base-100 border border-base-200/80 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <button
                      class="font-semibold text-sm break-all text-left text-primary hover:underline cursor-pointer"
                      type="button"
                      onclick={() => loadRecentOrder(recentOrder)}
                      disabled={trackingLookupActive || trackingCooldownActive}
                      title="Cargar pedido"
                    >
                      {recentOrder.orderNumber}
                    </button>
                    <p class="text-xs text-base-content/60 mt-1">
                      {TRACKING_STATUS_LABELS[recentOrder.status]} •
                      {formatMoney(recentOrder.totalAmount)} •
                      {formatDate(recentOrder.updatedAt)}
                    </p>
                    {#if recentOrder.customerName}
                      <p class="text-xs text-base-content/50 mt-1">
                        Cliente: {recentOrder.customerName}
                      </p>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 sm:justify-end">
                    <div class="relative">
                      <button
                        class="btn btn-ghost btn-sm rounded-full text-error"
                        type="button"
                        onclick={() => openRecentDeleteConfirm(recentOrder)}
                        aria-label={`Eliminar ${recentOrder.orderNumber} del historial`}
                        title="Eliminar del historial"
                      >
                        <Icon icon="lucide:trash-2" width="16" height="16" />
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
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
                        class={`text-sm font-semibold ${current ? "text-primary" : completed ? "text-base-content" : "text-base-content/45"}`}
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
            Esta accion borrara
            <span class="font-semibold"
              >{pendingRecentHistoryConfirm.order.orderNumber}</span
            >
            de este dispositivo.
          </p>
        {:else}
          <h3 class="text-base font-bold">Borrar historial completo?</h3>
          <p class="mt-2 text-sm text-base-content/75">
            Esta accion eliminara
            <span class="font-semibold"
              >{pendingRecentHistoryConfirm.count}</span
            >
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
