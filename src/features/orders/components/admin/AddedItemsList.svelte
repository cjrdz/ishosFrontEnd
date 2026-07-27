<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import type { Product } from "@features/admin-management";
  import type { ManualOrderItemDraft } from "../../types/orders-tab";

  interface Props {
    manualItems: ManualOrderItemDraft[];
    draftItemEditIndex: number | null;
    manualOrderTotal: number;
    onEdit: (index: number) => void;
    onRemove: (index: number) => void;
    onUpdateQuantity: (index: number, quantity: number) => void;
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
    manualItems,
    draftItemEditIndex,
    manualOrderTotal,
    onEdit,
    onRemove,
    onUpdateQuantity,
    onProductById,
    onResolveFlavorName,
    onResolveAddonNames,
    onManualItemSubtotal,
    onDraftItemKey,
  }: Props = $props();
</script>

{#if manualItems.length > 0}
  <div
    class="collapse collapse-arrow border border-base-300 bg-base-200/30 rounded-lg"
  >
    <input type="checkbox" checked />

    <div
      class="collapse-title min-h-0 py-2.5 px-3 flex items-center justify-between gap-2"
    >
      <div class="flex items-center gap-2">
        <Icon
          icon="lucide:package-check"
          class="h-4 w-4 text-base-content/60"
        />
        <span class="text-sm font-semibold text-base-content/90">
          {manualItems.length}
          {manualItems.length === 1 ? "producto" : "productos"}
        </span>
      </div>
      <span class="text-sm font-bold text-primary">
        {formatCurrency(manualOrderTotal)}
      </span>
    </div>

    <div class="collapse-content px-3 pb-3 pt-0">
      <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
        {#each manualItems as item, index (onDraftItemKey(item, index))}
          {@const product = onProductById(item.product_id)}
          {@const includedNames = onResolveAddonNames(
            item.product_id,
            item.included_addon_ids,
          )}
          {@const extraNames = onResolveAddonNames(
            item.product_id,
            item.extra_addon_ids,
          )}
          {@const isEditing = draftItemEditIndex === index}
          <div
            class={`rounded-lg border p-2.5 ${
              isEditing
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-base-200 bg-base-100"
            }`}
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 space-y-0.5 flex-1">
                <div class="flex flex-wrap items-center gap-1">
                  <span class="text-sm font-medium">
                    {product?.name ?? "Producto"}
                  </span>
                  {#if item.flavor_ids && item.flavor_ids.length > 0}
                    {#each item.flavor_ids as flavorId}
                      {@const name = onResolveFlavorName(
                        item.product_id,
                        flavorId,
                      )}
                      {#if name}
                        <span class="badge badge-ghost badge-xs">{name}</span>
                      {/if}
                    {/each}
                  {:else if onResolveFlavorName(item.product_id, item.flavor_id)}
                    <span class="badge badge-ghost badge-xs">
                      {onResolveFlavorName(item.product_id, item.flavor_id)}
                    </span>
                  {/if}
                </div>
                {#if includedNames.length > 0 || extraNames.length > 0}
                  <p class="text-xs text-base-content/50 truncate">
                    {includedNames.length > 0
                      ? `incl. ${includedNames.join(", ")}`
                      : ""}
                    {includedNames.length > 0 && extraNames.length > 0
                      ? " · "
                      : ""}
                    {extraNames.length > 0 ? `+ ${extraNames.join(", ")}` : ""}
                  </p>
                {/if}
              </div>
              <div class="text-sm font-semibold whitespace-nowrap">
                {formatCurrency(onManualItemSubtotal(item))}
              </div>
            </div>

            <div
              class="mt-1.5 flex flex-wrap items-center justify-between gap-1.5"
            >
              <div class="join">
                <button
                  class="btn btn-xs join-item"
                  type="button"
                  aria-label="Disminuir cantidad"
                  onclick={() =>
                    onUpdateQuantity(index, Math.max(0, item.quantity - 1))}
                >
                  -
                </button>
                <span
                  class="btn btn-xs join-item no-animation min-w-8 text-xs"
                  aria-label={`Cantidad: ${item.quantity}`}
                >
                  {item.quantity}
                </span>
                <button
                  class="btn btn-xs join-item"
                  type="button"
                  aria-label="Aumentar cantidad"
                  onclick={() => onUpdateQuantity(index, item.quantity + 1)}
                >
                  +
                </button>
              </div>

              <div class="flex items-center gap-0.5">
                <button
                  class="btn btn-ghost btn-xs btn-square"
                  type="button"
                  aria-label="Editar producto"
                  title="Editar"
                  onclick={() => onEdit(index)}
                >
                  <Icon icon="lucide:pencil" width="12" height="12" />
                </button>
                <button
                  class="btn btn-ghost btn-xs btn-square text-error"
                  type="button"
                  aria-label="Quitar producto"
                  title="Quitar"
                  onclick={() => onRemove(index)}
                >
                  <Icon icon="lucide:trash-2" width="12" height="12" />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
