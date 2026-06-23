<script lang="ts">
  interface Props {
    submitLabel: string;
    cancelLabel?: string;
    disabled?: boolean;
    busy?: boolean;
    submitVariant?: "primary" | "success" | "error" | "warning" | "accent";
    submitType?: "submit" | "button";
    onCancel: () => void;
    onSubmit?: () => void;
  }

  let {
    submitLabel,
    cancelLabel = "Cancelar",
    disabled = false,
    busy = false,
    submitVariant = "primary",
    submitType = "submit",
    onCancel,
    onSubmit,
  }: Props = $props();
</script>

<div class="flex flex-wrap gap-2 pt-1">
  <button
    class={`btn btn-${submitVariant}`}
    type={submitType}
    disabled={disabled || busy}
    onclick={onSubmit}
  >
    {#if busy}
      <span class="loading loading-spinner loading-xs"></span>
    {/if}
    {submitLabel}
  </button>
  <button class="btn btn-ghost" type="button" onclick={onCancel}>
    {cancelLabel}
  </button>
</div>
