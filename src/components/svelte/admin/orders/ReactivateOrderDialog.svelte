<script lang="ts">
  interface Props {
    open: boolean;
    busy: boolean;
    reactivateReason: string;
    reactivateError: string;
    onReactivateReasonChange: (value: string) => void;
    onConfirm: () => void;
    onClose: () => void;
  }

  let { open, busy, reactivateReason, reactivateError, onReactivateReasonChange, onConfirm, onClose }: Props = $props();
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
  <div class="modal-box">
    <h3 class="font-bold text-lg">Aceptar orden rechazada</h3>
    <p class="text-sm text-base-content/70">Indica el motivo de reactivacion para dejar registro.</p>
    <textarea
      class="textarea textarea-bordered w-full mt-3"
      rows="4"
      placeholder="Motivo de reactivacion"
      value={reactivateReason}
      oninput={(event) => onReactivateReasonChange((event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>
    {#if reactivateError}
      <p class="mt-2 text-sm text-error">{reactivateError}</p>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={onClose}>Cancelar</button>
      <button class="btn btn-success" type="button" onclick={onConfirm} disabled={busy}>Aceptar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="button" onclick={onClose}>close</button></form>
</dialog>
