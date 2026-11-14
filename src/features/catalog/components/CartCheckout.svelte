<script lang="ts">
  import StoreLocationsList from "./StoreLocationsList.svelte";
  import { onMount, tick } from "svelte";
  import { ApiError } from "@core/errors";
  import Icon from "@shared/components/AppIcon.svelte";
  import { enter, motionMs } from "@shared/motion/motion";
  import { slide } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { showToast } from "@shared/toast/toast";
  import ProductArt from "./shared/ProductArt.svelte";
  import { describeStoreStatus } from "@features/catalog/lib/store-status";
  import {
    createPublicOrder,
    listPublicProducts,
    cartItemsMatch,
    clearCartItems,
    getCartItems,
    removeCartItem,
    replaceCartItem,
    setCartItems,
    updateCartItemQuantity,
    type PublicProduct,
    type StoreCartItem,
  } from "@features/catalog";
  import {
    clearIdempotencyKey,
    getIdempotencyKey,
  } from "@features/orders/lib/idempotency";
  import { saveTracking } from "@features/analytics/lib/tracking";
  import { formatCurrency, toSafeImageUrl } from "@shared/utils/formatters";
  import {
    activeFlavors,
    addonsForGroup,
    computeUnitPrice,
    computeTotalPrice,
    normalizeQuantity,
    paidAddonGroups,
    requiresFlavorSelection,
    requiresGroupSelection,
    type ProductCustomizationDraft,
  } from "@features/catalog/lib/customization";
  import ProductModal from "./shared/ProductModal.svelte";
  import {
    fetchStoreSettings,
    type StoreOfferItem,
  } from "@features/catalog/lib/api";
  import { offerBasePrice } from "@features/catalog/lib/offers";
  import {
    MAX_CUSTOMER_NAME_LENGTH,
    validateCheckoutContact,
    type CheckoutFieldErrors,
  } from "@features/catalog/lib/checkout-validation";

  type CheckoutStep = "cart" | "checkout";

  type CheckoutForm = {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
    order_type: "en_local" | "para_llevar";
    table_number: string;
    notes: string;
  };

  let step = $state<CheckoutStep>("cart");
  let items = $state<StoreCartItem[]>([]);
  let products = $state<PublicProduct[]>([]);
  let submitting = $state(false);
  let message = $state("");
  let error = $state("");
  // Mirrors the admin "orders enabled" switch. Defaults to open if settings
  // cannot be loaded; the backend still rejects orders when the store is closed.
  let ordersEnabled = $state(true);
  // Why ordering is unavailable ("Abrimos mañana a las 2:00 pm."), if it is.
  let closedDetail = $state<string | null>(null);
  /** No location takes online orders: point customers to the shops. */
  let inStoreOnly = $state(false);
  let offers = $state<StoreOfferItem[]>([]);
  // Menu data is needed to re-price items and detect unavailable ones.
  let catalogLoaded = $state(false);
  let catalogLoadFailed = $state(false);
  let priceNotice = $state("");
  let fieldErrors = $state<CheckoutFieldErrors>({});

  const ORDER_TYPE_OPTIONS = [
    { value: "para_llevar", label: "Para llevar" },
    { value: "en_local", label: "En local" },
  ] as const;
  const PAYMENT_METHOD_OPTIONS = [
    { value: "efectivo", label: "Efectivo" },
    { value: "tarjeta", label: "Tarjeta" },
    { value: "transferencia", label: "Transferencia" },
  ] as const;

  let editingItem = $state<StoreCartItem | null>(null);
  let editingProduct = $state<PublicProduct | null>(null);

  let form = $state<CheckoutForm>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "efectivo",
    order_type: "para_llevar",
    table_number: "",
    notes: "",
  });

  let containerRef = $state<HTMLDivElement | null>(null);
  let summaryRef = $state<HTMLElement | null>(null);

  const total = $derived(
    items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
  );

  // Unavailable items are excluded: they can't be edited, only removed, so
  // they're reported separately (unavailableItems).
  const incompleteItems = $derived(
    items.filter((item) => {
      const product = productById(item.product_id);
      if (catalogLoaded && (!product || !product.is_available)) return false;
      const draft = draftFromItem(item);
      return (
        requiresFlavorSelection(product, draft) ||
        requiresGroupSelection(product, draft, "toppings") ||
        requiresGroupSelection(product, draft, "jalea")
      );
    }),
  );

  // Items whose product was removed or marked unavailable since it was added.
  const unavailableItems = $derived(
    catalogLoaded
      ? items.filter((item) => {
          const product = productById(item.product_id);
          return !product || !product.is_available;
        })
      : [],
  );

  function isItemUnavailable(item: StoreCartItem): boolean {
    return unavailableItems.includes(item);
  }

  /**
   * Re-prices cart items from the current menu (same rule the backend uses:
   * active offer price or regular price, plus paid add-ons), so the total the
   * customer confirms is the total they are charged.
   */
  function reconcileCartPrices() {
    let changed = false;
    const next = items.map((item) => {
      const product = productById(item.product_id);
      if (!product || !product.is_available) return item;
      const unit_price = computeUnitPrice(
        product,
        draftFromItem(item),
        offerBasePrice(product.id, offers),
      );
      if (Math.abs(unit_price - item.unit_price) < 0.005) return item;
      changed = true;
      return { ...item, unit_price };
    });
    if (changed) {
      setCartItems(next);
      items = getCartItems();
      priceNotice =
        "Actualizamos los precios de tu carrito según el menú y las ofertas vigentes.";
    }
  }

  async function loadCatalog() {
    catalogLoadFailed = false;
    const [productsResult, settingsResult] = await Promise.allSettled([
      listPublicProducts({ all: true }, { fresh: true }),
      fetchStoreSettings(),
    ]);
    if (settingsResult.status === "fulfilled") {
      const status = describeStoreStatus(settingsResult.value);
      ordersEnabled = status.canOrder;
      closedDetail = status.canOrder ? null : status.detail;
      inStoreOnly = !!status.inStoreOnly;
      offers = settingsResult.value.offers ?? [];
    } else {
      // The backend still enforces a closed store.
      ordersEnabled = true;
    }
    if (productsResult.status === "fulfilled") {
      products = productsResult.value;
      catalogLoaded = true;
      // Re-price only with the offers in hand: without settings, every item
      // would fall back to its regular price and the cart would show more than
      // the backend (which applies offers itself) will charge.
      if (settingsResult.status === "fulfilled") {
        reconcileCartPrices();
      }
    } else {
      catalogLoadFailed = true;
    }
  }

  function productById(productId: string): PublicProduct | undefined {
    return products.find((product) => product.id === productId);
  }

  function draftFromItem(item: StoreCartItem): ProductCustomizationDraft {
    return {
      quantity: normalizeQuantity(item.quantity),
      flavor_id: item.flavor_id || undefined,
      flavor_ids: item.flavor_ids || undefined,
      included_addon_ids: item.included_addon_ids ?? [],
      extra_addon_ids:
        item.extra_addon_ids && item.extra_addon_ids.length > 0
          ? item.extra_addon_ids
          : (item.addons ?? []),
      topping_selection: item.topping_selection,
      jalea_selection: item.jalea_selection,
    };
  }

  function resolveFlavorName(item: StoreCartItem): string | null {
    if (!item.flavor_id) return null;
    const product = productById(item.product_id);
    const flavor = (product?.flavors ?? []).find(
      (entry) => entry.id === item.flavor_id,
    );
    return flavor?.name ?? null;
  }

  function resolveAddonNames(
    product: PublicProduct | undefined,
    addonIds: string[],
  ): string[] {
    if (!product || addonIds.length === 0) return [];
    return addonIds
      .map((id) => product.addons?.find((addon) => addon.id === id)?.name)
      .filter((name): name is string => !!name);
  }

  function customizationSummary(item: StoreCartItem): string[] {
    const product = productById(item.product_id);
    if (!product) return [];

    const summary: string[] = [];

    const flavorName = resolveFlavorName(item);
    if (flavorName) summary.push(`Sabor: ${flavorName}`);

    const toppingId = addonsForGroup(product, "toppings").find((addon) =>
      (item.included_addon_ids ?? []).includes(addon.id),
    )?.id;
    if (toppingId) {
      const topping = product.addons?.find((addon) => addon.id === toppingId);
      if (topping) summary.push(`Topping: ${topping.name}`);
    } else if (item.topping_selection === "none") {
      summary.push("Topping: Sin topping");
    }

    const jaleaId = addonsForGroup(product, "jalea").find((addon) =>
      (item.included_addon_ids ?? []).includes(addon.id),
    )?.id;
    if (jaleaId) {
      const jalea = product.addons?.find((addon) => addon.id === jaleaId);
      if (jalea) summary.push(`Jalea: ${jalea.name}`);
    } else if (item.jalea_selection === "none") {
      summary.push("Jalea: Sin jalea");
    }

    const extras = resolveAddonNames(
      product,
      item.extra_addon_ids && item.extra_addon_ids.length > 0
        ? item.extra_addon_ids
        : (item.addons ?? []),
    );
    if (extras.length > 0) summary.push(`Extras: ${extras.join(", ")}`);

    return summary;
  }

  /** Stable identity for a cart line (same fields the cart merges on). */
  function cartLineKey(item: StoreCartItem): string {
    return JSON.stringify([
      item.product_id,
      item.flavor_id ?? null,
      item.flavor_ids ?? [],
      [...(item.included_addon_ids ?? [])].sort(),
      [...(item.extra_addon_ids ?? [])].sort(),
      item.topping_selection ?? "",
      item.jalea_selection ?? "",
      item.notes ?? "",
    ]);
  }

  function refreshItems() {
    items = getCartItems();
  }

  function openEditModal(item: StoreCartItem) {
    const product = productById(item.product_id);
    if (!product) return;

    editingItem = item;
    editingProduct = product;
  }

  function closeEditModal() {
    editingItem = null;
    editingProduct = null;
  }

  function updateQty(item: StoreCartItem, nextQty: number) {
    updateCartItemQuantity(
      item.product_id,
      nextQty,
      item.flavor_id,
      item.addons,
      item.notes,
      item.included_addon_ids,
      item.extra_addon_ids,
      item.topping_selection,
      item.jalea_selection,
    );
    refreshItems();
  }

  function removeItem(item: StoreCartItem) {
    const before = getCartItems();
    removeCartItem(
      item.product_id,
      item.flavor_id,
      item.addons,
      item.notes,
      item.included_addon_ids,
      item.extra_addon_ids,
      item.topping_selection,
      item.jalea_selection,
    );
    refreshItems();
    // Local-only change, so undo simply restores the previous cart.
    showToast(`Quitaste ${item.name}`, {
      actionLabel: "Deshacer",
      onAction: () => {
        setCartItems(before);
        refreshItems();
      },
    });
  }

  function continueToCheckout() {
    if (unavailableItems.length > 0) {
      error = "Quita los productos que ya no están disponibles para continuar.";
      return;
    }
    if (incompleteItems.length > 0) {
      error = "Completa las personalizaciones pendientes antes de continuar.";
      return;
    }
    error = "";
    step = "checkout";
    window.scrollTo({ top: 0 });
  }

  function handleEditConfirm(draft: ProductCustomizationDraft) {
    if (!editingItem || !editingProduct) return;

    const unit_price = computeUnitPrice(
      editingProduct,
      draft,
      offerBasePrice(editingProduct.id, offers),
    );

    const updated: StoreCartItem = {
      product_id: editingProduct.id,
      name: editingProduct.name,
      image_url: toSafeImageUrl(editingProduct.image_url),
      unit_price,
      quantity: normalizeQuantity(draft.quantity),
      flavor_id: draft.flavor_id || undefined,
      flavor_ids: draft.flavor_ids || undefined,
      included_addon_ids: draft.included_addon_ids,
      extra_addon_ids: draft.extra_addon_ids,
      topping_selection: draft.topping_selection,
      jalea_selection: draft.jalea_selection,
      notes: editingItem.notes,
    };

    replaceCartItem(editingItem, updated);
    refreshItems();
    closeEditModal();
  }

  function buildCustomizations(
    item: StoreCartItem,
  ): Record<string, unknown> | undefined {
    const customizations: Record<string, unknown> = {};
    const product = productById(item.product_id);

    if (item.notes) customizations.notes = item.notes;
    if (item.flavor_id) customizations.flavor_id = item.flavor_id;
    if (item.flavor_ids && item.flavor_ids.length > 0) {
      customizations.flavor_ids = item.flavor_ids;
    }
    if (item.included_addon_ids && item.included_addon_ids.length > 0) {
      customizations.included_addon_ids = item.included_addon_ids;
    }

    // Default topping/jalea selections to "none" when the product has those
    // option groups but the user did not explicitly choose an addon. This keeps
    // the backend validation happy while still allowing explicit selections.
    const toppingAddons = addonsForGroup(product, "toppings");
    const jaleaAddons = addonsForGroup(product, "jalea");

    // Defensive: if the cart claims "selected" but no matching addon is in
    // included_addon_ids, treat it as "none" to avoid backend rejection.
    const hasToppingAddonIncluded = (item.included_addon_ids ?? []).some((id) =>
      toppingAddons.some((a) => a.id === id),
    );
    const hasJaleaAddonIncluded = (item.included_addon_ids ?? []).some((id) =>
      jaleaAddons.some((a) => a.id === id),
    );

    let toppingSelection =
      item.topping_selection ?? (toppingAddons.length > 0 ? "none" : undefined);
    if (toppingSelection === "selected" && !hasToppingAddonIncluded) {
      toppingSelection = toppingAddons.length > 0 ? "none" : undefined;
    }

    let jaleaSelection =
      item.jalea_selection ?? (jaleaAddons.length > 0 ? "none" : undefined);
    if (jaleaSelection === "selected" && !hasJaleaAddonIncluded) {
      jaleaSelection = jaleaAddons.length > 0 ? "none" : undefined;
    }

    if (toppingSelection) customizations.topping_selection = toppingSelection;
    if (jaleaSelection) customizations.jalea_selection = jaleaSelection;

    if (item.extra_addon_ids && item.extra_addon_ids.length > 0) {
      customizations.extra_addon_ids = item.extra_addon_ids;
    } else if (item.addons && item.addons.length > 0) {
      customizations.addon_ids = item.addons;
    }

    return Object.keys(customizations).length > 0 ? customizations : undefined;
  }

  /**
   * Turns backend order errors into messages a customer can act on.
   */
  function orderErrorMessage(requestError: unknown): string {
    if (requestError instanceof ApiError) {
      if (requestError.status === 400) {
        return "Revisa tus datos: nombre, teléfono o correo no son válidos.";
      }
      if (requestError.status === 0) {
        return "Sin conexión. Revisa tu internet e intenta de nuevo; tu carrito sigue guardado.";
      }
      if (requestError.status === 429) {
        return "Has alcanzado el límite de pedidos. Intenta más tarde.";
      }
      if (requestError.status === 409) {
        // The backend names the unavailable product: "conflict: <name>".
        const product = requestError.message
          .replace(/^conflict:\s*/i, "")
          .trim();
        return product
          ? `“${product}” ya no está disponible. Quítalo del carrito para continuar.`
          : "Algunos productos ya no están disponibles. Revisa tu carrito.";
      }
      if (requestError.status === 403 || requestError.status === 503) {
        return "La tienda no está recibiendo pedidos en este momento.";
      }
      if (requestError.status >= 500) {
        return "No pudimos procesar tu pedido. Intenta de nuevo en unos minutos.";
      }
    }
    return requestError instanceof Error && requestError.message
      ? requestError.message
      : "No se pudo crear la orden.";
  }

  async function submitOrder() {
    if (!ordersEnabled) {
      error = "La tienda no está recibiendo pedidos en este momento.";
      return;
    }

    if (items.length === 0) {
      error = "Tu carrito está vacío.";
      step = "cart";
      return;
    }

    if (unavailableItems.length > 0) {
      error = "Quita los productos que ya no están disponibles para continuar.";
      step = "cart";
      return;
    }

    if (incompleteItems.length > 0) {
      error = "Completa las personalizaciones pendientes antes de confirmar.";
      step = "cart";
      return;
    }

    fieldErrors = validateCheckoutContact(form);
    if (Object.keys(fieldErrors).length > 0) {
      error = "Revisa los datos marcados.";
      // Move focus to the first invalid field for keyboard and screen readers.
      await tick();
      document
        .querySelector<HTMLElement>("#checkout-form [aria-invalid='true']")
        ?.focus();
      return;
    }

    error = "";
    message = "";
    submitting = true;

    try {
      const created = await createPublicOrder(
        {
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_email: form.customer_email.trim() || undefined,
          payment_method: form.payment_method,
          order_type: form.order_type,
          table_number:
            form.order_type === "en_local" && form.table_number.trim()
              ? Number(form.table_number)
              : undefined,
          notes: form.notes.trim() || undefined,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            customizations: buildCustomizations(item),
          })),
        },
        getIdempotencyKey(),
      );

      saveTracking(created.order_number, created.tracking_token);
      clearCartItems();
      clearIdempotencyKey();
      items = [];
      window.location.href = "/order/tracking";
    } catch (requestError: unknown) {
      error = orderErrorMessage(requestError);
    } finally {
      submitting = false;
    }
  }

  onMount(async () => {
    refreshItems();
    await loadCatalog();

    void tick().then(() => enter(containerRef));
  });
</script>

<div bind:this={containerRef}>
  <div class="container mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-12 md:pt-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display font-bold text-6xl leading-none md:text-7xl">
          {step === "cart" ? "Tu pedido" : "Datos y pago"}
        </h1>
        <p class="mt-1 text-base-content/70">
          {step === "cart"
            ? "Revisa tus productos antes de continuar."
            : "Paso 2 de 2 · Solo te tomará un minuto."}
        </p>
      </div>
      <div class="flex gap-2">
        <a href="/menu" class="btn btn-ghost rounded-full">Seguir comprando</a>
        <a href="/order/tracking" class="btn btn-outline rounded-full"
          >Mis pedidos</a
        >
      </div>
    </header>

    {#if !ordersEnabled}
      <div
        class="mb-6 flex items-start gap-3 rounded-box border border-warning/50 bg-warning/15 p-4"
        role="status"
      >
        <Icon
          icon="lucide:clock"
          class="mt-0.5 size-5 shrink-0"
          aria-hidden="true"
        />
        <div>
          <p class="font-semibold">
            {closedDetail ?? "No estamos recibiendo pedidos en este momento."}
          </p>
          {#if inStoreOnly}
            <p class="mb-3 text-sm text-base-content/70">
              Tu carrito queda guardado: muéstralo en caja o pídelo por WhatsApp
              a tu sucursal.
            </p>
            <StoreLocationsList variant="list" />
          {:else}
            <p class="text-sm text-base-content/70">
              Tu carrito queda guardado en este dispositivo para que pidas más
              tarde.
            </p>
          {/if}
        </div>
      </div>
    {/if}

    {#if items.length === 0}
      <div
        class="mx-auto max-w-lg rounded-box border border-base-300 bg-base-100 px-6 py-14 text-center"
      >
        <Icon
          icon="lucide:shopping-cart"
          class="mx-auto mb-4 size-12 text-base-content/40"
          aria-hidden="true"
        />
        <h2 class="mb-2 font-display font-bold text-4xl">
          Tu carrito está vacío
        </h2>
        <p class="mx-auto mb-6 max-w-sm text-base-content/70">
          Explora el menú y agrega tus sabores favoritos.
        </p>
        <a href="/menu" class="btn btn-primary btn-lg rounded-full px-10"
          >Ver el menú</a
        >
      </div>
    {:else if step === "cart"}
      <div class="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-6">
        <div class="space-y-4">
          {#if catalogLoadFailed}
            <div class="alert alert-warning rounded-2xl text-sm" role="status">
              <span>
                No pudimos cargar el menú para verificar precios y
                disponibilidad.
              </span>
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                onclick={() => void loadCatalog()}>Reintentar</button
              >
            </div>
          {/if}

          {#if priceNotice}
            <div class="alert alert-info rounded-2xl text-sm" role="status">
              <span>{priceNotice}</span>
            </div>
          {/if}

          {#if unavailableItems.length > 0}
            <div class="alert alert-error rounded-2xl text-sm" role="alert">
              <span>
                {unavailableItems.length === 1
                  ? "Un producto de tu carrito ya no está disponible."
                  : `${unavailableItems.length} productos de tu carrito ya no están disponibles.`}
                Quítalo para continuar.
              </span>
            </div>
          {/if}

          {#if incompleteItems.length > 0}
            <div class="alert alert-warning rounded-2xl text-sm">
              <span>
                Tienes {incompleteItems.length} producto(s) con personalización pendiente.
                Usa Editar para completarlos.
              </span>
            </div>
          {/if}

          {#each items as item (cartLineKey(item))}
            {@const summary = customizationSummary(item)}
            {@const lineProduct = productById(item.product_id)}
            <article
              animate:flip={{ duration: motionMs(250) }}
              transition:slide={{ duration: motionMs(220) }}
              class={`card rounded-box border bg-base-100 ${isItemUnavailable(item) ? "border-error/60" : "border-base-300"}`}
            >
              <div class="p-4 md:p-5">
                <div class="flex gap-4">
                  <div
                    class="size-20 shrink-0 overflow-hidden rounded-field bg-base-200 md:size-24"
                    aria-hidden="true"
                  >
                    {#if item.image_url}
                      <img
                        src={item.image_url}
                        alt=""
                        class="h-full w-full object-cover"
                      />
                    {:else}
                      <ProductArt
                        name={item.name}
                        category={lineProduct?.category_name}
                        scoops={lineProduct?.ball_quantity ?? 1}
                        seed={item.product_id}
                      />
                    {/if}
                  </div>
                  <div
                    class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div class="space-y-2 min-w-0">
                      <h3 class="text-lg font-bold leading-tight">
                        {item.name}
                      </h3>
                      {#if isItemUnavailable(item)}
                        <span class="badge badge-error badge-sm"
                          >No disponible</span
                        >
                      {/if}
                      <p class="text-sm text-base-content/65">
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </p>
                      {#if summary.length > 0}
                        <div class="flex flex-wrap gap-1.5">
                          {#each summary as line (line)}
                            <span class="badge badge-ghost badge-sm"
                              >{line}</span
                            >
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <div
                      class="whitespace-nowrap text-lg font-bold tabular-nums"
                    >
                      {formatCurrency(item.unit_price * item.quantity)}
                    </div>
                  </div>
                </div>

                <div
                  class="mt-4 flex flex-wrap items-center gap-3 justify-between"
                >
                  <div
                    class="flex items-center rounded-full border border-base-300"
                    role="group"
                    aria-label={`Cantidad de ${item.name}`}
                  >
                    <button
                      class="btn btn-ghost btn-circle btn-sm"
                      type="button"
                      aria-label={item.quantity <= 1
                        ? `Quitar ${item.name}`
                        : "Reducir cantidad"}
                      onclick={() =>
                        item.quantity <= 1
                          ? removeItem(item)
                          : updateQty(item, item.quantity - 1)}
                    >
                      <Icon
                        icon={item.quantity <= 1
                          ? "lucide:trash-2"
                          : "lucide:minus"}
                        class="size-4"
                        aria-hidden="true"
                      />
                    </button>
                    <span class="w-8 text-center font-semibold tabular-nums"
                      >{item.quantity}</span
                    >
                    <button
                      class="btn btn-ghost btn-circle btn-sm"
                      type="button"
                      aria-label="Aumentar cantidad"
                      onclick={() => updateQty(item, item.quantity + 1)}
                    >
                      <Icon
                        icon="lucide:plus"
                        class="size-4"
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div class="flex gap-2">
                    {#if !isItemUnavailable(item)}
                      <button
                        type="button"
                        class="btn btn-outline btn-sm rounded-full"
                        onclick={() => openEditModal(item)}
                      >
                        Editar
                      </button>
                    {/if}
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm rounded-full"
                      onclick={() => removeItem(item)}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            </article>
          {/each}
        </div>

        <aside
          class="card h-fit rounded-box border border-base-300 bg-base-100 xl:sticky xl:top-24"
          bind:this={summaryRef}
        >
          <div class="p-6 space-y-4">
            <h3 class="text-xl font-bold">Resumen</h3>
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-base-content/70">Productos</span>
                <span class="font-medium"
                  >{items.reduce((sum, item) => sum + item.quantity, 0)}</span
                >
              </div>
              <div
                class="flex items-center justify-between text-lg font-extrabold pt-2 border-t border-base-200"
              >
                <span>Total</span>
                <span class="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {#if error}
              <div class="alert alert-error rounded-2xl text-sm" role="alert">
                <span>{error}</span>
              </div>
            {/if}

            <button
              type="button"
              class="btn btn-primary btn-lg w-full rounded-full"
              disabled={!ordersEnabled}
              onclick={continueToCheckout}
            >
              Continuar
            </button>
          </div>
        </aside>
      </div>

      <!-- Phones: keep the total and the next step within reach. -->
      <div class="cart-bar">
        <div class="min-w-0">
          <p class="text-sm text-base-content/70">Total</p>
          <p class="text-xl font-bold tabular-nums">{formatCurrency(total)}</p>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-lg flex-1 rounded-full"
          disabled={!ordersEnabled}
          onclick={continueToCheckout}
        >
          Continuar
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-6 items-start">
        <section class="card rounded-box border border-base-300 bg-base-100">
          <div class="p-6 md:p-7 space-y-5">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold">Tus datos</h2>
              <button
                type="button"
                class="btn btn-ghost btn-sm rounded-full"
                onclick={() => (step = "cart")}>Volver al carrito</button
              >
            </div>

            <form
              id="checkout-form"
              class="space-y-5"
              novalidate
              onsubmit={(event) => {
                event.preventDefault();
                void submitOrder();
              }}
            >
              <div class="grid gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
                <label class="form-control w-full">
                  <span
                    class="label-text font-bold text-base-content/70 ml-1 mb-1"
                    >Nombre *</span
                  >
                  <input
                    type="text"
                    name="name"
                    autocomplete="name"
                    required
                    maxlength={MAX_CUSTOMER_NAME_LENGTH}
                    class={`input input-bordered rounded-2xl w-full ${fieldErrors.customer_name ? "input-error" : ""}`}
                    aria-invalid={fieldErrors.customer_name
                      ? "true"
                      : undefined}
                    aria-describedby={fieldErrors.customer_name
                      ? "checkout-name-error"
                      : undefined}
                    bind:value={form.customer_name}
                  />
                  {#if fieldErrors.customer_name}
                    <span
                      id="checkout-name-error"
                      class="text-error text-sm mt-1 ml-1"
                      >{fieldErrors.customer_name}</span
                    >
                  {/if}
                </label>
                <label class="form-control w-full">
                  <span
                    class="label-text font-bold text-base-content/70 ml-1 mb-1"
                    >Teléfono (WhatsApp) *</span
                  >
                  <input
                    type="tel"
                    name="tel"
                    autocomplete="tel"
                    inputmode="tel"
                    required
                    placeholder="7123 4567"
                    class={`input input-bordered rounded-2xl w-full ${fieldErrors.customer_phone ? "input-error" : ""}`}
                    aria-invalid={fieldErrors.customer_phone
                      ? "true"
                      : undefined}
                    aria-describedby={fieldErrors.customer_phone
                      ? "checkout-phone-error"
                      : "checkout-phone-hint"}
                    bind:value={form.customer_phone}
                  />
                  {#if fieldErrors.customer_phone}
                    <span
                      id="checkout-phone-error"
                      class="text-error text-sm mt-1 ml-1"
                      >{fieldErrors.customer_phone}</span
                    >
                  {:else}
                    <span
                      id="checkout-phone-hint"
                      class="text-base-content/60 text-xs mt-1 ml-1"
                      >Te avisaremos por WhatsApp cuando tu pedido esté listo.</span
                    >
                  {/if}
                </label>

                <label class="form-control w-full md:col-span-2">
                  <span
                    class="label-text font-bold text-base-content/70 ml-1 mb-1"
                    >Email (opcional)</span
                  >
                  <input
                    type="email"
                    name="email"
                    autocomplete="email"
                    inputmode="email"
                    class={`input input-bordered rounded-2xl w-full ${fieldErrors.customer_email ? "input-error" : ""}`}
                    aria-invalid={fieldErrors.customer_email
                      ? "true"
                      : undefined}
                    aria-describedby={fieldErrors.customer_email
                      ? "checkout-email-error"
                      : undefined}
                    bind:value={form.customer_email}
                  />
                  {#if fieldErrors.customer_email}
                    <span
                      id="checkout-email-error"
                      class="text-error text-sm mt-1 ml-1"
                      >{fieldErrors.customer_email}</span
                    >
                  {/if}
                </label>
              </div>

              <fieldset class="space-y-2">
                <legend
                  class="label-text font-bold text-base-content/70 ml-1 mb-2"
                  >Tipo de pedido</legend
                >
                <div class="flex flex-wrap gap-2">
                  {#each ORDER_TYPE_OPTIONS as option (option.value)}
                    <label
                      class={`btn rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${form.order_type === option.value ? "btn-primary" : "btn-outline"}`}
                    >
                      <input
                        type="radio"
                        name="order_type"
                        class="sr-only"
                        value={option.value}
                        bind:group={form.order_type}
                        onchange={() => {
                          if (option.value === "para_llevar")
                            form.table_number = "";
                        }}
                      />
                      {option.label}
                    </label>
                  {/each}
                </div>
                {#if form.order_type === "en_local"}
                  <p class="text-sm text-base-content/70 px-1">
                    El número de mesa se asigna al llegar al local.
                  </p>
                {/if}
              </fieldset>

              <fieldset class="space-y-2">
                <legend
                  class="label-text font-bold text-base-content/70 ml-1 mb-2"
                  >Método de pago</legend
                >
                <div class="flex flex-wrap gap-2">
                  {#each PAYMENT_METHOD_OPTIONS as option (option.value)}
                    <label
                      class={`btn rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${form.payment_method === option.value ? "btn-primary" : "btn-outline"}`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        class="sr-only"
                        value={option.value}
                        bind:group={form.payment_method}
                      />
                      {option.label}
                    </label>
                  {/each}
                </div>
                <p class="text-sm text-base-content/70 px-1">
                  Este método es informativo para preparar el cobro en local o
                  entrega.
                </p>
              </fieldset>

              <label class="form-control w-full">
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Notas (opcional)</span
                >
                <textarea
                  name="notes"
                  class="textarea textarea-bordered rounded-2xl w-full"
                  rows="3"
                  maxlength="500"
                  bind:value={form.notes}
                ></textarea>
              </label>
            </form>
          </div>
        </section>

        <aside
          class="card rounded-box border border-base-300 bg-base-100 xl:sticky xl:top-24"
        >
          <div class="p-6 space-y-5">
            <h3 class="text-xl font-bold">Resumen final</h3>

            <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
              {#each items as item, idx (idx)}
                <div class="flex items-center justify-between text-sm">
                  <span class="text-base-content/75"
                    >{item.quantity} x {item.name}</span
                  >
                  <span class="font-semibold"
                    >{formatCurrency(item.unit_price * item.quantity)}</span
                  >
                </div>
              {/each}
            </div>

            <div class="border-t border-base-200 pt-3">
              <div
                class="flex items-center justify-between text-xl font-extrabold"
              >
                <span>Total</span>
                <span class="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {#if error}
              <div class="alert alert-error rounded-2xl text-sm" role="alert">
                <span>{error}</span>
              </div>
            {/if}

            {#if message}
              <div class="alert alert-success rounded-2xl text-sm">
                <span>{message}</span>
              </div>
            {/if}

            <button
              class="btn btn-primary btn-lg w-full rounded-full"
              type="submit"
              form="checkout-form"
              disabled={submitting || !ordersEnabled}
            >
              {submitting
                ? "Procesando orden..."
                : `Confirmar pedido · ${formatCurrency(total)}`}
            </button>
          </div>
        </aside>
      </div>
    {/if}
  </div>
</div>

<ProductModal
  product={editingProduct}
  {ordersEnabled}
  basePrice={editingProduct
    ? offerBasePrice(editingProduct.id, offers)
    : undefined}
  imageUrl={editingProduct
    ? toSafeImageUrl(editingProduct.image_url)
    : undefined}
  initialDraft={editingItem ? draftFromItem(editingItem) : null}
  confirmLabel="Guardar cambios"
  onClose={closeEditModal}
  onConfirm={handleEditConfirm}
/>

<style>
  .cart-bar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-base-300);
    background: var(--color-base-100);
  }

  @media (min-width: 1280px) {
    .cart-bar {
      display: none;
    }
  }
</style>
