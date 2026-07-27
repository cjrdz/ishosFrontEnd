<script lang="ts">
  import { tick } from "svelte";
  import { animate, stagger } from "motion";
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import "../../../../styles/product-modal.css";
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
    onClose?: () => void;
    onConfirm?: (draft: ProductCustomizationDraft) => void | Promise<void>;
  }

  let {
    product,
    ordersEnabled,
    imageUrl,
    initialDraft = null,
    basePrice,
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
      : `Los primeros ${toppingFreeAllowance} topping${toppingFreeAllowance === 1 ? "" : "s"} son gratis. Los siguientes tienen costo.`,
  );
  const jaleaHelperText = $derived(
    jaleaFreeAllowance === 0
      ? "Cada jalea tiene costo adicional."
      : `Las primeras ${jaleaFreeAllowance} jalea${jaleaFreeAllowance === 1 ? "" : "s"} son gratis. Las siguientes tienen costo.`,
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
      return "btn btn-sm rounded-full border-[var(--ishos-teal)] bg-[color-mix(in_srgb,var(--ishos-teal)_15%,transparent)] text-[var(--ishos-teal)] hover:bg-[color-mix(in_srgb,var(--ishos-teal)_20%,transparent)]";
    }
    if (variant === "required") {
      return "btn btn-sm rounded-full btn-ghost border border-warning/40 text-base-content/75 hover:border-warning/60 hover:bg-warning/10";
    }
    return "btn btn-sm rounded-full btn-ghost border border-base-300 text-base-content/80 hover:border-base-content/25 hover:bg-base-200/80";
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
    const currentBox = modalBoxRef;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    if (currentBox && !reduceMotion) {
      void animate(
        currentBox,
        { opacity: [1, 0], y: [0, 16], scale: [1, 0.98] },
        { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
      ).finished.then(finishClose);
    } else {
      finishClose();
    }
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

  async function handleGoToCart() {
    const confirmed = await handleConfirm();
    if (!confirmed) return;
    window.location.href = "/order/cart#checkout";
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
        void tick().then(() => {
          if (!modalBoxRef) return;
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          void animate(
            modalBoxRef,
            { opacity: [0, 1], y: [20, 0], scale: [0.97, 1] },
            { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          );
          void tick().then(() => {
            if (!modalBoxRef) return;
            const details = modalBoxRef.querySelectorAll("details");
            if (details.length === 0) return;
            void animate(
              details,
              { opacity: [0, 1], y: [14, 0] },
              {
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
                delay: stagger(0.08, { startDelay: 0.15 }),
              },
            );
          });
        });
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
  onclose={handleNativeClose}
  oncancel={(event) => {
    event.preventDefault();
    closeDialog();
  }}
>
  <div
    class="modal-box w-full max-w-[min(96vw,72rem)] h-auto max-h-[94dvh] lg:max-h-208 p-0 overflow-hidden rounded-t-3xl sm:rounded-3xl border border-base-200/70 flex flex-col relative"
    bind:this={modalBoxRef}
  >
    <div class="brand-accent-bar"></div>
    <div
      class="stripe-bg absolute top-0 left-0 right-0 h-24 pointer-events-none"
    ></div>
    <button
      type="button"
      class="btn btn-circle btn-sm bg-base-100/92 border border-base-300/70 shadow-md absolute right-4 top-4 z-50"
      aria-label="Cerrar"
      onclick={closeDialog}
    >
      <Icon icon="lucide:x" class="size-5" aria-hidden="true" />
    </button>

    {#if product}
      <div class="sm:hidden flex justify-center pt-2 pb-1">
        <span class="h-1.25 w-14 rounded-full bg-base-300"></span>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div
          class="flex flex-col lg:grid lg:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)] lg:min-h-full"
        >
          <section
            class="border-b lg:border-b-0 lg:border-r border-base-200/70 bg-base-200/20 p-4 sm:p-6 lg:p-7 lg:flex lg:flex-col lg:gap-2"
          >
            {#if imageUrl && !modalImgFailed}
              <figure
                class="w-full aspect-4/3 sm:aspect-4/3 lg:aspect-4/3 lg:max-h-[56vh] rounded-2xl overflow-hidden border border-base-200 bg-base-100"
              >
                <img
                  src={imageUrl}
                  alt={product.name}
                  class="h-full w-full object-cover"
                  loading="lazy"
                  onerror={() => {
                    modalImgFailed = true;
                  }}
                />
              </figure>
            {:else}
              <div
                class="w-full aspect-4/3 sm:aspect-4/3 lg:aspect-4/3 lg:max-h-[56vh] rounded-2xl border border-base-200 bg-base-100 grid place-items-center text-base-content/50"
              >
                <div class="flex flex-col items-center gap-2">
                  <Icon icon="lucide:image-off" class="size-8 opacity-50" />
                  <span class="font-medium">Sin imagen</span>
                </div>
              </div>
            {/if}

            <div class="mt-4 space-y-2">
              <h3 class="text-2xl font-bold leading-tight">{product.name}</h3>
              <p
                class="text-lg font-extrabold"
                style="color: var(--ishos-teal);"
                aria-live="polite"
                aria-atomic="true"
              >
                {formatCurrency(totalPrice)}
              </p>
              {#if product.description}
                <p class="text-sm text-base-content/70">
                  {product.description}
                </p>
              {/if}
            </div>

            <div class="mt-4 flex flex-col gap-2">
              <div>
                <span class="label-text font-semibold text-base-content/70"
                  >Cantidad</span
                >
                <div
                  class="mt-2 inline-flex items-center gap-1 rounded-xl border border-base-300 bg-base-100 p-1"
                >
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost h-9 w-9 rounded-lg"
                    aria-label="Reducir cantidad"
                    onclick={decreaseQty}
                  >
                    <Icon icon="lucide:minus" class="size-4" />
                  </button>
                  <span class="w-10 text-center font-bold"
                    >{normalizeQuantity(draft.quantity)}</span
                  >
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost h-9 w-9 rounded-lg"
                    aria-label="Aumentar cantidad"
                    onclick={increaseQty}
                  >
                    <Icon icon="lucide:plus" class="size-4" />
                  </button>
                </div>
              </div>
              <div class="mt-2">
                <div class="grid gap-2">
                  <button
                    type="button"
                    class="btn btn-lg w-full rounded-xl font-bold bg-[var(--ishos-teal)] text-white border-[var(--ishos-teal)] hover:bg-[var(--ishos-teal-deep)] hover:border-[var(--ishos-teal-deep)]"
                    onclick={handleConfirm}
                    disabled={addDisabled}
                  >
                    {#if !ordersEnabled}
                      Pedidos pausados temporalmente
                    {:else}
                      Agregar al pedido · {formatCurrency(totalPrice)}
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline w-full rounded-xl font-semibold"
                    onclick={handleGoToCart}
                    disabled={addDisabled}
                  >
                    <Icon
                      icon="lucide:shopping-bag"
                      class="size-4 mr-1"
                      aria-hidden="true"
                    />
                    Ir al carrito
                  </button>
                  {#if !ordersEnabled}
                    <p class="text-center text-sm text-base-content/60">
                      ¡Gracias por escoger nuestros productos 🙂!
                    </p>
                  {/if}
                </div>
              </div>
            </div>
          </section>

          <section
            class="p-4 pb-6 sm:p-6 sm:pb-6 lg:p-7 lg:pb-7 lg:overflow-y-auto"
          >
            <div class="space-y-3">
              <div class="hidden lg:flex items-center justify-between pb-1">
                <h4 class="text-lg font-extrabold">Personaliza tu producto</h4>
              </div>

              {#if flavorRequired || toppingRequired || jaleaRequired}
                <div class="alert alert-warning rounded-xl text-sm">
                  <span>
                    Completa los campos requeridos para agregar este producto.
                  </span>
                </div>
              {/if}

              {#if flavorOptions.length > 0}
                <details
                  class="collapse collapse-arrow border border-base-200 bg-base-100 rounded-2xl"
                  open={flavorRequired ||
                    mixedFlavorsRequired ||
                    !draft.flavor_id}
                >
                  <summary
                    class="collapse-title font-bold flex items-center gap-2"
                  >
                    {hasMixedFlavors ? "Sabores (mezclados)" : "Sabor"}
                    <span class="badge badge-warning badge-sm">requerido</span>
                  </summary>
                  <div class="collapse-content pt-1">
                    <FlavorSelector
                      flavors={flavorOptions}
                      mode={hasMixedFlavors ? "fill" : "single"}
                      {ballQuantity}
                      selectedId={draft.flavor_id ?? ""}
                      selectedIds={flavorSelections}
                      label={hasMixedFlavors ? "Sabores" : "Sabor"}
                      required={true}
                      error={flavorRequired || mixedFlavorsRequired
                        ? "Selecciona un sabor"
                        : ""}
                      onChange={handleFlavorChange}
                    />
                  </div>
                </details>
              {/if}

              {#if toppingOptions.length > 0}
                <details
                  class="collapse collapse-arrow border border-base-200 bg-base-100 rounded-2xl"
                  open={toppingRequired || selectedToppingIds.length === 0}
                >
                  <summary
                    class="collapse-title font-bold flex items-center gap-2"
                  >
                    Topping
                  </summary>
                  <div class="collapse-content pt-1">
                    <ProductAddonChipGroup
                      items={toppingOptions}
                      includedIds={selectedToppingIds}
                      selectedIds={toppingExtraIds}
                      allowance={toppingFreeAllowance}
                      noneLabel="Sin topping"
                      label="Topping"
                      helperText={toppingHelperText}
                      required={true}
                      error={toppingRequired
                        ? "Selecciona un topping o 'Sin topping'"
                        : ""}
                      {chipClass}
                      onChange={updateToppingSelection}
                    />
                  </div>
                </details>
              {/if}

              {#if jaleaOptions.length > 0}
                <details
                  class="collapse collapse-arrow border border-base-200 bg-base-100 rounded-2xl"
                  open={jaleaRequired || selectedJaleaIds.length === 0}
                >
                  <summary
                    class="collapse-title font-bold flex items-center gap-2"
                  >
                    Jalea
                  </summary>
                  <div class="collapse-content pt-1">
                    <ProductAddonChipGroup
                      items={jaleaOptions}
                      includedIds={selectedJaleaIds}
                      selectedIds={jaleaExtraIds}
                      allowance={jaleaFreeAllowance}
                      noneLabel="Sin jalea"
                      label="Jalea"
                      helperText={jaleaHelperText}
                      required={true}
                      error={jaleaRequired
                        ? "Selecciona una jalea o 'Sin jalea'"
                        : ""}
                      {chipClass}
                      onChange={updateJaleaSelection}
                    />
                  </div>
                </details>
              {/if}

              {#each extraGroups as group (group.key)}
                {@const groupSelectedCount = (
                  draft.extra_addon_ids ?? []
                ).filter((id) =>
                  group.items.some((item) => item.id === id),
                ).length}
                <details
                  class="collapse collapse-arrow border border-base-200 bg-base-100 rounded-2xl"
                  open={groupSelectedCount > 0}
                >
                  <summary
                    class="collapse-title font-bold flex items-center gap-2"
                  >
                    {group.label}
                    <span class="badge badge-ghost badge-sm">opcional</span>
                  </summary>
                  <div class="collapse-content pt-1">
                    <div class="flex flex-wrap gap-2">
                      {#each group.items as addon (addon.id)}
                        {@const checked = (
                          draft.extra_addon_ids ?? []
                        ).includes(addon.id)}
                        <button
                          type="button"
                          class={chipClass(checked)}
                          onclick={() => toggleExtra(addon.id, !checked)}
                        >
                          {addon.name}
                          {#if Number(addon.price ?? 0) > 0}
                            <span class="ml-1" style="color: var(--ishos-teal);"
                              >+{formatCurrency(Number(addon.price))}</span
                            >
                          {/if}
                        </button>
                      {/each}
                    </div>
                  </div>
                </details>
              {/each}

              {#if flavorOptions.length === 0 && toppingOptions.length === 0 && jaleaOptions.length === 0 && extraGroups.length === 0}
                <div
                  class="rounded-2xl border border-base-200 bg-base-100 p-4 text-sm text-base-content/70"
                >
                  Este producto no tiene personalizaciones disponibles.
                </div>
              {/if}
            </div>
          </section>
        </div>
      </div>
    {/if}
  </div>

  <form
    method="dialog"
    class="modal-backdrop bg-base-300/60 backdrop-blur-sm"
    onsubmit={(event) => {
      event.preventDefault();
      closeDialog();
    }}
  >
    <button type="submit" class="sr-only"> Cerrar </button>
  </form>
</dialog>
