<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Employee, Order, Product } from "../../../../lib/api/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  interface CreateOrderPayload {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
    order_type: "en_local" | "para_llevar";
    table_number?: number;
    notes?: string;
    items: Array<{
      product_id: string;
      quantity: number;
      customizations?: Record<string, unknown>;
    }>;
  }

  interface OrdersTabProps {
    isAdmin: boolean;
    orders: Order[];
    products: Product[];
    employees: Employee[];
    selectedOrder: Order | null;
    busy: boolean;
    moduleError: string;
    orderStatusFilter: string;
    onFilterChange: (status: string) => void;
    onReload: () => void;
    onOpenOrder: (id: string) => Promise<Order | null>;
    onApprove: (id: string, reason?: string) => void;
    onReject: (id: string, reason: string) => void;
    onStatusChange: (id: string, status: "recibida" | "en_proceso" | "lista" | "entregada") => Promise<Order | null>;
    onUpdateOrder: (id: string, payload: {
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
      order_type: "en_local" | "para_llevar";
      table_number?: number;
      notes?: string;
    }) => Promise<Order | null>;
    onDelete: (id: string) => void;
    onCreate: (payload: CreateOrderPayload) => Promise<boolean>;
    saveUserFromOrder: (payload: {
      name: string;
      user_type: "user" | "company";
      phone: string;
      email?: string;
      status: "active" | "inactive";
    }) => Promise<boolean>;
  }

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

  let confirmDialog: HTMLDialogElement | null = null;
  let orderEditorDialog: HTMLDialogElement | null = null;
  let orderNotesDialog: HTMLDialogElement | null = null;
  let saveUserDialog: HTMLDialogElement | null = null;
  let tokenVisible = $state(false);
  let tokenCopied = $state<"" | "token" | "both" | "link">("");

  $effect(() => {
    // reset reveal state whenever a different order is opened
    if (selectedOrder) {
      tokenVisible = false;
      tokenCopied = "";
    }
  });

  async function copyToClipboard(text: string, kind: "token" | "both" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      tokenCopied = kind;
      setTimeout(() => { tokenCopied = ""; }, 2000);
    } catch {
      // clipboard not available (e.g. insecure context) — silently ignore
    }
  }
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);

  let rejectDialog: HTMLDialogElement | null = null;
  let rejectTargetId = $state<string | null>(null);
  let rejectReason = $state("");
  let rejectError = $state("");
  let reactivateDialog: HTMLDialogElement | null = null;
  let reactivateTargetId = $state<string | null>(null);
  let reactivateReason = $state("");
  let reactivateError = $state("");
  let printPromptDialog: HTMLDialogElement | null = null;
  let printTarget = $state<Order | null>(null);
  let pendingStatusChange = $state<null | { id: string; status: "recibida" | "en_proceso" | "lista" | "entregada" }>(null);
  let editOrderId = $state<string | null>(null);
  let editError = $state("");
  let editNotice = $state("");
  let addItemError = $state("");
  let saveUserError = $state("");
  let orderSearch = $state("");
  let selectedFlavorId = $state("");
  let includedToppingId = $state("");
  let includedJaleaId = $state("");
  let selectedExtraAddonIds = $state<string[]>([]);
  let lastSelectedProductId = $state("");
  let saveUserForm = $state({
    name: "",
    user_type: "user" as "user" | "company",
    phone: "",
    email: "",
    status: "active" as "active" | "inactive",
  });

  const DEFAULT_ADDON_GROUP_NAME = "extras";
  const ADDON_GROUP_LABELS: Record<string, string> = {
    toppings: "Toppings",
    jalea: "Jalea",
    extras: "Extras",
  };

  type ProductAddon = NonNullable<Product["addons"]>[number];
  type ProductFlavor = NonNullable<Product["flavors"]>[number];
  type ManualOrderItemDraft = {
    product_id: string;
    quantity: number;
    flavor_id?: string;
    included_addon_ids: string[];
    extra_addon_ids: string[];
  };

  function normalizeAddonGroupName(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return DEFAULT_ADDON_GROUP_NAME;
    }

    switch (normalized) {
      case "topping":
      case "toppings":
        return "toppings";
      case "jalea":
      case "jaleas":
        return "jalea";
      case "extra":
      case "extras":
        return "extras";
      default:
        if (normalized.includes("topping")) {
          return "toppings";
        }
        if (normalized.includes("jalea")) {
          return "jalea";
        }
        if (normalized.includes("extra")) {
          return "extras";
        }
        return normalized;
    }
  }

  function addonGroupLabel(value: string): string {
    const normalized = normalizeAddonGroupName(value);
    if (ADDON_GROUP_LABELS[normalized]) {
      return ADDON_GROUP_LABELS[normalized];
    }

    return normalized
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  function groupAddonsByGroup(source: ProductAddon[]): Array<{ key: string; label: string; items: ProductAddon[] }> {
    const grouped = new Map<string, ProductAddon[]>();

    for (const addon of source) {
      const key = normalizeAddonGroupName(addon.group_name);
      const current = grouped.get(key) ?? [];
      current.push(addon);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, items]) => ({
        key,
        label: addonGroupLabel(key),
        items: items.slice().sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name)),
      }));
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }

  function normalizeIdList(values: string[] | undefined): string[] {
    return Array.from(new Set((values ?? []).filter(Boolean))).sort();
  }

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
    manualItems.reduce((sum, item) => sum + manualItemSubtotal(item), 0),
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
    if (!flavorId) return null;
    const flavor = productById(productId)?.flavors?.find((candidate) => candidate.id === flavorId);
    return flavor?.name ?? null;
  }

  function resolveAddonNames(productId: string, addonIds: string[]): string[] {
    if (addonIds.length === 0) return [];
    const addons = productById(productId)?.addons ?? [];
    return addonIds
      .map((addonId) => addons.find((candidate) => candidate.id === addonId)?.name ?? null)
      .filter((value): value is string => !!value);
  }

  function manualItemUnitPrice(item: ManualOrderItemDraft): number {
    const product = productById(item.product_id);
    const addonPrice = item.extra_addon_ids.reduce((sum, addonId) => {
      const addon = product?.addons?.find((candidate) => candidate.id === addonId);
      return sum + (addon?.price ?? 0);
    }, 0);
    return (product?.price ?? 0) + addonPrice;
  }

  function manualItemSubtotal(item: ManualOrderItemDraft): number {
    return manualItemUnitPrice(item) * item.quantity;
  }

  function buildCustomizationsFromDraft(item: ManualOrderItemDraft): Record<string, unknown> | undefined {
    const customizations: Record<string, unknown> = {};
    if (item.flavor_id) {
      customizations.flavor_id = item.flavor_id;
    }
    if (item.included_addon_ids.length > 0) {
      customizations.included_addon_ids = item.included_addon_ids;
    }
    if (item.extra_addon_ids.length > 0) {
      customizations.extra_addon_ids = item.extra_addon_ids;
    }
    return Object.keys(customizations).length > 0 ? customizations : undefined;
  }

  function buildCurrentDraftItem(): ManualOrderItemDraft | null {
    if (!orderForm.product_id) {
      editError = "Selecciona un producto para agregar a la orden";
      return null;
    }

    const quantity = Number(orderForm.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      editError = "La cantidad debe ser mayor que cero";
      return null;
    }

    if (selectedProduct && activeFlavors(selectedProduct).length > 0 && !selectedFlavorId) {
      editError = "Selecciona un sabor para este producto";
      return null;
    }

    return {
      product_id: orderForm.product_id,
      quantity,
      flavor_id: selectedFlavorId || undefined,
      included_addon_ids: normalizeIdList([includedToppingId, includedJaleaId].filter((value) => value)),
      extra_addon_ids: normalizeIdList(selectedExtraAddonIds),
    };
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

    const existingIndex = manualItems.findIndex((item) => (
      item.product_id === nextItem.product_id &&
      (item.flavor_id || "") === (nextItem.flavor_id || "") &&
      arraysEqual(item.included_addon_ids, nextItem.included_addon_ids) &&
      arraysEqual(item.extra_addon_ids, nextItem.extra_addon_ids)
    ));

    if (existingIndex >= 0) {
      manualItems = manualItems.map((item, index) => (
        index === existingIndex
          ? { ...item, quantity: item.quantity + nextItem.quantity }
          : item
      ));
    } else {
      manualItems = [...manualItems, nextItem];
    }

    orderForm.quantity = 1;
    selectedFlavorId = "";
    includedToppingId = "";
    includedJaleaId = "";
    selectedExtraAddonIds = [];
  }

  function removeDraftItem(indexToRemove: number) {
    manualItems = manualItems.filter((_, index) => index !== indexToRemove);
  }

  function updateDraftItemQuantity(indexToUpdate: number, nextQuantity: number) {
    const safeQuantity = Math.max(0, Math.floor(nextQuantity));
    manualItems = manualItems
      .map((item, index) => index === indexToUpdate ? { ...item, quantity: safeQuantity } : item)
      .filter((item) => item.quantity > 0);
  }

  function draftItemKey(item: ManualOrderItemDraft, index: number): string {
    return [
      item.product_id,
      item.flavor_id || "",
      item.included_addon_ids.join(","),
      item.extra_addon_ids.join(","),
      String(index),
    ].join("|");
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

  const linearStatuses: Array<"pendiente_revision" | "recibida" | "en_proceso" | "lista" | "entregada"> = [
    "pendiente_revision",
    "recibida",
    "en_proceso",
    "lista",
    "entregada",
  ];

  const statusLabels: Record<Order["status"], string> = {
    pendiente_revision: "pendiente",
    recibida: "aceptada",
    en_proceso: "preparando",
    lista: "lista",
    entregada: "entregada",
    cancelada: "rechazada",
  };

  const statusBadgeClass: Record<Order["status"], string> = {
    pendiente_revision: "badge-warning",
    recibida: "badge-success",
    en_proceso: "badge-info",
    lista: "badge-accent",
    entregada: "badge-primary",
    cancelada: "badge-error",
  };

  const statusStepIconsActive: Record<(typeof linearStatuses)[number], string> = {
    pendiente_revision: "line-md:watch-loop",
    recibida:           "line-md:confirm-circle",
    en_proceso:         "line-md:loading-twotone-loop",
    lista:              "line-md:bell-loop",
    entregada:          "line-md:check-all",
  };

  const statusStepIconsStatic: Record<(typeof linearStatuses)[number], string> = {
    pendiente_revision: "lucide:clock",
    recibida:           "lucide:check-circle",
    en_proceso:         "lucide:loader",
    lista:              "lucide:bell",
    entregada:          "lucide:check-check",
  };

  const canceledFlow: Array<"pendiente_revision" | "cancelada"> = [
    "pendiente_revision",
    "cancelada",
  ];

  const canceledStepLabels: Record<(typeof canceledFlow)[number], string> = {
    pendiente_revision: "pendiente",
    cancelada: "denegada",
  };

  const canceledStepIconsActive: Record<(typeof canceledFlow)[number], string> = {
    pendiente_revision: "line-md:watch-loop",
    cancelada:          "line-md:close-circle",
  };

  const canceledStepIconsStatic: Record<(typeof canceledFlow)[number], string> = {
    pendiente_revision: "lucide:clock",
    cancelada:          "lucide:x-circle",
  };

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

  function kitchenBadge(order: Order): { text: string; className: string } | null {
    if (order.status === "recibida") {
      return { text: "Nueva orden", className: "badge badge-success badge-outline" };
    }
    return null;
  }

  function isStepReached(current: Order["status"], step: (typeof linearStatuses)[number]) {
    if (current === "cancelada") return false;
    return linearStatuses.indexOf(current as (typeof linearStatuses)[number]) >= linearStatuses.indexOf(step);
  }

  function amountColumnLabel(status: Order["status"]) {
    return status === "lista" || status === "entregada" ? "Total" : "Subtotal";
  }

  function orderTypeLabel(orderType: Order["order_type"]) {
    return orderType === "en_local" ? "En local" : "Para llevar";
  }

  function createdByLabel(order: Order) {
    const explicitName = order.created_by_name?.trim();
    if (explicitName) return explicitName;
    if (!order.created_by_user_id) return order.customer_name;
    return employeeById[order.created_by_user_id] || "Personal";
  }

  function resetOrderForm() {
    editOrderId = null;
    editError = "";
    editNotice = "";
    selectedFlavorId = "";
    includedToppingId = "";
    includedJaleaId = "";
    selectedExtraAddonIds = [];
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
    orderEditorDialog?.showModal();
  }

  function closeOrderEditor() {
    orderNotesDialog?.close();
    saveUserDialog?.close();
    orderEditorDialog?.close();
    resetOrderForm();
  }

  function openNotesDialog() {
    orderNotesDialog?.showModal();
  }

  function closeNotesDialog() {
    orderNotesDialog?.close();
  }

  function openSaveUserDialog() {
    saveUserError = "";
    saveUserForm = {
      name: orderForm.customer_name.trim(),
      user_type: "user",
      phone: orderForm.customer_phone.trim(),
      email: orderForm.customer_email.trim(),
      status: "active",
    };
    saveUserDialog?.showModal();
  }

  function openSaveUserDialogFromOrder(order: Order) {
    saveUserError = "";
    saveUserForm = {
      name: order.customer_name.trim(),
      user_type: "user",
      phone: order.customer_phone.trim(),
      email: (order.customer_email ?? "").trim(),
      status: "active",
    };
    saveUserDialog?.showModal();
  }

  function closeSaveUserDialog() {
    saveUserDialog?.close();
    saveUserError = "";
  }

  async function submitSaveUser(event: SubmitEvent) {
    event.preventDefault();
    saveUserError = "";

    const saved = await saveUserFromOrder({
      name: saveUserForm.name.trim(),
      user_type: saveUserForm.user_type,
      phone: saveUserForm.phone.trim(),
      email: saveUserForm.email.trim() || undefined,
      status: saveUserForm.status,
    });

    if (!saved) {
      saveUserError = "No se pudo guardar el usuario";
      return;
    }

    closeSaveUserDialog();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    editError = "";
    editNotice = "";
    if (editOrderId) {
      const normalizedTableNumber =
        orderForm.order_type === "en_local" && orderForm.table_number !== ""
          ? Number(orderForm.table_number)
          : undefined;
      const updated = await onUpdateOrder(editOrderId, {
        customer_name: orderForm.customer_name.trim(),
        customer_phone: orderForm.customer_phone.trim(),
        customer_email: orderForm.customer_email.trim() || undefined,
        payment_method: orderForm.payment_method,
        order_type: orderForm.order_type,
        table_number: Number.isFinite(normalizedTableNumber) ? normalizedTableNumber : undefined,
        notes: orderForm.notes.trim() || undefined,
      });
      if (updated) {
        editNotice = "Orden actualizada correctamente";
        closeOrderEditor();
      } else {
        editError = "No se pudo actualizar la orden";
      }
      return;
    }

    const fallbackItem = manualItems.length === 0 ? buildCurrentDraftItem() : null;
    const itemsToCreate = manualItems.length > 0
      ? manualItems
      : fallbackItem
        ? [fallbackItem]
        : [];

    if (itemsToCreate.length === 0) {
      if (!editError) {
        editError = "Agrega al menos un producto a la orden";
      }
      return;
    }

    const created = await onCreate({
      customer_name: orderForm.customer_name.trim(),
      customer_phone: orderForm.customer_phone.trim(),
      customer_email: orderForm.customer_email.trim() || undefined,
      payment_method: orderForm.payment_method,
      order_type: orderForm.order_type,
      table_number: orderForm.order_type === "en_local" && orderForm.table_number !== ""
        ? Number(orderForm.table_number)
        : undefined,
      notes: orderForm.notes.trim() || undefined,
      items: itemsToCreate.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        customizations: buildCustomizationsFromDraft(item),
      })),
    });

    if (created) {
      closeOrderEditor();
    } else {
      editError = "No se pudo crear la orden";
    }
  }

  function openConfirm(title: string, message: string, action: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmAction = action;
    confirmDialog?.showModal();
  }

  function confirmNow() {
    const action = confirmAction;
    confirmAction = null;
    confirmDialog?.close();
    if (action) action();
  }

  function closeConfirm() {
    confirmAction = null;
    confirmDialog?.close();
  }

  function openReject(orderId: string) {
    rejectTargetId = orderId;
    rejectReason = "";
    rejectError = "";
    rejectDialog?.showModal();
  }

  function confirmReject() {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      rejectError = "Debes indicar el motivo de rechazo";
      return;
    }
    onReject(rejectTargetId, rejectReason.trim());
    rejectDialog?.close();
    rejectTargetId = null;
    rejectReason = "";
    rejectError = "";
  }

  function closeReject() {
    rejectDialog?.close();
    rejectTargetId = null;
    rejectReason = "";
    rejectError = "";
  }

  function openReactivate(orderId: string) {
    reactivateTargetId = orderId;
    reactivateReason = "";
    reactivateError = "";
    reactivateDialog?.showModal();
  }

  function confirmReactivate() {
    if (!reactivateTargetId) return;
    if (!reactivateReason.trim()) {
      reactivateError = "Debes indicar el motivo de reactivacion";
      return;
    }
    onApprove(reactivateTargetId, reactivateReason.trim());
    closeReactivate();
  }

  function closeReactivate() {
    reactivateDialog?.close();
    reactivateTargetId = null;
    reactivateReason = "";
    reactivateError = "";
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
    orderEditorDialog?.showModal();
  }

  function cancelEdit() {
    closeOrderEditor();
  }

  function openPrintPrompt(order: Order) {
    printTarget = order;
    pendingStatusChange = { id: order.id, status: "lista" };
    printPromptDialog?.showModal();
  }

  async function handleStatusChangeFromList(orderId: string, status: "recibida" | "en_proceso" | "lista" | "entregada") {
    const updated = await onStatusChange(orderId, status);
    if (!updated) return;
    await onOpenOrder(orderId);
  }

  function handleStepClick(order: Order, stepStatus: (typeof linearStatuses)[number]) {
    if (order.status === "cancelada" || order.status === stepStatus) return;
    if (stepStatus === "lista") {
      openPrintPrompt(order);
      return;
    }
    const nextStatus = stepStatus === "pendiente_revision" ? "en_proceso" : stepStatus;
    handleStatusChangeFromList(order.id, nextStatus);
  }

  function canChangeToStep(order: Order, stepStatus: (typeof linearStatuses)[number]) {
    return order.status !== "cancelada" && order.status !== stepStatus && stepStatus !== "pendiente_revision";
  }

  function closePrintPrompt() {
    printPromptDialog?.close();
    printTarget = null;
    pendingStatusChange = null;
  }

  function renderReceipt(order: Order) {
    const itemsMarkup = (order.items || []).map((item) => {
      let details = "";
      if (item.customizations) {
        const parts: string[] = [];
        if (item.customizations.flavor_name) parts.push(`Sabor: ${item.customizations.flavor_name}`);
        if (Array.isArray(item.customizations.included_addon_names) && item.customizations.included_addon_names.length > 0) {
          parts.push(`Incluidos: ${(item.customizations.included_addon_names as string[]).join(", ")}`);
        }
        if (Array.isArray(item.customizations.extra_addon_names) && item.customizations.extra_addon_names.length > 0) {
          parts.push(`Extras: ${(item.customizations.extra_addon_names as string[]).join(", ")}`);
        }
        if (Array.isArray(item.customizations.addon_names) && item.customizations.addon_names.length > 0) {
          parts.push(`Complementos: ${(item.customizations.addon_names as string[]).join(", ")}`);
        }
        if (item.customizations.notes) parts.push(`Nota: ${item.customizations.notes}`);
        if (parts.length > 0) {
          details = `<br><span style="font-size:11px;color:#666">${parts.join(" | ")}</span>`;
        }
      }
      return `<tr><td>${item.product_name}${details}</td><td>${item.quantity}</td><td>${formatCurrency(item.subtotal)}</td></tr>`;
    }).join("");

    const itemsTable = itemsMarkup || `<tr><td colspan="3">Sin items</td></tr>`;

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Recibo ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #ddd; padding: 6px 0; text-align: left; }
      .meta { font-size: 12px; color: #555; margin-top: 6px; }
      .total { font-weight: bold; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>Recibo de orden ${order.order_number}</h1>
    <div class="meta">Cliente: ${order.customer_name}</div>
    <div class="meta">Telefono: ${order.customer_phone}</div>
    <div class="meta">Metodo pago: ${order.payment_method}</div>
    <table>
      <thead><tr><th>Producto</th><th>Cantidad</th><th>${amountColumnLabel(order.status)}</th></tr></thead>
      <tbody>${itemsTable}</tbody>
    </table>
    <div class="total">Total: ${formatCurrency(order.total_amount)}</div>
  </body>
</html>`;
  }

  function printReceipt(order: Order) {
    const receipt = renderReceipt(order);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = receipt;
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
    };
    document.body.appendChild(iframe);
  }

  async function applyStatusChange() {
    if (!pendingStatusChange) return;
    const { id, status } = pendingStatusChange;
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

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="card-title">Gestion de ordenes</h2>
          <p class="text-sm text-base-content/70">Crea ordenes nuevas o busca rapidamente por numero.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button class="btn btn-primary" type="button" onclick={openCreateOrderModal} disabled={busy}>
            Crear orden
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label for="order-search" class="label-text text-sm whitespace-nowrap">Buscar por numero</label>
            <input
              id="order-search"
              class="input input-sm input-bordered w-56 md:w-64"
              placeholder="ORD-20260223-2029"
              bind:value={orderSearch}
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="label-text text-sm whitespace-nowrap">Filtrar por estado</span>
            <div class="dropdown dropdown-right dropdown-center">
              <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-40 justify-between">
                {orderStatusFilterLabel}
              </div>
              <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-sm border border-base-300">
                <li><button type="button" onclick={() => onFilterChange("")}>Todos</button></li>
                <li><button type="button" onclick={() => onFilterChange("pendiente_revision")}>pendiente</button></li>
                <li><button type="button" onclick={() => onFilterChange("recibida")}>recibida</button></li>
                <li><button type="button" onclick={() => onFilterChange("en_proceso")}>preparando</button></li>
                <li><button type="button" onclick={() => onFilterChange("lista")}>lista</button></li>
                <li><button type="button" onclick={() => onFilterChange("entregada")}>entregada</button></li>
                <li><button type="button" onclick={() => onFilterChange("cancelada")}>cancelada</button></li>
              </ul>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick={onReload} disabled={busy}>Actualizar</button>
        </div>
        <div class="text-sm text-base-content/70 whitespace-nowrap">
          {filteredOrders.length} de {orders.length} orden(es)
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
        <table class="table">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Numero</th>
              <th class="text-center font-bold">Cliente</th>
              <th class="text-center font-bold">Estado</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredOrders.length === 0}
              <tr><td colspan="4" class="text-center">No hay ordenes</td></tr>
            {:else}
              {#each filteredOrders as order}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>
                    <button
                      class="font-medium text-left hover:underline"
                      type="button"
                      title="Ver detalle"
                      onclick={() => onOpenOrder(order.id)}
                    >
                      {order.order_number}
                    </button>
                  </td>
                  <td class="text-center align-middle">
                    <div class="font-medium">{order.customer_name}</div>
                  </td>
                  <td class="text-center align-middle">
                    <div class="flex flex-col items-center gap-1">
                      <span class={`badge ${statusBadgeClass[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                  </td>
                  <td class="text-center align-middle">
                    <div class="flex w-full flex-wrap items-center justify-center gap-2">
                      <button
                        class="btn btn-sm btn-soft btn-info"
                        onclick={async () => {
                          const detail = await onOpenOrder(order.id);
                          if (detail) {
                            printReceipt(detail);
                          }
                        }}
                      >
                        Imprimir
                      </button>
                      <button class="btn btn-sm btn-soft btn-accent" onclick={() => startEdit(order.id)}>Editar</button>
                      {#if order.status === "pendiente_revision"}
                        <button
                          class="btn btn-sm btn-soft btn-success"
                          onclick={() =>
                            openConfirm(
                              "Aprobar orden",
                              `Confirmar aprobacion de ${order.order_number}?`,
                              () => onApprove(order.id),
                            )}
                        >
                          Aprobar
                        </button>
                        <button class="btn btn-sm btn-soft btn-error" onclick={() => openReject(order.id)}>Rechazar</button>
                      {/if}

                      {#if isAdmin}
                        <button
                          class="btn btn-sm btn-soft btn-error"
                          onclick={() =>
                            openConfirm(
                              "Eliminar orden",
                              `Seguro que deseas eliminar ${order.order_number}?`,
                              () => onDelete(order.id),
                            )}
                        >
                          Eliminar
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  {#if selectedOrder}
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="card-title">Detalle de orden: {selectedOrder.order_number}</h3>
          {#if isAdmin}
            <button
              class="btn btn-sm btn-soft btn-secondary"
              type="button"
              onclick={() => openSaveUserDialogFromOrder(selectedOrder)}
            >
              Guardar como usuario
            </button>
          {/if}
        </div>
        <div class="grid gap-3 md:grid-cols-[1fr_1fr_0.9fr] text-sm">
          <div class="space-y-2">
            <p><strong>Cliente:</strong> {selectedOrder.customer_name}</p>
            <p><strong>Metodo pago:</strong> {selectedOrder.payment_method}</p>
            <p><strong>Mesa:</strong> {selectedOrder.order_type === "en_local" ? (selectedOrder.table_number ?? "Sin mesa") : "No aplica"}</p>
          </div>
          <div class="space-y-2">
            <p><strong>Telefono:</strong> {selectedOrder.customer_phone}</p>
            <p><strong>Tipo:</strong> {selectedOrder.order_type ? orderTypeLabel(selectedOrder.order_type) : "No definido"}</p>
            <p><strong>Creada por:</strong> {createdByLabel(selectedOrder)}</p>
          </div>
          <div class="space-y-2">
            <p><strong>Notas:</strong></p>
            <div class="rounded-lg border border-base-300/60 bg-base-200/40 p-3 text-sm max-h-28 overflow-y-auto">
              {selectedOrder.notes?.trim() ? selectedOrder.notes : "Sin notas"}
            </div>
          </div>
          {#if selectedOrder.tracking_token}
            <div class="md:col-span-3 rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2">
              <p class="text-xs font-semibold text-warning/80 uppercase tracking-wide">Token de seguimiento del cliente</p>
              <div class="flex flex-wrap items-center gap-2">
                <code class="flex-1 min-w-0 truncate rounded bg-base-300/60 px-2 py-1 text-xs font-mono select-all">
                  {tokenVisible ? selectedOrder.tracking_token : "\u2022".repeat(24)}
                </code>
                <button
                  class="btn btn-xs btn-ghost"
                  type="button"
                  title={tokenVisible ? "Ocultar token" : "Revelar token"}
                  onclick={() => { tokenVisible = !tokenVisible; }}
                  aria-label={tokenVisible ? "Ocultar token" : "Revelar token"}
                >
                  <Icon icon={tokenVisible ? "lucide:eye-off" : "lucide:eye"} width="14" height="14" />
                </button>
                <button
                  class="btn btn-xs btn-ghost"
                  type="button"
                  title="Copiar token"
                  onclick={() => copyToClipboard(selectedOrder.tracking_token!, "token")}
                  aria-label="Copiar token"
                >
                  <Icon icon={tokenCopied === "token" ? "lucide:check" : "lucide:copy"} width="14" height="14" />
                  {tokenCopied === "token" ? "¡Copiado!" : "Token"}
                </button>
                <button
                  class="btn btn-xs btn-outline btn-warning"
                  type="button"
                  title="Copiar Número de orden y token juntos para enviar al cliente"
                  onclick={() => copyToClipboard(`Número de orden: ${selectedOrder.order_number}\nToken: ${selectedOrder.tracking_token}`, "both")}
                  aria-label="Copiar ORD y token"
                >
                  <Icon icon={tokenCopied === "both" ? "lucide:check" : "lucide:clipboard-copy"} width="14" height="14" />
                  {tokenCopied === "both" ? "¡Copiado!" : "Copiar ORD + Token"}
                </button>
                {#if selectedOrder.tracking_url}
                  <button
                    class="btn btn-xs btn-warning"
                    type="button"
                    title="Copiar enlace seguro de seguimiento"
                    onclick={() => copyToClipboard(selectedOrder.tracking_url!, "link")}
                    aria-label="Copiar enlace de seguimiento"
                  >
                    <Icon icon={tokenCopied === "link" ? "lucide:check" : "lucide:link"} width="14" height="14" />
                    {tokenCopied === "link" ? "¡Copiado!" : "Copiar enlace"}
                  </button>
                {/if}
              </div>
              {#if selectedOrder.tracking_token_expires_at}
                <p class="text-xs text-base-content/50">Expira: {new Date(selectedOrder.tracking_token_expires_at).toLocaleDateString("es-SV", { dateStyle: "medium" })}</p>
              {/if}
            </div>
          {/if}
          <div class="md:col-span-3">
            {#if selectedOrder.status === "cancelada"}
              <div class="flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-left"><strong>Estado:</strong></p>
                  <span class="badge badge-error badge-outline">Orden denegada</span>
                  {#if selectedOrder.rejection_reason}
                    <span class="text-xs text-base-content/60">Motivo: {selectedOrder.rejection_reason}</span>
                  {/if}
                  {#if isAdmin}
                    <button
                      class="btn btn-xs btn-soft btn-success"
                      onclick={() => openReactivate(selectedOrder.id)}
                    >
                      Aceptar
                    </button>
                  {/if}
                </div>
                <ul class="steps steps-sm w-full max-w-2xl mt-2">
                  {#each canceledFlow as stepStatus}
                    <li class="step step-primary text-center">
                      <span class="step-icon"><Icon icon={stepStatus === selectedOrder.status ? canceledStepIconsActive[stepStatus] : canceledStepIconsStatic[stepStatus]} width="16" height="16" /></span>
                      <span>{canceledStepLabels[stepStatus]}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {:else}
              <div class="grid gap-3 md:grid-cols-[200px_minmax(240px,1fr)_200px] items-center">
                <div class="text-left">
                  <p><strong>Estado:</strong></p>
                </div>
                <div>
                  <ul class="steps steps-sm w-full max-w-3xl mx-auto">
                    {#each linearStatuses as stepStatus}
                      <li class={`step ${isStepReached(selectedOrder.status, stepStatus) ? "step-primary" : ""} text-center`}>
                        <span class="step-icon"><Icon icon={stepStatus === selectedOrder.status ? statusStepIconsActive[stepStatus] : statusStepIconsStatic[stepStatus]} width="16" height="16" /></span>
                        <button
                          class="cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit disabled:cursor-default"
                          type="button"
                          onclick={() => handleStepClick(selectedOrder, stepStatus)}
                          disabled={!canChangeToStep(selectedOrder, stepStatus)}
                          aria-label={`Actualizar estado a ${statusLabels[stepStatus]}`}
                        >
                          {statusLabels[stepStatus]}
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
                <div class="flex justify-end">
                  <div class="flex items-center gap-2">
                    {#if kitchenBadge(selectedOrder)}
                      <span class={kitchenBadge(selectedOrder)?.className}>{kitchenBadge(selectedOrder)?.text}</span>
                    {/if}
                    {#if selectedOrder.status === "recibida" && isAdmin}
                      <button class="btn btn-xs btn-soft btn-error" onclick={() => openReject(selectedOrder.id)}>
                        Rechazar
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
        <div class="overflow-x-auto mt-2">
          <table class="table table-sm">
            <thead class="bg-base-200/60 text-base-content">
              <tr>
                <th class="w-[55%] font-bold">Producto</th>
                <th class="w-[15%] text-center font-bold">Cantidad</th>
                <th class="w-[30%] text-right font-bold">{amountColumnLabel(selectedOrder.status)}</th>
              </tr>
            </thead>
            <tbody>
              {#if !selectedOrder.items || selectedOrder.items.length === 0}
                <tr><td colspan="3">Sin items</td></tr>
              {:else}
                {#each selectedOrder.items as item}
                  <tr>
                    <td>
                      <div>{item.product_name}</div>
                      {#if item.customizations}
                        {#if item.customizations.flavor_name}
                          <div class="text-xs text-base-content/60">Sabor: {item.customizations.flavor_name}</div>
                        {/if}
                        {#if Array.isArray(item.customizations.addon_names) && item.customizations.addon_names.length > 0}
                          <div class="text-xs text-base-content/60">Complementos: {item.customizations.addon_names.join(", ")}</div>
                        {/if}
                        {#if Array.isArray(item.customizations.included_addon_names) && item.customizations.included_addon_names.length > 0}
                          <div class="text-xs text-base-content/60">Incluidos: {item.customizations.included_addon_names.join(", ")}</div>
                        {/if}
                        {#if Array.isArray(item.customizations.extra_addon_names) && item.customizations.extra_addon_names.length > 0}
                          <div class="text-xs text-base-content/60">Extras: {item.customizations.extra_addon_names.join(", ")}</div>
                        {/if}
                        {#if item.customizations.notes}
                          <div class="text-xs text-base-content/60">Nota: {item.customizations.notes}</div>
                        {/if}
                      {/if}
                    </td>
                    <td class="text-center">{item.quantity}</td>
                    <td class="text-right">{formatCurrency(item.subtotal)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</section>

<dialog class="modal" bind:this={orderEditorDialog} onclose={resetOrderForm}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar orden" : "Crear orden manual"}</h3>
      {#if isEditing && selectedOrder && selectedOrder.id === editOrderId}
        <span class="text-xs text-base-content/60">{selectedOrder.order_number}</span>
      {/if}
    </div>
    <form class="mt-5" onsubmit={handleSubmit}>
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
          <section class="rounded-2xl border border-base-300 bg-base-200/50 p-4 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 class="font-semibold">Productos de la orden</h4>
                <p class="text-sm text-base-content/70">Agrega una o varias configuraciones del mismo producto o de productos distintos antes de crear la orden.</p>
              </div>
              <div class="text-sm text-base-content/70">{manualItems.length} item(s) agregados</div>
            </div>

            <div class="grid md:grid-cols-[minmax(0,1fr)_140px] gap-4">
              <div class="form-control">
                <span id="order-product-label" class="label-text mb-1">Producto</span>
                <select id="order-product" class="select select-bordered" bind:value={orderForm.product_id} required aria-labelledby="order-product-label">
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
                <input id="order-quantity" class="input input-bordered" type="number" min="1" bind:value={orderForm.quantity} required aria-labelledby="order-quantity-label" />
              </div>
            </div>

            {#if hasCustomizationOptions}
              <section class="rounded-2xl border border-base-300 bg-base-100 p-4 space-y-4">
                {#if selectedProductFlavors.length > 0}
                  <div class="form-control">
                    <span id="order-flavor-label" class="label-text mb-1">Sabor</span>
                    <select id="order-flavor" class="select select-bordered" bind:value={selectedFlavorId} aria-labelledby="order-flavor-label">
                      <option value="">Selecciona un sabor</option>
                      {#each selectedProductFlavors as flavor}
                        <option value={flavor.id}>{flavor.name}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
                {#if toppingAddons.length > 0}
                  <div class="form-control">
                    <span id="order-included-topping-label" class="label-text mb-1">Topping opcional</span>
                    <select id="order-included-topping" class="select select-bordered" bind:value={includedToppingId} onchange={(event) => changeIncludedTopping((event.currentTarget as HTMLSelectElement).value)} aria-labelledby="order-included-topping-label">
                      <option value="">Sin topping</option>
                      {#each toppingAddons as addon}
                        <option value={addon.id}>{addon.name}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
                {#if jaleaAddons.length > 0}
                  <div class="form-control">
                    <span id="order-included-jalea-label" class="label-text mb-1">Jalea opcional</span>
                    <select id="order-included-jalea" class="select select-bordered" bind:value={includedJaleaId} onchange={(event) => changeIncludedJalea((event.currentTarget as HTMLSelectElement).value)} aria-labelledby="order-included-jalea-label">
                      <option value="">Sin jalea</option>
                      {#each jaleaAddons as addon}
                        <option value={addon.id}>{addon.name}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
                {#if selectedProductAddons.length > 0}
                  <div class="form-control">
                    <span class="label-text mb-2">Extras con costo</span>
                    <p class="text-xs text-base-content/60 mb-1">Usa estos toggles para agregar toppings, jaleas u otros extras adicionales que sí deben cobrarse.</p>
                    <div class="space-y-3">
                  {#if toppingAddons.length > 0}
                    <div class="space-y-2">
                      <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Toppings extra</p>
                      <div class="grid gap-2 md:grid-cols-2">
                        {#each toppingAddons as addon}
                          <label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              checked={selectedExtraAddonIds.includes(addon.id)}
                              disabled={addon.id === includedToppingId}
                              onchange={(event) => toggleExtraAddonSelection(addon.id, (event.currentTarget as HTMLInputElement).checked)}
                            />
                            <span class="label-text flex-1">{addon.name}</span>
                            <span class="text-xs font-medium text-base-content/70">+{formatCurrency(addon.price)}</span>
                          </label>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if jaleaAddons.length > 0}
                    <div class="space-y-2">
                      <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Jalea extra</p>
                      <div class="grid gap-2 md:grid-cols-2">
                        {#each jaleaAddons as addon}
                          <label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              checked={selectedExtraAddonIds.includes(addon.id)}
                              disabled={addon.id === includedJaleaId}
                              onchange={(event) => toggleExtraAddonSelection(addon.id, (event.currentTarget as HTMLInputElement).checked)}
                            />
                            <span class="label-text flex-1">{addon.name}</span>
                            <span class="text-xs font-medium text-base-content/70">+{formatCurrency(addon.price)}</span>
                          </label>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#each paidAddonGroups as group}
                    <div class="space-y-2">
                      <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">{group.label}</p>
                      <div class="grid gap-2 md:grid-cols-2">
                        {#each group.items as addon}
                          <label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              checked={selectedExtraAddonIds.includes(addon.id)}
                              onchange={(event) => toggleExtraAddonSelection(addon.id, (event.currentTarget as HTMLInputElement).checked)}
                            />
                            <span class="label-text flex-1">{addon.name}</span>
                            <span class="text-xs font-medium text-base-content/70">+{formatCurrency(addon.price)}</span>
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

            <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-base-300 bg-base-100 px-4 py-3">
              <div class="text-sm text-base-content/70 space-y-1">
                <p>Subtotal de esta configuracion: <strong>{formatCurrency(totalPreview)}</strong></p>
                <p>Total acumulado en la orden: <strong>{formatCurrency(manualOrderTotal)}</strong></p>
              </div>
              <div class="space-y-1 text-right">
                <button class="btn btn-outline btn-primary" type="button" onclick={addDraftItem} disabled={busy || products.length === 0}>
                  Agregar producto
                </button>
                {#if addItemError}
                  <p class="text-xs text-error">{addItemError}</p>
                {:else}
                  <p class="text-xs text-base-content/60">La configuracion actual se agrega a la orden solo cuando presionas este boton.</p>
                {/if}
              </div>
            </div>

            <section class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <h5 class="font-semibold">Items agregados</h5>
                <span class="text-xs text-base-content/60">Puedes repetir el mismo producto con diferentes sabores o extras.</span>
              </div>
              {#if manualItems.length === 0}
                <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-5 text-sm text-base-content/70">
                  No has agregado productos todavia.
                </div>
              {:else}
                <div class="space-y-3">
                  {#each manualItems as item, index (draftItemKey(item, index))}
                    <div class="rounded-xl border border-base-300 bg-base-100 p-4 space-y-3">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <h6 class="font-medium">{productById(item.product_id)?.name ?? "Producto"}</h6>
                            {#if resolveFlavorName(item.product_id, item.flavor_id)}
                              <span class="badge badge-outline">Sabor: {resolveFlavorName(item.product_id, item.flavor_id)}</span>
                            {/if}
                          </div>
                          {#if resolveAddonNames(item.product_id, item.included_addon_ids).length > 0}
                            <p class="text-xs text-base-content/60">Incluidos: {resolveAddonNames(item.product_id, item.included_addon_ids).join(", ")}</p>
                          {/if}
                          {#if resolveAddonNames(item.product_id, item.extra_addon_ids).length > 0}
                            <p class="text-xs text-base-content/60">Extras: {resolveAddonNames(item.product_id, item.extra_addon_ids).join(", ")}</p>
                          {/if}
                        </div>
                        <div class="text-sm font-semibold whitespace-nowrap">{formatCurrency(manualItemSubtotal(item))}</div>
                      </div>
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="join">
                          <button class="btn btn-sm join-item" type="button" onclick={() => updateDraftItemQuantity(index, item.quantity - 1)}>-</button>
                          <span class="btn btn-sm join-item no-animation min-w-14 text-sm">{item.quantity}</span>
                          <button class="btn btn-sm join-item" type="button" onclick={() => updateDraftItemQuantity(index, item.quantity + 1)}>+</button>
                        </div>
                        <button class="btn btn-sm btn-error btn-outline" type="button" onclick={() => removeDraftItem(index)}>
                          Quitar
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          </section>
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
            {#if selectedOrder && selectedOrder.id === editOrderId}
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
          <button class="btn btn-error btn-outline" type="button" onclick={cancelEdit}>
            {isEditing ? "Cancelar edicion" : "Cancelar"}
          </button>
        </div>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeOrderEditor}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={orderNotesDialog}>
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

<dialog class="modal" bind:this={saveUserDialog}>
  <div class="modal-box max-w-2xl">
    <h3 class="font-bold text-lg">Guardar usuario desde orden</h3>
    <p class="mt-2 text-sm text-base-content/70">Puedes ajustar tipo y estado antes de guardar el registro.</p>

    <form class="mt-4 space-y-4" onsubmit={submitSaveUser}>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="form-control">
          <span id="save-user-name-label" class="label-text mb-1">Nombre</span>
          <input id="save-user-name" class="input input-bordered" bind:value={saveUserForm.name} required aria-labelledby="save-user-name-label" />
        </div>
        <div class="form-control">
          <span id="save-user-type-label" class="label-text mb-1">Tipo de usuario</span>
          <select id="save-user-type" class="select select-bordered" bind:value={saveUserForm.user_type} aria-labelledby="save-user-type-label">
            <option value="user">usuario</option>
            <option value="company">empresa</option>
          </select>
        </div>
        <div class="form-control">
          <span id="save-user-phone-label" class="label-text mb-1">Telefono</span>
          <input id="save-user-phone" class="input input-bordered" bind:value={saveUserForm.phone} required aria-labelledby="save-user-phone-label" />
        </div>
        <div class="form-control">
          <span id="save-user-email-label" class="label-text mb-1">Correo (opcional)</span>
          <input id="save-user-email" class="input input-bordered" type="email" bind:value={saveUserForm.email} aria-labelledby="save-user-email-label" />
        </div>
      </div>

      <div class="form-control">
        <span class="label-text mb-1">Estado</span>
        <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
          <input
            class="toggle toggle-sm"
            type="checkbox"
            checked={saveUserForm.status === "active"}
            onchange={(event) => (saveUserForm.status = (event.currentTarget as HTMLInputElement).checked ? "active" : "inactive")}
            aria-label="Estado de usuario"
          />
          <span class="label-text">{saveUserForm.status === "active" ? "Activo" : "Inactivo"}</span>
        </label>
      </div>

      {#if saveUserError}
        <div class="text-sm text-error">{saveUserError}</div>
      {/if}

      <div class="modal-action">
        <button class="btn btn-ghost" type="button" onclick={closeSaveUserDialog}>Cancelar</button>
        <button class="btn btn-primary" type="submit" disabled={busy}>Guardar usuario</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeSaveUserDialog}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={confirmDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">{confirmTitle || "Confirmar accion"}</h3>
    <p class="py-2 text-sm text-base-content/70">{confirmMessage}</p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeConfirm}>Cancelar</button>
      <button class="btn btn-primary" type="button" onclick={confirmNow} disabled={busy}>Confirmar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog class="modal" bind:this={rejectDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Rechazar orden</h3>
    <p class="text-sm text-base-content/70">Indica el motivo del rechazo para dejar registro.</p>
    <textarea
      class="textarea textarea-bordered w-full mt-3"
      rows="4"
      placeholder="Motivo"
      bind:value={rejectReason}
    ></textarea>
    {#if rejectError}
      <p class="mt-2 text-sm text-error">{rejectError}</p>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeReject}>Cancelar</button>
      <button class="btn btn-error" type="button" onclick={confirmReject} disabled={busy}>Rechazar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog class="modal" bind:this={printPromptDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Orden lista</h3>
    <p class="text-sm text-base-content/70">
      {#if printTarget}
        La orden {printTarget.order_number} paso a estado lista. Deseas imprimir el recibo?
      {/if}
    </p>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closePrintPrompt}>Cancelar</button>
      <button class="btn btn-primary" type="button" onclick={applyStatusChange} disabled={busy}>
        Actualizar
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<dialog class="modal" bind:this={reactivateDialog}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Aceptar orden rechazada</h3>
    <p class="text-sm text-base-content/70">Indica el motivo de reactivacion para dejar registro.</p>
    <textarea
      class="textarea textarea-bordered w-full mt-3"
      rows="4"
      placeholder="Motivo de reactivacion"
      bind:value={reactivateReason}
    ></textarea>
    {#if reactivateError}
      <p class="mt-2 text-sm text-error">{reactivateError}</p>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeReactivate}>Cancelar</button>
      <button class="btn btn-success" type="button" onclick={confirmReactivate} disabled={busy}>Aceptar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
