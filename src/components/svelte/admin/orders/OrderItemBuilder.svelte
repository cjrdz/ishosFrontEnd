<script lang="ts">
  import { formatCurrency } from "../../../../lib/utils/formatters";
  import type { Addon, Flavor, Product } from "../../../../lib/api/admin";
  import type {
    ManualOrderItemDraft,
    OrderFormState,
  } from "../tabs/types/orders-tab";

  interface AddonGroup {
    key: string;
    label: string;
    items: Addon[];
  }

  interface Props {
    products: Product[];
    orderForm: OrderFormState;
    manualItems: ManualOrderItemDraft[];
    selectedProductFlavors: Flavor[];
    toppingAddons: Addon[];
    jaleaAddons: Addon[];
    selectedProductAddons: Addon[];
    paidAddonGroups: AddonGroup[];
    selectedFlavorId: string;
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
    onChangeIncludedTopping: (value: string) => void;
    onChangeIncludedJalea: (value: string) => void;
    onToggleExtraAddonSelection: (addonId: string, checked: boolean) => void;
    onAddDraftItem: () => void;
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
    selectedProductFlavors,
    toppingAddons,
    jaleaAddons,
    selectedProductAddons,
    paidAddonGroups,
    selectedFlavorId,
    includedToppingId,
    includedJaleaId,
    selectedExtraAddonIds,
    hasCustomizationOptions,
    totalPreview,
    manualOrderTotal,
    addItemError,
    busy,
    onProductChange,
    onQuantityChange,
    onFlavorChange,
    onChangeIncludedTopping,
    onChangeIncludedJalea,
    onToggleExtraAddonSelection,
    onAddDraftItem,
    onRemoveDraftItem,
    onUpdateDraftItemQuantity,
    onProductById,
    onResolveFlavorName,
    onResolveAddonNames,
    onManualItemSubtotal,
    onDraftItemKey,
  }: Props = $props();

  const requiresFlavorSelection = $derived(
    selectedProductFlavors.length > 0 && !selectedFlavorId,
  );
  const canAddCurrentItem = $derived(
    !busy && products.length > 0 && !requiresFlavorSelection,
  );
  const hasIncludedAddonSelectors = $derived(
    toppingAddons.length > 0 || jaleaAddons.length > 0,
  );
</script>

<section
  class="rounded-2xl border border-base-300 bg-base-200/50 p-4 space-y-4"
>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div>
      <h4 class="font-semibold">Productos de la orden</h4>
      <p class="text-sm text-base-content/70">
        Agrega una o varias configuraciones del mismo producto o de productos
        distintos antes de crear la orden.
      </p>
    </div>
    <div class="text-sm text-base-content/70">
      {manualItems.length} item(s) agregados
    </div>
  </div>

  <div
    class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)] md:items-end"
  >
    <div class="form-control">
      <span id="order-product-label" class="label-text mb-1">Producto</span>
      <select
        id="order-product"
        class="select select-bordered w-full"
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
    <div class="form-control">
      <span id="order-quantity-label" class="label-text mb-1">Cantidad</span>
      <input
        id="order-quantity"
        class="input input-bordered w-full"
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

  {#if hasCustomizationOptions}
    <section
      class="rounded-2xl border border-base-300 bg-base-100 p-4 space-y-4"
    >
      {#if selectedProductFlavors.length > 0 || hasIncludedAddonSelectors}
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {#if selectedProductFlavors.length > 0}
            <div class="form-control">
              <span id="order-flavor-label" class="label-text mb-1">
                Sabor
                <span class="text-error">*</span>
              </span>
              <select
                id="order-flavor"
                class="select select-bordered w-full"
                value={selectedFlavorId}
                aria-labelledby="order-flavor-label"
                onchange={(event) =>
                  onFlavorChange(
                    (event.currentTarget as HTMLSelectElement).value,
                  )}
              >
                <option value="">Selecciona un sabor</option>
                {#each selectedProductFlavors as flavor}
                  <option value={flavor.id}>{flavor.name}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if toppingAddons.length > 0}
            <div class="form-control">
              <span id="order-included-topping-label" class="label-text mb-1"
                >Topping opcional</span
              >
              <select
                id="order-included-topping"
                class="select select-bordered w-full"
                value={includedToppingId}
                onchange={(event) =>
                  onChangeIncludedTopping(
                    (event.currentTarget as HTMLSelectElement).value,
                  )}
                aria-labelledby="order-included-topping-label"
              >
                <option value="">Sin topping</option>
                {#each toppingAddons as addon}
                  <option value={addon.id}>{addon.name}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if jaleaAddons.length > 0}
            <div class="form-control">
              <span id="order-included-jalea-label" class="label-text mb-1"
                >Jalea opcional</span
              >
              <select
                id="order-included-jalea"
                class="select select-bordered w-full"
                value={includedJaleaId}
                onchange={(event) =>
                  onChangeIncludedJalea(
                    (event.currentTarget as HTMLSelectElement).value,
                  )}
                aria-labelledby="order-included-jalea-label"
              >
                <option value="">Sin jalea</option>
                {#each jaleaAddons as addon}
                  <option value={addon.id}>{addon.name}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
      {/if}
      {#if selectedProductAddons.length > 0}
        <div class="form-control">
          <span class="label-text mb-2">Extras con costo</span>
          <p class="text-xs text-base-content/60 mb-1">
            Usa estos toggles para agregar toppings, jaleas u otros extras
            adicionales que si deben cobrarse.
          </p>
          <div class="space-y-3">
            {#if toppingAddons.length > 0}
              <div class="space-y-2">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-base-content/60"
                >
                  Toppings extra
                </p>
                <div class="grid gap-2 md:grid-cols-2">
                  {#each toppingAddons as addon}
                    <label
                      class="label w-full cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={selectedExtraAddonIds.includes(addon.id)}
                        disabled={addon.id === includedToppingId}
                        onchange={(event) =>
                          onToggleExtraAddonSelection(
                            addon.id,
                            (event.currentTarget as HTMLInputElement).checked,
                          )}
                      />
                      <span class="label-text flex-1">{addon.name}</span>
                      <span class="text-xs font-medium text-base-content/70"
                        >+{formatCurrency(addon.price)}</span
                      >
                    </label>
                  {/each}
                </div>
              </div>
            {/if}

            {#if jaleaAddons.length > 0}
              <div class="space-y-2">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-base-content/60"
                >
                  Jalea extra
                </p>
                <div class="grid gap-2 md:grid-cols-2">
                  {#each jaleaAddons as addon}
                    <label
                      class="label w-full cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={selectedExtraAddonIds.includes(addon.id)}
                        disabled={addon.id === includedJaleaId}
                        onchange={(event) =>
                          onToggleExtraAddonSelection(
                            addon.id,
                            (event.currentTarget as HTMLInputElement).checked,
                          )}
                      />
                      <span class="label-text flex-1">{addon.name}</span>
                      <span class="text-xs font-medium text-base-content/70"
                        >+{formatCurrency(addon.price)}</span
                      >
                    </label>
                  {/each}
                </div>
              </div>
            {/if}

            {#each paidAddonGroups as group}
              <div class="space-y-2">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-base-content/60"
                >
                  {group.label}
                </p>
                <div class="grid gap-2 md:grid-cols-2">
                  {#each group.items as addon}
                    <label
                      class="label w-full cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={selectedExtraAddonIds.includes(addon.id)}
                        onchange={(event) =>
                          onToggleExtraAddonSelection(
                            addon.id,
                            (event.currentTarget as HTMLInputElement).checked,
                          )}
                      />
                      <span class="label-text flex-1">{addon.name}</span>
                      <span class="text-xs font-medium text-base-content/70"
                        >+{formatCurrency(addon.price)}</span
                      >
                    </label>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <div
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-base-300 bg-base-100 px-4 py-3"
  >
    <div class="text-sm text-base-content/70 space-y-1">
      <p>
        Subtotal de esta configuracion: <strong
          >{formatCurrency(totalPreview)}</strong
        >
      </p>
      <p>
        Total acumulado en la orden: <strong
          >{formatCurrency(manualOrderTotal)}</strong
        >
      </p>
    </div>
    <div class="space-y-1 md:text-right">
      <button
        class="btn btn-outline btn-primary"
        type="button"
        onclick={onAddDraftItem}
        disabled={!canAddCurrentItem}
      >
        Agregar producto
      </button>
      {#if addItemError}
        <p class="text-xs text-error">{addItemError}</p>
      {:else if requiresFlavorSelection}
        <p class="text-xs text-warning">
          Selecciona un sabor para habilitar la accion.
        </p>
      {:else}
        <p class="text-xs text-base-content/60">
          La configuracion actual se agrega a la orden solo cuando presionas
          este boton.
        </p>
      {/if}
    </div>
  </div>

  <section class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h5 class="font-semibold">Items agregados</h5>
      <span class="text-xs text-base-content/60"
        >Puedes repetir el mismo producto con diferentes sabores o extras.</span
      >
    </div>
    {#if manualItems.length === 0}
      <div
        class="rounded-xl border border-base-300 bg-base-100 px-4 py-5 text-sm text-base-content/70"
      >
        No has agregado productos todavia.
      </div>
    {:else}
      <div class="space-y-3">
        {#each manualItems as item, index (onDraftItemKey(item, index))}
          <div
            class="rounded-xl border border-base-300 bg-base-100 p-4 space-y-3"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h6 class="font-medium">
                    {onProductById(item.product_id)?.name ?? "Producto"}
                  </h6>
                  {#if onResolveFlavorName(item.product_id, item.flavor_id)}
                    <span class="badge badge-outline"
                      >Sabor: {onResolveFlavorName(
                        item.product_id,
                        item.flavor_id,
                      )}</span
                    >
                  {/if}
                </div>
                {#if onResolveAddonNames(item.product_id, item.included_addon_ids).length > 0}
                  <p class="text-xs text-base-content/60">
                    Incluidos: {onResolveAddonNames(
                      item.product_id,
                      item.included_addon_ids,
                    ).join(", ")}
                  </p>
                {/if}
                {#if onResolveAddonNames(item.product_id, item.extra_addon_ids).length > 0}
                  <p class="text-xs text-base-content/60">
                    Extras: {onResolveAddonNames(
                      item.product_id,
                      item.extra_addon_ids,
                    ).join(", ")}
                  </p>
                {/if}
              </div>
              <div class="text-sm font-semibold whitespace-nowrap">
                {formatCurrency(onManualItemSubtotal(item))}
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="join">
                <button
                  class="btn btn-sm join-item"
                  type="button"
                  onclick={() =>
                    onUpdateDraftItemQuantity(index, item.quantity - 1)}
                  >-</button
                >
                <span class="btn btn-sm join-item no-animation min-w-14 text-sm"
                  >{item.quantity}</span
                >
                <button
                  class="btn btn-sm join-item"
                  type="button"
                  onclick={() =>
                    onUpdateDraftItemQuantity(index, item.quantity + 1)}
                  >+</button
                >
              </div>
              <button
                class="btn btn-sm btn-error btn-outline"
                type="button"
                onclick={() => onRemoveDraftItem(index)}
              >
                Quitar
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</section>
