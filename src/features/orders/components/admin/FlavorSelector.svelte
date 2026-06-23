<script lang="ts">
  import type { Flavor } from "@features/admin-management";
  import { fillSlot } from "../../lib/order-builder-logic";
  import {
    handleChipGroupKeydown,
    initializeRovingTabindex,
  } from "../../lib/chip-keyboard";

  interface Props {
    flavors: Flavor[];
    mode: "single" | "multi" | "fill";
    ballQuantity: number;
    selectedId: string;
    selectedIds: string[];
    label: string;
    required?: boolean;
    error?: string;
    onChange: (value: string | string[]) => void;
  }

  let {
    flavors,
    mode,
    ballQuantity,
    selectedId,
    selectedIds,
    label,
    required = false,
    error = "",
    onChange,
  }: Props = $props();

  let activeSlotIndex = $state(0);
  let groupRef = $state<HTMLDivElement | null>(null);

  const safeBallQuantity = $derived(Math.max(1, ballQuantity));
  const slots = $derived(
    mode === "fill"
      ? Array(safeBallQuantity)
          .fill("")
          .map((_, index) => selectedIds[index] || "")
      : [],
  );

  function handleSingleClick(flavorId: string) {
    onChange(selectedId === flavorId ? "" : flavorId);
  }

  function handleMultiClick(flavorId: string, index: number) {
    const nextIds = [...selectedIds];
    nextIds[index] = selectedIds[index] === flavorId ? "" : flavorId;
    onChange(nextIds);
  }

  function handleFillClick(flavorId: string) {
    const result = fillSlot(selectedIds, flavorId, activeSlotIndex);
    activeSlotIndex = result.nextActiveIndex;
    onChange(result.slots);
  }

  function selectSlot(index: number) {
    activeSlotIndex = index;
  }

  $effect(() => {
    if (groupRef) {
      initializeRovingTabindex(groupRef, "button[data-chip]");
    }
  });
</script>

<div class="space-y-2">
  <div class="flex items-center gap-1.5">
    <span class="text-xs font-medium text-base-content/80">
      {label}
    </span>
    {#if required}
      <span class="text-error">*</span>
    {/if}
  </div>

  {#if mode === "fill"}
    <div class="flex flex-wrap items-center gap-2" aria-label="{label} - bolas">
      {#each slots as slot, index}
        {@const flavor = flavors.find((f) => f.id === slot)}
        <button
          type="button"
          class={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            activeSlotIndex === index
              ? "border-primary bg-primary/10 text-primary"
              : "border-base-300 bg-base-100 text-base-content/70"
          } ${!slot ? "border-dashed" : ""}`}
          onclick={() => selectSlot(index)}
          aria-label={flavor
            ? `Bola ${index + 1}: ${flavor.name}`
            : `Bola ${index + 1}: vacía`}
          aria-pressed={activeSlotIndex === index}
        >
          <span class="font-medium">B{index + 1}</span>
          {#if flavor}
            <span class="max-w-[6rem] truncate" title={flavor.name}>
              {flavor.name}
            </span>
          {:else}
            <span class="text-base-content/40">—</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if mode !== "multi"}
    <div
      bind:this={groupRef}
      class="flex flex-wrap gap-2"
      role="listbox"
      tabindex="0"
      aria-label={label}
      aria-required={required}
      onkeydown={(event) => handleChipGroupKeydown(event, "button[data-chip]")}
    >
      {#each flavors as flavor}
        {@const selected =
          mode === "single"
            ? selectedId === flavor.id
            : selectedIds[activeSlotIndex] === flavor.id}
        <button
          type="button"
          data-chip
          class={`btn btn-sm min-h-10 ${
            selected
              ? "btn-primary"
              : "btn-outline btn-ghost border-base-300 hover:border-base-300"
          }`}
          role="option"
          aria-selected={selected}
          title={flavor.name}
          onclick={() => {
            if (mode === "single") {
              handleSingleClick(flavor.id);
            } else {
              handleFillClick(flavor.id);
            }
          }}
        >
          <span class="max-w-[8rem] truncate">{flavor.name}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if mode === "multi" && safeBallQuantity <= 3}
    <div class="space-y-2">
      {#each Array(safeBallQuantity) as _, index}
        <div class="space-y-1">
          <span class="text-xs text-base-content/60">Bola {index + 1}</span>
          <div
            class="flex flex-wrap gap-2"
            role="listbox"
            tabindex="0"
            aria-label="{label} - bola {index + 1}"
            onkeydown={(event) =>
              handleChipGroupKeydown(event, "button[data-chip]")}
          >
            {#each flavors as flavor}
              {@const selected = selectedIds[index] === flavor.id}
              <button
                type="button"
                data-chip
                class={`btn btn-sm min-h-10 ${
                  selected
                    ? "btn-primary"
                    : "btn-outline btn-ghost border-base-300 hover:border-base-300"
                }`}
                role="option"
                aria-selected={selected}
                title={flavor.name}
                onclick={() => handleMultiClick(flavor.id, index)}
              >
                <span class="max-w-[8rem] truncate">{flavor.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if mode === "fill"}
    <p class="text-xs text-base-content/60">
      Toca un sabor para llenar la bola activa (B{activeSlotIndex + 1}).
    </p>
  {/if}

  {#if error}
    <p class="text-xs text-error">{error}</p>
  {/if}
</div>
