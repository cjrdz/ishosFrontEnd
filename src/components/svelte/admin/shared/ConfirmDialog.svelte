<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message: string;
    busy?: boolean;
    variant?: "primary" | "error";
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    open,
    title = "Confirmar accion",
    message,
    busy = false,
    variant = "primary",
    onConfirm,
    onCancel,
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

<dialog
  class="modal"
  bind:this={dialogRef}
  onclose={() => {
    if (open) onCancel();
  }}
>
  <div class="modal-box">
    <h3 class="font-bold text-lg">{title}</h3>
    <p class="py-2 text-sm text-base-content/70">{message}</p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={onCancel}
        >Cancelar</button
      >
      <button
        class={`btn btn-${variant}`}
        type="button"
        onclick={onConfirm}
        disabled={busy}>Confirmar</button
      >
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onCancel}>close</button>
  </form>
</dialog>
