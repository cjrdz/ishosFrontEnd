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

  const incompleteItems = $derived(
    items.filter((item) => {
      const product = productById(item.product_id);
      const draft = draftFromItem(item);
      return (
        requiresFlavorSelection(product, draft) ||
        requiresGroupSelection(product, draft, "toppings") ||
        requiresGroupSelection(product, draft, "jalea")
      );
    }),
  );

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

    const unit_price = computeUnitPrice(editingProduct, draft);

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

  async function submitOrder() {
    if (items.length === 0) {
      error = "Tu carrito está vacío.";
      step = "cart";
      return;
    }

    if (incompleteItems.length > 0) {
      error = "Completa las personalizaciones pendientes antes de confirmar.";
      step = "cart";
      return;
    }

    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      error = "Nombre y teléfono son obligatorios.";
      return;
    }

    error = "";
    message = "";
    submitting = true;

    try {
      const created = await createPublicOrder({
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
      });

      saveTracking(created.order_number, created.tracking_token);
      clearCartItems();
      items = [];
      window.location.href = "/order/tracking";
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 429) {
        error = "Has alcanzado el límite de pedidos. Intenta más tarde.";
      } else {
        error =
          requestError instanceof Error
            ? requestError.message
            : "No se pudo crear la orden.";
      }
    } finally {
      submitting = false;
    }
  }

  onMount(async () => {
    refreshItems();
    try {
      products = await listPublicProducts();
    } catch {
      products = [];
    }

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
          Checkout
        </li>
      </ul>
    </section>

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
              class="card bg-base-100 border border-base-200 rounded-3xl shadow-sm"
            >
              <div class="p-5 md:p-6">
                <div
                  class="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between"
                >
                  <div class="space-y-2 min-w-0">
                    <h3 class="text-xl font-extrabold leading-tight">
                      {item.name}
                    </h3>
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
                    <button
                      type="button"
                      class="btn btn-outline btn-sm rounded-full"
                      onclick={() => openEditModal(item)}
                    >
                      Editar
                    </button>
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

            <button
              type="button"
              class="btn btn-brand btn-lg w-full rounded-xl font-bold"
              onclick={() => {
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

            <div class="grid gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
              <label class="form-control w-full">
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Nombre *</span
                >
                <input
                  type="text"
                  class="input input-bordered rounded-2xl w-full"
                  bind:value={form.customer_name}
                />
              </label>
              <label class="form-control w-full">
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Teléfono *</span
                >
                <input
                  type="tel"
                  class="input input-bordered rounded-2xl w-full"
                  bind:value={form.customer_phone}
                />
              </label>

              <label class="form-control w-full md:col-span-2">
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Email (opcional)</span
                >
                <input
                  type="email"
                  class="input input-bordered rounded-2xl w-full"
                  bind:value={form.customer_email}
                />
              </label>
            </div>

            <div class="space-y-2">
              <span class="label-text font-bold text-base-content/70 ml-1"
                >Tipo de pedido</span
              >
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class={`btn rounded-full ${form.order_type === "para_llevar" ? "btn-brand" : "btn-outline"}`}
                  onclick={() => {
                    form.order_type = "para_llevar";
                    form.table_number = "";
                  }}
                >
                  Para llevar
                </button>
                <button
                  type="button"
                  class={`btn rounded-full ${form.order_type === "en_local" ? "btn-brand" : "btn-outline"}`}
                  onclick={() => {
                    form.order_type = "en_local";
                  }}
                >
                  En local
                </button>
              </div>
              {#if form.order_type === "en_local"}
                <p class="text-sm text-base-content/70 px-1">
                  El número de mesa se asigna al llegar al local.
                </p>
              {/if}
            </div>

            <div class="space-y-2">
              <span class="label-text font-bold text-base-content/70 ml-1"
                >Método de pago</span
              >
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class={`btn rounded-full ${form.payment_method === "efectivo" ? "btn-brand" : "btn-outline"}`}
                  onclick={() => (form.payment_method = "efectivo")}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  class={`btn rounded-full ${form.payment_method === "tarjeta" ? "btn-brand" : "btn-outline"}`}
                  onclick={() => (form.payment_method = "tarjeta")}
                >
                  Tarjeta
                </button>
                <button
                  type="button"
                  class={`btn rounded-full ${form.payment_method === "transferencia" ? "btn-brand" : "btn-outline"}`}
                  onclick={() => (form.payment_method = "transferencia")}
                >
                  Transferencia
                </button>
              </div>
              <p class="text-sm text-base-content/70 px-1">
                Este método es informativo para preparar el cobro en local o
                entrega.
              </p>
            </div>

            <label class="form-control w-full">
              <span class="label-text font-bold text-base-content/70 ml-1 mb-1"
                >Notas (opcional)</span
              >
              <textarea
                class="textarea textarea-bordered rounded-2xl w-full"
                rows="3"
                bind:value={form.notes}
              ></textarea>
            </label>
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
              <div class="alert alert-error rounded-2xl text-sm">
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
              type="button"
              onclick={submitOrder}
              disabled={submitting}
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
  ordersEnabled={true}
  imageUrl={editingProduct
    ? toSafeImageUrl(editingProduct.image_url)
    : undefined}
  initialDraft={editingItem ? draftFromItem(editingItem) : null}
  onClose={closeEditModal}
  onConfirm={handleEditConfirm}
/>
