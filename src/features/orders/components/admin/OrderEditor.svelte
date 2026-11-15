<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
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
  import type { CreatedOrder } from "@features/admin-management/lib/order-handlers";
  import type { TicketKind } from "../../lib/receipt-renderer";
  import type { AutoPrintMode } from "../../types/orders-tab";

  const AUTO_PRINT_OPTIONS: { value: AutoPrintMode; label: string }[] = [
    { value: "both", label: "Imprimir ambos" },
    { value: "kitchen", label: "Solo comanda" },
    { value: "none", label: "No imprimir" },
  ];
  import { fly } from "svelte/transition";
  import { motionMs, celebrate } from "@shared/motion/motion";

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
    includedToppingIds: string[];
    includedJaleaIds: string[];
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
    onToppingSelectionChange: (
      includedIds: string[],
      extraIds: string[],
    ) => void;
    onJaleaSelectionChange: (includedIds: string[], extraIds: string[]) => void;
    onToggleExtraAddonSelection: (addonId: string, checked: boolean) => void;
    toppingFreeAllowance: number;
    jaleaFreeAllowance: number;
    toppingSelection?: "none" | "selected";
    jaleaSelection?: "none" | "selected";
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
    /** Set once a new order was created: the editor shows the print/next screen. */
    createdOrder?: CreatedOrder | null;
    autoPrint?: AutoPrintMode;
    onAutoPrintChange?: (value: AutoPrintMode) => void;
    onPrint?: (kinds: TicketKind[]) => void;
    /** Move the new order to "Preparando" (starts preparation, uses stock). */
    onStartPreparing?: () => void;
    onNewOrder?: () => void;
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
    includedToppingIds,
    includedJaleaIds,
    selectedExtraAddonIds,
    toppingFreeAllowance,
    jaleaFreeAllowance,
    toppingSelection,
    jaleaSelection,
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
    onToppingSelectionChange,
    onJaleaSelectionChange,
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
    createdOrder = null,
    autoPrint = "both",
    onAutoPrintChange,
    onPrint,
    onStartPreparing,
    onNewOrder,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });

  const displayTotal = $derived(
    manualItems.length > 0 ? manualOrderTotal : totalPreview,
  );
  const hasNotes = $derived(orderForm.notes.trim().length > 0);
  const requiresEditNote = $derived(isEditing && !hasNotes);

  type EditorStep = "products" | "customer" | "summary";
  const stepLabels: Record<EditorStep, string> = {
    products: "Productos",
    customer: "Cliente",
    summary: "Cobro",
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

  const effectiveReceived = $derived(
    typeof orderForm.amount_received === "number" &&
      orderForm.amount_received > 0
      ? orderForm.amount_received
      : null,
  );
  const changeAmount = $derived(
    effectiveReceived != null ? effectiveReceived - displayTotal : null,
  );
  const cashError = $derived(
    orderForm.payment_method === "efectivo" &&
      effectiveReceived != null &&
      effectiveReceived < displayTotal,
  );

  function setReceivedAmount(value: number) {
    orderForm.amount_received = Math.round(value * 100) / 100;
  }

  /** Bills a customer is likely to hand over for this total. */
  const cashSuggestions = $derived.by(() => {
    const total = displayTotal;
    const options = new Set<number>();
    const whole = Math.ceil(total);
    if (whole > total) options.add(whole);
    for (const bill of [1, 2, 5, 10, 20]) if (bill > total) options.add(bill);
    return [...options].sort((a, b) => a - b).slice(0, 5);
  });

  const roundedChange = $derived(
    changeAmount != null ? Math.round(changeAmount * 100) / 100 : null,
  );

  const PAYMENT_OPTIONS: {
    value: OrderFormState["payment_method"];
    label: string;
    icon: string;
  }[] = [
    { value: "efectivo", label: "Efectivo", icon: "lucide:banknote" },
    { value: "tarjeta", label: "Tarjeta", icon: "lucide:credit-card" },
    {
      value: "transferencia",
      label: "Transferencia",
      icon: "lucide:smartphone",
    },
    { value: "otro", label: "Otro", icon: "lucide:wallet" },
  ];

  const itemUnits = $derived(
    manualItems.reduce((sum, item) => sum + item.quantity, 0),
  );

  let receivedRef = $state<HTMLInputElement | null>(null);
  $effect(() => {
    if (
      step === "summary" &&
      orderForm.payment_method === "efectivo" &&
      receivedRef &&
      !createdOrder
    ) {
      receivedRef.focus();
    }
  });

  let doneRef = $state<HTMLElement | null>(null);
  $effect(() => {
    if (!createdOrder) return;
    step = "products";
    stepError = "";
    if (doneRef) celebrate(doneRef);
  });

  function shortNumber(orderNumber: string): string {
    return orderNumber.split("-").pop() ?? orderNumber;
  }

  function isStepValid(target: EditorStep): boolean {
    if (target === "products") {
      return manualItems.length > 0 && draftItemEditIndex === null;
    }
    if (target === "customer") {
      if (!isStepValid("products")) return false;
      return (
        orderForm.customer_name.trim().length > 0 &&
        phoneLooksValid(orderForm.customer_phone) &&
        orderForm.order_type.trim().length > 0 &&
        (orderForm.order_type !== "en_local" ||
          (orderForm.table_number !== "" && Number(orderForm.table_number) > 0))
      );
    }
    if (target === "summary") {
      return isStepValid("products") && isStepValid("customer") && !cashError;
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

  /**
   * Online orders (no staff creator) keep their phone: it is how the shop
   * reaches the customer. Counter orders may skip it.
   */
  const phoneRequired = $derived(
    isEditing && !!selectedOrder && !selectedOrder.created_by_user_id,
  );

  /** A typed phone must be real; an empty one only on counter orders. */
  function phoneLooksValid(phone: string): boolean {
    const digits = phone.replace(/\D/g, "").length;
    if (phone.trim() === "") return !phoneRequired;
    return digits >= 7 && digits <= 15;
  }

  function getStepError(target: EditorStep): string {
    if (target === "customer" && !isStepValid("products")) {
      return "Agrega al menos un producto completo antes de continuar.";
    }
    if (target === "summary") {
      if (!isStepValid("products")) {
        return "Agrega al menos un producto completo antes de continuar.";
      }
      if (!phoneLooksValid(orderForm.customer_phone)) {
        return phoneRequired
          ? "Las órdenes en línea necesitan el teléfono del cliente (7 a 15 dígitos)."
          : "El teléfono debe tener entre 7 y 15 dígitos, o déjalo vacío.";
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
  title={`${isEditing ? "Editar orden" : "Nueva orden"}${isEditing && selectedOrder ? ` · ${selectedOrder.order_number}` : ""}`}
  icon={isEditing ? "lucide:pencil" : "lucide:clipboard-list"}
  widthClass="max-w-6xl"
  {onClose}
>
  {#if createdOrder}
    <!-- Created: hand over change, print, start the next one -->
    <section
      bind:this={doneRef}
      class="mx-auto max-w-2xl space-y-6 py-2 text-center"
      in:fly={{ y: 12, duration: motionMs(220) }}
    >
      <div class="space-y-2">
        <span
          class="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success"
        >
          <Icon icon="lucide:check" class="size-7" aria-hidden="true" />
        </span>
        <p class="text-sm font-medium text-base-content/70">
          Orden creada ·
          {#if createdOrder.order?.status === "en_proceso"}
            <span class="font-semibold text-info">Preparando</span>
          {:else}
            <span class="font-semibold text-success">Aceptada</span>
          {/if}
        </p>
        <p class="font-display text-6xl font-bold leading-none">
          #{shortNumber(createdOrder.orderNumber)}
        </p>
        <p class="text-sm text-base-content/70">
          {createdOrder.orderNumber} · Total {formatCurrency(
            createdOrder.total,
          )}
        </p>
      </div>

      {#if createdOrder.change != null}
        <div
          class="rounded-box border-2 border-success/40 bg-success/10 p-5"
          role="status"
        >
          <p
            class="text-sm font-semibold uppercase tracking-wide text-base-content/70"
          >
            Cambio a entregar
          </p>
          <p class="text-5xl font-bold tabular-nums text-success">
            {formatCurrency(createdOrder.change)}
          </p>
        </div>
      {/if}

      <div class="space-y-3 rounded-box border border-base-300 p-4 text-left">
        <div class="flex items-center justify-between gap-2">
          <h4 class="flex items-center gap-2 font-semibold">
            <Icon
              icon="lucide:printer"
              class="size-4 text-primary"
              aria-hidden="true"
            />
            Tickets
          </h4>
          <div
            class="flex flex-wrap items-center gap-2 text-sm"
            role="radiogroup"
            aria-label="Al crear una orden en este dispositivo"
          >
            <span class="text-base-content/70">Al crear:</span>
            <div class="join">
              {#each AUTO_PRINT_OPTIONS as option (option.value)}
                <button
                  type="button"
                  role="radio"
                  aria-checked={autoPrint === option.value}
                  class={`btn btn-sm min-h-11 join-item ${autoPrint === option.value ? "btn-primary" : "btn-ghost border-base-300"}`}
                  onclick={() => onAutoPrintChange?.(option.value)}
                  >{option.label}</button
                >
              {/each}
            </div>
          </div>
        </div>
        {#if createdOrder.order}
          <div class="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              class="btn btn-outline h-auto flex-col gap-1 py-3"
              onclick={() => onPrint?.(["customer"])}
            >
              <Icon
                icon="lucide:receipt-text"
                class="size-5"
                aria-hidden="true"
              />
              <span>Ticket cliente</span>
              <span class="text-xs font-normal text-base-content/70"
                >Con precios y cambio</span
              >
            </button>
            <button
              type="button"
              class="btn btn-outline h-auto flex-col gap-1 py-3"
              onclick={() => onPrint?.(["kitchen"])}
            >
              <Icon icon="lucide:chef-hat" class="size-5" aria-hidden="true" />
              <span>Comanda cocina</span>
              <span class="text-xs font-normal text-base-content/70"
                >Sabores y toppings</span
              >
            </button>
            <button
              type="button"
              class="btn btn-primary h-auto flex-col gap-1 py-3"
              onclick={() => onPrint?.(["customer", "kitchen"])}
            >
              <Icon icon="lucide:copy" class="size-5" aria-hidden="true" />
              <span>Imprimir ambos</span>
              <span class="text-xs font-normal opacity-80">Uno tras otro</span>
            </button>
          </div>
        {:else}
          <p class="text-sm text-base-content/70">
            La orden se creó, pero no se pudo cargar para imprimir aquí. Ábrela
            desde el tablero para imprimir sus tickets.
          </p>
        {/if}
      </div>

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <button type="button" class="btn btn-ghost" onclick={onClose}
          >Cerrar</button
        >
        {#if onStartPreparing && createdOrder.order && createdOrder.order.status === "recibida"}
          <button
            type="button"
            class="btn btn-outline"
            onclick={() => onStartPreparing?.()}
            title="La orden pasa a Preparando y se descuenta el inventario"
          >
            <Icon icon="lucide:chef-hat" class="size-4" aria-hidden="true" />
            Pasar a Preparando
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => onNewOrder?.()}
        >
          <Icon icon="lucide:plus" class="size-4" aria-hidden="true" />
          Nueva orden
        </button>
      </div>
    </section>
  {:else}
    <form class="space-y-4" onsubmit={onSubmit}>
      <!-- Stepper -->
      <ol class="editor-steps" aria-label="Pasos">
        {#each stepOrder as stepName, index (stepName)}
          {@const reached = isStepReached(stepName)}
          {@const current = step === stepName}
          <li class="editor-step" class:editor-step-done={reached && !current}>
            <button
              type="button"
              class={`editor-step-btn ${current ? "editor-step-current" : ""}`}
              aria-current={current ? "step" : undefined}
              disabled={!canNavigateToStep(stepName)}
              onclick={() => goToStep(stepName)}
            >
              <span class="editor-step-dot">
                {#if reached && !current}
                  <Icon
                    icon="lucide:check"
                    class="size-3.5"
                    aria-hidden="true"
                  />
                {:else}
                  {index + 1}
                {/if}
              </span>
              <span>{stepLabels[stepName]}</span>
            </button>
          </li>
        {/each}
      </ol>

      {#if stepError}
        <div class="alert alert-warning py-2 text-sm" role="alert">
          <Icon icon="lucide:alert-triangle" width="16" height="16" />
          <span>{stepError}</span>
        </div>
      {/if}

      {#if step === "products"}
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
          {includedToppingIds}
          {includedJaleaIds}
          {selectedExtraAddonIds}
          {toppingFreeAllowance}
          {jaleaFreeAllowance}
          {toppingSelection}
          {jaleaSelection}
          {hasCustomizationOptions}
          {totalPreview}
          {manualOrderTotal}
          {addItemError}
          {busy}
          {onProductChange}
          {onQuantityChange}
          {onFlavorChange}
          {onFlavorIdsChange}
          {onToppingSelectionChange}
          {onJaleaSelectionChange}
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
      {:else if step === "customer"}
        <div class="mx-auto max-w-3xl space-y-5">
          <fieldset class="grid gap-3 sm:grid-cols-2">
            <legend class="mb-2 text-sm font-semibold">Cliente</legend>
            <label class="form-control">
              <span class="label-text mb-1 text-sm"
                >Nombre <span class="text-error" aria-hidden="true">*</span
                ></span
              >
              <input
                id="order-customer-name"
                class="input input-bordered w-full"
                placeholder="Nombre del cliente"
                autocomplete="off"
                bind:value={orderForm.customer_name}
                required
              />
            </label>
            <label class="form-control">
              <span class="label-text mb-1 text-sm"
                >Teléfono {#if phoneRequired}<span
                    class="text-error"
                    aria-hidden="true">*</span
                  >{:else}<span class="text-ink-muted">(opcional)</span
                  >{/if}</span
              >
              <input
                id="order-customer-phone"
                class="input input-bordered w-full"
                type="tel"
                inputmode="tel"
                placeholder="7000-0000"
                autocomplete="off"
                bind:value={orderForm.customer_phone}
                required={phoneRequired}
              />
            </label>
            <label class="form-control sm:col-span-2">
              <span class="label-text mb-1 text-sm"
                >Correo <span class="text-ink-muted">(opcional)</span></span
              >
              <input
                id="order-customer-email"
                class="input input-bordered w-full"
                type="email"
                placeholder="correo@ejemplo.com"
                bind:value={orderForm.customer_email}
              />
            </label>
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="mb-2 text-sm font-semibold"
              >¿Dónde lo consume?</legend
            >
            <div
              class="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Tipo de orden"
            >
              {#each [{ value: "para_llevar", label: "Para llevar", icon: "lucide:shopping-bag" }, { value: "en_local", label: "En local", icon: "lucide:armchair" }] as option (option.value)}
                {@const active = orderForm.order_type === option.value}
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  class={`btn h-14 justify-start gap-3 ${active ? "btn-primary" : "btn-outline border-base-300"}`}
                  onclick={() => {
                    orderForm.order_type =
                      option.value as OrderFormState["order_type"];
                    if (option.value !== "en_local")
                      orderForm.table_number = "";
                  }}
                >
                  <Icon icon={option.icon} class="size-5" aria-hidden="true" />
                  {option.label}
                </button>
              {/each}
            </div>
            {#if orderForm.order_type === "en_local"}
              <label
                class="form-control max-w-xs"
                in:fly={{ y: -6, duration: motionMs(160) }}
              >
                <span class="label-text mb-1 text-sm"
                  >Número de mesa <span class="text-error" aria-hidden="true"
                    >*</span
                  ></span
                >
                <input
                  id="order-table-number"
                  class="input input-bordered w-full"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  placeholder="Ej. 4"
                  bind:value={orderForm.table_number}
                  required
                />
              </label>
            {/if}
          </fieldset>

          <label class="form-control block">
            <span class="label-text mb-1 text-sm">
              Nota de la orden
              {#if isEditing}
                <span class="text-error">(obligatoria al editar)</span>
              {:else}
                <span class="text-ink-muted">(opcional)</span>
              {/if}
            </span>
            <textarea
              class="textarea textarea-bordered w-full"
              rows="3"
              placeholder={isEditing
                ? "Explica qué cambió y por qué"
                : "Ej: sin azúcar, alérgico a nueces, recoge su hermana…"}
              bind:value={orderForm.notes}
              aria-label="Nota de la orden"
            ></textarea>
          </label>
        </div>
      {:else if step === "summary"}
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <!-- Ticket preview -->
          <section
            class="flex flex-col rounded-box border border-base-300 bg-base-100"
          >
            <header
              class="flex items-start justify-between gap-3 border-b border-base-300 p-4"
            >
              <div class="min-w-0">
                <p class="truncate font-bold">
                  {orderForm.customer_name || "Cliente"}
                </p>
                <p class="text-sm text-base-content/70">
                  {orderForm.customer_phone || "Sin teléfono"}
                  {#if orderForm.customer_email}· {orderForm.customer_email}{/if}
                </p>
              </div>
              <span class="badge badge-outline shrink-0">
                {orderForm.order_type === "en_local"
                  ? `Mesa ${orderForm.table_number}`
                  : "Para llevar"}
              </span>
            </header>
            <ul
              class="max-h-72 flex-1 divide-y divide-base-300 overflow-y-auto px-4"
            >
              {#each manualItems as item, index (onDraftItemKey(item, index))}
                {@const product = onProductById(item.product_id)}
                {@const summary = resolveItemSummary(item)}
                <li class="flex items-start gap-3 py-3">
                  <span class="w-7 shrink-0 font-bold tabular-nums"
                    >{item.quantity}×</span
                  >
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold leading-snug">
                      {product?.name ?? "Producto"}
                    </p>
                    {#each summary as line (line.label)}
                      <p class="text-xs text-base-content/70">
                        {line.label}: {line.value}
                      </p>
                    {/each}
                  </div>
                  <span class="font-semibold tabular-nums"
                    >{formatCurrency(onManualItemSubtotal(item))}</span
                  >
                </li>
              {/each}
            </ul>
            {#if orderForm.notes.trim()}
              <p
                class="mx-4 mb-3 rounded-field border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
              >
                <span class="font-semibold">Nota:</span>
                {orderForm.notes}
              </p>
            {:else if isEditing}
              <p
                class="mx-4 mb-3 rounded-field border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
              >
                Agrega una nota en el paso “Cliente” explicando los cambios.
              </p>
            {/if}
            <footer
              class="flex items-baseline justify-between border-t border-base-300 p-4"
            >
              <span class="text-sm text-base-content/70"
                >{itemUnits} {itemUnits === 1 ? "artículo" : "artículos"}</span
              >
              {#if isEditing && selectedOrder}
                <span class="text-xs text-base-content/70"
                  >Antes: {formatCurrency(selectedOrder.total_amount)}</span
                >
              {/if}
            </footer>
          </section>

          <!-- Payment -->
          <section
            class="space-y-4 rounded-box border border-primary/30 bg-primary/5 p-4 md:p-5"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h4
                class="text-sm font-semibold uppercase tracking-wide text-base-content/70"
              >
                Total a cobrar
              </h4>
              <p
                class="text-4xl font-bold tabular-nums text-primary md:text-5xl"
              >
                {formatCurrency(displayTotal)}
              </p>
            </div>

            <div
              class="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Método de pago"
            >
              {#each PAYMENT_OPTIONS as option (option.value)}
                {@const active = orderForm.payment_method === option.value}
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  class={`btn h-auto flex-col gap-1 py-2.5 ${active ? "btn-primary" : "btn-outline border-base-300 bg-base-100"}`}
                  onclick={() => {
                    orderForm.payment_method = option.value;
                    if (option.value !== "efectivo")
                      orderForm.amount_received = "";
                  }}
                >
                  <Icon icon={option.icon} class="size-5" aria-hidden="true" />
                  <span class="text-sm">{option.label}</span>
                </button>
              {/each}
            </div>

            {#if orderForm.payment_method === "efectivo"}
              <div class="space-y-3 border-t border-primary/20 pt-4">
                <label class="form-control block">
                  <span class="label-text mb-1 text-sm font-medium"
                    >Recibido</span
                  >
                  <div
                    class="input input-bordered input-lg flex w-full items-center gap-2 bg-base-100"
                  >
                    <span class="text-2xl text-ink-muted">$</span>
                    <input
                      bind:this={receivedRef}
                      type="number"
                      step="0.01"
                      min="0"
                      inputmode="decimal"
                      class="w-full text-2xl font-semibold tabular-nums"
                      placeholder="0.00"
                      value={orderForm.amount_received}
                      oninput={(e) => {
                        const raw = e.currentTarget.value;
                        orderForm.amount_received =
                          raw === "" ? "" : Number(raw);
                      }}
                      aria-describedby="order-change"
                    />
                  </div>
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class={`btn ${effectiveReceived === Math.round(displayTotal * 100) / 100 ? "btn-primary" : "btn-outline border-base-300 bg-base-100"}`}
                    onclick={() => setReceivedAmount(displayTotal)}
                  >
                    Exacto
                  </button>
                  {#each cashSuggestions as amount (amount)}
                    <button
                      type="button"
                      class={`btn tabular-nums ${effectiveReceived === amount ? "btn-primary" : "btn-outline border-base-300 bg-base-100"}`}
                      onclick={() => setReceivedAmount(amount)}
                    >
                      ${amount}
                    </button>
                  {/each}
                </div>

                <div
                  id="order-change"
                  class={`flex items-baseline justify-between gap-3 rounded-box p-4 ${
                    cashError
                      ? "bg-error/10 text-error"
                      : roundedChange != null
                        ? "bg-success/10"
                        : "bg-base-100"
                  }`}
                  aria-live="polite"
                >
                  <span class="text-sm font-semibold uppercase tracking-wide">
                    {cashError ? "Faltan" : "Cambio"}
                  </span>
                  <span
                    class={`text-4xl font-bold tabular-nums ${cashError ? "" : roundedChange != null ? "text-success" : "text-ink-muted"}`}
                  >
                    {roundedChange == null
                      ? "—"
                      : formatCurrency(Math.abs(roundedChange))}
                  </span>
                </div>
                {#if roundedChange == null}
                  <p class="text-xs text-base-content/70">
                    Sin monto recibido se registra como pago exacto.
                  </p>
                {/if}
              </div>
            {:else}
              <p
                class="rounded-box bg-base-100 p-3 text-sm text-base-content/70"
              >
                {orderForm.payment_method === "tarjeta"
                  ? "Cobra con la terminal antes de crear la orden."
                  : orderForm.payment_method === "transferencia"
                    ? "Confirma que la transferencia llegó antes de crear la orden."
                    : "Registra el detalle del pago en la nota si hace falta."}
              </p>
            {/if}
          </section>
        </div>
      {/if}

      <!-- Feedback messages -->
      {#if editError}
        <div class="alert alert-error py-2 text-sm" role="alert">
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

      <!-- Action bar stays visible while the step scrolls -->
      <div class="editor-actions">
        <div class="flex gap-2">
          <button class="btn btn-ghost" type="button" onclick={onCancelEdit}>
            {isEditing ? "Cancelar edición" : "Cancelar"}
          </button>
          {#if !isEditing && step === "products" && manualItems.length > 0}
            <button
              class="btn btn-ghost text-error"
              type="button"
              onclick={onClearForm}
            >
              Vaciar
            </button>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if step !== "summary"}
            <span class="hidden text-right text-sm sm:block">
              <span class="block text-xs text-base-content/70"
                >{itemUnits} {itemUnits === 1 ? "artículo" : "artículos"}</span
              >
              <span class="font-bold tabular-nums"
                >{formatCurrency(manualOrderTotal)}</span
              >
            </span>
          {/if}
          {#if step !== "products"}
            <button
              class="btn btn-outline"
              type="button"
              onclick={prevStep}
              disabled={busy}
            >
              <Icon
                icon="lucide:arrow-left"
                class="size-4"
                aria-hidden="true"
              />
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
              <Icon
                icon="lucide:arrow-right"
                class="size-4"
                aria-hidden="true"
              />
            </button>
          {:else}
            <button
              class="btn btn-primary"
              type="submit"
              disabled={busy || !isStepValid("summary") || requiresEditNote}
            >
              {#if busy}<span class="loading loading-spinner loading-sm"
                ></span>{/if}
              {isEditing
                ? "Guardar cambios"
                : `Crear orden · ${formatCurrency(displayTotal)}`}
            </button>
          {/if}
        </div>
      </div>
    </form>
  {/if}
</AdminModalShell>

<style>
  .editor-steps {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .editor-step {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 0.25rem;
  }

  /* Connector between steps; filled once the step behind it is done. */
  .editor-step + .editor-step::before {
    content: "";
    flex: 1;
    height: 2px;
    min-width: 0.75rem;
    border-radius: 1px;
    background: var(--color-base-300);
  }

  .editor-step-done + .editor-step::before,
  .editor-step:has(.editor-step-current)::before {
    background: var(--color-primary);
  }

  .editor-step:first-child {
    flex: none;
  }

  .editor-step-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.625rem 0.25rem 0.25rem;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 600;
    color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
    white-space: nowrap;
  }

  .editor-step-btn:disabled {
    cursor: not-allowed;
  }

  .editor-step-btn:not(:disabled):hover {
    background: var(--color-base-200);
  }

  .editor-step-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .editor-step-dot {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: 999px;
    border: 2px solid var(--color-base-300);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }

  .editor-step-done .editor-step-dot {
    border-color: var(--color-primary);
    background: color-mix(in oklab, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
  }

  .editor-step-current {
    color: var(--color-base-content);
  }

  .editor-step-current .editor-step-dot {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .editor-actions {
    position: sticky;
    bottom: -1.25rem;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0 -1.25rem -1.25rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--color-base-300);
    background: var(--color-base-100);
  }

  @media (max-width: 479.98px) {
    .editor-step-btn > span:last-child {
      display: none;
    }
    .editor-step-current > span:last-child {
      display: inline;
    }
  }
</style>
