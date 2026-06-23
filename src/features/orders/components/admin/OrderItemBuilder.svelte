<script lang="ts">
  import { formatCurrency } from "@shared/utils/formatters";
  import type { Addon, Flavor, Product } from "@features/admin-management";
  import type {
    ManualOrderItemDraft,
    OrderFormState,
  } from "../../types/orders-tab";
  import FlavorSelector from "./FlavorSelector.svelte";
  import AddonChipGroup from "./AddonChipGroup.svelte";
  import AddedItemsList from "./AddedItemsList.svelte";

  interface AddonGroup {
    key: string;
    label: string;
    items: Addon[];
  }

  interface Props {
    products: Product[];
    orderForm: OrderFormState;
    manualItems: ManualOrderItemDraft[];
    draftItemEditIndex: number | null;
    selectedProductFlavors: Flavor[];
    toppingAddons: Addon[];
    jaleaAddons: Addon[];
    selectedProductAddons: Addon[];
    paidAddonGroups: AddonGroup[];
    selectedFlavorId: string;
    selectedFlavorIds: string[];
    includedToppingId: string;
    includedJaleaId: string;
    selectedExtraAddonIds: string[];
    hasCustomizationOptions: boolean;
    totalPreview: number;
    manualOrderTotal: number;
    addItemError: string;
    busy: boolean;
    onProductChange: (value: string) => void;
    onQuantityChange: (value: number) => void;
    onFlavorChange: (value: string) => void;
    onFlavorIdsChange: (value: string[]) => void;
    onChangeIncludedTopping: (value: string) => void;
    onChangeIncludedJalea: (value: string) => void;
    onToggleExtraAddonSelection: (addonId: string, checked: boolean) => void;
    onAddDraftItem: () => void;
    onEditDraftItem: (index: number) => void;
    onCancelDraftItemEdit: () => void;
    onRemoveDraftItem: (index: number) => void;
    onUpdateDraftItemQuantity: (index: number, quantity: number) => void;
    onProductById: (productId: string) => Product | undefined;
    onResolveFlavorName: (
      productId: string,
      flavorId: string | undefined,
    ) => string | null;
    onResolveAddonNames: (productId: string, addonIds: string[]) => string[];
    onManualItemSubtotal: (item: ManualOrderItemDraft) => number;
    onDraftItemKey: (item: ManualOrderItemDraft, index: number) => string;
  }

  let {
    products,
    orderForm,
    manualItems,
    draftItemEditIndex,
    selectedProductFlavors,
    toppingAddons,
    jaleaAddons,
    selectedProductAddons,
    paidAddonGroups,
    selectedFlavorId,
    selectedFlavorIds,
    includedToppingId,
    includedJaleaId,
    selectedExtraAddonIds,
    hasCustomizationOptions,
    totalPreview,
    addItemError,
    onProductChange,
    onQuantityChange,
    onFlavorChange,
    onFlavorIdsChange,
    onChangeIncludedTopping,
    onChangeIncludedJalea,
    onToggleExtraAddonSelection,
    onAddDraftItem,
    onEditDraftItem,
    onCancelDraftItemEdit,
    onRemoveDraftItem,
    onUpdateDraftItemQuantity,
    onProductById,
    onResolveFlavorName,
    onResolveAddonNames,
    onManualItemSubtotal,
    onDraftItemKey,
  }: Props = $props();

  const NONE_CUSTOMIZATION = "none";

  const selectedProduct = $derived(onProductById(orderForm.product_id));
  const ballQuantity = $derived(selectedProduct?.ball_quantity ?? 1);
  const allowsMixedFlavors = $derived(
    (selectedProduct?.allows_mixed_flavors ?? false) && ballQuantity > 1,
  );
  const flavorMode = $derived(
    selectedProductFlavors.length === 0
      ? "none"
      : allowsMixedFlavors
        ? ballQuantity <= 3
          ? "multi"
          : "fill"
        : "single",
  );

  const requiresFlavorSelection = $derived(
    flavorMode !== "none" &&
      (flavorMode === "multi" || flavorMode === "fill"
        ? selectedFlavorIds.length !== ballQuantity ||
          selectedFlavorIds.some((id) => !id)
        : !selectedFlavorId),
  );
  const requiresToppingSelection = $derived(
    toppingAddons.length > 0 && !includedToppingId,
  );
  const requiresJaleaSelection = $derived(
    jaleaAddons.length > 0 && !includedJaleaId,
  );
  const canAddCurrentItem = $derived(
    products.length > 0 &&
      !requiresFlavorSelection &&
      !requiresToppingSelection &&
      !requiresJaleaSelection,
  );

  const currentFlavorName = $derived(
    selectedProductFlavors.find((flavor) => flavor.id === selectedFlavorId)
      ?.name ?? null,
  );
  const currentIncludedAddonNames = $derived(
    [includedToppingId, includedJaleaId]
      .filter(
        (addonId): addonId is string =>
          Boolean(addonId) && addonId !== NONE_CUSTOMIZATION,
      )
      .map(
        (addonId) =>
          selectedProductAddons.find((addon) => addon.id === addonId)?.name ??
          null,
      )
      .filter((name): name is string => Boolean(name)),
  );
  const currentExtraAddonNames = $derived(
    selectedExtraAddonIds
      .map(
        (addonId) =>
          selectedProductAddons.find((addon) => addon.id === addonId)?.name ??
          null,
      )
      .filter((name): name is string => Boolean(name)),
  );

  function handleFlavorChange(value: string | string[]) {
    if (flavorMode === "single") {
      onFlavorChange(value as string);
    } else {
      onFlavorIdsChange(value as string[]);
    }
  }

  function isExtraInGroup(group: AddonGroup): string[] {
    const groupIds = new Set(group.items.map((item) => item.id));
    return selectedExtraAddonIds.filter((id) => groupIds.has(id));
  }

  function isExtraInAddons(addons: Addon[]): string[] {
    const addonIds = new Set(addons.map((addon) => addon.id));
    return selectedExtraAddonIds.filter((id) => addonIds.has(id));
  }
</script>

<section class="rounded-xl border border-base-300 bg-base-100 p-4 space-y-4">
  <!-- Product + Quantity -->
  <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
    <div class="form-control">
      <span id="order-product-label" class="label-text text-xs mb-1"
        >Producto</span
      >
      <select
        id="order-product"
        class="select select-bordered select-sm w-full"
        value={orderForm.product_id}
        required
        aria-labelledby="order-product-label"
        onchange={(event) =>
          onProductChange((event.currentTarget as HTMLSelectElement).value)}
      >
        {#if products.length === 0}
          <option value="" disabled>Sin productos</option>
        {:else}
          {#each products as product}
            <option value={product.id}>{product.name}</option>
          {/each}
        {/if}
      </select>
    </div>
    <div class="form-control w-20">
      <span id="order-quantity-label" class="label-text text-xs mb-1"
        >Cantidad</span
      >
      <input
        id="order-quantity"
        class="input input-bordered input-sm w-full text-center"
        type="number"
        min="1"
        value={orderForm.quantity}
        required
        aria-labelledby="order-quantity-label"
        oninput={(event) =>
          onQuantityChange(
            Number((event.currentTarget as HTMLInputElement).value || 1),
          )}
      />
    </div>
  </div>

  <!-- Customizations -->
  {#if hasCustomizationOptions}
    <div class="space-y-4">
      {#if flavorMode !== "none"}
        <FlavorSelector
          flavors={selectedProductFlavors}
          mode={flavorMode}
          {ballQuantity}
          selectedId={selectedFlavorId}
          selectedIds={selectedFlavorIds}
          label={flavorMode === "single" ? "Sabor" : "Sabores"}
          required={true}
          error={requiresFlavorSelection ? "Selecciona un sabor" : ""}
          onChange={handleFlavorChange}
        />
      {/if}

      {#if toppingAddons.length > 0 || jaleaAddons.length > 0}
        <div class="grid gap-4 md:grid-cols-2">
          {#if toppingAddons.length > 0}
            <AddonChipGroup
              items={toppingAddons}
              includedId={includedToppingId}
              selectedIds={isExtraInAddons(toppingAddons)}
              noneId={NONE_CUSTOMIZATION}
              noneLabel="Sin topping"
              label="Topping"
              required={true}
              error={requiresToppingSelection
                ? "Selecciona un topping o 'Sin topping'"
                : ""}
              onIncludedChange={onChangeIncludedTopping}
              onToggleExtra={onToggleExtraAddonSelection}
            />
          {/if}

          {#if jaleaAddons.length > 0}
            <AddonChipGroup
              items={jaleaAddons}
              includedId={includedJaleaId}
              selectedIds={isExtraInAddons(jaleaAddons)}
              noneId={NONE_CUSTOMIZATION}
              noneLabel="Sin jalea"
              label="Jalea"
              required={true}
              error={requiresJaleaSelection
                ? "Selecciona una jalea o 'Sin jalea'"
                : ""}
              onIncludedChange={onChangeIncludedJalea}
              onToggleExtra={onToggleExtraAddonSelection}
            />
          {/if}
        </div>
      {/if}

      {#each paidAddonGroups as group}
        <AddonChipGroup
          items={group.items}
          selectedIds={isExtraInGroup(group)}
          label={group.label}
          variant="multi"
          onToggleExtra={onToggleExtraAddonSelection}
        />
      {/each}
    </div>
  {/if}

  <!-- Preview + Confirm -->
  {#if selectedProduct}
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-base-200/50 px-3 py-2.5"
    >
      <div class="min-w-0">
        <p class="text-sm font-medium truncate">
          {selectedProduct.name}
        </p>
        <div
          class="flex flex-wrap items-center gap-1 text-xs text-base-content/70"
        >
          {#if allowsMixedFlavors && selectedFlavorIds.some((id) => id)}
            {@const names = selectedFlavorIds
              .map(
                (id) =>
                  selectedProductFlavors.find((flavor) => flavor.id === id)
                    ?.name,
              )
              .filter(Boolean)
              .join(", ")}
            <span class="truncate max-w-[12rem]" title={names}>
              {names}
            </span>
          {:else if currentFlavorName}
            <span>{currentFlavorName}</span>
          {/if}
          {#if currentIncludedAddonNames.length > 0}
            <span
              class="truncate max-w-[12rem]"
              title={currentIncludedAddonNames.join(", ")}
            >
              · {currentIncludedAddonNames.join(", ")}
            </span>
          {/if}
          {#if currentExtraAddonNames.length > 0}
            <span
              class="truncate max-w-[12rem]"
              title={currentExtraAddonNames.join(", ")}
            >
              + {currentExtraAddonNames.join(", ")}
            </span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <p class="text-xs text-base-content/60">Subtotal</p>
          <p class="text-sm font-semibold">{formatCurrency(totalPreview)}</p>
        </div>
        <div class="flex items-center gap-1.5">
          {#if draftItemEditIndex !== null}
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              onclick={onCancelDraftItemEdit}
            >
              Cancelar
            </button>
          {/if}
          <button
            class="btn btn-primary btn-sm"
            type="button"
            onclick={onAddDraftItem}
            disabled={!canAddCurrentItem}
          >
            {draftItemEditIndex !== null ? "Guardar" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if addItemError}
    <p class="text-xs text-error">{addItemError}</p>
  {/if}

  {#if draftItemEditIndex !== null}
    <div class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5">
      <p class="text-xs font-medium text-warning-content">
        Editando el item #{draftItemEditIndex + 1}.
      </p>
    </div>
  {/if}

  <AddedItemsList
    {manualItems}
    {draftItemEditIndex}
    onEdit={onEditDraftItem}
    onRemove={onRemoveDraftItem}
    onUpdateQuantity={onUpdateDraftItemQuantity}
    {onProductById}
    {onResolveFlavorName}
    {onResolveAddonNames}
    {onManualItemSubtotal}
    {onDraftItemKey}
  />
</section>
