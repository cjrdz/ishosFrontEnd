<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import type { Order } from "@features/admin-management";
  import {
    linearStatuses,
    canceledFlow,
    statusLabels,
    statusStepIconsActive,
    statusStepIconsStatic,
    canceledStepLabels,
    canceledStepIconsActive,
    canceledStepIconsStatic,
    kitchenBadge,
    isStepReached,
    suggestedNextStep,
    amountColumnLabel,
    orderTypeLabel,
    createdByLabel,
    type LinearOrderStatus,
  } from "../../lib/order-status";
  import { formatCurrency } from "@shared/utils/formatters";

  interface Props {
    selectedOrder: Order;
    isAdmin: boolean;
    employeeById: Record<string, string>;
    tokenVisible: boolean;
    tokenCopied: "" | "token" | "both" | "link";
    onToggleTokenVisibility: () => void;
    onCopyToken: (value: string, kind: "token" | "both" | "link") => void;
    onOpenSaveUserDialog: (order: Order) => void;
    onOpenReject: (orderId: string) => void;
    onOpenReactivate: (orderId: string) => void;
    onHandleStepClick: (order: Order, stepStatus: LinearOrderStatus) => void;
    onCanChangeToStep: (order: Order, stepStatus: LinearOrderStatus) => boolean;
  }

  let {
    selectedOrder,
    isAdmin,
    employeeById,
    tokenVisible,
    tokenCopied,
    onToggleTokenVisibility,
    onCopyToken,
    onOpenSaveUserDialog,
    onOpenReject,
    onOpenReactivate,
    onHandleStepClick,
    onCanChangeToStep,
  }: Props = $props();

  function resolveTrackingUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith("//")) {
      const protocol =
        typeof window !== "undefined" ? window.location.protocol : "https:";
      return `${protocol}${trimmed}`;
    }

    const looksLikeHostPath = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(\/|$)/i.test(
      trimmed,
    );
    if (looksLikeHostPath) {
      const protocol =
        typeof window !== "undefined" ? window.location.protocol : "https:";
      return `${protocol}//${trimmed}`;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!origin) {
      return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    }

    const separator = trimmed.startsWith("/") ? "" : "/";
    return `${origin}${separator}${trimmed}`;
  }

  const trackingLink = $derived.by(() => {
    if (!selectedOrder) return "";
    if (selectedOrder.tracking_url) {
      return resolveTrackingUrl(selectedOrder.tracking_url);
    }
    if (selectedOrder.tracking_token) {
      const search = new URLSearchParams({
        order: selectedOrder.order_number,
        token: selectedOrder.tracking_token,
      });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      return origin
        ? `${origin}/order/tracking?${search.toString()}`
        : `/order/tracking?${search.toString()}`;
    }
    return "";
  });

  const suggestedNext = $derived(suggestedNextStep(selectedOrder.status));
  const statusIndex = $derived(
    linearStatuses.indexOf(selectedOrder.status as LinearOrderStatus),
  );
  const stepAnnouncement = $derived(
    statusIndex >= 0
      ? `Estado actualizado a ${statusLabels[selectedOrder.status]}, paso ${statusIndex + 1} de ${linearStatuses.length}`
      : "",
  );
  const canceledStepAnnouncement = $derived(
    selectedOrder.status === "cancelada" ? "Pedido denegado" : "",
  );

  function formatAdminDate(value: string): string {
    return new Date(value).toLocaleString("es-SV", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function stepTimestamp(status: string): string {
    const ts = selectedOrder.status_timestamps?.[status];
    if (ts) return formatAdminDate(ts);
    // Fallback to updated_at for current status if no specific timestamp exists
    if (status === selectedOrder.status && selectedOrder.updated_at) {
      return formatAdminDate(selectedOrder.updated_at);
    }
    return "";
  }

  function itemFlavorText(
    customizations: NonNullable<Order["items"]>[number]["customizations"],
  ): string {
    if (!customizations) return "";
    if (
      Array.isArray(customizations.flavor_names) &&
      customizations.flavor_names.length > 0
    ) {
      return customizations.flavor_names.join(", ");
    }
    if (customizations.flavor_name) {
      return customizations.flavor_name;
    }
    return "";
  }

  function extraAddonCost(
    customizations: NonNullable<Order["items"]>[number]["customizations"],
  ): number {
    if (!customizations) return 0;
    const prices = customizations.extra_addon_prices;
    if (!Array.isArray(prices)) return 0;
    return prices.reduce(
      (sum, price) =>
        sum + (Number.isFinite(Number(price)) ? Number(price) : 0),
      0,
    );
  }
</script>

<div class="flex flex-col gap-4 text-sm">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="flex items-center gap-2 min-w-0">
      <h3 class="text-base sm:text-lg font-semibold truncate">
        Detalle: {selectedOrder.order_number}
      </h3>
      <button
        class="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-info shrink-0"
        type="button"
        title="Copiar numero de orden"
        onclick={() => onCopyToken(selectedOrder.order_number, "both")}
        aria-label="Copiar numero de orden"
      >
        <Icon
          icon={tokenCopied === "both" ? "lucide:check" : "lucide:copy"}
          class="h-4 w-4"
        />
      </button>
    </div>
    {#if trackingLink}
      <button
        class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-warning"
        type="button"
        title="Copiar enlace de seguimiento"
        onclick={() => onCopyToken(trackingLink, "link")}
        aria-label="Copiar enlace de seguimiento"
      >
        <Icon
          icon={tokenCopied === "link" ? "lucide:check" : "lucide:link"}
          class="h-4 w-4"
        />
      </button>
    {/if}
  </div>
  <div class="grid gap-4 md:grid-cols-3">
    <div class="space-y-1">
      <span class="text-xs text-base-content/60">Cliente</span>
      <p class="font-medium">{selectedOrder.customer_name}</p>
    </div>
    <div class="space-y-1">
      <span class="text-xs text-base-content/60">Telefono</span>
      <p class="font-medium">{selectedOrder.customer_phone}</p>
    </div>
    <div class="space-y-1">
      <span class="text-xs text-base-content/60">Metodo de pago</span>
      <p class="font-medium capitalize">{selectedOrder.payment_method}</p>
    </div>
    {#if selectedOrder.payment_method === "efectivo" && selectedOrder.amount_received != null}
      <div class="space-y-1">
        <span class="text-xs text-base-content/60">Recibido</span>
        <p class="font-medium">
          {formatCurrency(selectedOrder.amount_received)}
        </p>
      </div>
      <div class="space-y-1">
        <span class="text-xs text-base-content/60">Cambio</span>
        <p class="font-medium">
          {formatCurrency(
            selectedOrder.amount_received - selectedOrder.total_amount,
          )}
        </p>
      </div>
    {/if}
    <div class="space-y-1">
      <span class="text-xs text-base-content/60">Tipo</span>
      <p class="font-medium">
        {selectedOrder.order_type
          ? orderTypeLabel(selectedOrder.order_type)
          : "No definido"}
      </p>
    </div>
    <div class="space-y-1">
      <span class="text-xs text-base-content/60">Mesa</span>
      <p class="font-medium">
        {selectedOrder.order_type === "en_local"
          ? (selectedOrder.table_number ?? "Sin mesa")
          : "No aplica"}
      </p>
    </div>
    <div class="space-y-1">
      <span class="text-xs text-base-content/60">Creada por</span>
      <p class="font-medium">{createdByLabel(selectedOrder, employeeById)}</p>
    </div>
    <div class="space-y-1 md:col-span-3">
      <span class="text-xs text-base-content/60">Notas</span>
      <div
        class="rounded-lg border border-base-300/60 bg-base-100 p-3 text-sm max-h-28 overflow-y-auto"
      >
        {selectedOrder.notes?.trim() ? selectedOrder.notes : "Sin notas"}
      </div>
    </div>
    {#if selectedOrder.tracking_token}
      <div
        class="md:col-span-3 rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <p
            class="text-xs font-semibold text-warning/80 uppercase tracking-wide"
          >
            Token de seguimiento
          </p>
          {#if selectedOrder.tracking_token_expires_at}
            <p class="text-xs text-base-content/50">
              Expira {new Date(
                selectedOrder.tracking_token_expires_at,
              ).toLocaleDateString("es-SV", { dateStyle: "medium" })}
            </p>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <code
            class="flex-1 min-w-0 truncate rounded bg-base-100 px-2 py-1.5 text-xs font-mono select-all border border-warning/20"
          >
            {tokenVisible ? selectedOrder.tracking_token : "\u2022".repeat(24)}
          </code>
          <button
            class="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-warning"
            type="button"
            title={tokenVisible ? "Ocultar token" : "Revelar token"}
            onclick={onToggleTokenVisibility}
            aria-label={tokenVisible ? "Ocultar token" : "Revelar token"}
          >
            <Icon
              icon={tokenVisible ? "lucide:eye-off" : "lucide:eye"}
              class="h-4 w-4"
            />
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-warning"
            type="button"
            title="Copiar token"
            onclick={() => onCopyToken(selectedOrder.tracking_token!, "token")}
            aria-label="Copiar token"
          >
            <Icon
              icon={tokenCopied === "token" ? "lucide:check" : "lucide:copy"}
              class="h-4 w-4"
            />
          </button>
        </div>
      </div>
    {/if}
    <div class="md:col-span-3 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs text-base-content/60">Estado</span>
        {#if selectedOrder.status === "cancelada"}
          {#if isAdmin}
            <button
              class="btn btn-xs btn-soft btn-success"
              type="button"
              onclick={() => onOpenReactivate(selectedOrder.id)}
            >
              Reactivar
            </button>
          {/if}
        {:else}
          <div class="flex items-center gap-2">
            {#if kitchenBadge(selectedOrder)}
              <span class={kitchenBadge(selectedOrder)?.className}
                >{kitchenBadge(selectedOrder)?.text}</span
              >
            {/if}
            {#if selectedOrder.status === "recibida" && isAdmin}
              <button
                class="btn btn-xs btn-soft btn-error"
                type="button"
                onclick={() => onOpenReject(selectedOrder.id)}
              >
                Rechazar
              </button>
            {/if}
          </div>
        {/if}
      </div>

      {#if selectedOrder.status === "cancelada"}
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge badge-error badge-outline">Orden denegada</span>
          {#if selectedOrder.rejection_reason}
            <span class="text-xs text-base-content/60"
              >Motivo: {selectedOrder.rejection_reason}</span
            >
          {/if}
        </div>
        <div
          role="progressbar"
          aria-valuenow={canceledFlow.indexOf(
            selectedOrder.status as "pendiente_revision" | "cancelada",
          ) + 1}
          aria-valuemin={1}
          aria-valuemax={canceledFlow.length}
          aria-label="Estado de cancelacion"
        >
          <ul
            class="steps steps-vertical md:steps-horizontal w-full max-w-4xl mt-1 order-steps order-steps--compact"
          >
            {#each canceledFlow as stepStatus}
              {@const reached =
                canceledFlow.indexOf(stepStatus) <=
                canceledFlow.indexOf("cancelada")}
              {@const completed =
                canceledFlow.indexOf(stepStatus) <
                canceledFlow.indexOf("cancelada")}
              {@const current = stepStatus === "cancelada"}
              <li
                data-content=""
                class={`step min-h-18! ${reached ? "step-primary" : ""}`}
                aria-current={current ? "step" : undefined}
              >
                <div
                  class="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 mt-1"
                >
                  <span
                    class={`order-step-node ${current ? "order-step-node--current" : completed ? "order-step-node--complete" : "order-step-node--pending"}`}
                  >
                    <Icon
                      icon={current
                        ? canceledStepIconsActive[stepStatus]
                        : canceledStepIconsStatic[stepStatus]}
                      width="18"
                      height="18"
                    />
                  </span>
                  <span
                    class={`text-sm font-semibold ${current ? "text-error" : completed ? "text-base-content" : "text-base-content/45"}`}
                    >{canceledStepLabels[stepStatus]}</span
                  >
                  {#if stepTimestamp(stepStatus)}
                    <span class="order-step-timestamp"
                      >{stepTimestamp(stepStatus)}</span
                    >
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
          <span
            class="order-steps-sr-only"
            aria-live="polite"
            aria-atomic="true">{canceledStepAnnouncement}</span
          >
        </div>
      {:else}
        <div
          role="progressbar"
          class="w-full min-w-0"
          aria-valuenow={statusIndex + 1}
          aria-valuemin={1}
          aria-valuemax={linearStatuses.length}
          aria-label="Progreso del pedido"
        >
          <ul
            class="steps steps-vertical md:steps-horizontal w-full max-w-4xl mx-auto order-steps order-steps--compact"
          >
            {#each linearStatuses as stepStatus}
              {@const reached = isStepReached(selectedOrder.status, stepStatus)}
              {@const completed =
                reached && selectedOrder.status !== stepStatus}
              {@const current = selectedOrder.status === stepStatus}
              {@const isHint =
                stepStatus === suggestedNext && !current && !completed}
              <li
                data-content=""
                class={`step min-h-18! ${reached ? "step-primary" : ""}`}
                aria-current={current ? "step" : undefined}
              >
                <div
                  class="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 mt-1"
                >
                  <button
                    class={`order-step-node ${current ? "order-step-node--current" : completed ? "order-step-node--complete" : "order-step-node--pending"} ${!current && !completed && onCanChangeToStep(selectedOrder, stepStatus) ? "order-step-node--clickable" : ""} ${isHint ? "order-step-node--hint" : ""}`}
                    type="button"
                    onclick={() => onHandleStepClick(selectedOrder, stepStatus)}
                    disabled={!onCanChangeToStep(selectedOrder, stepStatus)}
                    aria-label={`Actualizar estado a ${statusLabels[stepStatus]}`}
                  >
                    <Icon
                      icon={current
                        ? statusStepIconsActive[stepStatus]
                        : statusStepIconsStatic[stepStatus]}
                      width="18"
                      height="18"
                    />
                  </button>
                  <button
                    class={`order-step-label-btn ${current ? "text-primary" : completed ? "text-base-content" : "text-base-content/45"}`}
                    type="button"
                    onclick={() => onHandleStepClick(selectedOrder, stepStatus)}
                    disabled={!onCanChangeToStep(selectedOrder, stepStatus)}
                    aria-label={`Actualizar estado a ${statusLabels[stepStatus]}`}
                  >
                    {statusLabels[stepStatus]}
                  </button>
                  {#if stepTimestamp(stepStatus)}
                    <span class="order-step-timestamp"
                      >{stepTimestamp(stepStatus)}</span
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
    </div>
  </div>

  <div
    class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
  >
    <table class="table table-sm w-full">
      <thead class="bg-base-200/60 text-base-content">
        <tr>
          <th class="font-bold">Producto</th>
          <th class="font-bold">Sabores</th>
          <th class="text-center font-bold">Cantidad</th>
          <th class="text-right font-bold"
            >{amountColumnLabel(selectedOrder.status)}</th
          >
        </tr>
      </thead>
      <tbody>
        {#if !selectedOrder.items || selectedOrder.items.length === 0}
          <tr
            ><td colspan="4" class="text-center py-6 text-base-content/50"
              >Sin items</td
            ></tr
          >
        {:else}
          {#each selectedOrder.items as item (item.id ?? `${item.product_name}-${item.quantity}`)}
            {@const flavorText = itemFlavorText(item.customizations)}
            <tr class="hover:bg-base-300/40 transition-colors">
              <td>
                <div class="font-medium">{item.product_name}</div>
                {#if item.customizations}
                  {#if Array.isArray(item.customizations.addon_names) && item.customizations.addon_names.length > 0 && !Array.isArray(item.customizations.included_addon_names) && !Array.isArray(item.customizations.extra_addon_names)}
                    <div class="text-xs text-base-content/60">
                      Complementos: {item.customizations.addon_names.join(", ")}
                    </div>
                  {/if}
                  {#if Array.isArray(item.customizations.included_addon_names) && item.customizations.included_addon_names.length > 0}
                    <div class="text-xs text-base-content/60">
                      Incluidos: {item.customizations.included_addon_names.join(
                        ", ",
                      )}
                    </div>
                  {/if}
                  {#if Array.isArray(item.customizations.extra_addon_names) && item.customizations.extra_addon_names.length > 0}
                    {@const extraCost = extraAddonCost(item.customizations)}
                    <div class="text-xs text-base-content/60">
                      Extras: {item.customizations.extra_addon_names.join(", ")}
                      {#if extraCost > 0}
                        <span class="text-success ml-1">
                          +{formatCurrency(extraCost)}
                        </span>
                      {/if}
                    </div>
                  {/if}
                  {#if item.customizations.notes}
                    <div class="text-xs text-base-content/60">
                      Nota: {item.customizations.notes}
                    </div>
                  {/if}
                {/if}
              </td>
              <td>
                {#if flavorText}
                  <span class="text-xs text-base-content/70">{flavorText}</span>
                {:else}
                  <span class="text-xs text-base-content/40">—</span>
                {/if}
              </td>
              <td class="text-center align-middle">{item.quantity}</td>
              <td class="text-right align-middle"
                >{formatCurrency(item.subtotal)}</td
              >
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
  <div class="flex justify-end">
    <div
      class="rounded-lg border border-base-300/60 bg-base-100 px-4 py-2 text-right shadow-sm"
    >
      <p class="text-xs text-base-content/60">Total de la orden</p>
      <p class="text-lg font-bold text-primary">
        {formatCurrency(selectedOrder.total_amount)}
      </p>
      {#if selectedOrder.payment_method === "efectivo" && selectedOrder.amount_received != null}
        <p class="text-xs text-base-content/60 mt-1">Recibido</p>
        <p class="font-semibold">
          {formatCurrency(selectedOrder.amount_received)}
        </p>
        <p class="text-xs text-base-content/60 mt-1">Cambio</p>
        <p class="font-semibold">
          {formatCurrency(
            selectedOrder.amount_received - selectedOrder.total_amount,
          )}
        </p>
      {/if}
    </div>
  </div>
</div>
