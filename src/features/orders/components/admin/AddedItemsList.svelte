<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import type { Product } from "@features/admin-management";
  import type { ManualOrderItemDraft } from "../../types/orders-tab";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { motionMs } from "@shared/motion/motion";

  interface Props {
    manualItems: ManualOrderItemDraft[];
    draftItemEditIndex: number | null;
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
    onEdit,
    onRemove,
    onUpdateQuantity,
    onProductById,
    onResolveFlavorName,
    onResolveAddonNames,
    onManualItemSubtotal,
    onDraftItemKey,
  }: Props = $props();

  function flavorText(item: ManualOrderItemDraft): string {
    if (item.flavor_ids && item.flavor_ids.some(Boolean)) {
      return item.flavor_ids
        .map((id) => onResolveFlavorName(item.product_id, id))
        .filter(Boolean)
        .join(", ");
    }
    return onResolveFlavorName(item.product_id, item.flavor_id) ?? "";
  }
</script>

<ul class="divide-y divide-base-300">
  {#each manualItems as item, index (onDraftItemKey(item, index))}
    {@const product = onProductById(item.product_id)}
    {@const flavors = flavorText(item)}
    {@const included = onResolveAddonNames(
      item.product_id,
      item.included_addon_ids,
    )}
    {@const extras = onResolveAddonNames(item.product_id, item.extra_addon_ids)}
    {@const editing = draftItemEditIndex === index}
    <li
      class={`py-2.5 first:pt-0 last:pb-0 ${editing ? "rounded-field bg-primary/10 px-2 ring-1 ring-primary/40" : ""}`}
      animate:flip={{ duration: motionMs(200) }}
      in:fly={{ y: 8, duration: motionMs(180) }}
    >
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-snug">
            {product?.name ?? "Producto"}
          </p>
          {#if flavors}
            <p class="text-xs text-base-content/75">{flavors}</p>
          {/if}
          {#if included.length > 0}
            <p class="text-xs text-base-content/70">
              Incluye: {included.join(", ")}
            </p>
          {/if}
          {#if extras.length > 0}
            <p class="text-xs text-secondary">Extras: {extras.join(", ")}</p>
          {/if}
        </div>
        <p class="text-sm font-semibold tabular-nums whitespace-nowrap">
          {formatCurrency(onManualItemSubtotal(item))}
        </p>
      </div>

      <div class="mt-1.5 flex items-center justify-between gap-2">
        <div
          class="join"
          role="group"
          aria-label={`Cantidad de ${product?.name ?? "producto"}`}
        >
          <button
            class="btn btn-sm join-item btn-square"
            type="button"
            aria-label={item.quantity <= 1
              ? "Quitar producto"
              : "Disminuir cantidad"}
            onclick={() =>
              item.quantity <= 1
                ? onRemove(index)
                : onUpdateQuantity(index, item.quantity - 1)}
          >
            <Icon
              icon={item.quantity <= 1 ? "lucide:trash-2" : "lucide:minus"}
              class="size-3.5"
              aria-hidden="true"
            />
          </button>
          <span
            class="btn btn-sm join-item no-animation pointer-events-none min-w-10 tabular-nums"
            aria-live="polite"
          >
            {item.quantity}
          </span>
          <button
            class="btn btn-sm join-item btn-square"
            type="button"
            aria-label="Aumentar cantidad"
            onclick={() => onUpdateQuantity(index, item.quantity + 1)}
          >
            <Icon icon="lucide:plus" class="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="btn btn-ghost btn-sm gap-1"
            type="button"
            onclick={() => onEdit(index)}
            disabled={editing}
          >
            <Icon icon="lucide:pencil" class="size-3.5" aria-hidden="true" />
            {editing ? "Editando" : "Editar"}
          </button>
          <button
            class="btn btn-ghost btn-sm btn-square text-error"
            type="button"
            aria-label={`Quitar ${product?.name ?? "producto"}`}
            title="Quitar"
            onclick={() => onRemove(index)}
          >
            <Icon icon="lucide:x" class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  {/each}
</ul>
