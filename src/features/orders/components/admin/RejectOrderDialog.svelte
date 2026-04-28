<script lang="ts">
  interface Props {
    open: boolean;
    busy: boolean;
    rejectReason: string;
    rejectError: string;
    onRejectReasonChange: (value: string) => void;
    onConfirm: () => void;
    onClose: () => void;
  }

  let {
    open,
    busy,
    rejectReason,
    rejectError,
    onRejectReasonChange,
    onConfirm,
    onClose,
  }: Props = $props();
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
    <h3 class="font-bold text-lg">Rechazar orden</h3>
    <p class="text-sm text-base-content/70">
      Indica el motivo del rechazo para dejar registro.
    </p>
    <textarea
      class="textarea textarea-bordered w-full mt-3"
      rows="4"
      placeholder="Motivo"
      value={rejectReason}
      oninput={(event) =>
        onRejectReasonChange(
          (event.currentTarget as HTMLTextAreaElement).value,
        )}
    ></textarea>
    {#if rejectError}
      <p class="mt-2 text-sm text-error">{rejectError}</p>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={onClose}
        >Cancelar</button
      >
      <button
        class="btn btn-error"
        type="button"
        onclick={onConfirm}
        disabled={busy}>Rechazar</button
      >
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>
