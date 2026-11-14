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
  import Icon from "@shared/components/AppIcon.svelte";

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
    includedToppingIds: string[];
    includedJaleaIds: string[];
    selectedExtraAddonIds: string[];
    toppingFreeAllowance: number;
    jaleaFreeAllowance: number;
    toppingSelection?: "none" | "selected";
    jaleaSelection?: "none" | "selected";
    hasCustomizationOptions: boolean;
    totalPreview: number;
    manualOrderTotal: number;
    addItemError: string;
    busy: boolean;
    onProductChange: (value: string) => void;
    onQuantityChange: (value: number) => void;
    onFlavorChange: (value: string) => void;
    onFlavorIdsChange: (value: string[]) => void;
    onToppingSelectionChange: (
      includedIds: string[],
      extraIds: string[],
    ) => void;
    onJaleaSelectionChange: (includedIds: string[], extraIds: string[]) => void;
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
    includedToppingIds,
    includedJaleaIds,
    selectedExtraAddonIds,
    toppingFreeAllowance,
    jaleaFreeAllowance,
    toppingSelection,
    jaleaSelection,
    hasCustomizationOptions,
    totalPreview,
    manualOrderTotal,
    addItemError,
    onProductChange,
    onQuantityChange,
    onFlavorChange,
    onFlavorIdsChange,
    onToppingSelectionChange,
    onJaleaSelectionChange,
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
  /** The right panel shows the product being configured instead of the order. */
  let configuring = $state(false);
  /** Missing choices are only flagged after the first "Agregar" attempt. */
  let attempted = $state(false);

  const showConfig = $derived(
    (configuring || draftItemEditIndex !== null) && !!orderForm.product_id,
  );
  const countsById = $derived(
    manualItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.product_id] = (acc[item.product_id] ?? 0) + item.quantity;
      return acc;
    }, {}),
  );
  const itemUnits = $derived(
    manualItems.reduce((sum, item) => sum + item.quantity, 0),
  );

  function pickProduct(productId: string) {
    if (draftItemEditIndex !== null) onCancelDraftItemEdit();
    attempted = false;
    onProductChange(productId);
    configuring = true;
  }

  function closeConfig() {
    if (draftItemEditIndex !== null) onCancelDraftItemEdit();
    attempted = false;
    configuring = false;
  }

  function editItem(index: number) {
    attempted = false;
    onEditDraftItem(index);
    configuring = true;
  }

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
    toppingAddons.length > 0 && toppingSelection === undefined,
  );
  const requiresJaleaSelection = $derived(
    jaleaAddons.length > 0 && jaleaSelection === undefined,
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
    [...includedToppingIds, ...includedJaleaIds]
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

  function handleAddDraftItem() {
    if (!canAddCurrentItem) {
      attempted = true;
      return;
    }
    if (orderForm.product_id) {
      saveRecentProduct(orderForm.product_id);
    }
    onAddDraftItem();
    if (!addItemError) {
      attempted = false;
      configuring = false;
    }
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

<div class="builder" class:builder-configuring={showConfig}>
  <!-- Left: catalog -->
  <div class="builder-catalog">
    <ProductSelector
      {products}
      {categories}
      activeProductId={showConfig ? orderForm.product_id : ""}
      {recentProducts}
      {countsById}
      onPick={pickProduct}
    />
  </div>

  <!-- Right: configure the tapped product, or review the order so far -->
  <div class="builder-side">
    {#if showConfig && selectedProduct}
      <div
        class="flex items-start justify-between gap-3 border-b border-base-300 p-4"
      >
        <div class="min-w-0">
          <p
            class="text-xs font-medium uppercase tracking-wide text-base-content/60"
          >
            {draftItemEditIndex !== null
              ? `Editando producto ${draftItemEditIndex + 1}`
              : "Configurar"}
          </p>
          <h4 class="text-lg font-bold leading-tight">
            {selectedProduct.name}
          </h4>
          <p class="text-sm text-base-content/70 tabular-nums">
            {formatCurrency(selectedProduct.price)} c/u
          </p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle"
          onclick={closeConfig}
          aria-label="Volver a la orden"
          title="Volver a la orden"
        >
          <Icon icon="lucide:x" class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {#if hasCustomizationOptions}
          {#if flavorMode !== "none"}
            <FlavorSelector
              flavors={selectedProductFlavors}
              mode={flavorMode}
              {ballQuantity}
              selectedId={selectedFlavorId}
              selectedIds={selectedFlavorIds}
              label={flavorMode === "single" ? "Sabor" : "Sabores"}
              required={true}
              error={attempted && requiresFlavorSelection
                ? "Elige el sabor"
                : ""}
              onChange={handleFlavorChange}
            />
          {/if}

          {#if toppingAddons.length > 0}
            <AddonChipGroup
              items={toppingAddons}
              includedIds={includedToppingIds}
              selectedIds={isExtraInAddons(toppingAddons)}
              noneId={NONE_CUSTOMIZATION}
              noneLabel="Sin topping"
              noneSelected={toppingSelection === "none"}
              label="Topping"
              allowance={toppingFreeAllowance}
              required={true}
              error={attempted && requiresToppingSelection
                ? "Elige un topping o “Sin topping”"
                : ""}
              onUnifiedChange={onToppingSelectionChange}
              onToggleExtra={onToggleExtraAddonSelection}
            />
          {/if}

          {#if jaleaAddons.length > 0}
            <AddonChipGroup
              items={jaleaAddons}
              includedIds={includedJaleaIds}
              selectedIds={isExtraInAddons(jaleaAddons)}
              noneId={NONE_CUSTOMIZATION}
              noneLabel="Sin jalea"
              noneSelected={jaleaSelection === "none"}
              label="Jalea"
              allowance={jaleaFreeAllowance}
              required={true}
              error={attempted && requiresJaleaSelection
                ? "Elige una jalea o “Sin jalea”"
                : ""}
              onUnifiedChange={onJaleaSelectionChange}
              onToggleExtra={onToggleExtraAddonSelection}
            />
          {/if}

          {#each paidAddonGroups as group (group.key)}
            <AddonChipGroup
              items={group.items}
              selectedIds={isExtraInGroup(group)}
              label={group.label}
              variant="multi"
              onToggleExtra={onToggleExtraAddonSelection}
            />
          {/each}
        {:else}
          <p class="text-sm text-base-content/70">
            Este producto no lleva opciones. Elige la cantidad y agrégalo.
          </p>
        {/if}
      </div>

      <div class="space-y-2 border-t border-base-300 bg-base-100 p-4">
        <p
          class="truncate text-xs text-base-content/70"
          title={configurationSummary}
        >
          {configurationSummary}
        </p>
        {#if addItemError}
          <p class="text-xs text-error" role="alert">{addItemError}</p>
        {/if}
        <div class="flex items-center gap-2">
          <div class="join" role="group" aria-label="Cantidad">
            <button
              class="btn join-item btn-square"
              type="button"
              aria-label="Disminuir cantidad"
              onclick={decreaseQuantity}
              disabled={orderForm.quantity <= 1}
            >
              <Icon icon="lucide:minus" class="size-4" aria-hidden="true" />
            </button>
            <span
              class="btn join-item no-animation pointer-events-none min-w-11 tabular-nums"
              aria-live="polite"
            >
              {orderForm.quantity}
            </span>
            <button
              class="btn join-item btn-square"
              type="button"
              aria-label="Aumentar cantidad"
              onclick={increaseQuantity}
            >
              <Icon icon="lucide:plus" class="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            class="btn btn-primary flex-1 justify-between"
            type="button"
            onclick={handleAddDraftItem}
          >
            <span>
              {#if draftItemEditIndex !== null}Guardar{:else}Agregar<span
                  class="hidden sm:inline"
                >
                  a la orden</span
                >{/if}
            </span>
            <span class="tabular-nums">{formatCurrency(totalPreview)}</span>
          </button>
        </div>
      </div>
    {:else}
      <div
        class="flex items-center justify-between gap-2 border-b border-base-300 p-4"
      >
        <h4 class="flex items-center gap-2 font-bold">
          <Icon
            icon="lucide:shopping-bag"
            class="size-4 text-primary"
            aria-hidden="true"
          />
          Orden actual
        </h4>
        {#if itemUnits > 0}
          <span class="badge badge-ghost tabular-nums"
            >{itemUnits} {itemUnits === 1 ? "artículo" : "artículos"}</span
          >
        {/if}
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        {#if manualItems.length === 0}
          <div
            class="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-base-content/70"
          >
            <Icon
              icon="lucide:pointer"
              class="size-8 text-base-content/40"
              aria-hidden="true"
            />
            <p class="text-sm font-medium">Toca un producto para empezar</p>
            <p class="text-xs">Eliges sabor y toppings, y se agrega aquí.</p>
          </div>
        {:else}
          <AddedItemsList
            {manualItems}
            {draftItemEditIndex}
            onEdit={editItem}
            onRemove={onRemoveDraftItem}
            onUpdateQuantity={onUpdateDraftItemQuantity}
            {onProductById}
            {onResolveFlavorName}
            {onResolveAddonNames}
            {onManualItemSubtotal}
            {onDraftItemKey}
          />
        {/if}
      </div>

      <div
        class="flex items-baseline justify-between gap-2 border-t border-base-300 p-4"
      >
        <span class="text-sm font-medium text-base-content/70">Total</span>
        <span class="text-2xl font-bold tabular-nums text-primary"
          >{formatCurrency(manualOrderTotal)}</span
        >
      </div>
    {/if}
  </div>
</div>

<style>
  .builder {
    display: grid;
    gap: 1rem;
  }

  .builder-catalog {
    min-width: 0;
  }

  .builder-side {
    display: flex;
    min-width: 0;
    flex-direction: column;
    border-radius: var(--radius-box);
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    overflow: hidden;
  }

  /* Phones/tablets: catalog first with its own scroll, the order panel below. */
  .builder-catalog {
    height: min(52dvh, 30rem);
  }

  /* Small screens: configuring takes the whole area; closing it brings the catalog back. */
  @media (max-width: 1023.98px) {
    .builder-configuring .builder-catalog {
      display: none;
    }
    /* The panel fills the space so "Agregar" stays in view. */
    .builder-configuring .builder-side {
      height: max(18rem, calc(90dvh - 16.5rem));
    }
  }

  @media (min-width: 1024px) {
    .builder {
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
      height: min(64dvh, 40rem);
    }
    .builder-catalog,
    .builder-side {
      height: 100%;
      min-height: 0;
    }
  }
</style>
