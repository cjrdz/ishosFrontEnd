<script lang="ts">
  import type { Order } from "@features/admin-management";

  interface Props {
    open: boolean;
    busy: boolean;
    printTarget: Order | null;
    onConfirm: () => void;
    onClose: () => void;
  }

  let { open, busy, printTarget, onConfirm, onClose }: Props = $props();
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
    <h3 class="font-bold text-lg">Orden lista</h3>
    <p class="text-sm text-base-content/70">
      {#if printTarget}
        La orden {printTarget.order_number} pasara a estado lista.
      {/if}
    </p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={onClose}
        >Cancelar</button
      >
      <button
        class="btn btn-primary"
        type="button"
        onclick={onConfirm}
        disabled={busy}>Confirmar</button
      >
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>
