<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    itemName: string;
    busy?: boolean;
    formBusy?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
  }

  let {
    itemName,
    busy = false,
    formBusy = false,
    canMoveUp = false,
    canMoveDown = false,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
  }: Props = $props();

  const isBusy = $derived(busy || formBusy);
</script>

<div class="flex flex-wrap items-center justify-center gap-1">
  {#if onMoveUp}
    <button
      class="btn btn-sm btn-ghost btn-square size-11"
      type="button"
      onclick={onMoveUp}
      disabled={isBusy || !canMoveUp}
      aria-label={`Subir ${itemName}`}
      title="Subir"
    >
      <Icon icon="lucide:arrow-up" width="14" height="14" />
    </button>
  {/if}
  {#if onMoveDown}
    <button
      class="btn btn-sm btn-ghost btn-square size-11"
      type="button"
      onclick={onMoveDown}
      disabled={isBusy || !canMoveDown}
      aria-label={`Bajar ${itemName}`}
      title="Bajar"
    >
      <Icon icon="lucide:arrow-down" width="14" height="14" />
    </button>
  {/if}
  <button
    class="btn btn-sm min-h-11 btn-soft btn-accent"
    type="button"
    onclick={onEdit}
    disabled={isBusy}>Editar</button
  >
  <button
    class="btn btn-sm min-h-11 btn-soft btn-error"
    type="button"
    onclick={onDelete}
    disabled={isBusy}>Eliminar</button
  >
</div>
