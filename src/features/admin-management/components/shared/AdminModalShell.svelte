<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    dialogRef?: HTMLDialogElement | null;
    title: string;
    icon: string;
    widthClass?: string;
    onClose: () => void;
    children: Snippet;
    headerActions?: Snippet;
  }

  let {
    dialogRef = $bindable(null),
    title,
    icon,
    widthClass = "max-w-3xl",
    onClose,
    children,
    headerActions,
  }: Props = $props();
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div
    class={`modal-box w-11/12 ${widthClass} max-h-[90vh] overflow-y-auto p-0`}
  >
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
      <div class="flex items-center gap-1">
        {#if headerActions}
          {@render headerActions()}
        {/if}
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={onClose}
          aria-label="Cerrar"
        >
          <Icon icon="lucide:x" width="16" height="16" />
        </button>
      </div>
    </div>

    <div class="p-5 space-y-4">
      {@render children()}
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>
