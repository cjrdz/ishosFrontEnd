<script lang="ts">
  /**
   * Kitchen board: active orders in one column per stage, oldest first, with
   * the next step one tap away. Advancing waits a few seconds with "Deshacer"
   * before it is sent, so a mis-tap never reaches the customer's tracking page.
   * "Lista" keeps the existing print prompt, and rejecting keeps its
   * reason dialog; both come from the parent.
   */
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import type { Order } from "@features/admin-management";
  import { listOrders } from "@features/admin-management/lib/bff";
  import { formatCurrency } from "@shared/utils/formatters";
  import { motionMs, pulse } from "@shared/motion/motion";
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { undoableAction } from "@shared/toast/toast";

  type ActiveStatus =
    "pendiente_revision" | "recibida" | "en_proceso" | "lista";

  interface Props {
    /** Changes whenever the dashboard reloads orders; the board refetches. */
    refreshKey?: unknown;
    onOpenOrder: (orderId: string) => void;
    /** Sends the status change; resolves null when it failed. */
    onAdvance: (
      order: Order,
      next: "recibida" | "en_proceso" | "entregada",
    ) => Promise<Order | null>;
    /** Moving to "lista" goes through the print prompt. */
    onRequestReady: (order: Order) => void;
    onRequestReject: (orderId: string) => void;
    /** Prints the comanda for whoever prepares the order. */
    onPrintKitchen: (order: Order) => void;
  }

  let {
    refreshKey,
    onOpenOrder,
    onAdvance,
    onRequestReady,
    onRequestReject,
    onPrintKitchen,
  }: Props = $props();

  const ACTIVE: ActiveStatus[] = [
    "pendiente_revision",
    "recibida",
    "en_proceso",
    "lista",
  ];
  const COLUMNS: { status: ActiveStatus; title: string; empty: string }[] = [
    {
      status: "pendiente_revision",
      title: "Por revisar",
      empty: "Sin pedidos nuevos",
    },
    { status: "recibida", title: "Aceptadas", empty: "Nada en espera" },
    { status: "en_proceso", title: "Preparando", empty: "Nada en preparación" },
    { status: "lista", title: "Listas", empty: "Nada por entregar" },
  ];
  const NEXT: Record<
    ActiveStatus,
    {
      label: string;
      status: "recibida" | "en_proceso" | "lista" | "entregada";
      icon: string;
    }
  > = {
    pendiente_revision: {
      label: "Aceptar",
      status: "recibida",
      icon: "lucide:check",
    },
    recibida: {
      label: "Preparar",
      status: "en_proceso",
      icon: "lucide:chef-hat",
    },
    en_proceso: { label: "Lista", status: "lista", icon: "lucide:bell" },
    lista: {
      label: "Entregada",
      status: "entregada",
      icon: "lucide:check-check",
    },
  };
  const STATUS_TEXT: Record<string, string> = {
    recibida: "Aceptada",
    en_proceso: "Preparando",
    entregada: "Entregada",
  };

  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let loadError = $state("");
  let now = $state(Date.now());
  /** Status shown while an undoable change is pending (order id → status). */
  let overrides = $state<Record<string, string>>({});
  let knownIds = new Set<string>();
  const cardRefs: Record<string, HTMLElement> = {};

  const columns = $derived(
    COLUMNS.map((column) => {
      const inColumn = orders
        .filter(
          (order) => (overrides[order.id] ?? order.status) === column.status,
        )
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      // Orders left open from earlier days fold away so today's queue stays on screen.
      return {
        ...column,
        count: inColumn.length,
        orders: inColumn.filter((order) => !isFromEarlierDay(order)),
        older: inColumn.filter(isFromEarlierDay),
      };
    }),
  );

  function isFromEarlierDay(order: Order): boolean {
    if (!order.created_at) return false;
    const created = new Date(order.created_at);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return created.getTime() < today.getTime();
  }

  async function load() {
    try {
      const { orders: active } = await listOrders(
        ACTIVE.join(","),
        false,
        1,
        100,
        {
          withItems: true,
        },
      );
      const fresh =
        knownIds.size > 0 ? active.filter((o) => !knownIds.has(o.id)) : [];
      orders = active;
      knownIds = new Set(active.map((o) => o.id));
      loadError = "";
      // Let the new cards render, then draw the eye to them.
      requestAnimationFrame(() =>
        fresh.forEach((o) => void pulse(cardRefs[o.id])),
      );
    } catch {
      loadError = "No se pudieron cargar las órdenes activas.";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    refreshKey;
    void load();
  });

  onMount(() => {
    const clock = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(clock);
  });

  function waitingMinutes(order: Order): number {
    if (!order.created_at) return 0;
    return Math.max(
      0,
      Math.floor((now - new Date(order.created_at).getTime()) / 60_000),
    );
  }

  function formatWait(minutes: number): string {
    if (minutes < 1) return "ahora";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours >= 24
      ? `${Math.floor(hours / 24)} d`
      : `${hours} h ${minutes % 60} min`;
  }

  /** Neutral under 10 min, amber from 10, red from 20. */
  function waitTone(minutes: number): string {
    if (minutes >= 20) return "bg-error/15 text-error";
    if (minutes >= 10) return "bg-warning/25 text-base-content";
    return "bg-base-200 text-base-content/70";
  }

  function itemSummary(order: Order): string {
    const items = order.items ?? [];
    if (items.length === 0) return "";
    return items
      .map((item) => `${item.quantity}× ${item.product_name}`)
      .join(", ");
  }

  function shortNumber(order: Order): string {
    return `#${order.order_number.split("-").pop()}`;
  }

  function advance(order: Order) {
    const status = (overrides[order.id] ?? order.status) as ActiveStatus;
    const next = NEXT[status];
    if (next.status === "lista") {
      onRequestReady(order);
      return;
    }
    const target = next.status;
    overrides = { ...overrides, [order.id]: target };
    const clearOverride = () => {
      const { [order.id]: _, ...rest } = overrides;
      overrides = rest;
    };
    undoableAction({
      message: `${shortNumber(order)} → ${STATUS_TEXT[target]}`,
      undo: clearOverride,
      commit: async () => {
        const updated = await onAdvance(order, target);
        if (!updated) throw new Error("status change failed");
        orders = orders
          .map((o) =>
            o.id === updated.id ? { ...o, status: updated.status } : o,
          )
          .filter((o) => (ACTIVE as string[]).includes(o.status));
        clearOverride();
      },
      failureMessage: `No se pudo actualizar ${shortNumber(order)}. Se revirtió.`,
    });
  }
</script>

{#if loadError}
  <div class="alert alert-warning mb-3">
    <span>{loadError}</span>
    <button type="button" class="btn btn-sm" onclick={() => void load()}
      >Reintentar</button
    >
  </div>
{/if}

{#snippet cardBody(order: Order, status: ActiveStatus)}
  {@const minutes = waitingMinutes(order)}
  {@const next = NEXT[status]}
  <button
    type="button"
    class="board-card-open"
    onclick={() => onOpenOrder(order.id)}
    aria-label={`Ver detalle de ${order.order_number}`}
  ></button>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      <p class="font-bold tabular-nums">{shortNumber(order)}</p>
      <p class="truncate text-sm">{order.customer_name || "Cliente"}</p>
    </div>
    <span class={`badge badge-sm border-0 tabular-nums ${waitTone(minutes)}`}>
      {formatWait(minutes)}
    </span>
  </div>
  <p class="mt-1 text-xs text-base-content/70">
    {order.order_type === "en_local"
      ? order.table_number
        ? `Mesa ${order.table_number}`
        : "En local"
      : "Para llevar"}
    · {formatCurrency(order.total_amount)}
    {#if order.created_by_role && order.created_by_role !== "customer"}
      · Mostrador
    {:else}
      · En línea
    {/if}
  </p>
  {#if itemSummary(order)}
    <p class="mt-1 line-clamp-2 text-sm">{itemSummary(order)}</p>
  {/if}
  {#if order.notes}
    <p class="mt-1 line-clamp-2 text-xs italic text-base-content/70">
      “{order.notes}”
    </p>
  {/if}
  <div class="relative z-[1] mt-3 flex items-center gap-1.5">
    <button
      type="button"
      class="btn btn-primary btn-sm flex-1 rounded-full"
      onclick={() => advance(order)}
    >
      <Icon icon={next.icon} class="size-4" aria-hidden="true" />
      {next.label}
    </button>
    {#if status === "pendiente_revision"}
      <button
        type="button"
        class="btn btn-ghost btn-sm rounded-full"
        onclick={() => onRequestReject(order.id)}
      >
        Rechazar
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-ghost btn-sm btn-circle"
      onclick={() => onPrintKitchen(order)}
      aria-label={`Imprimir comanda de ${shortNumber(order)}`}
      title="Imprimir comanda"
    >
      <Icon icon="lucide:printer" class="size-4" aria-hidden="true" />
    </button>
  </div>
{/snippet}

<div class="orders-board" aria-busy={loading}>
  {#each columns as column (column.status)}
    <section class="board-column" aria-labelledby={`col-${column.status}`}>
      <header class="mb-2 flex items-center justify-between px-1">
        <h3 id={`col-${column.status}`} class="font-semibold">
          {column.title}
        </h3>
        <span class="badge badge-ghost tabular-nums">{column.count}</span>
      </header>

      <div class="board-column-body space-y-2">
        {#if loading}
          <div class="skeleton h-28 w-full rounded-box"></div>
        {:else if column.count === 0}
          <p
            class="rounded-box border border-dashed border-base-300 p-4 text-center text-sm text-base-content/60"
          >
            {column.empty}
          </p>
        {/if}

        {#each column.orders as order (order.id)}
          <!-- Advancing slides the card out of its column and into the next. -->
          <article
            class="board-card"
            animate:flip={{ duration: motionMs(260) }}
            in:fly={{ x: -24, duration: motionMs(240), delay: motionMs(80) }}
            out:fly={{ x: 24, duration: motionMs(180) }}
            bind:this={cardRefs[order.id]}
            aria-label={`Orden ${order.order_number}`}
          >
            {@render cardBody(order, column.status)}
          </article>
        {/each}

        {#if column.older.length > 0}
          <details class="board-older">
            <summary
              class="flex cursor-pointer items-center justify-between gap-2 rounded-field px-2 py-1.5 text-sm text-base-content/80 hover:bg-base-100"
            >
              <span class="flex items-center gap-1.5">
                <Icon icon="lucide:history" class="size-4" aria-hidden="true" />
                De días anteriores
              </span>
              <span class="badge badge-sm badge-warning tabular-nums"
                >{column.older.length}</span
              >
            </summary>
            <div class="mt-2 space-y-2">
              {#each column.older as order (order.id)}
                <article
                  class="board-card board-card-old"
                  bind:this={cardRefs[order.id]}
                  aria-label={`Orden ${order.order_number}`}
                >
                  {@render cardBody(order, column.status)}
                </article>
              {/each}
            </div>
          </details>
        {/if}
      </div>
    </section>
  {/each}
</div>

<style>
  .orders-board {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(16rem, 85%);
    gap: 0.75rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-bottom: 0.5rem;
  }

  /* Tablets: three whole columns at a time, swipe for the fourth. */
  @media (min-width: 640px) {
    .orders-board {
      grid-auto-columns: calc((100% - 1.5rem) / 3);
    }
  }

  @media (min-width: 1024px) {
    .orders-board {
      grid-auto-flow: row;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      overflow: visible;
    }
  }

  .board-column {
    scroll-snap-align: start;
    min-width: 0;
    padding: 0.75rem;
    border-radius: var(--radius-box);
    border: 1px solid var(--color-base-300);
    background: color-mix(
      in oklab,
      var(--color-base-200) 70%,
      var(--color-base-300)
    );
  }

  /* Long queues scroll inside their column instead of stretching the page. */
  .board-column-body {
    max-height: calc(100dvh - 15rem);
    min-height: 6rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.125rem;
  }

  .board-older > summary {
    list-style: none;
  }

  .board-older > summary::-webkit-details-marker {
    display: none;
  }

  .board-card-old {
    opacity: 0.85;
  }

  .board-card {
    position: relative;
    padding: 0.75rem;
    border-radius: calc(var(--radius-box) * 0.75);
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
  }

  /* Whole card opens the detail; the action buttons sit above this layer. */
  .board-card-open {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .board-card-open:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
