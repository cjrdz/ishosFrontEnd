<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import type { Order } from "@features/admin-management";
  import {
    linearStatuses,
    statusLabels,
    statusBadgeClass,
    statusStepIconsActive,
    statusStepIconsStatic,
    kitchenBadge,
    isStepReached,
    suggestedNextStep,
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

  const PAYMENT_LABELS: Record<Order["payment_method"], string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
    otro: "Otro",
  };

  const shortNumber = $derived(
    `#${selectedOrder.order_number.split("-").pop() ?? selectedOrder.order_number}`,
  );
  const itemCount = $derived(
    (selectedOrder.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
  );
  const cashChange = $derived(
    selectedOrder.payment_method === "efectivo" &&
      selectedOrder.amount_received != null
      ? Math.max(0, selectedOrder.amount_received - selectedOrder.total_amount)
      : null,
  );
  // wa.me needs digits with country code; local 8-digit numbers are El Salvador.
  const whatsappLink = $derived.by(() => {
    const digits = (selectedOrder.customer_phone ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits.length === 8 ? `503${digits}` : digits}`;
  });

  function names(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }
</script>

<div class="flex flex-col gap-5 text-sm">
  <!-- Header: the number staff call out, its state, and when it came in. -->
  <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span class="font-display text-5xl font-bold leading-none"
      >{shortNumber}</span
    >
    <span class={`badge ${statusBadgeClass[selectedOrder.status]}`}>
      {statusLabels[selectedOrder.status]}
    </span>
    <span class="badge badge-ghost">
      {selectedOrder.order_type
        ? orderTypeLabel(selectedOrder.order_type)
        : "Sin tipo"}{selectedOrder.order_type === "en_local" &&
      selectedOrder.table_number
        ? ` · Mesa ${selectedOrder.table_number}`
        : ""}
    </span>
    {#if selectedOrder.created_at}
      <span class="text-base-content/65"
        >{formatAdminDate(selectedOrder.created_at)}</span
      >
    {/if}
    <span class="ml-auto flex items-center gap-1">
      <span class="hidden text-xs text-base-content/60 sm:inline"
        >{selectedOrder.order_number}</span
      >
      <button
        class="btn btn-ghost btn-xs btn-square"
        type="button"
        title="Copiar número de orden"
        aria-label="Copiar número de orden"
        onclick={() => onCopyToken(selectedOrder.order_number, "both")}
      >
        <Icon
          icon={tokenCopied === "both" ? "lucide:check" : "lucide:copy"}
          class="h-4 w-4"
        />
      </button>
      {#if trackingLink}
        <button
          class="btn btn-ghost btn-xs btn-square"
          type="button"
          title="Copiar enlace de seguimiento"
          aria-label="Copiar enlace de seguimiento"
          onclick={() => onCopyToken(trackingLink, "link")}
        >
          <Icon
            icon={tokenCopied === "link" ? "lucide:check" : "lucide:link"}
            class="h-4 w-4"
          />
        </button>
      {/if}
    </span>
  </header>

  <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
    <!-- Products + totals, read like the ticket. -->
    <section
      class="self-start overflow-hidden rounded-box border border-base-300 bg-base-100"
      aria-labelledby="detail-items"
    >
      <h4
        id="detail-items"
        class="border-b border-base-300 px-4 py-3 font-semibold"
      >
        Productos
      </h4>
      {#if !selectedOrder.items || selectedOrder.items.length === 0}
        <p class="px-4 py-6 text-center text-base-content/60">Sin productos</p>
      {:else}
        <ul class="divide-y divide-base-300">
          {#each selectedOrder.items as item (item.id ?? `${item.product_name}-${item.quantity}`)}
            {@const c = item.customizations}
            {@const flavorText = itemFlavorText(c)}
            {@const included = names(c?.included_addon_names)}
            {@const extras = names(c?.extra_addon_names)}
            {@const legacy = names(c?.addon_names)}
            {@const extraCost = extraAddonCost(c)}
            <li class="px-4 py-3">
              <div class="flex items-baseline gap-3">
                <span class="w-8 shrink-0 font-bold tabular-nums"
                  >{item.quantity}×</span
                >
                <span class="min-w-0 flex-1 font-semibold"
                  >{item.product_name}</span
                >
                <span class="shrink-0 font-semibold tabular-nums"
                  >{formatCurrency(item.subtotal)}</span
                >
              </div>
              <div class="mt-1 space-y-0.5 pl-11 text-base-content/70">
                {#if flavorText}
                  <p>Sabor: {flavorText}</p>
                {/if}
                {#if included.length}
                  <p>Incluye: {included.join(", ")}</p>
                {/if}
                {#if extras.length}
                  <p>
                    Extras: {extras.join(", ")}
                    {#if extraCost > 0}<span
                        class="font-medium text-base-content"
                      >
                        (+{formatCurrency(extraCost)})</span
                      >{/if}
                  </p>
                {/if}
                {#if legacy.length && !included.length && !extras.length}
                  <p>Complementos: {legacy.join(", ")}</p>
                {/if}
                {#if c?.notes}
                  <p class="italic">Nota: {c.notes}</p>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      <dl class="space-y-1.5 border-t border-base-300 bg-base-200/40 px-4 py-3">
        <div class="flex justify-between text-base-content/70">
          <dt>Artículos</dt>
          <dd class="tabular-nums">{itemCount}</dd>
        </div>
        <div class="flex items-baseline justify-between">
          <dt class="text-base font-bold">Total</dt>
          <dd class="text-2xl font-bold tabular-nums">
            {formatCurrency(selectedOrder.total_amount)}
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-base-content/70">Pago</dt>
          <dd class="font-medium">
            {PAYMENT_LABELS[selectedOrder.payment_method] ??
              selectedOrder.payment_method}
          </dd>
        </div>
        {#if cashChange !== null}
          <div class="flex justify-between">
            <dt class="text-base-content/70">Recibido</dt>
            <dd class="font-medium tabular-nums">
              {formatCurrency(selectedOrder.amount_received ?? 0)}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-base-content/70">Cambio</dt>
            <dd class="font-semibold tabular-nums">
              {formatCurrency(cashChange)}
            </dd>
          </div>
        {/if}
      </dl>
    </section>

    <div class="flex flex-col gap-4">
      <!-- Customer -->
      <section
        class="rounded-box border border-base-300 bg-base-100 p-4"
        aria-labelledby="detail-customer"
      >
        <h4 id="detail-customer" class="mb-2 font-semibold">Cliente</h4>
        <p class="text-base font-semibold">
          {selectedOrder.customer_name || "Sin nombre"}
        </p>
        {#if selectedOrder.customer_phone}
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <a
              class="link link-hover tabular-nums"
              href={`tel:${selectedOrder.customer_phone}`}
              >{selectedOrder.customer_phone}</a
            >
            {#if whatsappLink}
              <a
                class="btn btn-ghost btn-xs gap-1"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon
                  icon="mdi:whatsapp"
                  class="h-4 w-4"
                  aria-hidden="true"
                />WhatsApp
              </a>
            {/if}
          </div>
        {/if}
        <p class="mt-2 text-base-content/65">
          Creada por {createdByLabel(selectedOrder, employeeById)}
        </p>
      </section>

      {#if selectedOrder.notes?.trim()}
        <section
          class="rounded-box border border-warning/50 bg-warning/10 p-4"
          aria-label="Nota de la orden"
        >
          <h4 class="mb-1 flex items-center gap-1.5 font-semibold">
            <Icon
              icon="lucide:sticky-note"
              class="h-4 w-4"
              aria-hidden="true"
            />Nota
          </h4>
          <p class="whitespace-pre-line">{selectedOrder.notes}</p>
        </section>
      {/if}

      <!-- Status: one vertical stepper; tap the next step to advance. -->
      <section
        class="rounded-box border border-base-300 bg-base-100 p-4"
        aria-labelledby="detail-status"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <h4 id="detail-status" class="font-semibold">Estado</h4>
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
          {:else if (selectedOrder.status === "recibida" || selectedOrder.status === "pendiente_revision") && isAdmin}
            <button
              class="btn btn-xs btn-soft btn-error"
              type="button"
              onclick={() => onOpenReject(selectedOrder.id)}
            >
              Rechazar
            </button>
          {/if}
        </div>

        {#if selectedOrder.status === "cancelada"}
          <div class="space-y-1">
            <span class="badge badge-error">Orden rechazada</span>
            {#if selectedOrder.rejection_reason}
              <p class="text-base-content/70">
                Motivo: {selectedOrder.rejection_reason}
              </p>
            {/if}
            {#if stepTimestamp("cancelada")}
              <p class="text-xs text-base-content/60">
                {stepTimestamp("cancelada")}
              </p>
            {/if}
          </div>
          <span class="sr-only" aria-live="polite" aria-atomic="true"
            >{canceledStepAnnouncement}</span
          >
        {:else}
          <ol
            class="detail-steps"
            role="progressbar"
            aria-valuenow={statusIndex + 1}
            aria-valuemin={1}
            aria-valuemax={linearStatuses.length}
            aria-label="Progreso del pedido"
          >
            {#each linearStatuses as stepStatus (stepStatus)}
              {@const reached = isStepReached(selectedOrder.status, stepStatus)}
              {@const current = selectedOrder.status === stepStatus}
              {@const isHint =
                stepStatus === suggestedNext && !current && !reached}
              {@const canChange = onCanChangeToStep(selectedOrder, stepStatus)}
              <li
                class="detail-step"
                class:detail-step--reached={reached}
                aria-current={current ? "step" : undefined}
              >
                <button
                  type="button"
                  class="detail-step__node"
                  class:detail-step__node--current={current}
                  class:detail-step__node--hint={isHint}
                  onclick={() => onHandleStepClick(selectedOrder, stepStatus)}
                  disabled={!canChange}
                  aria-label={`Actualizar estado a ${statusLabels[stepStatus]}`}
                >
                  <Icon
                    icon={current
                      ? statusStepIconsActive[stepStatus]
                      : statusStepIconsStatic[stepStatus]}
                    width="16"
                    height="16"
                  />
                </button>
                <div class="min-w-0">
                  <p
                    class={`font-semibold ${current ? "text-primary" : reached ? "" : "text-base-content/50"}`}
                  >
                    {statusLabels[stepStatus]}
                    {#if isHint && canChange}<span
                        class="ml-1 text-xs font-medium text-base-content/60"
                        >· siguiente</span
                      >{/if}
                  </p>
                  {#if stepTimestamp(stepStatus)}
                    <p class="text-xs text-base-content/60">
                      {stepTimestamp(stepStatus)}
                    </p>
                  {/if}
                </div>
              </li>
            {/each}
          </ol>
          {#if kitchenBadge(selectedOrder)}
            <span class={`mt-2 ${kitchenBadge(selectedOrder)?.className}`}
              >{kitchenBadge(selectedOrder)?.text}</span
            >
          {/if}
          <span class="sr-only" aria-live="polite" aria-atomic="true"
            >{stepAnnouncement}</span
          >
        {/if}
      </section>

      {#if selectedOrder.tracking_token}
        <details class="rounded-box border border-base-300 bg-base-100 p-4">
          <summary class="cursor-pointer font-semibold"
            >Seguimiento del cliente</summary
          >
          <div class="mt-3 space-y-2">
            {#if selectedOrder.tracking_token_expires_at}
              <p class="text-xs text-base-content/60">
                El enlace vence el {new Date(
                  selectedOrder.tracking_token_expires_at,
                ).toLocaleDateString("es-SV", { dateStyle: "medium" })}
              </p>
            {/if}
            <div class="flex items-center gap-2">
              <code
                class="min-w-0 flex-1 truncate rounded border border-base-300 bg-base-200 px-2 py-1.5 font-mono text-xs select-all"
              >
                {tokenVisible
                  ? selectedOrder.tracking_token
                  : "\u2022".repeat(24)}
              </code>
              <button
                class="btn btn-ghost btn-xs btn-square"
                type="button"
                title={tokenVisible ? "Ocultar token" : "Revelar token"}
                aria-label={tokenVisible ? "Ocultar token" : "Revelar token"}
                onclick={onToggleTokenVisibility}
              >
                <Icon
                  icon={tokenVisible ? "lucide:eye-off" : "lucide:eye"}
                  class="h-4 w-4"
                />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square"
                type="button"
                title="Copiar token"
                aria-label="Copiar token"
                onclick={() =>
                  onCopyToken(selectedOrder.tracking_token!, "token")}
              >
                <Icon
                  icon={tokenCopied === "token"
                    ? "lucide:check"
                    : "lucide:copy"}
                  class="h-4 w-4"
                />
              </button>
            </div>
          </div>
        </details>
      {/if}
    </div>
  </div>
</div>

<style>
  .detail-steps {
    display: grid;
    gap: 0;
  }
  .detail-step {
    position: relative;
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr);
    gap: 0.75rem;
    padding-bottom: 0.9rem;
  }
  .detail-step:last-child {
    padding-bottom: 0;
  }
  /* Connector between nodes; filled up to the current step. */
  .detail-step:not(:last-child)::after {
    content: "";
    position: absolute;
    left: calc(1.125rem - 1px);
    top: 2.25rem;
    bottom: 0;
    width: 2px;
    background: var(--color-base-300);
  }
  .detail-step--reached:not(:last-child)::after {
    background: var(--color-primary);
  }
  .detail-step__node {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    border: 2px solid var(--color-base-300);
    background: var(--color-base-100);
    color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
    transition:
      background-color var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .detail-step--reached .detail-step__node {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }
  .detail-step__node--current {
    box-shadow: 0 0 0 4px
      color-mix(in oklab, var(--color-primary) 25%, transparent);
  }
  .detail-step__node--hint {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .detail-step__node:not(:disabled):hover {
    border-color: var(--color-primary);
  }
  .detail-step__node:disabled {
    cursor: default;
  }
  .detail-step__node:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
