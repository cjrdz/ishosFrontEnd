<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    title: string;
    icon: string;
    onClose: () => void;
    onSubmit: (event: SubmitEvent) => void;
    submitLabel: string;
    submitDisabled?: boolean;
    cancelLabel?: string;
    children?: Snippet;
  }

  let {
    title,
    icon,
    onClose,
    onSubmit,
    submitLabel,
    submitDisabled = false,
    cancelLabel = "Cancelar",
    children,
  }: Props = $props();
</script>

<div
  class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4"
>
  <div class="flex items-center gap-2.5">
    <div
      class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"
    >
      <Icon {icon} width="16" height="16" class="text-primary" />
    </div>
    <h3 class="font-bold text-base leading-tight">{title}</h3>
  </div>
  <button
    class="btn btn-ghost btn-sm btn-circle"
    type="button"
    onclick={onClose}
    aria-label="Cerrar"
  >
    <Icon icon="lucide:x" width="16" height="16" />
  </button>
</div>

<form class="p-5 space-y-5" onsubmit={onSubmit}>
  <div class="grid gap-5">
    {@render children?.()}
  </div>

  <div class="flex flex-wrap gap-2 pt-1">
    <button class="btn btn-primary" type="submit" disabled={submitDisabled}>
      {submitLabel}
    </button>
    <button type="button" class="btn btn-ghost" onclick={onClose}>
      {cancelLabel}
    </button>
  </div>
</form>
