<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";

  interface Props {
    open: boolean;
    busy: boolean;
    reactivateReason: string;
    reactivateError: string;
    onReactivateReasonChange: (value: string) => void;
    onConfirm: () => void;
    onClose: () => void;
  }

  let {
    open,
    busy,
    reactivateReason,
    reactivateError,
    onReactivateReasonChange,
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

<AdminModalShell
  bind:dialogRef
  title="Aceptar orden rechazada"
  icon="lucide:check-circle"
  widthClass="max-w-md"
  {onClose}
>
  <p class="text-sm text-base-content/70">
    Indica el motivo de reactivacion para dejar registro.
  </p>
  <textarea
    class="textarea textarea-bordered w-full"
    rows="4"
    placeholder="Motivo de reactivacion"
    value={reactivateReason}
    oninput={(event) =>
      onReactivateReasonChange(
        (event.currentTarget as HTMLTextAreaElement).value,
      )}
  ></textarea>
  {#if reactivateError}
    <p class="text-sm text-error">{reactivateError}</p>
  {/if}
  <AdminFormActions
    submitLabel="Aceptar"
    submitType="button"
    submitVariant="success"
    onSubmit={onConfirm}
    onCancel={onClose}
    {busy}
  />
</AdminModalShell>
