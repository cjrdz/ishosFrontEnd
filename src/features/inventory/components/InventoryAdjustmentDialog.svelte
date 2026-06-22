<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
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

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div
    class="modal-box w-11/12 md:max-w-md max-h-[90vh] overflow-y-auto p-0 animate-scaleIn"
  >
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10"
        >
          <Icon
            icon="lucide:sliders-horizontal"
            width="16"
            height="16"
            class="text-warning"
          />
        </div>
        <h3 class="font-bold text-base leading-tight">
          Ajuste: {item?.name ?? "--"}
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

    <form class="p-5 space-y-5" onsubmit={handleSubmit}>
      <div class="space-y-3 rounded-lg border border-base-300/70 p-3">
        <div class="form-control w-full">
          <span class="label-text mb-1">Cantidad de ajuste</span>
          <span class="label-text-alt text-base-content/60"
            >Negativo para restar</span
          >
          <input
            type="number"
            class="input input-bordered w-full"
            bind:value={form.quantity}
            placeholder="Ej: -10 o 20"
            required
          />
        </div>

        <div class="form-control w-full">
          <span class="label-text mb-1">Razón</span>
          <input
            type="text"
            class="input input-bordered w-full"
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

      <div class="flex flex-wrap gap-2 pt-1">
        <button class="btn btn-primary" type="submit" disabled={!canSubmit}>
          Registrar Ajuste
        </button>
        <button type="button" class="btn btn-ghost" onclick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
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
