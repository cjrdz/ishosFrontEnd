<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";

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

<AdminModalShell
  bind:dialogRef
  title="Rechazar orden"
  icon="lucide:x-circle"
  widthClass="max-w-md"
  {onClose}
>
  <p class="text-sm text-base-content/70">
    Indica el motivo del rechazo para dejar registro.
  </p>
  <textarea
    class="textarea textarea-bordered w-full"
    rows="4"
    placeholder="Motivo"
    value={rejectReason}
    oninput={(event) =>
      onRejectReasonChange((event.currentTarget as HTMLTextAreaElement).value)}
  ></textarea>
  {#if rejectError}
    <p class="text-sm text-error">{rejectError}</p>
  {/if}
  <AdminFormActions
    submitLabel="Rechazar"
    submitType="button"
    submitVariant="error"
    onSubmit={onConfirm}
    onCancel={onClose}
    {busy}
  />
</AdminModalShell>
