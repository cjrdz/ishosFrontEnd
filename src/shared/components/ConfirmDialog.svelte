<script lang="ts">
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";

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

<AdminModalShell
  bind:dialogRef
  {title}
  icon={variant === "error" ? "lucide:alert-triangle" : "lucide:help-circle"}
  widthClass="max-w-md"
  onClose={onCancel}
>
  <p class="text-sm text-base-content/70">{message}</p>
  <AdminFormActions
    submitLabel="Confirmar"
    submitType="button"
    submitVariant={variant}
    onSubmit={onConfirm}
    {onCancel}
    {busy}
  />
</AdminModalShell>
