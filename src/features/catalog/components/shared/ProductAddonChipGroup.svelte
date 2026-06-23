<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import type { PublicAddon } from "@features/catalog/lib/api";
  import { computeAddonSelection } from "@features/orders/lib/order-builder-logic";

  interface Props {
    items: PublicAddon[];
    includedId: string;
    selectedIds: string[];
    noneLabel: string;
    label: string;
    helperText?: string;
    required?: boolean;
    error?: string;
    chipClass: (selected: boolean, variant?: "base" | "required") => string;
    onChange: (includedId: string | null, selectedIds: string[]) => void;
  }

  let {
    items,
    includedId,
    selectedIds,
    noneLabel,
    label,
    helperText = "",
    required = false,
    error = "",
    chipClass,
    onChange,
  }: Props = $props();

  const NONE_ID = "none";

  function handleChipClick(clickedId: string) {
    const next = computeAddonSelection(
      { includedId: includedId || null, extraIds: selectedIds },
      clickedId,
      NONE_ID,
    );
    onChange(next.includedId, next.extraIds);
  }

  function clearSelection() {
    onChange(null, []);
  }

  function isIncluded(id: string): boolean {
    return includedId === id;
  }

  function isExtra(id: string): boolean {
    return selectedIds.includes(id);
  }

  function isNoneSelected(): boolean {
    return (!includedId || includedId === NONE_ID) && selectedIds.length === 0;
  }

  const canClear = $derived(
    (includedId && includedId !== NONE_ID) || selectedIds.length > 0,
  );
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-1.5">
      <span class="font-bold">{label}</span>
      {#if required}
        <span class="badge badge-warning badge-sm">requerido</span>
      {/if}
    </div>
    {#if canClear}
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        aria-label={`Borrar ${label.toLowerCase()}`}
        title={`Borrar ${label.toLowerCase()}`}
        onclick={clearSelection}
      >
        <Icon icon="lucide:trash-2" class="size-3.5" />
      </button>
    {/if}
  </div>

  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class={chipClass(isNoneSelected(), "required")}
      onclick={() => handleChipClick(NONE_ID)}
    >
      {noneLabel}
    </button>

    {#each items as addon}
      {@const included = isIncluded(addon.id)}
      {@const extra = isExtra(addon.id)}
      {@const isDouble = included && extra}
      <button
        type="button"
        class={chipClass(included || extra, "required")}
        aria-label={`${addon.name}${isDouble ? ", doble porción" : included ? ", incluido" : extra ? ", extra " + formatCurrency(Number(addon.price ?? 0)) : ""}`}
        onclick={() => handleChipClick(addon.id)}
      >
        <span>{addon.name}</span>
        {#if isDouble}
          <span class="ml-1 text-xs opacity-80">x2</span>
          {#if Number(addon.price ?? 0) > 0}
            <span class="ml-1 text-xs" style="color: var(--ishos-teal);">
              +{formatCurrency(Number(addon.price))}
            </span>
          {/if}
        {:else if included}
          <span class="ml-1 text-xs opacity-80">incluido</span>
        {:else if extra}
          {#if Number(addon.price ?? 0) > 0}
            <span class="ml-1 text-xs" style="color: var(--ishos-teal);">
              +{formatCurrency(Number(addon.price))}
            </span>
          {/if}
        {/if}
      </button>
    {/each}
  </div>

  {#if helperText}
    <p class="text-xs text-base-content/60">{helperText}</p>
  {/if}

  {#if error}
    <p class="text-xs text-error">{error}</p>
  {/if}
</div>
