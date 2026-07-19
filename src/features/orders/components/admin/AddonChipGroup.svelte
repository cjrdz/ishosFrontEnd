<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import { computeAddonSelection } from "../../lib/order-builder-logic";
  import {
    handleChipGroupKeydown,
    initializeRovingTabindex,
  } from "../../lib/chip-keyboard";

  interface AddonItem {
    id: string;
    name: string;
    price: number;
  }

  interface Props {
    items: AddonItem[];
    includedId?: string;
    selectedIds: string[];
    noneId?: string;
    noneLabel?: string;
    label?: string;
    variant?: "unified" | "multi";
    required?: boolean;
    error?: string;
    onIncludedChange?: (value: string) => void;
    onToggleExtra: (addonId: string, checked: boolean) => void;
  }

  let {
    items,
    includedId = "",
    selectedIds,
    noneId = "none",
    noneLabel = "Ninguno",
    label,
    variant = "unified",
    required = false,
    error = "",
    onIncludedChange,
    onToggleExtra,
  }: Props = $props();

  let groupRef = $state<HTMLDivElement | null>(null);

  function emitUnifiedChanges(next: {
    includedId: string | null;
    extraIds: string[];
  }) {
    const nextIncludedValue = next.includedId ?? noneId;
    if (nextIncludedValue !== includedId) {
      onIncludedChange?.(nextIncludedValue);
    }

    const currentExtras = new Set(selectedIds);
    const nextExtras = new Set(next.extraIds);

    for (const id of currentExtras) {
      if (!nextExtras.has(id)) {
        onToggleExtra(id, false);
      }
    }
    for (const id of nextExtras) {
      if (!currentExtras.has(id)) {
        onToggleExtra(id, true);
      }
    }
  }

  function handleUnifiedChipClick(clickedId: string) {
    const next = computeAddonSelection(
      { includedId: includedId || null, extraIds: selectedIds },
      clickedId,
      noneId,
    );
    emitUnifiedChanges(next);
  }

  function handleMultiChipClick(clickedId: string) {
    const isSelected = selectedIds.includes(clickedId);
    onToggleExtra(clickedId, !isSelected);
  }

  function handleChipClick(clickedId: string) {
    if (variant === "multi") {
      handleMultiChipClick(clickedId);
    } else {
      handleUnifiedChipClick(clickedId);
    }
  }

  function isIncluded(id: string): boolean {
    return includedId === id;
  }

  function isExtra(id: string): boolean {
    return selectedIds.includes(id);
  }

  function isNoneSelected(): boolean {
    return (!includedId || includedId === noneId) && selectedIds.length === 0;
  }

  function clearSelection() {
    onIncludedChange?.(noneId);
    for (const id of selectedIds) {
      onToggleExtra(id, false);
    }
  }

  const canClear = $derived(
    variant === "unified"
      ? (includedId && includedId !== noneId) || selectedIds.length > 0
      : selectedIds.length > 0,
  );

  $effect(() => {
    if (groupRef) {
      initializeRovingTabindex(groupRef, "button[data-chip]");
    }
  });
</script>

<fieldset class="fieldset space-y-2">
  {#if label}
    <legend class="fieldset-legend flex items-center gap-1.5">
      <span class="text-sm font-semibold text-base-content/90">{label}</span>
      {#if required}
        <span class="text-error">*</span>
      {/if}
      {#if canClear}
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square text-error ml-1"
          aria-label={`Borrar ${label.toLowerCase()}`}
          title={`Borrar ${label.toLowerCase()}`}
          onclick={clearSelection}
        >
          <Icon icon="lucide:trash-2" width="12" height="12" />
        </button>
      {/if}
    </legend>
  {/if}

  <div
    bind:this={groupRef}
    class="flex flex-wrap gap-1.5"
    role="listbox"
    tabindex="0"
    aria-label={label}
    aria-required={required}
    onkeydown={(event) => handleChipGroupKeydown(event, "button[data-chip]")}
  >
    {#if variant === "unified"}
      <button
        type="button"
        data-chip
        class={`btn btn-sm h-9 min-h-9 ${
          isNoneSelected() ? "btn-primary" : "btn-ghost"
        }`}
        role="option"
        aria-selected={isNoneSelected()}
        onclick={() => handleChipClick(noneId)}
      >
        {noneLabel}
      </button>
    {/if}

    {#each items as item}
      {@const included = variant === "unified" && isIncluded(item.id)}
      {@const extra = isExtra(item.id)}
      {@const isDouble = included && extra}
      <button
        type="button"
        data-chip
        class={`btn btn-sm h-9 min-h-9 ${
          included ? "btn-primary" : extra ? "btn-secondary" : "btn-ghost"
        }`}
        role="option"
        aria-selected={included || extra}
        aria-label={`${item.name}${isDouble ? ", doble porción" : included ? ", incluido" : extra ? ", extra " + formatCurrency(item.price) : ""}`}
        title={item.name}
        onclick={() => handleChipClick(item.id)}
      >
        <span class="max-w-[8rem] truncate">{item.name}</span>
        {#if isDouble}
          <span class="badge badge-ghost badge-xs ml-0.5">x2</span>
        {:else if included}
          <span class="badge badge-ghost badge-xs ml-0.5">incl.</span>
        {:else if extra}
          <span class="badge badge-ghost badge-xs ml-0.5">
            +{formatCurrency(item.price)}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  {#if error}
    <p class="label text-error text-xs">{error}</p>
  {/if}
</fieldset>
