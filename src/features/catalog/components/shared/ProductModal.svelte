<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import { DURATION, safeAnimate } from "@shared/motion/motion";
  import ProductArt from "./ProductArt.svelte";
  import type { PublicProduct } from "@features/catalog/lib/api";
  import FlavorSelector from "@shared/components/FlavorSelector.svelte";
  import ProductAddonChipGroup from "./ProductAddonChipGroup.svelte";
  import {
    activeFlavors,
    addonsForGroup,
    computeTotalPrice,
    normalizeQuantity,
    normalizeSelectionIds,
    paidAddonGroups,
    requiresFlavorSelection,
    requiresGroupSelection,
    selectedIncludedAddonsForGroup,
    type ProductCustomizationDraft,
  } from "@features/catalog/lib/customization";

  interface Props {
    product: PublicProduct | null;
    ordersEnabled: boolean;
    imageUrl?: string;
    initialDraft?: ProductCustomizationDraft | null;
    basePrice?: number;
    /** Button verb: "Agregar" when adding, "Guardar cambios" when editing a cart line. */
    confirmLabel?: string;
    onClose?: () => void;
    onConfirm?: (draft: ProductCustomizationDraft) => void | Promise<void>;
  }

  let {
    product,
    ordersEnabled,
    imageUrl,
    initialDraft = null,
    basePrice,
    confirmLabel = "Agregar",
    onClose = () => {},
    onConfirm = () => {},
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let modalBoxRef = $state<HTMLDivElement | null>(null);
  let closeDispatched = $state(false);
  let closing = $state(false);
  let modalImgFailed = $state(false);

  let draft = $state<ProductCustomizationDraft>({ quantity: 1 });

  const flavorOptions = $derived(activeFlavors(product ?? undefined));
  const toppingOptions = $derived(
    addonsForGroup(product ?? undefined, "toppings"),
  );
  const jaleaOptions = $derived(addonsForGroup(product ?? undefined, "jalea"));
  const extraGroups = $derived(paidAddonGroups(product ?? undefined));

  const selectedToppingIds = $derived(
    selectedIncludedAddonsForGroup(product ?? undefined, draft, "toppings"),
  );
  const selectedJaleaIds = $derived(
    selectedIncludedAddonsForGroup(product ?? undefined, draft, "jalea"),
  );
  const toppingFreeAllowance = $derived(
    Math.max(0, product?.free_toppings ?? 1),
  );
  const jaleaFreeAllowance = $derived(1);

  const toppingIds = $derived(new Set(toppingOptions.map((addon) => addon.id)));
  const jaleaIds = $derived(new Set(jaleaOptions.map((addon) => addon.id)));
  const toppingExtraIds = $derived(
    (draft.extra_addon_ids ?? []).filter((id) => toppingIds.has(id)),
  );
  const jaleaExtraIds = $derived(
    (draft.extra_addon_ids ?? []).filter((id) => jaleaIds.has(id)),
  );

  const flavorRequired = $derived(
    requiresFlavorSelection(product ?? undefined, draft),
  );
  const toppingRequired = $derived(
    requiresGroupSelection(product ?? undefined, draft, "toppings"),
  );
  const jaleaRequired = $derived(
    requiresGroupSelection(product ?? undefined, draft, "jalea"),
  );
  const toppingHelperText = $derived(
    toppingFreeAllowance === 0
      ? "Cada topping tiene costo adicional."
      : toppingFreeAllowance === 1
        ? "El primer topping es gratis; los demás tienen costo."
        : `Los primeros ${toppingFreeAllowance} toppings son gratis; los demás tienen costo.`,
  );
  const jaleaHelperText = $derived(
    jaleaFreeAllowance === 0
      ? "Cada jalea tiene costo adicional."
      : jaleaFreeAllowance === 1
        ? "La primera jalea es gratis; las demás tienen costo."
        : `Las primeras ${jaleaFreeAllowance} jaleas son gratis; las demás tienen costo.`,
  );

  // Mixed flavors support
  const hasMixedFlavors = $derived(
    !!(
      product?.allows_mixed_flavors &&
      product?.ball_quantity &&
      product.ball_quantity > 1
    ),
  );
  const ballQuantity = $derived(product?.ball_quantity ?? 1);
  const flavorSelections = $derived(
    hasMixedFlavors ? (draft.flavor_ids ?? Array(ballQuantity).fill("")) : [],
  );
  const mixedFlavorsRequired = $derived(
    hasMixedFlavors && flavorSelections.some((id) => !id),
  );

  const totalPrice = $derived(
    computeTotalPrice(product ?? undefined, draft, basePrice),
  );
  const addDisabled = $derived(
    !ordersEnabled ||
      !product ||
      flavorRequired ||
      mixedFlavorsRequired ||
      toppingRequired ||
      jaleaRequired,
  );

  const remainingFlavors = $derived(
    flavorSelections.filter((id) => !id).length,
  );

  /** What still blocks the button, in the customer's words. */
  const missingHint = $derived.by(() => {
    if (flavorRequired) return "Elige un sabor";
    if (mixedFlavorsRequired) {
      return remainingFlavors === 1
        ? "Elige 1 sabor más"
        : `Elige ${remainingFlavors} sabores más`;
    }
    if (toppingRequired) return "Elige un topping o «Sin topping»";
    if (jaleaRequired) return "Elige una jalea o «Sin jalea»";
    return "";
  });

  const flavorDone = $derived(
    hasMixedFlavors
      ? !mixedFlavorsRequired
      : !flavorRequired && !!draft.flavor_id,
  );

  function isPhone(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches
    );
  }

  function buildInitialDraft(): ProductCustomizationDraft {
    return {
      quantity: normalizeQuantity(initialDraft?.quantity ?? 1),
      flavor_id: initialDraft?.flavor_id || undefined,
      flavor_ids: initialDraft?.flavor_ids ?? undefined,
      included_addon_ids: normalizeSelectionIds(
        initialDraft?.included_addon_ids,
      ),
      extra_addon_ids: normalizeSelectionIds(initialDraft?.extra_addon_ids),
      topping_selection: initialDraft?.topping_selection,
      jalea_selection: initialDraft?.jalea_selection,
    };
  }

  function resetDraft() {
    draft = buildInitialDraft();
  }

  function chipClass(selected: boolean, variant: "base" | "required" = "base") {
    if (selected) {
      return "btn btn-sm min-h-11 rounded-full border-primary bg-primary/10 text-primary hover:bg-primary/15";
    }
    if (variant === "required") {
      return "btn btn-sm min-h-11 rounded-full btn-ghost border border-warning/40 text-base-content/75 hover:border-warning/60 hover:bg-warning/10";
    }
    return "btn btn-sm min-h-11 rounded-full btn-ghost border border-base-300 text-base-content/80 hover:border-base-content/25 hover:bg-base-200/80";
  }

  function increaseQty() {
    draft = { ...draft, quantity: normalizeQuantity(draft.quantity) + 1 };
  }

  function decreaseQty() {
    draft = {
      ...draft,
      quantity: Math.max(1, normalizeQuantity(draft.quantity) - 1),
    };
  }

  function handleFlavorChange(value: string | string[]) {
    if (hasMixedFlavors) {
      draft = { ...draft, flavor_ids: value as string[] };
    } else {
      draft = { ...draft, flavor_id: value as string };
    }
  }

  function updateToppingSelection(
    nextIncludedIds: string[],
    nextExtraIds: string[],
  ) {
    const currentIncluded = draft.included_addon_ids ?? [];
    const currentExtras = draft.extra_addon_ids ?? [];

    const newIncluded = [
      ...currentIncluded.filter((id) => !toppingIds.has(id)),
      ...nextIncludedIds.filter((id) => toppingIds.has(id)),
    ];
    const newExtras = [
      ...currentExtras.filter((id) => !toppingIds.has(id)),
      ...nextExtraIds.filter((id) => toppingIds.has(id)),
    ];

    draft = {
      ...draft,
      included_addon_ids: normalizeSelectionIds(newIncluded),
      extra_addon_ids: normalizeSelectionIds(newExtras),
      topping_selection: nextIncludedIds.length > 0 ? "selected" : "none",
    };
  }

  function updateJaleaSelection(
    nextIncludedIds: string[],
    nextExtraIds: string[],
  ) {
    const currentIncluded = draft.included_addon_ids ?? [];
    const currentExtras = draft.extra_addon_ids ?? [];

    const newIncluded = [
      ...currentIncluded.filter((id) => !jaleaIds.has(id)),
      ...nextIncludedIds.filter((id) => jaleaIds.has(id)),
    ];
    const newExtras = [
      ...currentExtras.filter((id) => !jaleaIds.has(id)),
      ...nextExtraIds.filter((id) => jaleaIds.has(id)),
    ];

    draft = {
      ...draft,
      included_addon_ids: normalizeSelectionIds(newIncluded),
      extra_addon_ids: normalizeSelectionIds(newExtras),
      jalea_selection: nextIncludedIds.length > 0 ? "selected" : "none",
    };
  }

  function toggleExtra(addonId: string, checked: boolean) {
    const nextExtras = checked
      ? [...(draft.extra_addon_ids ?? []), addonId]
      : (draft.extra_addon_ids ?? []).filter((id) => id !== addonId);

    draft = {
      ...draft,
      extra_addon_ids: normalizeSelectionIds(nextExtras),
    };
  }

  function emitCloseOnce() {
    if (closeDispatched) return;
    closeDispatched = true;
    onClose();
  }

  function closeDialog() {
    if (closing || !dialogRef) return;
    closing = true;

    const currentDialog = dialogRef;
    const finishClose = () => {
      closeDispatched = true;
      onClose();
      if (typeof currentDialog.close === "function") {
        currentDialog.close();
      } else {
        currentDialog.removeAttribute("open");
      }
      closing = false;
    };

    // Phones: the sheet slides back down; larger screens: fade and settle.
    const from = modalBoxRef?.style.transform || "none";
    void safeAnimate(
      modalBoxRef,
      isPhone()
        ? [{ transform: from }, { transform: "translateY(100%)" }]
        : [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(12px) scale(0.98)" },
          ],
      { duration: DURATION.panel },
    ).then(finishClose);
  }

  // Drag the sheet's handle down to dismiss (phones).
  let dragStartY: number | null = null;
  let dragOffset = 0;

  function onDragStart(event: PointerEvent) {
    if (!isPhone() || !modalBoxRef) return;
    dragStartY = event.clientY;
    dragOffset = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    modalBoxRef.style.transition = "none";
  }

  function onDragMove(event: PointerEvent) {
    if (dragStartY === null || !modalBoxRef) return;
    dragOffset = Math.max(0, event.clientY - dragStartY);
    modalBoxRef.style.transform = `translateY(${dragOffset}px)`;
  }

  function onDragEnd() {
    if (dragStartY === null || !modalBoxRef) return;
    dragStartY = null;
    modalBoxRef.style.transition = "";
    if (dragOffset > 110) {
      closeDialog();
      return;
    }
    void safeAnimate(
      modalBoxRef,
      [{ transform: `translateY(${dragOffset}px)` }, { transform: "none" }],
      { duration: DURATION.fast },
    );
  }

  async function handleConfirm(): Promise<boolean> {
    if (!product || addDisabled) return false;

    await onConfirm({
      quantity: normalizeQuantity(draft.quantity),
      flavor_id: draft.flavor_id || undefined,
      flavor_ids: draft.flavor_ids || undefined,
      included_addon_ids: normalizeSelectionIds(draft.included_addon_ids),
      extra_addon_ids: normalizeSelectionIds(draft.extra_addon_ids),
      topping_selection: draft.topping_selection,
      jalea_selection: draft.jalea_selection,
    });

    return true;
  }

  function handleNativeClose() {
    emitCloseOnce();
  }

  $effect(() => {
    imageUrl;
    modalImgFailed = false;
  });

  $effect(() => {
    product?.id;
    initialDraft;
    resetDraft();
  });

  $effect(() => {
    if (!dialogRef) return;

    if (product) {
      closeDispatched = false;
      if (!dialogRef.open && !closing) {
        if (typeof dialogRef.showModal === "function") {
          dialogRef.showModal();
        } else {
          dialogRef.setAttribute("open", "");
        }
        // A previous close leaves its last frame inline; daisyUI animates the entrance.
        modalBoxRef?.style.removeProperty("opacity");
        modalBoxRef?.style.removeProperty("transform");
      }
      return;
    }

    if (dialogRef.open && !closeDispatched && !closing) {
      closeDialog();
    }
  });
</script>

<dialog
  class="modal modal-bottom sm:modal-middle"
  bind:this={dialogRef}
  aria-labelledby="product-sheet-title"
  onclose={handleNativeClose}
  oncancel={(event) => {
    event.preventDefault();
    closeDialog();
  }}
>
  <div
    class="modal-box product-sheet flex w-full max-w-4xl flex-col overflow-hidden p-0"
    bind:this={modalBoxRef}
  >
    {#if product}
      <div
        class="sheet-handle"
        role="presentation"
        onpointerdown={onDragStart}
        onpointermove={onDragMove}
        onpointerup={onDragEnd}
        onpointercancel={onDragEnd}
      >
        <span></span>
      </div>
      <button
        type="button"
        class="btn btn-circle btn-sm size-11 absolute right-3 top-3 z-10 border-base-300 bg-base-100/90"
        aria-label="Cerrar"
        onclick={closeDialog}
      >
        <Icon icon="lucide:x" class="size-5" aria-hidden="true" />
      </button>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="sm:grid sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div class="p-4 pb-0 sm:sticky sm:top-0 sm:self-start sm:p-6">
            <figure
              class="aspect-[16/10] overflow-hidden rounded-box bg-base-200 sm:aspect-square"
            >
              {#if imageUrl && !modalImgFailed}
                <img
                  src={imageUrl}
                  alt=""
                  class="h-full w-full object-cover"
                  onerror={() => {
                    modalImgFailed = true;
                  }}
                />
              {:else}
                <ProductArt
                  name={product.name}
                  category={product.category_name}
                  scoops={product.ball_quantity ?? 1}
                  seed={product.id}
                />
              {/if}
            </figure>
          </div>

          <div class="space-y-6 p-4 sm:p-6 sm:pl-0">
            <header class="space-y-1 pr-10">
              <h2
                id="product-sheet-title"
                class="font-display font-bold text-4xl leading-none md:text-5xl"
              >
                {product.name}
              </h2>
              {#if product.description}
                <p class="text-base-content/70">{product.description}</p>
              {/if}
            </header>

            {#if flavorOptions.length > 0}
              <section class="space-y-3" aria-labelledby="sheet-flavor">
                <div class="flex items-center justify-between gap-2">
                  <h3 id="sheet-flavor" class="font-semibold">
                    {hasMixedFlavors
                      ? `Elige ${ballQuantity} sabores`
                      : "Elige tu sabor"}
                  </h3>
                  {@render requirement(flavorDone)}
                </div>
                {#if hasMixedFlavors}
                  <p class="text-sm text-ink-muted">
                    Puedes repetir un sabor. {ballQuantity - remainingFlavors} de
                    {ballQuantity} elegidos.
                  </p>
                {/if}
                <FlavorSelector
                  flavors={flavorOptions}
                  mode={hasMixedFlavors ? "fill" : "single"}
                  {ballQuantity}
                  selectedId={draft.flavor_id ?? ""}
                  selectedIds={flavorSelections}
                  label={hasMixedFlavors ? "Sabores" : "Sabor"}
                  required={true}
                  hideLabel={true}
                  onChange={handleFlavorChange}
                />
              </section>
            {/if}

            {#if toppingOptions.length > 0}
              <section class="space-y-3" aria-labelledby="sheet-topping">
                <div class="flex items-center justify-between gap-2">
                  <h3 id="sheet-topping" class="font-semibold">Topping</h3>
                  {@render requirement(!toppingRequired)}
                </div>
                <ProductAddonChipGroup
                  items={toppingOptions}
                  includedIds={selectedToppingIds}
                  selectedIds={toppingExtraIds}
                  allowance={toppingFreeAllowance}
                  noneLabel="Sin topping"
                  label="Topping"
                  helperText={toppingHelperText}
                  required={true}
                  hideLabel={true}
                  noneChosen={draft.topping_selection === "none"}
                  {chipClass}
                  onChange={updateToppingSelection}
                />
              </section>
            {/if}

            {#if jaleaOptions.length > 0}
              <section class="space-y-3" aria-labelledby="sheet-jalea">
                <div class="flex items-center justify-between gap-2">
                  <h3 id="sheet-jalea" class="font-semibold">Jalea</h3>
                  {@render requirement(!jaleaRequired)}
                </div>
                <ProductAddonChipGroup
                  items={jaleaOptions}
                  includedIds={selectedJaleaIds}
                  selectedIds={jaleaExtraIds}
                  allowance={jaleaFreeAllowance}
                  noneLabel="Sin jalea"
                  label="Jalea"
                  helperText={jaleaHelperText}
                  required={true}
                  hideLabel={true}
                  noneChosen={draft.jalea_selection === "none"}
                  {chipClass}
                  onChange={updateJaleaSelection}
                />
              </section>
            {/if}

            {#each extraGroups as group (group.key)}
              <section
                class="space-y-3"
                aria-labelledby={`sheet-extra-${group.key}`}
              >
                <div class="flex items-center justify-between gap-2">
                  <h3 id={`sheet-extra-${group.key}`} class="font-semibold">
                    {group.label}
                  </h3>
                  <span class="text-sm text-ink-muted">Opcional</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  {#each group.items as addon (addon.id)}
                    {@const checked = (draft.extra_addon_ids ?? []).includes(
                      addon.id,
                    )}
                    <button
                      type="button"
                      class={chipClass(checked)}
                      aria-pressed={checked}
                      onclick={() => toggleExtra(addon.id, !checked)}
                    >
                      {addon.name}
                      {#if Number(addon.price ?? 0) > 0}
                        <span class="text-ink-muted"
                          >+{formatCurrency(Number(addon.price))}</span
                        >
                      {/if}
                    </button>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        </div>
      </div>

      <footer class="sheet-footer">
        {#if ordersEnabled && missingHint}
          <p
            class="mb-2 text-center text-sm text-base-content/70"
            aria-live="polite"
          >
            {missingHint} para continuar.
          </p>
        {/if}
        <div class="flex items-center gap-3">
          <div
            class="flex items-center rounded-full border border-base-300"
            role="group"
            aria-label="Cantidad"
          >
            <button
              type="button"
              class="btn btn-ghost btn-circle btn-sm size-11"
              aria-label="Reducir cantidad"
              disabled={normalizeQuantity(draft.quantity) <= 1}
              onclick={decreaseQty}
            >
              <Icon icon="lucide:minus" class="size-4" aria-hidden="true" />
            </button>
            <span
              class="w-8 text-center font-semibold tabular-nums"
              aria-live="polite">{normalizeQuantity(draft.quantity)}</span
            >
            <button
              type="button"
              class="btn btn-ghost btn-circle btn-sm size-11"
              aria-label="Aumentar cantidad"
              onclick={increaseQty}
            >
              <Icon icon="lucide:plus" class="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-lg flex-1 rounded-full"
            onclick={handleConfirm}
            disabled={addDisabled}
          >
            {#if !ordersEnabled}
              Pedidos en pausa
            {:else}
              {confirmLabel} ·
              <span class="tabular-nums">{formatCurrency(totalPrice)}</span>
            {/if}
          </button>
        </div>
      </footer>
    {/if}
  </div>

  <form
    method="dialog"
    class="modal-backdrop bg-neutral/50"
    onsubmit={(event) => {
      event.preventDefault();
      closeDialog();
    }}
  >
    <button type="submit" class="sr-only">Cerrar</button>
  </form>
</dialog>

{#snippet requirement(done: boolean)}
  {#if done}
    <span
      class="inline-flex items-center gap-1 text-sm font-medium text-success"
    >
      <Icon icon="lucide:check" class="size-4" aria-hidden="true" />Listo
    </span>
  {:else}
    <span
      class="badge badge-sm border-warning/60 bg-warning/20 text-base-content"
      >Requerido</span
    >
  {/if}
{/snippet}

<style>
  .product-sheet {
    max-height: min(92dvh, 52rem);
    border-radius: var(--radius-box) var(--radius-box) 0 0;
  }

  @media (min-width: 640px) {
    .product-sheet {
      border-radius: var(--radius-box);
    }
  }

  .sheet-handle {
    display: flex;
    justify-content: center;
    padding: 0.6rem 0 0.25rem;
    touch-action: none;
    cursor: grab;
  }

  @media (min-width: 640px) {
    .sheet-handle {
      display: none;
    }
  }

  .sheet-handle span {
    width: 2.75rem;
    height: 0.3rem;
    border-radius: 999px;
    background: var(--color-base-300);
  }

  .sheet-footer {
    border-top: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  }

  @media (min-width: 640px) {
    .sheet-footer {
      padding-inline: 1.5rem;
    }
  }
</style>
