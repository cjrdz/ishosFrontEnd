<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import type {
    InventoryItem,
    StockMovement,
  } from "@features/admin-management/lib/bff";

  interface Props {
    open: boolean;
    item: InventoryItem | null;
    movements: StockMovement[];
    onClose: () => void;
  }

  let { open, item, movements, onClose }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div
    class="modal-box w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto p-0 animate-scaleIn"
  >
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"
        >
          <Icon
            icon="lucide:clock"
            width="16"
            height="16"
            class="text-primary"
          />
        </div>
        <h3 class="font-bold text-base leading-tight">
          Historial: {item?.name ?? "--"}
        </h3>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        type="button"
        onclick={onClose}
        aria-label="Cerrar"
      >
        <Icon icon="lucide:x" width="16" height="16" />
      </button>
    </div>

    <div class="p-5">
      {#if movements.length > 0}
        <div
          class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
        >
          <table class="table table-sm">
            <thead class="bg-base-200/60 text-base-content">
              <tr>
                <th class="font-bold">Fecha</th>
                <th class="font-bold">Tipo</th>
                <th class="text-right font-bold">Cantidad</th>
                <th class="font-bold">Razón</th>
              </tr>
            </thead>
            <tbody>
              {#each movements as m (m.id)}
                <tr class="hover:bg-base-200/50 transition-colors">
                  <td class="text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString("es-SV")}
                  </td>
                  <td>
                    <span
                      class="badge badge-sm"
                      class:badge-success={m.type === "entry"}
                      class:badge-error={m.type === "sale"}
                      class:badge-warning={m.type === "adjustment"}
                    >
                      {m.type === "entry"
                        ? "Entrada"
                        : m.type === "sale"
                          ? "Venta"
                          : "Ajuste"}
                    </span>
                  </td>
                  <td class="text-right font-mono">
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td class="text-xs">{m.reason || "-"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-6 text-base-content/50">
          No hay movimientos registrados
        </div>
      {/if}
    </div>
    <div class="modal-action px-5 pb-5">
      <button class="btn btn-ghost" onclick={onClose}>Cerrar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>

<style>
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-scaleIn {
    animation: scaleIn 0.2s ease-out;
  }
</style>
