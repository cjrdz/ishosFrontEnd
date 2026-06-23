<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
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

<AdminModalShell
  bind:dialogRef
  title="Orden lista"
  icon="lucide:printer"
  widthClass="max-w-md"
  {onClose}
>
  <p class="text-sm text-base-content/70">
    {#if printTarget}
      La orden {printTarget.order_number} pasara a estado lista.
    {/if}
  </p>
  <AdminFormActions
    submitLabel="Confirmar"
    submitType="button"
    onSubmit={onConfirm}
    onCancel={onClose}
    {busy}
  />
</AdminModalShell>
