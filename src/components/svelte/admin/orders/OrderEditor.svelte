<script lang="ts">
  import type { Product, Order, Flavor, Addon } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";
  import OrderItemBuilder from "./OrderItemBuilder.svelte";
  import type { ManualOrderItemDraft, OrderFormState } from "../tabs/types/orders-tab";

  interface AddonGroup {
    key: string;
    label: string;
    items: Addon[];
  }

  interface Props {
    open: boolean;
    isEditing: boolean;
    selectedOrder: Order | null;
    busy: boolean;
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
    editError: string;
    editNotice: string;
    onSubmit: (event: SubmitEvent) => void;
    onClose: () => void;
    onCancelEdit: () => void;
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
    onResolveFlavorName: (productId: string, flavorId: string | undefined) => string | null;
    onResolveAddonNames: (productId: string, addonIds: string[]) => string[];
    onManualItemSubtotal: (item: ManualOrderItemDraft) => number;
    onDraftItemKey: (item: ManualOrderItemDraft, index: number) => string;
  }

  let {
    open,
    isEditing,
    selectedOrder,
    busy,
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
    editError,
    editNotice,
    onSubmit,
    onClose,
    onCancelEdit,
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

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let noteDialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      noteDialogRef?.close();
      dialogRef.close();
    }
  });

  function openNotesDialog() {
    noteDialogRef?.showModal();
  }

  function closeNotesDialog() {
    noteDialogRef?.close();
  }
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar orden" : "Crear orden manual"}</h3>
      {#if isEditing && selectedOrder}
        <span class="text-xs text-base-content/60">{selectedOrder.order_number}</span>
      {/if}
    </div>
    <form class="mt-5" onsubmit={onSubmit}>
      <div class="grid gap-5">
        <div class="grid md:grid-cols-2 gap-5">
          <div class="form-control">
            <span id="order-customer-name-label" class="label-text mb-1">Nombre cliente</span>
            <input id="order-customer-name" class="input input-bordered" bind:value={orderForm.customer_name} required aria-labelledby="order-customer-name-label" />
          </div>
          <div class="form-control">
            <span id="order-customer-phone-label" class="label-text mb-1">Telefono</span>
            <input id="order-customer-phone" class="input input-bordered" bind:value={orderForm.customer_phone} required aria-labelledby="order-customer-phone-label" />
          </div>
          <div class="form-control md:col-span-2">
            <span id="order-customer-email-label" class="label-text mb-1">Correo (opcional)</span>
            <input id="order-customer-email" class="input input-bordered" type="email" bind:value={orderForm.customer_email} aria-labelledby="order-customer-email-label" />
          </div>
          <div class="form-control">
            <span id="order-payment-method-label" class="label-text mb-1">Metodo de pago</span>
            <select id="order-payment-method" class="select select-bordered" bind:value={orderForm.payment_method} aria-labelledby="order-payment-method-label">
              <option value="efectivo">efectivo</option>
              <option value="tarjeta">tarjeta</option>
              <option value="transferencia">transferencia</option>
              <option value="otro">otro</option>
            </select>
          </div>
          <div class="form-control">
            <span id="order-type-label" class="label-text mb-1">Tipo de orden</span>
            <select id="order-type" class="select select-bordered" bind:value={orderForm.order_type} aria-labelledby="order-type-label">
              <option value="para_llevar">para llevar</option>
              <option value="en_local">en local</option>
            </select>
          </div>
          <div class="form-control">
            <span id="order-table-number-label" class="label-text mb-1">Mesa</span>
            <input
              id="order-table-number"
              class="input input-bordered"
              type="number"
              min="1"
              placeholder={orderForm.order_type === "en_local" ? "Numero de mesa" : "No aplica"}
              bind:value={orderForm.table_number}
              required={orderForm.order_type === "en_local"}
              disabled={orderForm.order_type !== "en_local"}
              aria-labelledby="order-table-number-label"
            />
          </div>
        </div>
        {#if !isEditing}
          <OrderItemBuilder
            {products}
            {orderForm}
            {manualItems}
            {selectedProductFlavors}
            {toppingAddons}
            {jaleaAddons}
            {selectedProductAddons}
            {paidAddonGroups}
            {selectedFlavorId}
            {includedToppingId}
            {includedJaleaId}
            {selectedExtraAddonIds}
            {hasCustomizationOptions}
            {totalPreview}
            {manualOrderTotal}
            {addItemError}
            {busy}
            {onProductChange}
            {onQuantityChange}
            {onFlavorChange}
            onChangeIncludedTopping={onChangeIncludedTopping}
            onChangeIncludedJalea={onChangeIncludedJalea}
            onToggleExtraAddonSelection={onToggleExtraAddonSelection}
            onAddDraftItem={onAddDraftItem}
            onRemoveDraftItem={onRemoveDraftItem}
            onUpdateDraftItemQuantity={onUpdateDraftItemQuantity}
            onProductById={onProductById}
            onResolveFlavorName={onResolveFlavorName}
            onResolveAddonNames={onResolveAddonNames}
            onManualItemSubtotal={onManualItemSubtotal}
            onDraftItemKey={onDraftItemKey}
          />
        {:else}
          <div class="grid md:grid-cols-2 gap-5">
            <div class="form-control">
              <span id="order-product-label" class="label-text mb-1">Producto</span>
              <select id="order-product" class="select select-bordered" bind:value={orderForm.product_id} required disabled aria-labelledby="order-product-label">
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
              <input id="order-quantity" class="input input-bordered" type="number" min="1" bind:value={orderForm.quantity} required disabled aria-labelledby="order-quantity-label" />
            </div>
          </div>
        {/if}
        <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p class="font-medium">Nota de la orden</p>
              <p class="text-sm text-base-content/70">
                {orderForm.notes.trim() ? orderForm.notes : "Sin nota agregada"}
              </p>
            </div>
            <button class="btn btn-outline btn-sm" type="button" onclick={openNotesDialog}>
              {orderForm.notes.trim() ? "Editar nota" : "Agregar nota"}
            </button>
          </div>
        </div>
        <div class="text-sm text-base-content/70">
          {#if isEditing}
            {#if selectedOrder}
              <p>Total actual: <strong>{formatCurrency(selectedOrder.total_amount)}</strong></p>
            {/if}
          {:else}
            <p>Total estimado de la orden: <strong>{formatCurrency(manualItems.length > 0 ? manualOrderTotal : totalPreview)}</strong></p>
          {/if}
        </div>
        {#if editError}
          <div class="text-sm text-error">{editError}</div>
        {/if}
        {#if editNotice}
          <div class="alert alert-success py-2">
            <span>{editNotice}</span>
          </div>
        {/if}
        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {isEditing ? "Guardar cambios" : "Crear orden"}
          </button>
          <button class="btn btn-error btn-outline" type="button" onclick={onCancelEdit}>
            {isEditing ? "Cancelar edicion" : "Cancelar"}
          </button>
        </div>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={noteDialogRef}>
  <div class="modal-box max-w-xl">
    <div class="flex items-center justify-between gap-3">
      <h3 class="font-bold text-lg">Nota de la orden</h3>
      {#if orderForm.notes.trim()}
        <button class="btn btn-ghost btn-xs" type="button" onclick={() => (orderForm.notes = "")}>Limpiar</button>
      {/if}
    </div>
    <p class="mt-2 text-sm text-base-content/70">Agrega una observacion general para esta orden.</p>
    <textarea
      id="order-notes"
      class="textarea textarea-bordered w-full mt-4 min-h-40"
      rows="6"
      placeholder="Notas"
      bind:value={orderForm.notes}
      aria-label="Notas"
    ></textarea>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeNotesDialog}>Cerrar</button>
      <button class="btn btn-primary" type="button" onclick={closeNotesDialog}>Guardar nota</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeNotesDialog}>close</button>
  </form>
</dialog>
