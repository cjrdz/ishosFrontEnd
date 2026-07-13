<script lang="ts">
  import { onMount } from "svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import type {
    Addon,
    Category,
    Flavor,
    Product,
  } from "@features/admin-management";
  import type {
    ManualOrderItemDraft,
    OrderFormState,
  } from "../../types/orders-tab";
  import FlavorSelector from "@shared/components/FlavorSelector.svelte";
  import AddonChipGroup from "./AddonChipGroup.svelte";
  import AddedItemsList from "./AddedItemsList.svelte";
  import ProductSelector from "./ProductSelector.svelte";

  interface AddonGroup {
    key: string;
    label: string;
    items: Addon[];
  }

  interface Props {
    products: Product[];
    categories: Category[];
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

  const RECENT_PRODUCTS_KEY = "ishos:manual-order-recent-products";
  const MAX_RECENT = 5;
  const NONE_CUSTOMIZATION = "none";

  let {
    products,
    categories,
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
    manualOrderTotal,
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

  let recentProductIds = $state<string[]>([]);

  const recentProducts = $derived(
    recentProductIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p)),
  );

  const selectedProduct = $derived(onProductById(orderForm.product_id));
  const ballQuantity = $derived(selectedProduct?.ball_quantity ?? 1);
  const allowsMixedFlavors = $derived(
    (selectedProduct?.allows_mixed_flavors ?? false) && ballQuantity > 1,
  );
  const flavorMode = $derived(
    selectedProductFlavors.length === 0
      ? "none"
      : allowsMixedFlavors
        ? "fill"
        : "single",
  );

  const requiresFlavorSelection = $derived(
    flavorMode !== "none" &&
      (flavorMode === "fill"
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

  const configurationSummary = $derived.by(() => {
    const parts: string[] = [];
    if (allowsMixedFlavors && selectedFlavorIds.some((id) => id)) {
      parts.push(
        selectedFlavorIds
          .map(
            (id) =>
              selectedProductFlavors.find((flavor) => flavor.id === id)?.name,
          )
          .filter(Boolean)
          .join(", "),
      );
    } else if (currentFlavorName) {
      parts.push(currentFlavorName);
    }
    if (currentIncludedAddonNames.length > 0) {
      parts.push(`incl. ${currentIncludedAddonNames.join(", ")}`);
    }
    if (currentExtraAddonNames.length > 0) {
      parts.push(`+ ${currentExtraAddonNames.join(", ")}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "Sin personalización";
  });

  function handleFlavorChange(value: string | string[]) {
    if (flavorMode === "single") {
      onFlavorChange(value as string);
    } else {
      onFlavorIdsChange(value as string[]);
    }
  }

  function loadRecentProducts() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_PRODUCTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        recentProductIds = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      recentProductIds = [];
    }
  }

  function saveRecentProduct(productId: string) {
    if (typeof window === "undefined" || !productId) return;
    const next = [
      productId,
      ...recentProductIds.filter((id) => id !== productId),
    ].slice(0, MAX_RECENT);
    recentProductIds = next;
    try {
      window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function handleProductChange(productId: string) {
    onProductChange(productId);
  }

  function handleAddDraftItem() {
    if (orderForm.product_id) {
      saveRecentProduct(orderForm.product_id);
    }
    onAddDraftItem();
  }

  function increaseQuantity() {
    onQuantityChange(Math.max(1, orderForm.quantity + 1));
  }

  function decreaseQuantity() {
    onQuantityChange(Math.max(1, orderForm.quantity - 1));
  }

  onMount(() => {
    loadRecentProducts();
  });

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
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Left: product finder -->
    <ProductSelector
      {products}
      {categories}
      selectedProductId={orderForm.product_id}
      {recentProducts}
      onProductChange={handleProductChange}
    />

    <!-- Right: configuration panel -->
    <div class="space-y-4 min-w-0 flex flex-col">
      {#if !selectedProduct}
        <div
          class="rounded-lg border border-base-300 bg-base-200/40 px-3 py-6 text-center text-sm text-base-content/60 flex-1 flex items-center justify-center"
        >
          Selecciona un producto para configurarlo.
        </div>
      {:else}
        <!-- Selected product header -->
        <div class="rounded-lg border border-base-300 bg-base-200/30 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate">
                {selectedProduct.name}
              </p>
              <p class="text-xs text-base-content/60">
                {formatCurrency(selectedProduct.price)} unidad
              </p>
            </div>
            <p class="text-lg font-bold text-primary whitespace-nowrap">
              {formatCurrency(totalPreview)}
            </p>
          </div>
        </div>

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
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div class="card card-sm card-bordered bg-base-100">
                <div class="card-body p-3 space-y-2">
                  <h4 class="text-sm font-semibold text-base-content/80">
                    {group.label}
                  </h4>
                  <AddonChipGroup
                    items={group.items}
                    selectedIds={isExtraInGroup(group)}
                    label=""
                    variant="multi"
                    onToggleExtra={onToggleExtraAddonSelection}
                  />
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Quantity + summary + Add -->
        <div class="card card-sm card-bordered bg-base-200/30">
          <div class="card-body p-3 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-base-content/80"
                >Cantidad</span
              >
              <div class="join">
                <button
                  class="btn btn-sm join-item"
                  type="button"
                  aria-label="Disminuir cantidad"
                  onclick={decreaseQuantity}
                  disabled={orderForm.quantity <= 1}
                >
                  −
                </button>
                <span
                  class="btn btn-sm join-item no-animation min-w-10 text-sm"
                  aria-label={`Cantidad: ${orderForm.quantity}`}
                >
                  {orderForm.quantity}
                </span>
                <button
                  class="btn btn-sm join-item"
                  type="button"
                  aria-label="Aumentar cantidad"
                  onclick={increaseQuantity}
                >
                  +
                </button>
              </div>
            </div>

            <div class="text-xs text-base-content/60 truncate">
              {configurationSummary}
            </div>

            <button
              class="btn btn-primary w-full"
              type="button"
              onclick={handleAddDraftItem}
              disabled={!canAddCurrentItem}
            >
              {draftItemEditIndex !== null ? "Guardar cambios" : "Agregar"}
              <span class="ml-1 text-sm opacity-90">
                {formatCurrency(totalPreview)}
              </span>
            </button>

            {#if draftItemEditIndex !== null}
              <button
                class="btn btn-ghost btn-sm w-full"
                type="button"
                onclick={onCancelDraftItemEdit}
              >
                Cancelar edición
              </button>
            {/if}
          </div>
        </div>
      {/if}

      {#if addItemError}
        <p class="text-xs text-error">{addItemError}</p>
      {/if}

      {#if draftItemEditIndex !== null}
        <div
          class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5"
        >
          <p class="text-xs font-medium text-warning-content">
            Editando el item #{draftItemEditIndex + 1}.
          </p>
        </div>
      {/if}

      <AddedItemsList
        {manualItems}
        {draftItemEditIndex}
        {manualOrderTotal}
        onEdit={onEditDraftItem}
        onRemove={onRemoveDraftItem}
        onUpdateQuantity={onUpdateDraftItemQuantity}
        {onProductById}
        {onResolveFlavorName}
        {onResolveAddonNames}
        {onManualItemSubtotal}
        {onDraftItemKey}
      />
    </div>
  </div>
</section>
