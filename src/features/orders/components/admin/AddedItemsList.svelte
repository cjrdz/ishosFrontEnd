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
  <div class="rounded-xl border border-base-300 bg-base-100 p-3 space-y-3">
    <div
      class="flex items-center justify-between gap-2 border-b border-base-200/60 pb-2"
    >
      <span class="text-sm font-semibold text-base-content/90">
        {manualItems.length}
        {manualItems.length === 1 ? "producto" : "productos"}
      </span>
      <span class="text-sm font-bold text-primary">
        {formatCurrency(manualOrderTotal)}
      </span>
    </div>

    <div class="space-y-2">
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
        <div
          class={`rounded-lg border bg-base-100 p-3 ${
            draftItemEditIndex === index
              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
              : "border-base-200"
          }`}
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <h6 class="text-sm font-medium">
                  {product?.name ?? "Producto"}
                </h6>
                {#if item.flavor_ids && item.flavor_ids.length > 0}
                  {#each item.flavor_ids as flavorId}
                    {@const name = onResolveFlavorName(
                      item.product_id,
                      flavorId,
                    )}
                    {#if name}
                      <span class="badge badge-outline badge-sm">{name}</span>
                    {/if}
                  {/each}
                {:else if onResolveFlavorName(item.product_id, item.flavor_id)}
                  <span class="badge badge-outline badge-sm">
                    {onResolveFlavorName(item.product_id, item.flavor_id)}
                  </span>
                {/if}
              </div>
              {#if includedNames.length > 0}
                <p class="text-xs text-base-content/60">
                  Incluidos: {includedNames.join(", ")}
                </p>
              {/if}
              {#if extraNames.length > 0}
                <p class="text-xs text-base-content/60">
                  Extras: {extraNames.join(", ")}
                </p>
              {/if}
            </div>
            <div class="text-sm font-semibold whitespace-nowrap">
              {formatCurrency(onManualItemSubtotal(item))}
            </div>
          </div>

          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
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
                class="btn btn-xs join-item no-animation min-w-10 text-sm"
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

            <div class="flex items-center gap-1">
              <button
                class="btn btn-ghost btn-xs btn-square"
                type="button"
                aria-label="Editar producto"
                title="Editar"
                onclick={() => onEdit(index)}
              >
                <Icon icon="lucide:pencil" width="14" height="14" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square text-error"
                type="button"
                aria-label="Quitar producto"
                title="Quitar"
                onclick={() => onRemove(index)}
              >
                <Icon icon="lucide:trash-2" width="14" height="14" />
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
