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
</script>

<div class="card bg-base-100 shadow-sm border border-base-200">
  <div class="card-body p-4 sm:p-6 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="card-title text-base sm:text-lg">
          Detalle de orden: {selectedOrder.order_number}
        </h3>
        <button
          class="btn btn-xs btn-ghost"
          type="button"
          title="Copiar numero de orden"
          onclick={() => onCopyToken(selectedOrder.order_number, "both")}
          aria-label="Copiar numero de orden"
        >
          <Icon
            icon={tokenCopied === "both" ? "lucide:check" : "lucide:copy"}
            width="14"
            height="14"
          />
          {tokenCopied === "both" ? "¡Copiado!" : "Copiar ORD"}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {#if trackingLink}
          <button
            class="btn btn-xs btn-outline btn-warning gap-1"
            type="button"
            title="Copiar enlace seguro de seguimiento"
            onclick={() => onCopyToken(trackingLink, "link")}
            aria-label="Copiar enlace de seguimiento"
          >
            <Icon
              icon={tokenCopied === "link" ? "lucide:check" : "lucide:link"}
              width="14"
              height="14"
            />
            {tokenCopied === "link" ? "¡Copiado!" : "Copiar enlace"}
          </button>
        {/if}
        {#if isAdmin}
          <button
            class="btn btn-sm btn-soft btn-secondary"
            type="button"
            onclick={() => onOpenSaveUserDialog(selectedOrder)}
          >
            Guardar como usuario
          </button>
        {/if}
      </div>
    </div>
    <div class="grid gap-3 md:grid-cols-[1fr_1fr_0.9fr] text-sm">
      <div class="space-y-2">
        <p><strong>Cliente:</strong> {selectedOrder.customer_name}</p>
        <p><strong>Metodo pago:</strong> {selectedOrder.payment_method}</p>
        <p>
          <strong>Mesa:</strong>
          {selectedOrder.order_type === "en_local"
            ? (selectedOrder.table_number ?? "Sin mesa")
            : "No aplica"}
        </p>
      </div>
      <div class="space-y-2">
        <p><strong>Telefono:</strong> {selectedOrder.customer_phone}</p>
        <p>
          <strong>Tipo:</strong>
          {selectedOrder.order_type
            ? orderTypeLabel(selectedOrder.order_type)
            : "No definido"}
        </p>
        <p>
          <strong>Creada por:</strong>
          {createdByLabel(selectedOrder, employeeById)}
        </p>
      </div>
      <div class="space-y-2">
        <p><strong>Notas:</strong></p>
        <div
          class="rounded-lg border border-base-300/60 bg-base-200/40 p-3 text-sm max-h-28 overflow-y-auto"
        >
          {selectedOrder.notes?.trim() ? selectedOrder.notes : "Sin notas"}
        </div>
      </div>
      {#if selectedOrder.tracking_token}
        <div
          class="md:col-span-3 rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2"
        >
          <p
            class="text-xs font-semibold text-warning/80 uppercase tracking-wide"
          >
            Token de seguimiento del cliente
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <code
              class="flex-1 min-w-0 truncate rounded bg-base-300/60 px-2 py-1 text-xs font-mono select-all"
            >
              {tokenVisible
                ? selectedOrder.tracking_token
                : "\u2022".repeat(24)}
            </code>
            <button
              class="btn btn-xs btn-ghost"
              type="button"
              title={tokenVisible ? "Ocultar token" : "Revelar token"}
              onclick={onToggleTokenVisibility}
              aria-label={tokenVisible ? "Ocultar token" : "Revelar token"}
            >
              <Icon
                icon={tokenVisible ? "lucide:eye-off" : "lucide:eye"}
                width="14"
                height="14"
              />
            </button>
            <button
              class="btn btn-xs btn-ghost"
              type="button"
              title="Copiar token"
              onclick={() =>
                onCopyToken(selectedOrder.tracking_token!, "token")}
              aria-label="Copiar token"
            >
              <Icon
                icon={tokenCopied === "token" ? "lucide:check" : "lucide:copy"}
                width="14"
                height="14"
              />
              {tokenCopied === "token" ? "¡Copiado!" : "Token"}
            </button>
          </div>
          {#if selectedOrder.tracking_token_expires_at}
            <p class="text-xs text-base-content/50">
              Expira: {new Date(
                selectedOrder.tracking_token_expires_at,
              ).toLocaleDateString("es-SV", { dateStyle: "medium" })}
            </p>
          {/if}
        </div>
      {/if}
      <div class="md:col-span-3">
        {#if selectedOrder.status === "cancelada"}
          <div class="flex flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-left"><strong>Estado:</strong></p>
              <span class="badge badge-error badge-outline">Orden denegada</span
              >
              {#if selectedOrder.rejection_reason}
                <span class="text-xs text-base-content/60"
                  >Motivo: {selectedOrder.rejection_reason}</span
                >
              {/if}
              {#if isAdmin}
                <button
                  class="btn btn-xs btn-soft btn-success"
                  onclick={() => onOpenReactivate(selectedOrder.id)}
                >
                  Aceptar
                </button>
              {/if}
            </div>
            <ul class="steps steps-sm w-full max-w-2xl mt-2">
              {#each canceledFlow as stepStatus}
                <li class="step step-primary text-center">
                  <span class="step-icon"
                    ><Icon
                      icon={stepStatus === selectedOrder.status
                        ? canceledStepIconsActive[stepStatus]
                        : canceledStepIconsStatic[stepStatus]}
                      width="16"
                      height="16"
                    /></span
                  >
                  <span>{canceledStepLabels[stepStatus]}</span>
                </li>
              {/each}
            </ul>
          </div>
        {:else}
          <div
            class="grid gap-3 md:grid-cols-[200px_minmax(240px,1fr)_200px] items-center"
          >
            <div class="text-left">
              <p><strong>Estado:</strong></p>
            </div>
            <div>
              <ul class="steps steps-sm w-full max-w-3xl mx-auto">
                {#each linearStatuses as stepStatus}
                  <li
                    class={`step ${isStepReached(selectedOrder.status, stepStatus) ? "step-primary" : ""} text-center`}
                  >
                    <span class="step-icon"
                      ><Icon
                        icon={stepStatus === selectedOrder.status
                          ? statusStepIconsActive[stepStatus]
                          : statusStepIconsStatic[stepStatus]}
                        width="16"
                        height="16"
                      /></span
                    >
                    <button
                      class="cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit disabled:cursor-default"
                      type="button"
                      onclick={() =>
                        onHandleStepClick(selectedOrder, stepStatus)}
                      disabled={!onCanChangeToStep(selectedOrder, stepStatus)}
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
                  <span class={kitchenBadge(selectedOrder)?.className}
                    >{kitchenBadge(selectedOrder)?.text}</span
                  >
                {/if}
                {#if selectedOrder.status === "recibida" && isAdmin}
                  <button
                    class="btn btn-xs btn-soft btn-error"
                    onclick={() => onOpenReject(selectedOrder.id)}
                  >
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
            <th class="w-[30%] text-right font-bold"
              >{amountColumnLabel(selectedOrder.status)}</th
            >
          </tr>
        </thead>
        <tbody>
          {#if !selectedOrder.items || selectedOrder.items.length === 0}
            <tr><td colspan="3">Sin items</td></tr>
          {:else}
            {#each selectedOrder.items as item}
              <tr>
                <td>
                  <div>{item.product_name}</div>
                  {#if item.customizations}
                    {#if item.customizations.flavor_name}
                      <div class="text-xs text-base-content/60">
                        Sabor: {item.customizations.flavor_name}
                      </div>
                    {/if}
                    {#if Array.isArray(item.customizations.addon_names) && item.customizations.addon_names.length > 0 && !Array.isArray(item.customizations.included_addon_names) && !Array.isArray(item.customizations.extra_addon_names)}
                      <div class="text-xs text-base-content/60">
                        Complementos: {item.customizations.addon_names.join(
                          ", ",
                        )}
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
                      <div class="text-xs text-base-content/60">
                        Extras: {item.customizations.extra_addon_names.join(
                          ", ",
                        )}
                      </div>
                    {/if}
                    {#if item.customizations.notes}
                      <div class="text-xs text-base-content/60">
                        Nota: {item.customizations.notes}
                      </div>
                    {/if}
                  {/if}
                </td>
                <td class="text-center">{item.quantity}</td>
                <td class="text-right">{formatCurrency(item.subtotal)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    <div class="mt-3 flex justify-end">
      <div
        class="rounded-xl border border-base-300/60 bg-base-200/40 px-4 py-2 text-right"
      >
        <p
          class="text-xs font-semibold uppercase tracking-wide text-base-content/60"
        >
          Total de la orden
        </p>
        <p class="text-lg font-bold text-primary">
          {formatCurrency(selectedOrder.total_amount)}
        </p>
      </div>
    </div>
  </div>
</div>
