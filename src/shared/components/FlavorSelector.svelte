<script lang="ts">
  import {
    fillSlot,
    handleChipGroupKeydown,
    initializeRovingTabindex,
  } from "@shared/lib/flavor-selector";

  interface FlavorLike {
    id: string;
    name: string;
    is_seasonal?: boolean;
  }

  interface Props {
    flavors: FlavorLike[];
    mode: "single" | "fill";
    ballQuantity?: number;
    selectedId?: string;
    selectedIds?: string[];
    label?: string;
    required?: boolean;
    error?: string;
    /** The caller shows its own heading; keep the label for assistive tech only. */
    hideLabel?: boolean;
    /** Flavours sold out where the order is placed: shown but not selectable. */
    soldOutIds?: string[];
    onChange: (value: string | string[]) => void;
  }

  let {
    flavors,
    mode,
    ballQuantity = 1,
    selectedId = "",
    selectedIds = [],
    label = "Sabor",
    required = false,
    error = "",
    hideLabel = false,
    soldOutIds = [],
    onChange,
  }: Props = $props();

  const soldOut = $derived(new Set(soldOutIds));

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

  function handleFillClick(flavorId: string) {
    const result = fillSlot(selectedIds, flavorId, activeSlotIndex);
    activeSlotIndex = result.nextActiveIndex;
    onChange(result.slots);
  }

  function selectSlot(index: number) {
    activeSlotIndex = index;
  }

  function clearSlots() {
    activeSlotIndex = 0;
    onChange(Array(safeBallQuantity).fill(""));
  }

  $effect(() => {
    if (groupRef) {
      initializeRovingTabindex(groupRef, "button[data-chip]");
    }
  });
</script>

<div class="space-y-2">
  <div class="flex items-center gap-1.5" class:sr-only={hideLabel}>
    <span class="text-sm font-semibold text-base-content/90">
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
            <span class="text-ink-muted">—</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

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
      {@const unavailable = soldOut.has(flavor.id)}
      <button
        type="button"
        data-chip
        class={`btn btn-sm min-h-11 ${
          selected
            ? "btn-primary"
            : "btn-outline btn-ghost border-base-300 hover:border-base-300"
        } ${unavailable ? "line-through opacity-50" : ""}`}
        role="option"
        aria-selected={selected}
        aria-disabled={unavailable}
        disabled={unavailable && !selected}
        title={unavailable ? `${flavor.name} · Agotado` : flavor.name}
        onclick={() => {
          if (unavailable && !selected) return;
          if (mode === "single") {
            handleSingleClick(flavor.id);
          } else {
            handleFillClick(flavor.id);
          }
        }}
      >
        <span class="max-w-[8rem] truncate">{flavor.name}</span>
        {#if unavailable}
          <span
            class="badge badge-xs border-0 bg-error/15 text-error no-underline"
            >Agotado</span
          >
        {/if}
        {#if flavor.is_seasonal}
          <span class="ml-0.5 text-xs opacity-70">★</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if mode === "fill"}
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-ink-muted">
        Toca un sabor para llenar la bola activa (B{activeSlotIndex + 1}).
      </p>
      <button
        type="button"
        class="btn btn-ghost btn-sm min-h-11"
        onclick={clearSlots}
      >
        Limpiar
      </button>
    </div>
  {/if}

  {#if error}
    <p class="text-xs text-error">{error}</p>
  {/if}
</div>
