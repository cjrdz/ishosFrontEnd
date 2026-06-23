<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import type { InventoryItem } from "@features/admin-management/lib/bff";

  interface Props {
    open: boolean;
    item: InventoryItem | null;
    onClose: () => void;
    onSubmit: (payload: { quantity: number; reason: string }) => void;
  }

  let { open, item, onClose, onSubmit }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let form = $state({
    quantity: 0,
    reason: "",
  });

  let currentStock = $derived(item?.current_stock ?? 0);
  let newStock = $derived(currentStock + form.quantity);
  let canSubmit = $derived(
    form.quantity !== 0 && form.reason.trim() && newStock >= 0,
  );

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function resetForm() {
    form = { quantity: 0, reason: "" };
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      quantity: form.quantity,
      reason: form.reason.trim(),
    });
    resetForm();
  }
</script>

<AdminModalShell
  bind:dialogRef
  title={`Ajuste: ${item?.name ?? "--"}`}
  icon="lucide:sliders-horizontal"
  widthClass="max-w-md"
  {onClose}
>
  <form class="space-y-4" onsubmit={handleSubmit}>
    <div class="space-y-3 rounded-lg border border-base-300/70 p-3">
      <div class="form-control">
        <span class="label-text text-xs mb-1">Cantidad de ajuste</span>
        <span class="label-text-alt text-xs text-base-content/60"
          >Negativo para restar</span
        >
        <input
          type="number"
          class="input input-bordered input-sm w-full"
          bind:value={form.quantity}
          placeholder="Ej: -10 o 20"
          required
        />
      </div>

      <div class="form-control">
        <span class="label-text text-xs mb-1">Razón</span>
        <input
          type="text"
          class="input input-bordered input-sm w-full"
          bind:value={form.reason}
          placeholder="Ej: Daños, vencimiento, conteo físico"
          required
        />
      </div>
    </div>

    <div class="alert alert-info text-sm">
      <span>
        Stock actual: <strong>{currentStock}</strong>
        {item?.type === "ball_based" ? "bolas" : "unidades"}
      </span>
    </div>

    {#if form.quantity !== 0}
      <div class="alert alert-warning text-sm">
        <span>
          Nuevo stock estimado:
          <strong>{newStock}</strong>
        </span>
      </div>
    {/if}

    <AdminFormActions
      submitLabel="Registrar Ajuste"
      onCancel={onClose}
      disabled={!canSubmit}
    />
  </form>
</AdminModalShell>
