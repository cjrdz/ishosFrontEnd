<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import type {
    Addon,
    Flavor,
    Order,
    Product,
  } from "@features/admin-management";
  import { formatCurrency } from "@shared/utils/formatters";
  import OrderItemBuilder from "./OrderItemBuilder.svelte";
  import type {
    ManualOrderItemDraft,
    OrderFormState,
  } from "../../types/orders-tab";

  interface AddonGroup {
    key: string;
    label: string;
    items: Addon[];
  }

  interface Props {
    open: boolean;
    draftItemEditIndex?: number | null;
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
    selectedFlavorIds: string[];
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
    open,
    draftItemEditIndex = null,
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
    selectedFlavorIds,
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
  const hasNotes = $derived(orderForm.notes.trim().length > 0);
  const requiresEditNote = $derived(isEditing && !hasNotes);
</script>

<!-- Main order editor dialog -->
<AdminModalShell
  bind:dialogRef
  title={`${isEditing ? "Editar orden" : "Crear orden manual"}${isEditing && selectedOrder ? ` · ${selectedOrder.order_number}` : ""}`}
  icon={isEditing ? "lucide:pencil" : "lucide:clipboard-list"}
  widthClass="max-w-3xl"
  {onClose}
>
  <form class="space-y-4" onsubmit={onSubmit}>
    <!-- Customer + order details compact strip -->
    <div class="space-y-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div class="form-control">
          <span id="order-customer-name-label" class="label-text text-xs mb-1">
            Nombre
          </span>
          <input
            id="order-customer-name"
            class="input input-bordered input-sm w-full"
            placeholder="Nombre completo"
            bind:value={orderForm.customer_name}
            required
            aria-labelledby="order-customer-name-label"
          />
        </div>
        <div class="form-control">
          <span id="order-customer-phone-label" class="label-text text-xs mb-1">
            Teléfono
          </span>
          <input
            id="order-customer-phone"
            class="input input-bordered input-sm w-full"
            placeholder="Ej. 7000-0000"
            bind:value={orderForm.customer_phone}
            required
            aria-labelledby="order-customer-phone-label"
          />
        </div>
        <div class="form-control sm:col-span-2 md:col-span-1">
          <span id="order-customer-email-label" class="label-text text-xs mb-1">
            Correo <span class="text-base-content/40 font-normal"
              >(opcional)</span
            >
          </span>
          <input
            id="order-customer-email"
            class="input input-bordered input-sm w-full"
            type="email"
            placeholder="correo@ejemplo.com"
            bind:value={orderForm.customer_email}
            aria-labelledby="order-customer-email-label"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div class="form-control">
          <span id="order-payment-method-label" class="label-text text-xs mb-1">
            Pago
          </span>
          <select
            id="order-payment-method"
            class="select select-bordered select-sm w-full"
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
          <span id="order-type-label" class="label-text text-xs mb-1">
            Tipo
          </span>
          <select
            id="order-type"
            class="select select-bordered select-sm w-full"
            bind:value={orderForm.order_type}
            aria-labelledby="order-type-label"
          >
            <option value="para_llevar">Para llevar</option>
            <option value="en_local">En local</option>
          </select>
        </div>
        <div class="form-control sm:col-span-2 md:col-span-1">
          <span id="order-table-number-label" class="label-text text-xs mb-1">
            Mesa
          </span>
          <input
            id="order-table-number"
            class="input input-bordered input-sm w-full"
            type="number"
            min="1"
            placeholder={orderForm.order_type === "en_local"
              ? "Número"
              : "No aplica"}
            bind:value={orderForm.table_number}
            required={orderForm.order_type === "en_local"}
            disabled={orderForm.order_type !== "en_local"}
            aria-labelledby="order-table-number-label"
          />
        </div>
      </div>
    </div>

    <div class="divider my-0"></div>

    <!-- Products section -->
    <OrderItemBuilder
      {products}
      {orderForm}
      {manualItems}
      {draftItemEditIndex}
      {selectedProductFlavors}
      {toppingAddons}
      {jaleaAddons}
      {selectedProductAddons}
      {paidAddonGroups}
      {selectedFlavorId}
      {selectedFlavorIds}
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
      {onFlavorIdsChange}
      {onChangeIncludedTopping}
      {onChangeIncludedJalea}
      {onToggleExtraAddonSelection}
      {onAddDraftItem}
      {onEditDraftItem}
      {onCancelDraftItemEdit}
      {onRemoveDraftItem}
      {onUpdateDraftItemQuantity}
      {onProductById}
      {onResolveFlavorName}
      {onResolveAddonNames}
      {onManualItemSubtotal}
      {onDraftItemKey}
    />

    <span class="hidden" aria-hidden="true">{draftItemEditIndex ?? ""}</span>

    {#if isEditing}
      <div class="alert alert-info py-2 text-sm">
        <Icon icon="lucide:info" width="16" height="16" />
        <span>
          Puedes editar productos, cantidades y configuraciones. Debes agregar
          una nota explicando los cambios antes de guardar.
        </span>
      </div>
    {/if}

    <!-- Total preview with note trigger -->
    <div
      class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2">
        <Icon
          icon="lucide:calculator"
          width="15"
          height="15"
          class="text-primary/70"
        />
        <span class="text-sm font-medium text-base-content/80"
          >Total estimado</span
        >
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class={`btn btn-xs gap-1 ${requiresEditNote ? "btn-error btn-outline" : "btn-ghost"}`}
          onclick={openNotesDialog}
          aria-label={hasNotes ? "Editar nota" : "Agregar nota"}
          title={hasNotes ? orderForm.notes : "Agregar nota"}
        >
          <Icon
            icon={hasNotes ? "lucide:pencil" : "lucide:plus"}
            width="12"
            height="12"
          />
          {requiresEditNote
            ? "Falta nota"
            : hasNotes
              ? "Editar nota"
              : "Agregar nota"}
        </button>
        <span class="text-base font-bold text-primary">
          {formatCurrency(displayTotal)}
        </span>
      </div>
    </div>

    {#if isEditing && selectedOrder}
      <p class="text-xs text-base-content/60 -mt-2">
        Total previo: {formatCurrency(selectedOrder.total_amount)}
      </p>
    {/if}

    <!-- Feedback messages -->
    {#if editError}
      <div class="alert alert-error py-2 text-sm">
        <Icon icon="lucide:circle-alert" width="16" height="16" />
        <span>{editError}</span>
      </div>
    {/if}
    {#if editNotice}
      <div class="alert alert-success py-2 text-sm">
        <Icon icon="lucide:circle-check" width="16" height="16" />
        <span>{editNotice}</span>
      </div>
    {/if}

    <!-- Action buttons -->
    <div class="flex flex-wrap gap-2 pt-1">
      {#if !isEditing}
        <button class="btn btn-outline" type="button" onclick={onClearForm}>
          Limpiar
        </button>
      {/if}
      <AdminFormActions
        submitLabel={isEditing ? "Guardar cambios" : "Crear orden"}
        cancelLabel={isEditing ? "Cancelar edición" : "Cancelar"}
        onCancel={onCancelEdit}
        {busy}
      />
    </div>
  </form>
</AdminModalShell>

<!-- Notes sub-dialog -->
<AdminModalShell
  bind:dialogRef={noteDialogRef}
  title="Nota de la orden"
  icon="lucide:sticky-note"
  widthClass="max-w-lg"
  onClose={closeNotesDialog}
>
  <p class="text-sm text-base-content/60">
    Agrega una observación general para esta orden. El cliente puede verla en su
    seguimiento.
  </p>

  {#if orderForm.notes.trim()}
    <div class="flex justify-end">
      <button
        class="btn btn-ghost btn-xs text-error"
        type="button"
        onclick={() => (orderForm.notes = "")}
      >
        <Icon icon="lucide:trash-2" width="12" height="12" />
        Limpiar
      </button>
    </div>
  {/if}

  <textarea
    id="order-notes"
    class="textarea textarea-bordered w-full min-h-36"
    rows="6"
    placeholder="Ej: Sin hielo, entregar en planta baja, alérgico a nueces..."
    bind:value={orderForm.notes}
    aria-label="Notas de la orden"
  ></textarea>

  <AdminFormActions
    submitLabel="Guardar nota"
    submitType="button"
    onSubmit={closeNotesDialog}
    onCancel={closeNotesDialog}
  />
</AdminModalShell>
