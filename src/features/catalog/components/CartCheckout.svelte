<script lang="ts">
  import { onMount, tick } from "svelte";
  import { animate, stagger } from "motion";
  import { ApiError } from "@core/errors";
  import "../../../styles/cart.css";
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
      ordersEnabled = settingsResult.value.orders_enabled;
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

    void tick().then(() => {
      if (!containerRef) return;
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      void animate(
        containerRef,
        { opacity: [0, 1], y: [20, 0] },
        { duration: 0.45, ease: [0, 0, 0.2, 1] },
      );
      void tick().then(() => {
        if (!containerRef) return;
        const cards = containerRef.querySelectorAll("article.card");
        if (cards.length > 0) {
          void animate(
            cards,
            { opacity: [0, 1], y: [14, 0] },
            {
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
              delay: stagger(0.08, { startDelay: 0.22 }),
            },
          );
        }
        if (summaryRef) {
          void animate(
            summaryRef,
            { opacity: [0, 1], x: [20, 0] },
            { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 },
          );
        }
      });
    });
  });
</script>

<div class="relative overflow-hidden" bind:this={containerRef}>
  <div
    class="stripe-bg absolute top-0 left-0 right-0 h-48 md:h-64 pointer-events-none"
  ></div>
  <div class="relative container mx-auto px-4 py-6 md:py-10 max-w-7xl">
    <section
      class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <div class="section-pill mb-3">Tu Carrito</div>
        <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
          <span
            class="bg-clip-text text-transparent inline-block"
            style="background-image: var(--brand-gradient);"
          >
            Tu carrito
          </span>
        </h1>
      </div>

      <div class="flex gap-2">
        <a href="/menu" class="btn btn-ghost rounded-full">Seguir comprando</a>
        <a href="/order/tracking" class="btn btn-outline rounded-full"
          >Ir a seguimiento</a
        >
      </div>
    </section>

    <div class="wave-divider -mt-2 mb-4" style="color: var(--ishos-teal);">
      <svg
        viewBox="0 0 1440 60"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        style="height:32px; width:100%;"
      >
        <path
          d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
          fill="color-mix(in srgb, var(--ishos-teal) 8%, transparent)"
        ></path>
      </svg>
    </div>

    <section class="mb-6">
      <ul class="steps steps-horizontal w-full">
        <li class={`step ${step === "cart" ? "step-brand" : ""}`}>Carrito</li>
        <li class={`step ${step === "checkout" ? "step-brand" : ""}`}>
          Datos y pago
        </li>
      </ul>
    </section>

    {#if !ordersEnabled}
      <div class="alert alert-warning rounded-2xl mb-6" role="status">
        <span>
          La tienda no está recibiendo pedidos en este momento. Tu carrito se
          guarda en este dispositivo para que puedas pedir más tarde.
        </span>
      </div>
    {/if}

    {#if items.length === 0}
      <div
        class="max-w-2xl mx-auto text-center py-20 px-6 bg-base-100/50 border border-base-200/50 rounded-3xl shadow-xl"
      >
        <div class="text-6xl mb-6">🛒</div>
        <h2 class="text-2xl font-bold mb-3">Tu carrito está vacío</h2>
        <p class="text-base-content/70 mb-8 max-w-md mx-auto">
          Explora nuestro menú y agrega tus sabores favoritos.
        </p>
        <a href="/menu" class="btn btn-brand btn-lg rounded-full px-10"
          >Ir al menú</a
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

          {#each items as item, index (index)}
            {@const summary = customizationSummary(item)}
            <article
              class={`card bg-base-100 border rounded-3xl shadow-sm ${isItemUnavailable(item) ? "border-error/60 opacity-75" : "border-base-200"}`}
            >
              <div class="p-5 md:p-6">
                <div
                  class="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between"
                >
                  <div class="space-y-2 min-w-0">
                    <h3 class="text-xl font-extrabold leading-tight">
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
                          <span class="badge badge-ghost badge-sm">{line}</span>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  <div
                    class="text-2xl font-extrabold whitespace-nowrap"
                    style="color: var(--ishos-teal);"
                  >
                    {formatCurrency(item.unit_price * item.quantity)}
                  </div>
                </div>

                <div
                  class="mt-4 flex flex-wrap items-center gap-3 justify-between"
                >
                  <div
                    class="inline-flex items-center gap-1 rounded-xl border border-base-300 bg-base-100 p-1"
                  >
                    <button
                      class="btn btn-sm btn-ghost h-9 w-9 rounded-lg"
                      type="button"
                      aria-label="Reducir cantidad"
                      onclick={() => updateQty(item, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span class="w-10 text-center font-bold"
                      >{item.quantity}</span
                    >
                    <button
                      class="btn btn-sm btn-ghost h-9 w-9 rounded-lg"
                      type="button"
                      aria-label="Aumentar cantidad"
                      onclick={() => updateQty(item, item.quantity + 1)}
                    >
                      +
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
                      class="btn btn-ghost btn-sm rounded-full text-error"
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
          class="card bg-base-100 border border-base-200 rounded-3xl shadow-md h-fit"
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
                <span style="color: var(--ishos-teal);"
                  >{formatCurrency(total)}</span
                >
              </div>
            </div>

            {#if error}
              <div class="alert alert-error rounded-2xl text-sm" role="alert">
                <span>{error}</span>
              </div>
            {/if}

            <button
              type="button"
              class="btn btn-brand btn-lg w-full rounded-xl font-bold"
              disabled={!ordersEnabled}
              onclick={() => {
                if (unavailableItems.length > 0) {
                  error =
                    "Quita los productos que ya no están disponibles para continuar.";
                  return;
                }
                if (incompleteItems.length > 0) {
                  error =
                    "Completa las personalizaciones pendientes antes de continuar.";
                  return;
                }
                error = "";
                step = "checkout";
              }}
            >
              Continuar al checkout
            </button>
          </div>
        </aside>
      </div>
    {:else}
      <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-6 items-start">
        <section
          class="card bg-base-100 border border-base-200 rounded-3xl shadow-sm"
        >
          <div class="p-6 md:p-7 space-y-5">
            <div class="flex items-center justify-between">
              <h2 class="text-2xl font-bold">Datos de orden</h2>
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
                      class={`btn rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${form.order_type === option.value ? "btn-brand" : "btn-outline"}`}
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
                      class={`btn rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${form.payment_method === option.value ? "btn-brand" : "btn-outline"}`}
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
          class="card bg-base-100 border border-base-200 rounded-3xl shadow-md xl:sticky xl:top-6"
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
                <span style="color: var(--ishos-teal);"
                  >{formatCurrency(total)}</span
                >
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
              class="btn btn-brand btn-lg w-full rounded-xl font-extrabold"
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
  onClose={closeEditModal}
  onConfirm={handleEditConfirm}
/>
