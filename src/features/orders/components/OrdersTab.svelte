<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import type {
    Category,
    Employee,
    Order,
    Product,
  } from "@features/admin-management";
  import {
    groupAddonsByGroup,
    normalizeAddonGroupName,
  } from "@features/products";
  import { printOrderReceipt } from "../lib/receipt-renderer";
  import {
    statusLabels,
    statusBadgeClass,
    canChangeToStep,
    isOrderEditable,
    type LinearOrderStatus,
  } from "../lib/order-status";
  import * as DraftHelpers from "../lib/draft-item-helpers";
  import * as ManualItemHelpers from "../lib/manual-item-helpers";
  import * as TokenHelpers from "../lib/token-helpers";
  import * as DialogState from "../lib/dialog-state";
  import * as OrderSubmission from "../lib/order-submission";
  import * as SaveUserHelpers from "../lib/save-user-helpers";
  import { emitOrderStatusSync } from "../lib/status-sync";
  import {
    clearIdempotencyKey,
    generateIdempotencyKey,
  } from "../lib/idempotency";
  import OrderDetailView from "./admin/OrderDetailView.svelte";
  import OrderList from "./admin/OrderList.svelte";
  import OrderEditor from "./admin/OrderEditor.svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import SaveUserFromOrderDialog from "./admin/SaveUserFromOrderDialog.svelte";
  import RejectOrderDialog from "./admin/RejectOrderDialog.svelte";
  import ReactivateOrderDialog from "./admin/ReactivateOrderDialog.svelte";
  import PrintPromptDialog from "./admin/PrintPromptDialog.svelte";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import type {
    CreateOrderPayload,
    OrdersTabProps,
    ManualOrderItemDraft,
    OrderFormState,
  } from "../types/orders-tab";
  import { normalizeIdList } from "../lib/list";

  const MANUAL_ORDER_DRAFT_STORAGE_KEY = "ishos.manual-order-draft.v1";

  interface ManualOrderDraftSnapshot {
    orderForm: OrderFormState;
    manualItems: ManualOrderItemDraft[];
    selectedFlavorId: string;
    selectedFlavorIds: string[];
    includedToppingIds: string[];
    includedJaleaIds: string[];
    selectedExtraAddonIds: string[];
    toppingSelection?: "none" | "selected";
    jaleaSelection?: "none" | "selected";
  }

  let {
    isAdmin,
    orders,
    products,
    allProducts,
    categories,
    employees,
    selectedOrder,
    busy,
    moduleError,
    orderStatusFilter,
    showArchived,
    pagination,
    onFilterChange,
    onToggleArchivedView,
    onReload,
    onPageChange,
    onPerPageChange,
    onOpenOrder,
    onClearSelectedOrder,
    onApprove,
    onReject,
    onStatusChange,
    onUpdateOrder,
    onDelete,
    onCreate,
    onArchive,
    saveUserFromOrder,
  }: OrdersTabProps = $props();

  let confirmDialog = $state(createConfirmDialogState());
  let detailDialogRef = $state<HTMLDialogElement | null>(null);
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
      if (detailDialogRef && !detailDialogRef.open) {
        detailDialogRef.showModal();
      }
    } else if (detailDialogRef && detailDialogRef.open) {
      detailDialogRef.close();
    }
  });

  async function copyToClipboard(
    text: string,
    kind: "token" | "both" | "link",
  ) {
    tokenCopied = await TokenHelpers.copyToClipboard(text, kind);
    if (tokenCopied) {
      TokenHelpers.clearClipboardFeedback(tokenCopied, () => {
        tokenCopied = "";
      });
    }
  }

  let rejectState = $state<DialogState.RejectDialogState>(
    DialogState.closeReject(),
  );
  let reactivateState = $state<DialogState.ReactivateDialogState>(
    DialogState.closeReactivate(),
  );
  let printPromptState = $state<DialogState.PrintPromptDialogState>(
    DialogState.closePrintPrompt(),
  );
  let saveUserState = $state<DialogState.SaveUserDialogState>(
    DialogState.closeSaveUserDialog(),
  );
  let editOrderId = $state<string | null>(null);
  let editError = $state("");
  let editNotice = $state("");
  let addItemError = $state("");
  let orderSearch = $state("");
  let selectedFlavorId = $state("");
  let selectedFlavorIds = $state<string[]>([]);
  let includedToppingIds = $state<string[]>([]);
  let includedJaleaIds = $state<string[]>([]);
  let selectedExtraAddonIds = $state<string[]>([]);
  let toppingSelection = $state<"none" | "selected" | undefined>(undefined);
  let jaleaSelection = $state<"none" | "selected" | undefined>(undefined);
  let lastSelectedProductId = $state("");
  let editingDraftIndex = $state<number | null>(null);
  let createOrderIdempotencyKey = $state<string | null>(null);

  type ProductAddon = NonNullable<Product["addons"]>[number];
  type ProductFlavor = NonNullable<Product["flavors"]>[number];
  let orderForm = $state({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "efectivo" as
      | "efectivo"
      | "tarjeta"
      | "transferencia"
      | "otro",
    amount_received: "" as "" | number,
    order_type: "para_llevar" as "en_local" | "para_llevar",
    table_number: "" as "" | number,
    notes: "",
    product_id: "",
    quantity: 1,
  });
  let manualItems = $state<ManualOrderItemDraft[]>([]);

  function hasManualDraftContent(snapshot: ManualOrderDraftSnapshot): boolean {
    return (
      snapshot.orderForm.customer_name.trim().length > 0 ||
      snapshot.orderForm.customer_phone.trim().length > 0 ||
      snapshot.orderForm.customer_email.trim().length > 0 ||
      snapshot.orderForm.notes.trim().length > 0 ||
      snapshot.orderForm.table_number !== "" ||
      snapshot.manualItems.length > 0 ||
      snapshot.orderForm.quantity !== 1 ||
      snapshot.selectedFlavorId.length > 0 ||
      snapshot.selectedFlavorIds.length > 0 ||
      snapshot.includedToppingIds.length > 0 ||
      snapshot.includedJaleaIds.length > 0 ||
      snapshot.selectedExtraAddonIds.length > 0 ||
      snapshot.toppingSelection === "none" ||
      snapshot.toppingSelection === "selected" ||
      snapshot.jaleaSelection === "none" ||
      snapshot.jaleaSelection === "selected"
    );
  }

  function buildManualDraftSnapshot(): ManualOrderDraftSnapshot {
    return {
      orderForm: {
        ...orderForm,
      },
      manualItems: manualItems.map((item) => ({
        ...item,
        included_addon_ids: [...item.included_addon_ids],
        extra_addon_ids: [...item.extra_addon_ids],
      })),
      selectedFlavorId,
      selectedFlavorIds: [...selectedFlavorIds],
      includedToppingIds: [...includedToppingIds],
      includedJaleaIds: [...includedJaleaIds],
      selectedExtraAddonIds: [...selectedExtraAddonIds],
      toppingSelection,
      jaleaSelection,
    };
  }

  function clearManualDraftStorage() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(MANUAL_ORDER_DRAFT_STORAGE_KEY);
  }

  function persistManualDraft() {
    if (typeof window === "undefined" || isEditing || !orderEditorOpen) return;

    const snapshot = buildManualDraftSnapshot();
    if (!hasManualDraftContent(snapshot)) {
      clearManualDraftStorage();
      return;
    }

    window.sessionStorage.setItem(
      MANUAL_ORDER_DRAFT_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  }

  function restoreManualDraft(): boolean {
    if (typeof window === "undefined") return false;

    const rawSnapshot = window.sessionStorage.getItem(
      MANUAL_ORDER_DRAFT_STORAGE_KEY,
    );
    if (!rawSnapshot) return false;

    try {
      const snapshot = JSON.parse(rawSnapshot) as ManualOrderDraftSnapshot;
      orderForm = {
        customer_name: snapshot.orderForm.customer_name ?? "",
        customer_phone: snapshot.orderForm.customer_phone ?? "",
        customer_email: snapshot.orderForm.customer_email ?? "",
        payment_method: snapshot.orderForm.payment_method ?? "efectivo",
        amount_received: snapshot.orderForm.amount_received ?? "",
        order_type: snapshot.orderForm.order_type ?? "para_llevar",
        table_number: snapshot.orderForm.table_number ?? "",
        notes: snapshot.orderForm.notes ?? "",
        product_id:
          snapshot.orderForm.product_id ?? orderEditorProducts[0]?.id ?? "",
        quantity: snapshot.orderForm.quantity ?? 1,
      };
      manualItems = Array.isArray(snapshot.manualItems)
        ? snapshot.manualItems.map((item) => {
            const includedIds = normalizeIdList(item.included_addon_ids ?? []);
            const product = orderEditorProducts.find(
              (p) => p.id === item.product_id,
            );
            const toppingAddons = (product?.addons ?? []).filter(
              (a) =>
                a.is_active &&
                normalizeAddonGroupName(a.group_name) === "toppings",
            );
            const jaleaAddons = (product?.addons ?? []).filter(
              (a) =>
                a.is_active &&
                normalizeAddonGroupName(a.group_name) === "jalea",
            );
            const hasToppingIncluded = includedIds.some((id) =>
              toppingAddons.some((a) => a.id === id),
            );
            const hasJaleaIncluded = includedIds.some((id) =>
              jaleaAddons.some((a) => a.id === id),
            );
            let toppingSelection: "none" | "selected" | undefined =
              item.topping_selection === "none"
                ? "none"
                : item.topping_selection === "selected"
                  ? "selected"
                  : undefined;
            if (toppingSelection === "selected" && !hasToppingIncluded) {
              toppingSelection = toppingAddons.length > 0 ? "none" : undefined;
            }
            let jaleaSelection: "none" | "selected" | undefined =
              item.jalea_selection === "none"
                ? "none"
                : item.jalea_selection === "selected"
                  ? "selected"
                  : undefined;
            if (jaleaSelection === "selected" && !hasJaleaIncluded) {
              jaleaSelection = jaleaAddons.length > 0 ? "none" : undefined;
            }
            return {
              product_id: item.product_id,
              quantity: Number(item.quantity) || 1,
              flavor_id: item.flavor_id,
              flavor_ids: Array.isArray(item.flavor_ids)
                ? item.flavor_ids.filter(
                    (id): id is string => typeof id === "string" && !!id,
                  )
                : undefined,
              included_addon_ids: includedIds,
              extra_addon_ids: normalizeIdList(item.extra_addon_ids ?? []),
              topping_selection: toppingSelection,
              jalea_selection: jaleaSelection,
            };
          })
        : [];
      selectedFlavorId = snapshot.selectedFlavorId ?? "";
      selectedFlavorIds = (snapshot.selectedFlavorIds ?? []).filter(
        (id): id is string => !!id,
      );
      includedToppingIds = normalizeIdList(snapshot.includedToppingIds ?? []);
      includedJaleaIds = normalizeIdList(snapshot.includedJaleaIds ?? []);
      selectedExtraAddonIds = normalizeIdList(
        snapshot.selectedExtraAddonIds ?? [],
      );
      toppingSelection = snapshot.toppingSelection ?? undefined;
      jaleaSelection = snapshot.jaleaSelection ?? undefined;
      return true;
    } catch {
      clearManualDraftStorage();
      return false;
    }
  }

  $effect(() => {
    if (!orderForm.product_id && orderEditorProducts.length > 0) {
      orderForm.product_id = orderEditorProducts[0].id;
    }
  });

  $effect(() => {
    if (
      !isEditing &&
      selectedProductFlavors.length === 1 &&
      !selectedFlavorId &&
      !selectedProduct?.allows_mixed_flavors
    ) {
      selectedFlavorId = selectedProductFlavors[0].id;
    }
  });

  $effect(() => {
    if (orderForm.order_type === "para_llevar") {
      orderForm.table_number = "";
    }
  });

  $effect(() => {
    persistManualDraft();
  });

  const orderEditorProducts = $derived(allProducts ?? products);
  const selectedProduct = $derived(
    orderEditorProducts.find(
      (product) => product.id === orderForm.product_id,
    ) || null,
  );
  const selectedProductFlavors = $derived(
    (selectedProduct?.flavors ?? [])
      .filter((flavor) => flavor.is_active)
      .slice()
      .sort(
        (left, right) =>
          left.display_order - right.display_order ||
          left.name.localeCompare(right.name),
      ),
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
  const selectedProductAddonGroups = $derived(
    groupAddonsByGroup(selectedProductAddons),
  );
  const toppingAddons = $derived(
    selectedProductAddons.filter(
      (addon) => normalizeAddonGroupName(addon.group_name) === "toppings",
    ),
  );
  const jaleaAddons = $derived(
    selectedProductAddons.filter(
      (addon) => normalizeAddonGroupName(addon.group_name) === "jalea",
    ),
  );
  const paidAddonGroups = $derived(
    selectedProductAddonGroups.filter(
      (group) => group.key !== "toppings" && group.key !== "jalea",
    ),
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
      : orders.filter((order) =>
          order.order_number.toLowerCase().includes(normalizedOrderSearch),
        ),
  );

  const pricePreview = $derived(selectedProduct ? selectedProduct.price : 0);
  const addonsPreviewTotal = $derived(
    selectedExtraAddonIds.reduce((sum, addonId) => {
      const addon = selectedProductAddons.find(
        (candidate) => candidate.id === addonId,
      );
      return sum + Number(addon?.price ?? 0);
    }, 0),
  );
  const totalPreview = $derived(
    ((selectedProduct ? selectedProduct.price : 0) + addonsPreviewTotal) *
      Number(orderForm.quantity || 0),
  );
  const isEditing = $derived(!!editOrderId);
  const employeeById = $derived(
    employees.reduce(
      (acc, employee) => {
        acc[employee.id] = employee.name || employee.email;
        return acc;
      },
      {} as Record<string, string>,
    ),
  );
  const manualOrderTotal = $derived(
    ManualItemHelpers.manualOrderTotal(manualItems, orderEditorProducts),
  );

  function readCustomizationStringArray(
    customizations: Record<string, unknown> | null | undefined,
    key: string,
  ): string[] {
    const rawValue = customizations?.[key];
    if (!Array.isArray(rawValue)) {
      return [];
    }

    return normalizeIdList(
      rawValue.filter((value): value is string => typeof value === "string"),
    );
  }

  function mapOrderItemsToDraft(order: Order): ManualOrderItemDraft[] {
    const items = order.items ?? [];

    return items
      .map((item) => {
        const customizations =
          (item.customizations as Record<string, unknown> | null | undefined) ??
          undefined;
        const flavorIdRaw = customizations?.flavor_id;
        const flavorId =
          typeof flavorIdRaw === "string" && flavorIdRaw.trim()
            ? flavorIdRaw.trim()
            : undefined;
        const flavorIds = readCustomizationStringArray(
          customizations,
          "flavor_ids",
        );

        const includedAddonIDs = readCustomizationStringArray(
          customizations,
          "included_addon_ids",
        );
        const extraAddonIDs = readCustomizationStringArray(
          customizations,
          "extra_addon_ids",
        );
        const legacyAddonIDs = readCustomizationStringArray(
          customizations,
          "addon_ids",
        );

        const fallbackProductID =
          orderEditorProducts.find(
            (product) => product.name === item.product_name,
          )?.id ?? "";
        const productID = (item.product_id || "").trim() || fallbackProductID;

        const toppingSelectionRaw = customizations?.topping_selection;
        const toppingSelection: ManualOrderItemDraft["topping_selection"] =
          toppingSelectionRaw === "none" || toppingSelectionRaw === "selected"
            ? toppingSelectionRaw
            : undefined;

        const jaleaSelectionRaw = customizations?.jalea_selection;
        const jaleaSelection: ManualOrderItemDraft["jalea_selection"] =
          jaleaSelectionRaw === "none" || jaleaSelectionRaw === "selected"
            ? jaleaSelectionRaw
            : undefined;

        return {
          product_id: productID,
          quantity: Math.max(1, Number(item.quantity) || 1),
          flavor_id: flavorId,
          flavor_ids: flavorIds.length > 0 ? flavorIds : undefined,
          included_addon_ids: includedAddonIDs,
          extra_addon_ids:
            extraAddonIDs.length > 0 ? extraAddonIDs : legacyAddonIDs,
          topping_selection: toppingSelection,
          jalea_selection: jaleaSelection,
        };
      })
      .filter((item) => item.product_id);
  }

  function productById(productId: string): Product | undefined {
    return orderEditorProducts.find((product) => product.id === productId);
  }

  function activeFlavors(product: Product | null | undefined): ProductFlavor[] {
    return (product?.flavors ?? [])
      .filter((flavor) => flavor.is_active)
      .slice()
      .sort(
        (left, right) =>
          left.display_order - right.display_order ||
          left.name.localeCompare(right.name),
      );
  }

  function resolveFlavorName(
    productId: string,
    flavorId: string | undefined,
  ): string | null {
    return ManualItemHelpers.resolveFlavorName(
      productId,
      flavorId,
      orderEditorProducts,
    );
  }

  function resolveAddonNames(productId: string, addonIds: string[]): string[] {
    return ManualItemHelpers.resolveAddonNames(
      productId,
      addonIds,
      orderEditorProducts,
    );
  }

  function manualItemUnitPrice(item: ManualOrderItemDraft): number {
    return ManualItemHelpers.manualItemUnitPrice(item, orderEditorProducts);
  }

  function manualItemSubtotal(item: ManualOrderItemDraft): number {
    return ManualItemHelpers.manualItemSubtotal(item, orderEditorProducts);
  }

  function buildCustomizationsFromDraft(
    item: ManualOrderItemDraft,
  ): Record<string, unknown> | undefined {
    return ManualItemHelpers.buildCustomizationsFromDraft(
      item,
      orderEditorProducts,
    );
  }

  function buildCurrentDraftItem(): ManualOrderItemDraft | null {
    const result = DraftHelpers.buildCurrentDraftItem(
      orderForm.product_id,
      orderForm.quantity,
      selectedFlavorId,
      selectedFlavorIds,
      includedToppingIds,
      includedJaleaIds,
      selectedExtraAddonIds,
      toppingSelection,
      jaleaSelection,
      orderEditorProducts,
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

    if (editingDraftIndex !== null) {
      manualItems = manualItems.map((item, index) =>
        index === editingDraftIndex ? nextItem : item,
      );
      editingDraftIndex = null;
    } else {
      manualItems = DraftHelpers.addDraftItem(manualItems, nextItem);
    }

    orderForm.quantity = 1;
    const reset = DraftHelpers.resetCustomizationSelections();
    selectedFlavorId = reset.selectedFlavorId;
    selectedFlavorIds = reset.selectedFlavorIds;
    includedToppingIds = reset.includedToppingIds;
    includedJaleaIds = reset.includedJaleaIds;
    selectedExtraAddonIds = reset.selectedExtraAddonIds;
    toppingSelection = undefined;
    jaleaSelection = undefined;
  }

  function removeDraftItem(indexToRemove: number) {
    manualItems = DraftHelpers.removeDraftItem(manualItems, indexToRemove);
    if (editingDraftIndex === null) return;
    if (editingDraftIndex === indexToRemove) {
      editingDraftIndex = null;
      return;
    }
    if (editingDraftIndex > indexToRemove) {
      editingDraftIndex -= 1;
    }
  }

  function updateDraftItemQuantity(
    indexToUpdate: number,
    nextQuantity: number,
  ) {
    manualItems = DraftHelpers.updateDraftItemQuantity(
      manualItems,
      indexToUpdate,
      nextQuantity,
    );
  }

  function draftItemKey(item: ManualOrderItemDraft, index: number): string {
    return DraftHelpers.draftItemKey(item, index);
  }

  function startEditingDraftItem(index: number) {
    const targetItem = manualItems[index];
    if (!targetItem) return;

    const product = orderEditorProducts.find(
      (product) => product.id === targetItem.product_id,
    );
    const includedIds = new Set(targetItem.included_addon_ids ?? []);

    const toppingIds = (product?.addons ?? [])
      .filter(
        (addon) =>
          includedIds.has(addon.id) &&
          normalizeAddonGroupName(addon.group_name) === "toppings",
      )
      .map((addon) => addon.id);

    const jaleaIds = (product?.addons ?? [])
      .filter(
        (addon) =>
          includedIds.has(addon.id) &&
          normalizeAddonGroupName(addon.group_name) === "jalea",
      )
      .map((addon) => addon.id);

    editingDraftIndex = index;
    orderForm.product_id = targetItem.product_id;
    orderForm.quantity = targetItem.quantity;
    selectedFlavorId = targetItem.flavor_id ?? "";
    selectedFlavorIds = (targetItem.flavor_ids ?? []).filter(
      (id): id is string => !!id,
    );
    includedToppingIds =
      toppingIds.length > 0
        ? toppingIds
        : targetItem.topping_selection === "none"
          ? []
          : [];
    includedJaleaIds =
      jaleaIds.length > 0
        ? jaleaIds
        : targetItem.jalea_selection === "none"
          ? []
          : [];
    selectedExtraAddonIds = normalizeIdList(targetItem.extra_addon_ids ?? []);
    toppingSelection =
      targetItem.topping_selection === "selected"
        ? "selected"
        : targetItem.topping_selection === "none"
          ? "none"
          : undefined;
    jaleaSelection =
      targetItem.jalea_selection === "selected"
        ? "selected"
        : targetItem.jalea_selection === "none"
          ? "none"
          : undefined;
    addItemError = "";
    editError = "";
  }

  function cancelEditingDraftItem() {
    editingDraftIndex = null;
    orderForm.quantity = 1;
    const reset = DraftHelpers.resetCustomizationSelections();
    selectedFlavorId = reset.selectedFlavorId;
    selectedFlavorIds = reset.selectedFlavorIds;
    includedToppingIds = reset.includedToppingIds;
    includedJaleaIds = reset.includedJaleaIds;
    selectedExtraAddonIds = reset.selectedExtraAddonIds;
    toppingSelection = undefined;
    jaleaSelection = undefined;
  }

  $effect(() => {
    const currentProductId = selectedProduct?.id ?? "";
    const currentBallQuantity = selectedProduct?.ball_quantity ?? 1;
    const currentAllowsMixed =
      (selectedProduct?.allows_mixed_flavors ?? false) &&
      currentBallQuantity > 1;

    if (currentProductId !== lastSelectedProductId) {
      lastSelectedProductId = currentProductId;
      selectedFlavorId = "";
      selectedFlavorIds = Array(currentBallQuantity).fill("");
      includedToppingIds = [];
      includedJaleaIds = [];
      selectedExtraAddonIds = [];
      toppingSelection = undefined;
      jaleaSelection = undefined;
      return;
    }

    if (
      selectedFlavorId &&
      !selectedProductFlavors.some((flavor) => flavor.id === selectedFlavorId)
    ) {
      selectedFlavorId = "";
    }

    let validFlavorIds = selectedFlavorIds.filter((id) =>
      selectedProductFlavors.some((flavor) => flavor.id === id),
    );
    if (currentAllowsMixed) {
      validFlavorIds = validFlavorIds.slice(0, currentBallQuantity);
      while (validFlavorIds.length < currentBallQuantity) {
        validFlavorIds.push("");
      }
    }
    if (validFlavorIds.length !== selectedFlavorIds.length) {
      selectedFlavorIds = validFlavorIds;
    }

    const normalizedAddonIds = selectedExtraAddonIds.filter((addonId) =>
      selectedProductAddons.some((addon) => addon.id === addonId),
    );
    if (normalizedAddonIds.length !== selectedExtraAddonIds.length) {
      selectedExtraAddonIds = normalizedAddonIds;
    }

    const validToppingIds = includedToppingIds.filter((id) =>
      toppingAddons.some((addon) => addon.id === id),
    );
    if (validToppingIds.length !== includedToppingIds.length) {
      includedToppingIds = validToppingIds;
    }

    const validJaleaIds = includedJaleaIds.filter((id) =>
      jaleaAddons.some((addon) => addon.id === id),
    );
    if (validJaleaIds.length !== includedJaleaIds.length) {
      includedJaleaIds = validJaleaIds;
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
    openConfirmDialog(
      confirmDialog,
      "Aprobar orden",
      `Confirmar aprobacion de ${order.order_number}?`,
      () => {
        void approveAndSync(order.id);
      },
    );
  }

  function requestDelete(order: Order) {
    openConfirmDialog(
      confirmDialog,
      "Eliminar orden",
      `Seguro que deseas eliminar ${order.order_number}?`,
      () => onDelete(order.id),
    );
  }

  function requestArchive(order: Order) {
    openConfirmDialog(
      confirmDialog,
      "Archivar orden",
      `Archivar ${order.order_number}? Las ordenes archivadas no aparecen en la lista principal.`,
      () => {
        void onArchive(order.id, true);
      },
    );
  }

  function requestUnarchive(order: Order) {
    openConfirmDialog(
      confirmDialog,
      "Desarchivar orden",
      `Desarchivar ${order.order_number}? Volvera a aparecer en la lista principal.`,
      () => {
        void onArchive(order.id, false);
      },
    );
  }

  async function printFromList(orderId: string) {
    const detail = await onOpenOrder(orderId);
    if (detail) {
      printOrderReceipt(detail);
    }
  }

  function resetOrderForm() {
    editOrderId = null;
    editingDraftIndex = null;
    editError = "";
    editNotice = "";
    addItemError = "";
    const reset = DraftHelpers.resetCustomizationSelections();
    selectedFlavorId = reset.selectedFlavorId;
    selectedFlavorIds = reset.selectedFlavorIds;
    includedToppingIds = reset.includedToppingIds;
    includedJaleaIds = reset.includedJaleaIds;
    selectedExtraAddonIds = reset.selectedExtraAddonIds;
    toppingSelection = undefined;
    jaleaSelection = undefined;
    manualItems = [];
    orderForm = {
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      payment_method: "efectivo",
      amount_received: "",
      order_type: "para_llevar",
      table_number: "",
      notes: "",
      product_id: orderEditorProducts[0]?.id || "",
      quantity: 1,
    };
  }

  function toggleExtraAddonSelection(addonId: string, checked: boolean) {
    if (checked) {
      if (!selectedExtraAddonIds.includes(addonId)) {
        selectedExtraAddonIds = [...selectedExtraAddonIds, addonId];
      }
      return;
    }

    selectedExtraAddonIds = selectedExtraAddonIds.filter(
      (currentAddonId) => currentAddonId !== addonId,
    );
  }

  function onToppingSelectionChange(includedIds: string[], extraIds: string[]) {
    includedToppingIds = includedIds;
    const groupIds = new Set(toppingAddons.map((a) => a.id));
    selectedExtraAddonIds = normalizeIdList([
      ...selectedExtraAddonIds.filter((id) => !groupIds.has(id)),
      ...extraIds,
    ]);
    toppingSelection =
      includedIds.length > 0 || extraIds.length > 0 ? "selected" : "none";
  }

  function onJaleaSelectionChange(includedIds: string[], extraIds: string[]) {
    includedJaleaIds = includedIds;
    const groupIds = new Set(jaleaAddons.map((a) => a.id));
    selectedExtraAddonIds = normalizeIdList([
      ...selectedExtraAddonIds.filter((id) => !groupIds.has(id)),
      ...extraIds,
    ]);
    jaleaSelection =
      includedIds.length > 0 || extraIds.length > 0 ? "selected" : "none";
  }

  function openCreateOrderModal() {
    addItemError = "";
    createOrderIdempotencyKey = generateIdempotencyKey();
    if (!restoreManualDraft()) {
      resetOrderForm();
    }
    orderEditorOpen = true;
  }

  function clearManualOrderForm(options?: { close?: boolean }) {
    clearManualDraftStorage();
    resetOrderForm();
    saveUserOpen = false;

    if (options?.close ?? false) {
      orderEditorOpen = false;
    }
  }

  function closeOrderEditor() {
    saveUserOpen = false;
    orderEditorOpen = false;
    editingDraftIndex = null;
    if (editOrderId) {
      resetOrderForm();
      return;
    }

    editError = "";
    editNotice = "";
    addItemError = "";
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
      const fallbackItem =
        manualItems.length === 0 ? buildCurrentDraftItem() : null;
      const items = OrderSubmission.prepareOrderItems(
        manualItems,
        fallbackItem,
        orderEditorProducts,
      );
      if (!items) {
        editError = "Agrega al menos un producto a la orden";
        return;
      }

      if (!orderForm.notes.trim()) {
        editError =
          "Debes agregar una nota explicando los cambios realizados en la orden";
        return;
      }

      const updatePayload = OrderSubmission.buildOrderUpdatePayload(
        orderForm.customer_name,
        orderForm.customer_phone,
        orderForm.customer_email,
        orderForm.payment_method,
        orderForm.amount_received,
        orderForm.order_type,
        orderForm.table_number,
        orderForm.notes,
        items,
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

    const fallbackItem =
      manualItems.length === 0 ? buildCurrentDraftItem() : null;
    const items = OrderSubmission.prepareOrderItems(
      manualItems,
      fallbackItem,
      orderEditorProducts,
    );

    if (!items) {
      editError = "Agrega al menos un producto a la orden";
      return;
    }

    const createPayload = OrderSubmission.buildCreateOrderPayload(
      orderForm.customer_name,
      orderForm.customer_phone,
      orderForm.customer_email,
      orderForm.payment_method,
      orderForm.amount_received,
      orderForm.order_type,
      orderForm.table_number,
      orderForm.notes,
      items,
    );

    const created = await onCreate(
      createPayload,
      createOrderIdempotencyKey ?? undefined,
    );
    if (created) {
      clearManualDraftStorage();
      clearIdempotencyKey();
      createOrderIdempotencyKey = null;
      closeOrderEditor();
    } else {
      editError = "No se pudo crear la orden";
    }
  }

  function openConfirm(title: string, message: string, action: () => void) {
    openConfirmDialog(confirmDialog, title, message, action);
  }

  function confirmNow() {
    confirmDialogNow(confirmDialog);
  }

  function closeConfirm() {
    closeConfirmDialog(confirmDialog);
  }

  function closeDetailDrawer() {
    onClearSelectedOrder();
  }

  function openReject(orderId: string) {
    rejectState = DialogState.openReject(orderId);
  }

  async function approveAndSync(orderId: string, reason?: string) {
    const updated = await onApprove(orderId, reason);
    if (!updated) return;
    emitOrderStatusSync({
      orderId: updated.id,
      orderNumber: updated.order_number,
      status: updated.status,
    });
    await onOpenOrder(orderId);
  }

  async function rejectAndSync(orderId: string, reason: string) {
    const updated = await onReject(orderId, reason);
    if (!updated) return;
    emitOrderStatusSync({
      orderId: updated.id,
      orderNumber: updated.order_number,
      status: updated.status,
    });
    await onOpenOrder(orderId);
  }

  function confirmReject() {
    if (!rejectState.targetId) return;
    if (!rejectState.reason.trim()) {
      rejectState.error = "Debes indicar el motivo de rechazo";
      return;
    }
    void rejectAndSync(rejectState.targetId, rejectState.reason.trim());
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
    void approveAndSync(
      reactivateState.targetId,
      reactivateState.reason.trim(),
    );
    closeReactivate();
  }

  function closeReactivate() {
    reactivateState = DialogState.closeReactivate();
  }

  async function startEdit(orderId: string) {
    editNotice = "";
    editError = "";
    editingDraftIndex = null;
    const order = await onOpenOrder(orderId);
    if (!order) return;
    const draftItems = mapOrderItemsToDraft(order);
    const defaultProductId =
      draftItems[0]?.product_id ||
      orderEditorProducts[0]?.id ||
      orderForm.product_id;

    const reset = DraftHelpers.resetCustomizationSelections();
    selectedFlavorId = reset.selectedFlavorId;
    selectedFlavorIds = reset.selectedFlavorIds;
    includedToppingIds = reset.includedToppingIds;
    includedJaleaIds = reset.includedJaleaIds;
    selectedExtraAddonIds = reset.selectedExtraAddonIds;
    toppingSelection = undefined;
    jaleaSelection = undefined;

    manualItems = draftItems;
    editOrderId = order.id;
    orderForm = {
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email ?? "",
      payment_method: order.payment_method,
      amount_received: order.amount_received ?? "",
      order_type: order.order_type,
      table_number: order.table_number ?? "",
      notes: order.notes ?? "",
      product_id: defaultProductId,
      quantity: 1,
    };
    orderEditorOpen = true;
  }

  function cancelEdit() {
    if (!editOrderId) {
      clearManualOrderForm({ close: true });
      return;
    }

    closeOrderEditor();
  }

  function openPrintPrompt(order: Order) {
    printPromptState = DialogState.openPrintPrompt(order);
  }

  async function handleStatusChangeFromList(
    orderId: string,
    status: "recibida" | "en_proceso" | "lista" | "entregada",
  ) {
    const updated = await onStatusChange(orderId, status);
    if (!updated) return;
    emitOrderStatusSync({
      orderId: updated.id,
      orderNumber: updated.order_number,
      status: updated.status,
    });
    await onOpenOrder(orderId);
  }

  function handleStepClick(order: Order, stepStatus: LinearOrderStatus) {
    if (order.status === "cancelada" || order.status === stepStatus) return;
    if (stepStatus === "lista") {
      openPrintPrompt(order);
      return;
    }
    const nextStatus =
      stepStatus === "pendiente_revision" ? "en_proceso" : stepStatus;
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
    emitOrderStatusSync({
      orderId: updated.id,
      orderNumber: updated.order_number,
      status: updated.status,
    });
    await onOpenOrder(id);
  }
</script>

<section class="space-y-4 md:space-y-6">
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
    {showArchived}
    {pagination}
    onSearchChange={(value) => {
      orderSearch = value;
    }}
    {onFilterChange}
    {onToggleArchivedView}
    {onReload}
    {onPageChange}
    {onPerPageChange}
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
    onRequestArchive={requestArchive}
    onRequestUnarchive={requestUnarchive}
    onRequestDelete={requestDelete}
  />
</section>

{#if selectedOrder}
  <AdminModalShell
    bind:dialogRef={detailDialogRef}
    title={`Detalle: ${selectedOrder.order_number}`}
    icon="lucide:file-text"
    widthClass="w-full md:w-5/6 lg:w-3/4 xl:max-w-5xl"
    onClose={closeDetailDrawer}
  >
    {#snippet headerActions()}
      {#if isOrderEditable(selectedOrder.status)}
        <button
          class="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-info"
          type="button"
          onclick={() => {
            void startEdit(selectedOrder.id);
          }}
          disabled={busy}
          aria-label="Editar orden"
          title="Editar"
        >
          <Icon icon="lucide:pencil" class="h-4 w-4" />
        </button>
      {/if}
      <button
        class="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-info"
        type="button"
        onclick={() => {
          void printFromList(selectedOrder.id);
        }}
        disabled={busy}
        aria-label="Imprimir orden"
        title="Imprimir"
      >
        <Icon icon="lucide:printer" class="h-4 w-4" />
      </button>
      {#if isAdmin}
        <button
          class="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-secondary"
          type="button"
          onclick={() => openSaveUserDialogFromOrder(selectedOrder)}
          aria-label="Guardar como usuario"
          title="Guardar como usuario"
        >
          <Icon icon="lucide:user-plus" class="h-4 w-4" />
        </button>
      {/if}
    {/snippet}

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
  </AdminModalShell>
{/if}

<OrderEditor
  open={orderEditorOpen}
  draftItemEditIndex={editingDraftIndex}
  {isEditing}
  {selectedOrder}
  {busy}
  products={orderEditorProducts}
  {categories}
  {orderForm}
  {manualItems}
  {selectedProductFlavors}
  {toppingAddons}
  {jaleaAddons}
  {selectedProductAddons}
  {paidAddonGroups}
  {selectedFlavorId}
  {selectedFlavorIds}
  {includedToppingIds}
  {includedJaleaIds}
  {selectedExtraAddonIds}
  toppingFreeAllowance={Math.max(0, selectedProduct?.free_toppings ?? 1)}
  jaleaFreeAllowance={1}
  {toppingSelection}
  {jaleaSelection}
  {hasCustomizationOptions}
  {totalPreview}
  {manualOrderTotal}
  {addItemError}
  {editError}
  {editNotice}
  onSubmit={handleSubmit}
  onClose={closeOrderEditor}
  onCancelEdit={cancelEdit}
  onClearForm={() => {
    clearManualOrderForm();
  }}
  onProductChange={(value) => {
    orderForm.product_id = value;
  }}
  onQuantityChange={(value) => {
    orderForm.quantity = value;
  }}
  onFlavorChange={(value) => {
    selectedFlavorId = value;
  }}
  onFlavorIdsChange={(value) => {
    selectedFlavorIds = value;
  }}
  {onToppingSelectionChange}
  {onJaleaSelectionChange}
  onToggleExtraAddonSelection={toggleExtraAddonSelection}
  onAddDraftItem={addDraftItem}
  onEditDraftItem={startEditingDraftItem}
  onCancelDraftItemEdit={cancelEditingDraftItem}
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
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  {busy}
  variant="primary"
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
