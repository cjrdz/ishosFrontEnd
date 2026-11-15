<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";

  interface Props {
    open: boolean;
    busy: boolean;
    rejectReason: string;
    rejectError: string;
    /**
     * "cancel" for an accepted order (or one in preparation): it is
     * cancelled and any stock it took goes back to inventory.
     */
    mode?: "reject" | "cancel";
    onRejectReasonChange: (value: string) => void;
    onConfirm: () => void;
    onClose: () => void;
  }

  let {
    open,
    busy,
    rejectReason,
    rejectError,
    mode = "reject",
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
  title={mode === "cancel" ? "Cancelar orden" : "Rechazar orden"}
  icon="lucide:x-circle"
  widthClass="max-w-md"
  {onClose}
>
  <p class="text-sm text-base-content/70">
    {#if mode === "cancel"}
      La orden se cancela y lo que ya se descontó del inventario vuelve al
      stock. Si ya se cobró, devuelve el dinero al cliente. Indica el motivo
      para dejar registro.
    {:else}
      Indica el motivo del rechazo para dejar registro.
    {/if}
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
    submitLabel={mode === "cancel" ? "Cancelar orden" : "Rechazar"}
    submitType="button"
    submitVariant="error"
    onSubmit={onConfirm}
    onCancel={onClose}
    {busy}
  />
</AdminModalShell>
