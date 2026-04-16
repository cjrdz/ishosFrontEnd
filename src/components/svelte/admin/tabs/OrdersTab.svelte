<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Employee, Order, Product } from "../../../../lib/api/admin";
  import { groupAddonsByGroup, normalizeAddonGroupName } from "../../../../lib/admin/addon-groups";
  import { printOrderReceipt } from "../../../../lib/admin/orders/receipt-renderer";
  import {
    statusLabels,
    statusBadgeClass,
    canChangeToStep,
    type LinearOrderStatus,
  } from "../../../../lib/admin/orders/order-status";
  import * as DraftHelpers from "../../../../lib/admin/orders/draft-item-helpers";
  import * as ManualItemHelpers from "../../../../lib/admin/orders/manual-item-helpers";
  import * as TokenHelpers from "../../../../lib/admin/orders/token-helpers";
  import * as DialogState from "../../../../lib/admin/orders/dialog-state";
  import * as OrderSubmission from "../../../../lib/admin/orders/order-submission";
  import * as SaveUserHelpers from "../../../../lib/admin/orders/save-user-helpers";
  import OrderDetailView from "../orders/OrderDetailView.svelte";
  import OrderList from "../orders/OrderList.svelte";
  import OrderEditor from "../orders/OrderEditor.svelte";
  import SaveUserFromOrderDialog from "../orders/SaveUserFromOrderDialog.svelte";
  import RejectOrderDialog from "../orders/RejectOrderDialog.svelte";
  import ReactivateOrderDialog from "../orders/ReactivateOrderDialog.svelte";
  import PrintPromptDialog from "../orders/PrintPromptDialog.svelte";
  import ConfirmDialog from "../shared/ConfirmDialog.svelte";
  import type { CreateOrderPayload, OrdersTabProps, ManualOrderItemDraft } from "./types/orders-tab";
  import { normalizeIdList } from "./utils/list";

  let {
    isAdmin,
    orders,
    products,
    employees,
    selectedOrder,
    busy,
    moduleError,
    orderStatusFilter,
    onFilterChange,
    onReload,
    onOpenOrder,
    onApprove,
    onReject,
    onStatusChange,
    onUpdateOrder,
    onDelete,
    onCreate,
    saveUserFromOrder,
  }: OrdersTabProps = $props();

  let confirmOpen = $state(false);
  let orderEditorOpen = $state(false);
  let saveUserOpen = $state(false);
  let tokenVisible = $state(false);
  let tokenCopied = $state<TokenHelpers.TokenCopyKind>("");

  $effect(() => {
    // reset reveal state whenever a different order is opened
    if (selectedOrder) {
      const reset = TokenHelpers.resetTokenState();
      tokenVisible = reset.tokenVisible;
      tokenCopied = reset.tokenCopied;
    }
  });

  async function copyToClipboard(text: string, kind: "token" | "both" | "link") {
    tokenCopied = await TokenHelpers.copyToClipboard(text, kind);
    if (tokenCopied) {
      TokenHelpers.clearClipboardFeedback(tokenCopied, () => {
        tokenCopied = "";
      });
    }
  }

  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);

  let rejectState = $state<DialogState.RejectDialogState>(DialogState.closeReject());
  let reactivateState = $state<DialogState.ReactivateDialogState>(DialogState.closeReactivate());
  let printPromptState = $state<DialogState.PrintPromptDialogState>(DialogState.closePrintPrompt());
  let saveUserState = $state<DialogState.SaveUserDialogState>(DialogState.closeSaveUserDialog());
  let editOrderId = $state<string | null>(null);
  let editError = $state("");
  let editNotice = $state("");
  let addItemError = $state("");
  let orderSearch = $state("");
  let selectedFlavorId = $state("");
  let includedToppingId = $state("");
  let includedJaleaId = $state("");
  let selectedExtraAddonIds = $state<string[]>([]);
  let lastSelectedProductId = $state("");

  type ProductAddon = NonNullable<Product["addons"]>[number];
  type ProductFlavor = NonNullable<Product["flavors"]>[number];
  let orderForm = $state({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "efectivo" as "efectivo" | "tarjeta" | "transferencia" | "otro",
    order_type: "para_llevar" as "en_local" | "para_llevar",
    table_number: "" as "" | number,
    notes: "",
    product_id: "",
    quantity: 1,
  });
  let manualItems = $state<ManualOrderItemDraft[]>([]);

  $effect(() => {
    if (!orderForm.product_id && products.length > 0) {
      orderForm.product_id = products[0].id;
    }
  });

  $effect(() => {
    if (orderForm.order_type === "para_llevar") {
      orderForm.table_number = "";
    }
  });

  const selectedProduct = $derived(
    products.find((product) => product.id === orderForm.product_id) || null,
  );
  const selectedProductFlavors = $derived(
    (selectedProduct?.flavors ?? [])
      .filter((flavor) => flavor.is_active)
      .slice()
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name)),
  );
  const selectedProductAddons = $derived(
    (selectedProduct?.addons ?? [])
      .filter((addon) => addon.is_active)
      .slice()
      .sort((left, right) => {
        const leftGroup = normalizeAddonGroupName(left.group_name);
        const rightGroup = normalizeAddonGroupName(right.group_name);
        return (
          leftGroup.localeCompare(rightGroup) ||
          left.display_order - right.display_order ||
          left.name.localeCompare(right.name)
        );
      }),
  );
  const selectedProductAddonGroups = $derived(groupAddonsByGroup(selectedProductAddons));
  const toppingAddons = $derived(
    selectedProductAddons.filter((addon) => normalizeAddonGroupName(addon.group_name) === "toppings"),
  );
  const jaleaAddons = $derived(
    selectedProductAddons.filter((addon) => normalizeAddonGroupName(addon.group_name) === "jalea"),
  );
  const paidAddonGroups = $derived(
    selectedProductAddonGroups.filter((group) => group.key !== "toppings" && group.key !== "jalea"),
  );
  const hasCustomizationOptions = $derived(
    selectedProductFlavors.length > 0 || selectedProductAddons.length > 0,
  );
  const customizationDebugSummary = $derived({
    flavors: selectedProductFlavors.length,
    toppings: toppingAddons.length,
    jaleas: jaleaAddons.length,
    extras: paidAddonGroups.reduce((sum, group) => sum + group.items.length, 0),
  });
  const normalizedOrderSearch = $derived(orderSearch.trim().toLowerCase());
  const filteredOrders = $derived(
    !normalizedOrderSearch
      ? orders
      : orders.filter((order) => order.order_number.toLowerCase().includes(normalizedOrderSearch)),
  );

  const pricePreview = $derived(selectedProduct ? selectedProduct.price : 0);
  const addonsPreviewTotal = $derived(
    selectedExtraAddonIds.reduce((sum, addonId) => {
      const addon = selectedProductAddons.find((candidate) => candidate.id === addonId);
      return sum + (addon?.price ?? 0);
    }, 0),
  );
  const totalPreview = $derived(
    ((selectedProduct ? selectedProduct.price : 0) + addonsPreviewTotal) * Number(orderForm.quantity || 0),
  );
  const isEditing = $derived(!!editOrderId);
  const employeeById = $derived(
    employees.reduce((acc, employee) => {
      acc[employee.id] = employee.name || employee.email;
      return acc;
    }, {} as Record<string, string>),
  );
  const manualOrderTotal = $derived(
    ManualItemHelpers.manualOrderTotal(manualItems, products),
  );

  function productById(productId: string): Product | undefined {
    return products.find((product) => product.id === productId);
  }

  function activeFlavors(product: Product | null | undefined): ProductFlavor[] {
    return (product?.flavors ?? [])
      .filter((flavor) => flavor.is_active)
      .slice()
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name));
  }

  function resolveFlavorName(productId: string, flavorId: string | undefined): string | null {
    return ManualItemHelpers.resolveFlavorName(productId, flavorId, products);
  }

  function resolveAddonNames(productId: string, addonIds: string[]): string[] {
    return ManualItemHelpers.resolveAddonNames(productId, addonIds, products);
  }

  function manualItemUnitPrice(item: ManualOrderItemDraft): number {
    return ManualItemHelpers.manualItemUnitPrice(item, products);
  }

  function manualItemSubtotal(item: ManualOrderItemDraft): number {
    return ManualItemHelpers.manualItemSubtotal(item, products);
  }

  function buildCustomizationsFromDraft(item: ManualOrderItemDraft): Record<string, unknown> | undefined {
    return ManualItemHelpers.buildCustomizationsFromDraft(item);
  }

  function buildCurrentDraftItem(): ManualOrderItemDraft | null {
    const result = DraftHelpers.buildCurrentDraftItem(
      orderForm.product_id,
      orderForm.quantity,
      selectedFlavorId,
      includedToppingId,
      includedJaleaId,
      selectedExtraAddonIds,
      products,
    );
    if (result.item) return result.item;
    editError = result.error;
    return null;
  }

  function addDraftItem() {
    editError = "";
    addItemError = "";
    const nextItem = buildCurrentDraftItem();
    if (!nextItem) {
      addItemError = editError;
      editError = "";
      return;
    }
    addItemError = "";

    manualItems = DraftHelpers.addDraftItem(manualItems, nextItem);

    orderForm.quantity = 1;
    const reset = DraftHelpers.resetCustomizationSelections();
    selectedFlavorId = reset.selectedFlavorId;
    includedToppingId = reset.includedToppingId;
    includedJaleaId = reset.includedJaleaId;
    selectedExtraAddonIds = reset.selectedExtraAddonIds;
  }

  function removeDraftItem(indexToRemove: number) {
    manualItems = DraftHelpers.removeDraftItem(manualItems, indexToRemove);
  }

  function updateDraftItemQuantity(indexToUpdate: number, nextQuantity: number) {
    manualItems = DraftHelpers.updateDraftItemQuantity(manualItems, indexToUpdate, nextQuantity);
  }

  function draftItemKey(item: ManualOrderItemDraft, index: number): string {
    return DraftHelpers.draftItemKey(item, index);
  }

  $effect(() => {
    const currentProductId = selectedProduct?.id ?? "";
    if (currentProductId !== lastSelectedProductId) {
      lastSelectedProductId = currentProductId;
      selectedFlavorId = "";
      includedToppingId = "";
      includedJaleaId = "";
      selectedExtraAddonIds = [];
      return;
    }

    if (selectedFlavorId && !selectedProductFlavors.some((flavor) => flavor.id === selectedFlavorId)) {
      selectedFlavorId = "";
    }

    const normalizedAddonIds = selectedExtraAddonIds.filter((addonId) =>
      selectedProductAddons.some((addon) => addon.id === addonId),
    );
    if (normalizedAddonIds.length !== selectedExtraAddonIds.length) {
      selectedExtraAddonIds = normalizedAddonIds;
    }

    if (includedToppingId && !toppingAddons.some((addon) => addon.id === includedToppingId)) {
      includedToppingId = "";
    }
    if (includedJaleaId && !jaleaAddons.some((addon) => addon.id === includedJaleaId)) {
      includedJaleaId = "";
    }

    if (includedToppingId) {
      selectedExtraAddonIds = selectedExtraAddonIds.filter((addonId) => addonId !== includedToppingId);
    }
    if (includedJaleaId) {
      selectedExtraAddonIds = selectedExtraAddonIds.filter((addonId) => addonId !== includedJaleaId);
    }
  });

  const orderStatusFilterLabel = $derived(
    orderStatusFilter === ""
      ? "Todos"
      : orderStatusFilter === "pendiente_revision"
        ? "pendiente_revision"
        : orderStatusFilter === "recibida"
          ? "recibida"
          : orderStatusFilter === "en_proceso"
            ? "preparando"
            : orderStatusFilter === "lista"
              ? "lista"
              : orderStatusFilter === "entregada"
                ? "entregada"
                : orderStatusFilter === "cancelada"
                  ? "cancelada"
                  : "Todos",
  );

  function requestApprove(order: Order) {
    const newState = DialogState.openConfirm(
      "Aprobar orden",
      `Confirmar aprobacion de ${order.order_number}?`,
      () => onApprove(order.id),
    );
    confirmTitle = newState.title;
    confirmMessage = newState.message;
    confirmAction = newState.action;
    confirmOpen = newState.open;
  }

  function requestDelete(order: Order) {
    const newState = DialogState.openConfirm(
      "Eliminar orden",
      `Seguro que deseas eliminar ${order.order_number}?`,
      () => onDelete(order.id),
    );
    confirmTitle = newState.title;
    confirmMessage = newState.message;
    confirmAction = newState.action;
    confirmOpen = newState.open;
  }

  async function printFromList(orderId: string) {
    const detail = await onOpenOrder(orderId);
    if (detail) {
      printOrderReceipt(detail);
    }
  }

  function resetOrderForm() {
    editOrderId = null;
    editError = "";
    editNotice = "";
    const reset = DraftHelpers.resetCustomizationSelections();
    selectedFlavorId = reset.selectedFlavorId;
    includedToppingId = reset.includedToppingId;
    includedJaleaId = reset.includedJaleaId;
    selectedExtraAddonIds = reset.selectedExtraAddonIds;
    manualItems = [];
    orderForm = {
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      payment_method: "efectivo",
      order_type: "para_llevar",
      table_number: "",
      notes: "",
      product_id: products[0]?.id || "",
      quantity: 1,
    };
  }

  function toggleExtraAddonSelection(addonId: string, checked: boolean) {
    if (addonId === includedToppingId || addonId === includedJaleaId) {
      return;
    }

    if (checked) {
      if (!selectedExtraAddonIds.includes(addonId)) {
        selectedExtraAddonIds = [...selectedExtraAddonIds, addonId];
      }
      return;
    }

    selectedExtraAddonIds = selectedExtraAddonIds.filter((currentAddonId) => currentAddonId !== addonId);
  }

  function changeIncludedTopping(addonId: string) {
    includedToppingId = addonId;
    if (addonId) {
      selectedExtraAddonIds = selectedExtraAddonIds.filter((currentAddonId) => currentAddonId !== addonId);
    }
  }

  function changeIncludedJalea(addonId: string) {
    includedJaleaId = addonId;
    if (addonId) {
      selectedExtraAddonIds = selectedExtraAddonIds.filter((currentAddonId) => currentAddonId !== addonId);
    }
  }

  function openCreateOrderModal() {
    resetOrderForm();
    orderEditorOpen = true;
  }

  function closeOrderEditor() {
    saveUserOpen = false;
    orderEditorOpen = false;
    resetOrderForm();
  }

  function openSaveUserDialog() {
    saveUserState = DialogState.openSaveUserDialog(
      orderForm.customer_name,
      orderForm.customer_phone,
      orderForm.customer_email,
    );
  }

  function openSaveUserDialogFromOrder(order: Order) {
    const form = SaveUserHelpers.prefillSaveUserFormFromOrder(order);
    saveUserState = {
      open: true,
      form,
      error: "",
    };
  }

  function closeSaveUserDialog() {
    saveUserState = DialogState.closeSaveUserDialog();
  }

  async function submitSaveUser(event: SubmitEvent) {
    event.preventDefault();
    saveUserState.error = "";

    const validation = SaveUserHelpers.validateSaveUserForm(saveUserState.form);
    if (!validation.valid) {
      saveUserState.error = validation.error;
      return;
    }

    const payload = SaveUserHelpers.buildSaveUserPayload(saveUserState.form);
    const saved = await saveUserFromOrder(payload);

    if (!saved) {
      saveUserState.error = "No se pudo guardar el usuario";
      return;
    }

    closeSaveUserDialog();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    editError = "";
    editNotice = "";

    if (editOrderId) {
      const updatePayload = OrderSubmission.buildOrderUpdatePayload(
        orderForm.customer_name,
        orderForm.customer_phone,
        orderForm.customer_email,
        orderForm.payment_method,
        orderForm.order_type,
        orderForm.table_number,
        orderForm.notes,
      );
      const updated = await onUpdateOrder(editOrderId, updatePayload);
      if (updated) {
        editNotice = "Orden actualizada correctamente";
        closeOrderEditor();
      } else {
        editError = "No se pudo actualizar la orden";
      }
      return;
    }

    const fallbackItem = manualItems.length === 0 ? buildCurrentDraftItem() : null;
    const items = OrderSubmission.prepareOrderItems(manualItems, fallbackItem);

    if (!items) {
      editError = "Agrega al menos un producto a la orden";
      return;
    }

    const createPayload = OrderSubmission.buildCreateOrderPayload(
      orderForm.customer_name,
      orderForm.customer_phone,
      orderForm.customer_email,
      orderForm.payment_method,
      orderForm.order_type,
      orderForm.table_number,
      orderForm.notes,
      items,
    );

    const created = await onCreate(createPayload);
    if (created) {
      closeOrderEditor();
    } else {
      editError = "No se pudo crear la orden";
    }
  }

  function openConfirm(title: string, message: string, action: () => void) {
    const newState = DialogState.openConfirm(title, message, action);
    confirmTitle = newState.title;
    confirmMessage = newState.message;
    confirmAction = newState.action;
    confirmOpen = newState.open;
  }

  function confirmNow() {
    const result = DialogState.confirmNow({ open: confirmOpen, title: confirmTitle, message: confirmMessage, action: confirmAction });
    const action = result.action;
    confirmTitle = result.newState.title;
    confirmMessage = result.newState.message;
    confirmAction = result.newState.action;
    confirmOpen = result.newState.open;
    if (action) action();
  }

  function closeConfirm() {
    const newState = DialogState.closeConfirm();
    confirmTitle = newState.title;
    confirmMessage = newState.message;
    confirmAction = newState.action;
    confirmOpen = newState.open;
  }

  function openReject(orderId: string) {
    rejectState = DialogState.openReject(orderId);
  }

  function confirmReject() {
    if (!rejectState.targetId) return;
    if (!rejectState.reason.trim()) {
      rejectState.error = "Debes indicar el motivo de rechazo";
      return;
    }
    onReject(rejectState.targetId, rejectState.reason.trim());
    rejectState = DialogState.closeReject();
  }

  function closeReject() {
    rejectState = DialogState.closeReject();
  }

  function openReactivate(orderId: string) {
    reactivateState = DialogState.openReactivate(orderId);
  }

  function confirmReactivate() {
    if (!reactivateState.targetId) return;
    if (!reactivateState.reason.trim()) {
      reactivateState.error = "Debes indicar el motivo de reactivacion";
      return;
    }
    onApprove(reactivateState.targetId, reactivateState.reason.trim());
    closeReactivate();
  }

  function closeReactivate() {
    reactivateState = DialogState.closeReactivate();
  }

  async function startEdit(orderId: string) {
    editNotice = "";
    editError = "";
    const order = await onOpenOrder(orderId);
    if (!order) return;
    editOrderId = order.id;
    orderForm = {
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email ?? "",
      payment_method: order.payment_method,
      order_type: order.order_type,
      table_number: order.table_number ?? "",
      notes: order.notes ?? "",
      product_id: orderForm.product_id,
      quantity: orderForm.quantity,
    };
    orderEditorOpen = true;
  }

  function cancelEdit() {
    closeOrderEditor();
  }

  function openPrintPrompt(order: Order) {
    printPromptState = DialogState.openPrintPrompt(order);
  }

  async function handleStatusChangeFromList(orderId: string, status: "recibida" | "en_proceso" | "lista" | "entregada") {
    const updated = await onStatusChange(orderId, status);
    if (!updated) return;
    await onOpenOrder(orderId);
  }

  function handleStepClick(order: Order, stepStatus: LinearOrderStatus) {
    if (order.status === "cancelada" || order.status === stepStatus) return;
    if (stepStatus === "lista") {
      openPrintPrompt(order);
      return;
    }
    const nextStatus = stepStatus === "pendiente_revision" ? "en_proceso" : stepStatus;
    void handleStatusChangeFromList(order.id, nextStatus);
  }

  function closePrintPrompt() {
    printPromptState = DialogState.closePrintPrompt();
  }

  async function applyStatusChange() {
    if (!printPromptState.printTarget) return;
    const id = printPromptState.printTarget.id;
    const status = "lista" as const;
    closePrintPrompt();
    const updated = await onStatusChange(id, status);
    if (!updated) return;
    await onOpenOrder(id);
  }

</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <OrderList
    {orders}
    {filteredOrders}
    {busy}
    {isAdmin}
    {orderSearch}
    {orderStatusFilterLabel}
    {statusLabels}
    {statusBadgeClass}
    onSearchChange={(value) => {
      orderSearch = value;
    }}
    onFilterChange={onFilterChange}
    onReload={onReload}
    onCreateOrder={openCreateOrderModal}
    onOpenOrder={(orderId) => {
      void onOpenOrder(orderId);
    }}
    onPrintOrder={(orderId) => {
      void printFromList(orderId);
    }}
    onStartEdit={(orderId) => {
      void startEdit(orderId);
    }}
    onRequestApprove={requestApprove}
    onOpenReject={openReject}
    onRequestDelete={requestDelete}
  />

  {#if selectedOrder}
    <OrderDetailView
      {selectedOrder}
      {isAdmin}
      {tokenVisible}
      {tokenCopied}
      {employeeById}
      onToggleTokenVisibility={() => {
        tokenVisible = !tokenVisible;
      }}
      onCopyToken={copyToClipboard}
      onOpenSaveUserDialog={openSaveUserDialogFromOrder}
      onOpenReject={openReject}
      onOpenReactivate={openReactivate}
      onHandleStepClick={handleStepClick}
      onCanChangeToStep={canChangeToStep}
    />
  {/if}
</section>

<OrderEditor
  open={orderEditorOpen}
  isEditing={isEditing}
  {selectedOrder}
  {busy}
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
  {editError}
  {editNotice}
  onSubmit={handleSubmit}
  onClose={closeOrderEditor}
  onCancelEdit={cancelEdit}
  onProductChange={(value) => {
    orderForm.product_id = value;
  }}
  onQuantityChange={(value) => {
    orderForm.quantity = value;
  }}
  onFlavorChange={(value) => {
    selectedFlavorId = value;
  }}
  onChangeIncludedTopping={changeIncludedTopping}
  onChangeIncludedJalea={changeIncludedJalea}
  onToggleExtraAddonSelection={toggleExtraAddonSelection}
  onAddDraftItem={addDraftItem}
  onRemoveDraftItem={removeDraftItem}
  onUpdateDraftItemQuantity={updateDraftItemQuantity}
  onProductById={productById}
  onResolveFlavorName={resolveFlavorName}
  onResolveAddonNames={resolveAddonNames}
  onManualItemSubtotal={manualItemSubtotal}
  onDraftItemKey={draftItemKey}
/>

<SaveUserFromOrderDialog
  open={saveUserState.open}
  {busy}
  saveUserForm={saveUserState.form}
  saveUserError={saveUserState.error}
  onSubmit={submitSaveUser}
  onClose={closeSaveUserDialog}
/>

<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  busy={busy}
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>

<RejectOrderDialog
  open={rejectState.open}
  {busy}
  rejectReason={rejectState.reason}
  rejectError={rejectState.error}
  onRejectReasonChange={(value) => {
    rejectState.reason = value;
  }}
  onConfirm={confirmReject}
  onClose={closeReject}
/>

<PrintPromptDialog
  open={printPromptState.open}
  {busy}
  printTarget={printPromptState.printTarget}
  onConfirm={applyStatusChange}
  onClose={closePrintPrompt}
/>

<ReactivateOrderDialog
  open={reactivateState.open}
  {busy}
  reactivateReason={reactivateState.reason}
  reactivateError={reactivateState.error}
  onReactivateReasonChange={(value) => {
    reactivateState.reason = value;
  }}
  onConfirm={confirmReactivate}
  onClose={closeReactivate}
/>
