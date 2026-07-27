<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
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

<AdminModalShell
  bind:dialogRef
  title={`Historial: ${item?.name ?? "--"}`}
  icon="lucide:clock"
  widthClass="max-w-2xl"
  {onClose}
>
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

  <div class="flex justify-end">
    <button class="btn btn-ghost" type="button" onclick={onClose}>Cerrar</button
    >
  </div>
</AdminModalShell>
