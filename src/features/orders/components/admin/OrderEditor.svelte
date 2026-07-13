<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import type {
    Addon,
    Category,
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
    categories: Category[];
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
    categories,
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

  type EditorStep = "products" | "customer" | "summary";
  const stepLabels: Record<EditorStep, string> = {
    products: "Productos",
    customer: "Cliente",
    summary: "Resumen",
  };
  const stepOrder: EditorStep[] = ["products", "customer", "summary"];

  let step = $state<EditorStep>("products");
  let stepError = $state("");

  $effect(() => {
    if (open) {
      step = "products";
      stepError = "";
    }
  });

  function isStepReached(target: EditorStep): boolean {
    return stepOrder.indexOf(step) >= stepOrder.indexOf(target);
  }

  function canNavigateToStep(target: EditorStep): boolean {
    const currentIndex = stepOrder.indexOf(step);
    const targetIndex = stepOrder.indexOf(target);
    if (targetIndex <= currentIndex) return true;
    // Can only move forward if all previous steps are valid
    for (let i = 0; i < targetIndex; i++) {
      if (!isStepValid(stepOrder[i])) return false;
    }
    return true;
  }

  function isStepValid(target: EditorStep): boolean {
    if (target === "products") {
      return manualItems.length > 0 && draftItemEditIndex === null;
    }
    if (target === "customer") {
      if (!isStepValid("products")) return false;
      return (
        orderForm.customer_name.trim().length > 0 &&
        orderForm.customer_phone.trim().length > 0 &&
        orderForm.payment_method.trim().length > 0 &&
        orderForm.order_type.trim().length > 0 &&
        (orderForm.order_type !== "en_local" ||
          (orderForm.table_number !== "" && Number(orderForm.table_number) > 0))
      );
    }
    if (target === "summary") {
      return isStepValid("products") && isStepValid("customer");
    }
    return false;
  }

  function goToStep(target: EditorStep) {
    if (!canNavigateToStep(target)) {
      stepError = getStepError(target);
      return;
    }
    stepError = "";
    step = target;
  }

  function getStepError(target: EditorStep): string {
    if (target === "customer" && !isStepValid("products")) {
      return "Agrega al menos un producto completo antes de continuar.";
    }
    if (target === "summary") {
      if (!isStepValid("products")) {
        return "Agrega al menos un producto completo antes de continuar.";
      }
      if (!isStepValid("customer")) {
        return "Completa los datos del cliente antes de continuar.";
      }
    }
    return "";
  }

  function nextStep() {
    const nextIndex = stepOrder.indexOf(step) + 1;
    if (nextIndex < stepOrder.length) {
      goToStep(stepOrder[nextIndex]);
    }
  }

  function prevStep() {
    const prevIndex = stepOrder.indexOf(step) - 1;
    if (prevIndex >= 0) {
      goToStep(stepOrder[prevIndex]);
    }
  }

  function resolveItemSummary(
    item: ManualOrderItemDraft,
  ): { label: string; value: string }[] {
    const product = onProductById(item.product_id);
    const summary: { label: string; value: string }[] = [];
    const flavorName = onResolveFlavorName(item.product_id, item.flavor_id);
    if (flavorName) summary.push({ label: "Sabor", value: flavorName });
    if (item.flavor_ids && item.flavor_ids.length > 0) {
      const names = item.flavor_ids
        .map((id) => onResolveFlavorName(item.product_id, id))
        .filter((name): name is string => !!name);
      if (names.length > 0) {
        summary.push({ label: "Sabores", value: names.join(", ") });
      }
    }
    const includedNames = onResolveAddonNames(
      item.product_id,
      item.included_addon_ids,
    );
    if (includedNames.length > 0) {
      summary.push({ label: "Incluidos", value: includedNames.join(", ") });
    }
    const extraNames = onResolveAddonNames(
      item.product_id,
      item.extra_addon_ids,
    );
    if (extraNames.length > 0) {
      summary.push({ label: "Extras", value: extraNames.join(", ") });
    }
    return summary;
  }
</script>

<!-- Main order editor dialog -->
<AdminModalShell
  bind:dialogRef
  title={`${isEditing ? "Editar orden" : "Crear orden manual"}${isEditing && selectedOrder ? ` · ${selectedOrder.order_number}` : ""}`}
  icon={isEditing ? "lucide:pencil" : "lucide:clipboard-list"}
  widthClass="max-w-5xl"
  {onClose}
>
  <form class="space-y-4" onsubmit={onSubmit}>
    <!-- Stepper -->
    <div class="steps steps-horizontal w-full">
      {#each stepOrder as stepName}
        <button
          type="button"
          class={`step ${isStepReached(stepName) ? "step-primary" : ""} ${canNavigateToStep(stepName) ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
          aria-current={step === stepName ? "step" : undefined}
          disabled={!canNavigateToStep(stepName)}
          onclick={() => goToStep(stepName)}
        >
          {stepLabels[stepName]}
        </button>
      {/each}
    </div>

    {#if stepError}
      <div class="alert alert-warning py-2 text-sm">
        <Icon icon="lucide:alert-triangle" width="16" height="16" />
        <span>{stepError}</span>
      </div>
    {/if}

    {#if step === "products"}
      <!-- Products section -->
      <OrderItemBuilder
        {products}
        {categories}
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
    {:else if step === "customer"}
      <!-- Customer + order details section -->
      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div class="form-control">
            <span
              id="order-customer-name-label"
              class="label-text text-xs mb-1"
            >
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
            <span
              id="order-customer-phone-label"
              class="label-text text-xs mb-1"
            >
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
            <span
              id="order-customer-email-label"
              class="label-text text-xs mb-1"
            >
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
            <span
              id="order-payment-method-label"
              class="label-text text-xs mb-1"
            >
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

        <label class="form-control w-full">
          <span class="label-text text-xs mb-1">Notas (opcional)</span>
          <textarea
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="Ej: Sin hielo, entregar en planta baja, alérgico a nueces..."
            bind:value={orderForm.notes}
            aria-label="Notas de la orden"
          ></textarea>
        </label>
      </div>
    {:else if step === "summary"}
      <!-- Summary section -->
      <div class="space-y-4">
        {#if isEditing}
          <div class="alert alert-info py-2 text-sm">
            <Icon icon="lucide:info" width="16" height="16" />
            <span>
              Puedes editar productos, cantidades y configuraciones. Debes
              agregar una nota explicando los cambios antes de guardar.
            </span>
          </div>
        {/if}

        <div
          class="rounded-xl border border-base-300 bg-base-100 p-4 space-y-3"
        >
          <h4 class="font-semibold text-sm">Productos agregados</h4>
          {#if manualItems.length === 0}
            <p class="text-sm text-base-content/50">Sin productos</p>
          {:else}
            <div class="space-y-3 max-h-64 overflow-y-auto">
              {#each manualItems as item, index (onDraftItemKey(item, index))}
                {@const product = onProductById(item.product_id)}
                {@const summary = resolveItemSummary(item)}
                <div
                  class="flex items-start justify-between gap-3 border-b border-base-200/60 last:border-0 pb-3 last:pb-0"
                >
                  <div class="min-w-0 space-y-1">
                    <p class="text-sm font-medium">
                      {item.quantity} x {product?.name ?? "Producto"}
                    </p>
                    {#if summary.length > 0}
                      <div class="flex flex-wrap gap-1">
                        {#each summary as line (line.label)}
                          <span class="text-xs text-base-content/70"
                            >{line.label}: {line.value}</span
                          >
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <p class="text-sm font-semibold whitespace-nowrap">
                    {formatCurrency(onManualItemSubtotal(item))}
                  </p>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            class="rounded-xl border border-base-300 bg-base-100 p-4 space-y-2"
          >
            <h4 class="font-semibold text-sm">Datos del cliente</h4>
            <div class="text-sm space-y-1">
              <p>
                <span class="text-base-content/60">Nombre:</span>
                {orderForm.customer_name || "—"}
              </p>
              <p>
                <span class="text-base-content/60">Teléfono:</span>
                {orderForm.customer_phone || "—"}
              </p>
              {#if orderForm.customer_email}
                <p>
                  <span class="text-base-content/60">Correo:</span>
                  {orderForm.customer_email}
                </p>
              {/if}
              <p>
                <span class="text-base-content/60">Pago:</span>
                <span class="capitalize">{orderForm.payment_method}</span>
              </p>
              <p>
                <span class="text-base-content/60">Tipo:</span>
                {orderForm.order_type === "en_local"
                  ? "En local"
                  : "Para llevar"}
              </p>
              {#if orderForm.order_type === "en_local"}
                <p>
                  <span class="text-base-content/60">Mesa:</span>
                  {orderForm.table_number}
                </p>
              {/if}
              {#if orderForm.notes.trim()}
                <p>
                  <span class="text-base-content/60">Notas:</span>
                  {orderForm.notes}
                </p>
              {/if}
            </div>
          </div>

          <div
            class="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
          >
            <h4 class="font-semibold text-sm text-base-content/80">
              Total estimado
            </h4>
            <p class="text-2xl font-bold text-primary">
              {formatCurrency(displayTotal)}
            </p>
            {#if isEditing && selectedOrder}
              <p class="text-xs text-base-content/60">
                Total previo: {formatCurrency(selectedOrder.total_amount)}
              </p>
            {/if}
          </div>
        </div>
      </div>
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
    <div
      class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-base-200"
    >
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-outline" type="button" onclick={onCancelEdit}>
          {isEditing ? "Cancelar edición" : "Cancelar"}
        </button>
        {#if !isEditing}
          <button class="btn btn-outline" type="button" onclick={onClearForm}>
            Limpiar
          </button>
        {/if}
      </div>
      <div class="flex flex-wrap gap-2">
        {#if step !== "products"}
          <button
            class="btn btn-outline"
            type="button"
            onclick={prevStep}
            disabled={busy}
          >
            Atrás
          </button>
        {/if}
        {#if step !== "summary"}
          <button
            class="btn btn-primary"
            type="button"
            onclick={nextStep}
            disabled={busy}
          >
            Siguiente
          </button>
        {:else}
          <button
            class="btn btn-primary"
            type="submit"
            disabled={busy || !isStepValid("summary") || requiresEditNote}
          >
            {isEditing ? "Guardar cambios" : "Crear orden"}
          </button>
        {/if}
      </div>
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
