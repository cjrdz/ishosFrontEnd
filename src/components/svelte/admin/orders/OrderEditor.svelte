<script lang="ts">
  import Icon from "../../shared/AppIcon.svelte";
  import type {
    Product,
    Order,
    Flavor,
    Addon,
  } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";
  import OrderItemBuilder from "./OrderItemBuilder.svelte";
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
    onClearForm: () => void;
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
    onClearForm,
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

  const displayTotal = $derived(
    manualItems.length > 0 ? manualOrderTotal : totalPreview,
  );
</script>

<!-- Main order editor dialog -->
<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box w-11/12 max-w-4xl max-h-[92vh] overflow-y-auto p-0">
    <!-- Sticky header -->
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4"
    >
      <div class="flex flex-wrap items-center gap-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"
        >
          <Icon
            icon={isEditing ? "lucide:pencil" : "lucide:clipboard-list"}
            class="text-primary"
            width="16"
            height="16"
          />
        </div>
        <div>
          <h3 class="font-bold text-base leading-tight">
            {isEditing ? "Editar orden" : "Crear orden manual"}
          </h3>
          {#if isEditing && selectedOrder}
            <p class="text-xs text-base-content/50 leading-tight">
              {selectedOrder.order_number}
            </p>
          {/if}
        </div>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        type="button"
        onclick={onClose}
        aria-label="Cerrar"
      >
        <Icon icon="lucide:x" width="16" height="16" />
      </button>
    </div>

    <!-- Form body -->
    <form class="p-5 space-y-5" onsubmit={onSubmit}>
      <!-- Customer info section -->
      <section class="space-y-4">
        <div class="flex items-center gap-2">
          <Icon
            icon="lucide:user"
            width="14"
            height="14"
            class="text-base-content/50"
          />
          <p
            class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
          >
            Informacion del cliente
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <div class="form-control">
            <span id="order-customer-name-label" class="label-text mb-1.5"
              >Nombre del cliente</span
            >
            <input
              id="order-customer-name"
              class="input input-bordered w-full"
              placeholder="Nombre completo"
              bind:value={orderForm.customer_name}
              required
              aria-labelledby="order-customer-name-label"
            />
          </div>
          <div class="form-control">
            <span id="order-customer-phone-label" class="label-text mb-1.5"
              >Telefono</span
            >
            <input
              id="order-customer-phone"
              class="input input-bordered w-full"
              placeholder="Ej. 7000-0000"
              bind:value={orderForm.customer_phone}
              required
              aria-labelledby="order-customer-phone-label"
            />
          </div>
          <div class="form-control md:col-span-2">
            <span id="order-customer-email-label" class="label-text mb-1.5">
              Correo
              <span class="text-base-content/40 font-normal">(opcional)</span>
            </span>
            <input
              id="order-customer-email"
              class="input input-bordered w-full"
              type="email"
              placeholder="correo@ejemplo.com"
              bind:value={orderForm.customer_email}
              aria-labelledby="order-customer-email-label"
            />
          </div>
        </div>
      </section>

      <div class="divider my-0"></div>

      <!-- Order details section -->
      <section class="space-y-4">
        <div class="flex items-center gap-2">
          <Icon
            icon="lucide:receipt"
            width="14"
            height="14"
            class="text-base-content/50"
          />
          <p
            class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
          >
            Detalles de la orden
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-4">
          <div class="form-control">
            <span id="order-payment-method-label" class="label-text mb-1.5"
              >Metodo de pago</span
            >
            <select
              id="order-payment-method"
              class="select select-bordered w-full"
              bind:value={orderForm.payment_method}
              aria-labelledby="order-payment-method-label"
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="form-control">
            <span id="order-type-label" class="label-text mb-1.5"
              >Tipo de orden</span
            >
            <select
              id="order-type"
              class="select select-bordered w-full"
              bind:value={orderForm.order_type}
              aria-labelledby="order-type-label"
            >
              <option value="para_llevar">Para llevar</option>
              <option value="en_local">En local</option>
            </select>
          </div>
          <div class="form-control">
            <span id="order-table-number-label" class="label-text mb-1.5"
              >Mesa</span
            >
            <input
              id="order-table-number"
              class="input input-bordered w-full"
              type="number"
              min="1"
              placeholder={orderForm.order_type === "en_local"
                ? "Numero de mesa"
                : "No aplica"}
              bind:value={orderForm.table_number}
              required={orderForm.order_type === "en_local"}
              disabled={orderForm.order_type !== "en_local"}
              aria-labelledby="order-table-number-label"
            />
          </div>
        </div>
      </section>

      <div class="divider my-0"></div>

      <!-- Products section -->
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
        {onChangeIncludedTopping}
        {onChangeIncludedJalea}
        {onToggleExtraAddonSelection}
        {onAddDraftItem}
        {onRemoveDraftItem}
        {onUpdateDraftItemQuantity}
        {onProductById}
        {onResolveFlavorName}
        {onResolveAddonNames}
        {onManualItemSubtotal}
        {onDraftItemKey}
      />

      {#if isEditing}
        <div class="alert alert-info py-2.5 text-sm">
          <Icon icon="lucide:info" width="16" height="16" />
          <span>
            Puedes editar productos, cantidades y configuraciones. Debes agregar
            una nota explicando los cambios antes de guardar.
          </span>
        </div>
      {/if}

      <!-- Notes section -->
      <section>
        <div class="rounded-xl border border-base-300 bg-base-100 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-start gap-3">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-base-200 mt-0.5"
              >
                <Icon
                  icon="lucide:sticky-note"
                  width="14"
                  height="14"
                  class="text-base-content/60"
                />
              </div>
              <div class="min-w-0">
                <p class="font-medium text-sm leading-tight">
                  Nota de la orden
                </p>
                <p class="text-sm text-base-content/60 mt-0.5 line-clamp-2">
                  {orderForm.notes.trim()
                    ? orderForm.notes
                    : "Sin nota agregada"}
                </p>
              </div>
            </div>
            <button
              class="btn btn-sm btn-outline shrink-0"
              type="button"
              onclick={openNotesDialog}
            >
              <Icon
                icon={orderForm.notes.trim() ? "lucide:pencil" : "lucide:plus"}
                width="13"
                height="13"
              />
              {orderForm.notes.trim() ? "Editar nota" : "Agregar nota"}
            </button>
          </div>
        </div>
      </section>

      <!-- Total preview -->
      <div
        class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="lucide:calculator"
            width="15"
            height="15"
            class="text-primary/70"
          />
          <span class="text-sm font-medium text-base-content/80"
            >Total estimado de la orden</span
          >
        </div>
        <span class="text-base font-bold text-primary">
          {formatCurrency(displayTotal)}
        </span>
      </div>

      {#if isEditing && selectedOrder}
        <p class="text-xs text-base-content/60 -mt-2">
          Total previo: {formatCurrency(selectedOrder.total_amount)}
        </p>
      {/if}

      <!-- Feedback messages -->
      {#if editError}
        <div class="alert alert-error py-2.5 text-sm">
          <Icon icon="lucide:circle-alert" width="16" height="16" />
          <span>{editError}</span>
        </div>
      {/if}
      {#if editNotice}
        <div class="alert alert-success py-2.5 text-sm">
          <Icon icon="lucide:circle-check" width="16" height="16" />
          <span>{editNotice}</span>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="flex flex-wrap gap-2 pt-1">
        <button class="btn btn-primary" type="submit" disabled={busy}>
          {#if busy}
            <span class="loading loading-spinner loading-xs"></span>
          {/if}
          {isEditing ? "Guardar cambios" : "Crear orden"}
        </button>
        {#if !isEditing}
          <button class="btn btn-outline" type="button" onclick={onClearForm}>
            Limpiar
          </button>
        {/if}
        <button class="btn btn-ghost" type="button" onclick={onCancelEdit}>
          {isEditing ? "Cancelar edicion" : "Cancelar"}
        </button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>

<!-- Notes sub-dialog -->
<dialog class="modal" bind:this={noteDialogRef}>
  <div class="modal-box max-w-lg p-0">
    <div
      class="flex items-center justify-between gap-3 border-b border-base-200 px-5 py-4"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-7 w-7 items-center justify-center rounded-lg bg-base-200"
        >
          <Icon
            icon="lucide:sticky-note"
            width="14"
            height="14"
            class="text-base-content/60"
          />
        </div>
        <h3 class="font-bold text-base">Nota de la orden</h3>
      </div>
      <div class="flex items-center gap-1">
        {#if orderForm.notes.trim()}
          <button
            class="btn btn-ghost btn-xs text-error"
            type="button"
            onclick={() => (orderForm.notes = "")}
          >
            <Icon icon="lucide:trash-2" width="12" height="12" />
            Limpiar
          </button>
        {/if}
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={closeNotesDialog}
          aria-label="Cerrar"
        >
          <Icon icon="lucide:x" width="15" height="15" />
        </button>
      </div>
    </div>

    <div class="p-5 space-y-3">
      <p class="text-sm text-base-content/60">
        Agrega una observacion general para esta orden. El cliente puede verla
        en su seguimiento.
      </p>
      <textarea
        id="order-notes"
        class="textarea textarea-bordered w-full min-h-36"
        rows="6"
        placeholder="Ej: Sin hielo, entregar en planta baja, alergico a nueces..."
        bind:value={orderForm.notes}
        aria-label="Notas de la orden"
      ></textarea>
    </div>

    <div class="flex justify-end gap-2 border-t border-base-200 px-5 py-4">
      <button
        class="btn btn-ghost btn-sm"
        type="button"
        onclick={closeNotesDialog}>Cancelar</button
      >
      <button
        class="btn btn-primary btn-sm"
        type="button"
        onclick={closeNotesDialog}
      >
        <Icon icon="lucide:check" width="14" height="14" />
        Guardar nota
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeNotesDialog}>close</button>
  </form>
</dialog>
