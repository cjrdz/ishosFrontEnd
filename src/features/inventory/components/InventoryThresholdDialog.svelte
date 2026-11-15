<script lang="ts">
  /**
   * Sets the minimum ("mínimo") of one inventory item at the working
   * location. It decides the status shown everywhere: 0 = Agotado, below the
   * minimum = Stock bajo, the minimum or more = OK.
   */
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import type { InventoryItem } from "@features/admin-management/lib/bff";

  interface Props {
    open: boolean;
    item: InventoryItem | null;
    onClose: () => void;
    onSubmit: (threshold: number) => void;
  }

  let { open, item, onClose, onSubmit }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let threshold = $state(0);

  const unit = $derived(item?.type === "ball_based" ? "bolas" : "unidades");
  const valid = $derived(
    Number.isInteger(threshold) && threshold >= 0 && threshold <= 100000,
  );

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      threshold = item?.low_stock_threshold ?? 0;
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (valid) onSubmit(threshold);
  }
</script>

<AdminModalShell
  bind:dialogRef
  title={`Mínimo de ${item?.name ?? "--"}`}
  icon="lucide:gauge"
  widthClass="max-w-md"
  {onClose}
>
  <form class="space-y-4" onsubmit={handleSubmit}>
    <label class="form-control">
      <span class="label-text mb-1 text-sm">Mínimo ({unit})</span>
      <input
        type="number"
        min="0"
        max="100000"
        step="1"
        inputmode="numeric"
        class="input input-bordered w-full"
        bind:value={threshold}
        required
      />
    </label>

    <ul class="space-y-1.5 rounded-box bg-base-200 p-3 text-sm">
      <li class="flex items-center gap-2">
        <span class="status-chip status-chip--sm status-chip--late"
          >Agotado</span
        >
        con 0 {unit}
      </li>
      <li class="flex items-center gap-2">
        <span class="status-chip status-chip--sm status-chip--review"
          >Stock bajo</span
        >
        con menos de {valid ? threshold : "—"}
        {unit}
      </li>
      <li class="flex items-center gap-2">
        <span class="status-chip status-chip--sm status-chip--ready">OK</span>
        con {valid ? threshold : "—"}
        {unit} o más
      </li>
    </ul>
    <p class="text-xs text-ink-muted">
      Aplica solo a esta sucursal. Pon 0 si no quieres aviso de stock bajo.
    </p>

    <AdminFormActions
      submitLabel="Guardar mínimo"
      onCancel={onClose}
      disabled={!valid}
    />
  </form>
</AdminModalShell>
