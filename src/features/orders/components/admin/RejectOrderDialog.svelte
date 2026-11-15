<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import {
    getOrderStock,
    type OrderStockLine,
  } from "@features/admin-management/lib/bff";

  type Restock = { inventory_item_id: string; quantity: number }[];

  interface Props {
    open: boolean;
    busy: boolean;
    rejectReason: string;
    rejectError: string;
    /**
     * "cancel" for an accepted order (or one in preparation or ready): it is
     * cancelled and staff choose what it took goes back to stock.
     */
    mode?: "reject" | "cancel";
    /** Order being cancelled (cancel mode: loads what it took). */
    orderId?: string | null;
    /** Its status: served ice cream of a "lista" order does not go back. */
    orderStatus?: string | null;
    onRejectReasonChange: (value: string) => void;
    /** restock is sent in cancel mode once the order's stock is known. */
    onConfirm: (restock?: Restock) => void;
    onClose: () => void;
  }

  let {
    open,
    busy,
    rejectReason,
    rejectError,
    mode = "reject",
    orderId = null,
    orderStatus = null,
    onRejectReasonChange,
    onConfirm,
    onClose,
  }: Props = $props();
  let dialogRef = $state<HTMLDialogElement | null>(null);

  let lines = $state<OrderStockLine[]>([]);
  let back = $state<Record<string, number>>({});
  let stockState = $state<"idle" | "loading" | "ready" | "error">("idle");

  const lost = $derived(
    lines
      .map((l) => ({
        ...l,
        lost: l.quantity - (back[l.inventory_item_id] ?? 0),
      }))
      .filter((l) => l.lost > 0),
  );

  function unit(line: OrderStockLine, n: number) {
    if (line.type === "ball_based") return n === 1 ? "bola" : "bolas";
    return n === 1 ? "unidad" : "unidades";
  }

  async function loadStock(id: string) {
    stockState = "loading";
    try {
      lines = await getOrderStock(id);
      // Sealed products (water, sodas) usually go back. Ice cream already
      // scooped for a ready order does not; in preparation it may not be yet.
      back = Object.fromEntries(
        lines.map((l) => [
          l.inventory_item_id,
          l.type === "ball_based" && orderStatus === "lista" ? 0 : l.quantity,
        ]),
      );
      stockState = "ready";
    } catch {
      lines = [];
      stockState = "error";
    }
  }

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      lines = [];
      back = {};
      stockState = "idle";
      if (mode === "cancel" && orderId) void loadStock(orderId);
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function setBack(line: OrderStockLine, value: number) {
    const n = Number.isFinite(value) ? Math.round(value) : 0;
    back = {
      ...back,
      [line.inventory_item_id]: Math.min(line.quantity, Math.max(0, n)),
    };
  }

  function confirm() {
    if (mode !== "cancel" || stockState !== "ready") {
      onConfirm();
      return;
    }
    onConfirm(
      lines.map((l) => ({
        inventory_item_id: l.inventory_item_id,
        quantity: back[l.inventory_item_id] ?? 0,
      })),
    );
  }
</script>

<AdminModalShell
  bind:dialogRef
  title={mode === "cancel" ? "Cancelar orden" : "Rechazar orden"}
  icon="lucide:x-circle"
  widthClass="max-w-md"
  {onClose}
>
  {#if mode === "cancel"}
    <p class="text-sm text-base-content/70">
      La orden se cancela. Si ya se cobró, devuelve el dinero al cliente.
    </p>

    {#if stockState === "loading"}
      <div class="skeleton h-16 w-full"></div>
    {:else if stockState === "error"}
      <p class="text-sm text-error" role="alert">
        No se pudo cargar el stock de la orden. Si continúas, todo lo que
        descontó vuelve al inventario.
      </p>
    {:else if stockState === "ready" && lines.length > 0}
      <fieldset class="space-y-2">
        <legend class="mb-1 text-sm font-semibold"
          >¿Qué vuelve al inventario?</legend
        >
        {#each lines as line (line.inventory_item_id)}
          <label
            class="flex items-center justify-between gap-3 rounded-box border border-base-300 px-3 py-2"
          >
            <span class="min-w-0">
              <span class="block truncate font-medium">{line.name}</span>
              <span class="block text-xs text-ink-muted"
                >Descontó {line.quantity}
                {unit(line, line.quantity)}</span
              >
            </span>
            <span class="flex items-center gap-2 text-sm">
              Devolver
              <input
                type="number"
                class="input input-bordered input-sm w-20 min-h-11"
                min="0"
                max={line.quantity}
                step="1"
                inputmode="numeric"
                value={back[line.inventory_item_id] ?? 0}
                aria-label={`Cantidad de ${line.name} que vuelve al inventario`}
                oninput={(e) =>
                  setBack(
                    line,
                    Number((e.currentTarget as HTMLInputElement).value),
                  )}
              />
            </span>
          </label>
        {/each}
      </fieldset>
      {#if lost.length > 0}
        <p class="rounded-box bg-st-review p-3 text-sm text-st-review-ink">
          Quedará como merma:
          {lost
            .map((l) => `${l.lost} ${unit(l, l.lost)} de ${l.name}`)
            .join(", ")}. El motivo queda en el historial de inventario.
        </p>
      {/if}
    {:else if stockState === "ready"}
      <p class="text-sm text-ink-muted">
        Esta orden no descontó inventario todavía.
      </p>
    {/if}

    <p class="text-sm font-medium">Motivo de la cancelación</p>
  {:else}
    <p class="text-sm text-base-content/70">
      Indica el motivo del rechazo para dejar registro.
    </p>
  {/if}
  <textarea
    class="textarea textarea-bordered w-full"
    rows="3"
    placeholder={mode === "cancel"
      ? "Ej: el cliente se fue, se derritió, error de cobro"
      : "Motivo"}
    aria-label={mode === "cancel"
      ? "Motivo de la cancelación"
      : "Motivo del rechazo"}
    value={rejectReason}
    oninput={(event) =>
      onRejectReasonChange((event.currentTarget as HTMLTextAreaElement).value)}
  ></textarea>
  {#if rejectError}
    <p class="text-sm text-error">{rejectError}</p>
  {/if}
  <AdminFormActions
    submitLabel={mode === "cancel" ? "Cancelar orden" : "Rechazar"}
    submitType="button"
    submitVariant="error"
    onSubmit={confirm}
    onCancel={onClose}
    disabled={stockState === "loading"}
    {busy}
  />
</AdminModalShell>
