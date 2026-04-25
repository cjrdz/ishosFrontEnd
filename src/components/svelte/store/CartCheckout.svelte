<script lang="ts">
  import { onMount } from "svelte";
  import { ApiError } from "../../../lib/errors";
  import {
    createPublicOrder,
    listPublicProducts,
    type PublicProduct,
  } from "../../../lib/api/store";
  import {
    cartItemsMatch,
    clearCartItems,
    getCartItems,
    normalizeCartQuantity,
    setCartItems,
    type StoreCartItem,
  } from "../../../lib/store/cart";
  import { saveTracking } from "../../../lib/store/tracking";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import {
    normalizeAddonGroupName,
    addonGroupLabel,
  } from "../../../lib/store/helpers";
  import { normalizeIdList } from "../../../lib/utils/collections";

  type CheckoutForm = {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
    order_type: "en_local" | "para_llevar";
    table_number: string;
    notes: string;
  };

  let items = $state<StoreCartItem[]>([]);
  let products = $state<PublicProduct[]>([]);
  let submitting = $state(false);
  let message = $state("");
  let error = $state("");

  let form = $state<CheckoutForm>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "efectivo",
    order_type: "para_llevar",
    table_number: "",
    notes: "",
  });

  type ProductAddon = NonNullable<PublicProduct["addons"]>[number];
  type ProductFlavor = NonNullable<PublicProduct["flavors"]>[number];

  const total = $derived(
    items.reduce((sum, item) => {
      let itemPrice = item.unit_price;
      const payableAddonIds =
        item.extra_addon_ids && item.extra_addon_ids.length > 0
          ? item.extra_addon_ids
          : item.addons || [];
      if (payableAddonIds.length > 0 && products.length > 0) {
        const product = products.find((p) => p.id === item.product_id);
        if (product?.addons) {
          for (const addonId of payableAddonIds) {
            const addon = product.addons.find((a) => a.id === addonId);
            if (addon) itemPrice += addon.price;
          }
        }
      }
      return sum + itemPrice * item.quantity;
    }, 0),
  );

  const customerStepComplete = $derived(
    !!form.customer_name.trim() && !!form.customer_phone.trim(),
  );

  const deliveryStepComplete = $derived(
    form.order_type === "en_local"
      ? !!form.table_number.trim() && !!form.payment_method
      : !!form.payment_method,
  );

  const customizationsStepComplete = $derived(
    !items.some((item) => requiresFlavorSelection(item)),
  );

  const activeCheckoutStep = $derived(
    !customerStepComplete
      ? 1
      : !deliveryStepComplete
        ? 2
        : !customizationsStepComplete
          ? 3
          : 4,
  );

  function itemEffectivePrice(item: StoreCartItem): number {
    let price = item.unit_price;
    const payableAddonIds =
      item.extra_addon_ids && item.extra_addon_ids.length > 0
        ? item.extra_addon_ids
        : item.addons || [];
    if (payableAddonIds.length > 0 && products.length > 0) {
      const product = products.find((p) => p.id === item.product_id);
      if (product?.addons) {
        for (const addonId of payableAddonIds) {
          const addon = product.addons.find((a) => a.id === addonId);
          if (addon) price += addon.price;
        }
      }
    }
    return price;
  }

  function productById(productId: string): PublicProduct | undefined {
    return products.find((product) => product.id === productId);
  }

  function activeFlavors(product: PublicProduct | undefined): ProductFlavor[] {
    return (product?.flavors ?? [])
      .filter((flavor) => flavor.is_active)
      .slice()
      .sort(
        (left, right) =>
          left.display_order - right.display_order ||
          left.name.localeCompare(right.name),
      );
  }

  function activeAddons(product: PublicProduct | undefined): ProductAddon[] {
    return (product?.addons ?? [])
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
      });
  }

  function addonsForGroup(
    product: PublicProduct | undefined,
    groupName: string,
  ): ProductAddon[] {
    return activeAddons(product).filter(
      (addon) => normalizeAddonGroupName(addon.group_name) === groupName,
    );
  }

  function paidAddonGroups(
    product: PublicProduct | undefined,
  ): Array<{ key: string; label: string; items: ProductAddon[] }> {
    const grouped = new Map<string, ProductAddon[]>();

    for (const addon of activeAddons(product)) {
      const key = normalizeAddonGroupName(addon.group_name);
      if (key === "toppings" || key === "jalea") {
        continue;
      }
      const current = grouped.get(key) ?? [];
      current.push(addon);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, items]) => ({
        key,
        label: addonGroupLabel(key),
        items,
      }));
  }

  function hasEditableCustomizations(
    product: PublicProduct | undefined,
  ): boolean {
    return (
      activeFlavors(product).length > 0 || activeAddons(product).length > 0
    );
  }

  function requiresFlavorSelection(item: StoreCartItem): boolean {
    const product = productById(item.product_id);
    return activeFlavors(product).length > 0 && !item.flavor_id;
  }

  function resolveFlavorName(item: StoreCartItem): string | null {
    if (!item.flavor_id || products.length === 0) return null;
    const product = products.find((p) => p.id === item.product_id);
    const flavor = product?.flavors?.find((f) => f.id === item.flavor_id);
    return flavor?.name ?? null;
  }

  function resolveAddonNames(addonIds: string[] | undefined): string[] {
    if (!addonIds || addonIds.length === 0 || products.length === 0) return [];
    return addonIds
      .map((id) => {
        for (const product of products) {
          const addon = product.addons?.find(
            (candidate) => candidate.id === id,
          );
          if (addon) return addon.name;
        }
        return null;
      })
      .filter((name): name is string => !!name);
  }

  function resolveItemAddonNames(item: StoreCartItem): {
    included: string[];
    extras: string[];
  } {
    const included = resolveAddonNames(item.included_addon_ids || []);
    const extras = resolveAddonNames(
      item.extra_addon_ids && item.extra_addon_ids.length > 0
        ? item.extra_addon_ids
        : item.addons || [],
    );
    return { included, extras };
  }

  function resolveIncludedAddonNames(item: StoreCartItem): string[] {
    return resolveItemAddonNames(item).included;
  }

  function resolveExtraAddonNames(item: StoreCartItem): string[] {
    return resolveItemAddonNames(item).extras;
  }

  function itemFlavorSummary(item: StoreCartItem): string | null {
    const flavorName = resolveFlavorName(item);
    if (flavorName) {
      return flavorName;
    }

    return requiresFlavorSelection(item) ? "Pendiente" : null;
  }

  function cartItemKey(item: StoreCartItem): string {
    return [
      item.product_id,
      item.flavor_id || "",
      normalizeIdList(item.addons).join(","),
      normalizeIdList(item.included_addon_ids).join(","),
      normalizeIdList(item.extra_addon_ids).join(","),
      item.notes || "",
    ].join("|");
  }

  function mergeOrPush(
    list: StoreCartItem[],
    candidate: StoreCartItem,
  ): StoreCartItem[] {
    const existingIndex = list.findIndex((entry) =>
      cartItemsMatch(entry, candidate),
    );
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        quantity: normalizeCartQuantity(
          list[existingIndex].quantity + candidate.quantity,
        ),
      };
      return list;
    }

    list.push(candidate);
    return list;
  }

  function applyCustomizationUpdate(
    item: StoreCartItem,
    mutate: (base: StoreCartItem) => StoreCartItem,
  ) {
    const snapshot = getCartItems();
    const sourceItem = snapshot.find((entry) => cartItemsMatch(entry, item));
    if (!sourceItem) {
      items = snapshot;
      return;
    }
    const baseList = snapshot.filter(
      (entry) => !cartItemsMatch(entry, sourceItem),
    );

    const sanitize = (value: StoreCartItem): StoreCartItem => ({
      ...value,
      flavor_id: value.flavor_id || undefined,
      addons: undefined,
      included_addon_ids: normalizeIdList(value.included_addon_ids),
      extra_addon_ids: normalizeIdList(value.extra_addon_ids),
    });

    let nextList = [...baseList];

    if (sourceItem.quantity > 1) {
      const remainder = sanitize({
        ...sourceItem,
        quantity: sourceItem.quantity - 1,
      });
      const customized = sanitize(mutate({ ...sourceItem, quantity: 1 }));
      nextList = mergeOrPush(nextList, remainder);
      nextList = mergeOrPush(nextList, customized);
    } else {
      const customized = sanitize(mutate({ ...sourceItem }));
      nextList = mergeOrPush(nextList, customized);
    }

    items = nextList;
    setCartItems(nextList);
  }

  function updateItemFlavor(item: StoreCartItem, flavorId: string) {
    applyCustomizationUpdate(item, (base) => ({
      ...base,
      flavor_id: flavorId || undefined,
    }));
  }

  function updateIncludedAddon(
    item: StoreCartItem,
    groupName: "toppings" | "jalea",
    addonId: string,
  ) {
    const product = productById(item.product_id);
    const groupIds = new Set(
      addonsForGroup(product, groupName).map((addon) => addon.id),
    );
    const nextIncluded = normalizeIdList(
      (item.included_addon_ids || []).filter((id) => !groupIds.has(id)),
    );
    if (addonId) {
      nextIncluded.push(addonId);
      nextIncluded.sort();
    }

    const existingExtras =
      item.extra_addon_ids && item.extra_addon_ids.length > 0
        ? item.extra_addon_ids
        : item.addons || [];
    const nextExtras = normalizeIdList(
      existingExtras.filter((id) => id !== addonId),
    );

    applyCustomizationUpdate(item, (base) => ({
      ...base,
      addons: undefined,
      included_addon_ids: nextIncluded,
      extra_addon_ids: nextExtras,
    }));
  }

  function toggleItemExtraAddon(
    item: StoreCartItem,
    addonId: string,
    checked: boolean,
  ) {
    if ((item.included_addon_ids || []).includes(addonId)) {
      return;
    }

    const existingExtras =
      item.extra_addon_ids && item.extra_addon_ids.length > 0
        ? item.extra_addon_ids
        : item.addons || [];
    const nextExtras = checked
      ? normalizeIdList([...existingExtras, addonId])
      : normalizeIdList(existingExtras.filter((id) => id !== addonId));

    applyCustomizationUpdate(item, (base) => ({
      ...base,
      addons: undefined,
      extra_addon_ids: nextExtras,
    }));
  }

  function clearCart() {
    clearCartItems();
    items = [];
  }

  function buildCustomizations(
    item: StoreCartItem,
  ): Record<string, unknown> | undefined {
    const customizations: Record<string, unknown> = {};
    if (item.notes) customizations.notes = item.notes;
    if (item.flavor_id) customizations.flavor_id = item.flavor_id;
    if (item.included_addon_ids && item.included_addon_ids.length > 0) {
      customizations.included_addon_ids = item.included_addon_ids;
    }
    if (item.extra_addon_ids && item.extra_addon_ids.length > 0) {
      customizations.extra_addon_ids = item.extra_addon_ids;
    } else if (item.addons && item.addons.length > 0) {
      customizations.addon_ids = item.addons;
    }
    return Object.keys(customizations).length > 0 ? customizations : undefined;
  }

  onMount(async () => {
    items = getCartItems();
    try {
      products = await listPublicProducts();
    } catch {
      // Non-critical: flavor/addon names won't resolve but checkout still works
    }
  });

  function updateQty(item: StoreCartItem, nextQty: number) {
    const safeQty = normalizeCartQuantity(nextQty, 0);
    const snapshot = getCartItems();
    const updated = snapshot
      .map((entry) =>
        cartItemsMatch(entry, item) ? { ...entry, quantity: safeQty } : entry,
      )
      .filter((entry) => entry.quantity > 0);

    items = updated;
    setCartItems(updated);
  }

  async function submitOrder() {
    if (items.length === 0) {
      error = "Tu carrito está vacío.";
      return;
    }

    const missingFlavor = items.some((item) => requiresFlavorSelection(item));
    if (missingFlavor) {
      error =
        "Debes seleccionar un sabor en todos los productos que tienen sabores disponibles.";
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
          form.order_type === "en_local"
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
      window.location.href = `/order/tracking`;
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
</script>

<div class="container mx-auto px-4 py-6 md:py-10 max-w-7xl">
  <section
    class="mb-8 md:mb-12 flex flex-col gap-5 text-center md:text-left md:flex-row items-center justify-between"
  >
    <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
      <span
        class="bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary inline-block"
        >Tu carrito</span
      >
    </h1>
    <div class="flex items-center gap-3 flex-wrap justify-center">
      <a
        href="/order/tracking"
        class="btn btn-outline rounded-full font-medium shadow-sm hover:shadow-md"
        >Ir a seguimiento</a
      >
      {#if items.length > 0}
        <button
          type="button"
          class="btn btn-ghost hover:bg-error/10 hover:text-error text-base-content/70 rounded-full font-medium transition-colors"
          onclick={clearCart}>Limpiar carrito</button
        >
      {/if}
    </div>
  </section>

  <section id="checkout" class="w-full">
    {#if items.length === 0}
      <div
        class="max-w-2xl mx-auto text-center py-24 px-6 bg-base-100/50 backdrop-blur-sm border border-base-200/50 rounded-3xl shadow-xl"
      >
        <div class="text-6xl mb-6">🛒</div>
        <h2 class="text-2xl font-bold mb-3">Tu carrito está vacío</h2>
        <p class="text-base-content/70 mb-8 max-w-md mx-auto">
          Parece que aún no has agregado ningún helado artesanal. Explora
          nuestro menú y encuentra tu sabor favorito.
        </p>
        <a
          href="/menu"
          class="btn btn-primary btn-lg rounded-full px-10 shadow-md hover:shadow-lg transition-all"
          >Ir al menú</a
        >
      </div>
    {:else}
      <div
        class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-10 items-start"
      >
        <!-- Left Column: Items List -->
        <div class="space-y-6">
          <div
            class="flex items-center justify-between border-b border-base-200/80 pb-3 p-1"
          >
            <h2 class="text-2xl font-bold">Productos en orden</h2>
            <span class="badge badge-lg bg-base-200/50 font-bold"
              >{items.length} {items.length === 1 ? "item" : "items"}</span
            >
          </div>

          <div class="space-y-5">
            {#each items as item, itemIndex (cartItemKey(item))}
              {@const product = productById(item.product_id)}
              {@const flavorOptions = activeFlavors(product)}
              {@const toppingOptions = addonsForGroup(product, "toppings")}
              {@const jaleaOptions = addonsForGroup(product, "jalea")}
              {@const extraGroups = paidAddonGroups(product)}
              {@const flavorIsRequired =
                flavorOptions.length > 0 && !item.flavor_id}
              {@const flavorSummary = itemFlavorSummary(item)}

              <div
                class="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-3xl overflow-visible"
              >
                <div class="p-5 md:p-6 space-y-4">
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="flex-1 min-w-0 space-y-1.5">
                      <h4
                        class="font-extrabold text-xl leading-tight text-base-content"
                      >
                        {item.name}
                      </h4>
                      {#if flavorSummary}
                        <div
                          class={`badge badge-sm sm:badge-md font-medium border-0 ${flavorIsRequired ? "bg-warning/20 text-warning-content" : "bg-primary/10 text-primary"}`}
                        >
                          Sabor: {flavorSummary}
                        </div>
                      {/if}
                    </div>
                    <div
                      class="font-extrabold text-2xl text-primary whitespace-nowrap"
                    >
                      {formatCurrency(itemEffectivePrice(item) * item.quantity)}
                    </div>
                  </div>

                  <div class="flex items-center gap-3 pt-1">
                    <div
                      class="bg-base-200/50 rounded-xl flex items-center shadow-inner border border-base-200/80 p-0.5"
                    >
                      <button
                        class="btn btn-ghost btn-sm h-9 w-10 p-0 rounded-lg hover:bg-base-100 shadow-sm"
                        type="button"
                        onclick={() => updateQty(item, item.quantity - 1)}
                        aria-label="Reducir cantidad"
                      >
                        <span class="text-xl leading-none">−</span>
                      </button>
                      <div
                        class="w-10 text-center font-bold text-base text-base-content/90"
                      >
                        {item.quantity}
                      </div>
                      <button
                        class="btn btn-ghost btn-sm h-9 w-10 p-0 rounded-lg hover:bg-base-100 shadow-sm"
                        type="button"
                        onclick={() => updateQty(item, item.quantity + 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <span class="text-xl leading-none">+</span>
                      </button>
                    </div>
                  </div>
                </div>

                {#if flavorIsRequired}
                  <div
                    class="mx-5 mb-4 alert alert-warning shadow-sm border-warning/20 text-sm rounded-2xl flex gap-3 p-3"
                  >
                    <span class="text-xl">⚠️</span>
                    <span class="font-medium"
                      >Selecciona un sabor primero para continuar.</span
                    >
                  </div>
                {/if}

                <div
                  class="bg-base-200/30 border-t border-base-200 p-2 md:p-3 rounded-b-3xl"
                >
                  <div
                    role="tablist"
                    class="tabs tabs-boxed bg-transparent p-0 w-full"
                  >
                    <input
                      type="radio"
                      name={`cart-item-tabs-${itemIndex}`}
                      class="tab h-10 font-bold rounded-xl [--tab-bg:var(--fallback-b1,oklch(var(--b1)))] border border-transparent checked:border-base-300 shadow-sm"
                      aria-label="Opcionales"
                      checked
                    />
                    <div
                      class="tab-content bg-transparent p-2 sm:p-3 space-y-3 mt-2"
                    >
                      {#if hasEditableCustomizations(product) && (flavorOptions.length > 0 || toppingOptions.length > 0 || jaleaOptions.length > 0)}
                        {#if flavorOptions.length > 0}
                          <div
                            class="collapse collapse-arrow bg-base-100 border border-base-200/80 shadow-sm rounded-2xl"
                          >
                            <input type="checkbox" checked />
                            <div
                              class="collapse-title font-bold text-base-content/90"
                            >
                              Sabor
                            </div>
                            <div class="collapse-content pt-0">
                              <label class="form-control w-full">
                                <div
                                  class="flex justify-between items-center mb-2 px-1"
                                >
                                  <span
                                    class="text-sm font-medium text-base-content/70"
                                    >Seleccione:</span
                                  >
                                </div>
                                <select
                                  class="select select-bordered bg-base-100 focus:bg-base-200 w-full rounded-xl transition-all"
                                  value={item.flavor_id || ""}
                                  onchange={(event) =>
                                    updateItemFlavor(
                                      item,
                                      (event.currentTarget as HTMLSelectElement)
                                        .value,
                                    )}
                                >
                                  <option value=""
                                    >Sin sabor seleccionado</option
                                  >
                                  {#each flavorOptions as flavor (flavor.id)}
                                    <option value={flavor.id}>
                                      {flavor.name}
                                      {#if flavor.is_seasonal}
                                        (Temporada)
                                      {/if}
                                    </option>
                                  {/each}
                                </select>
                              </label>
                            </div>
                          </div>
                        {/if}

                        {#if toppingOptions.length > 0}
                          <div
                            class="collapse collapse-arrow bg-base-100 border border-base-200/80 shadow-sm rounded-2xl"
                          >
                            <input type="checkbox" />
                            <div
                              class="collapse-title font-bold text-base-content/90"
                            >
                              Topping opcional
                            </div>
                            <div class="collapse-content pt-0">
                              <select
                                class="select select-bordered bg-base-100 focus:bg-base-200 w-full rounded-xl transition-all"
                                value={toppingOptions.find((addon) =>
                                  (item.included_addon_ids || []).includes(
                                    addon.id,
                                  ),
                                )?.id || ""}
                                onchange={(event) =>
                                  updateIncludedAddon(
                                    item,
                                    "toppings",
                                    (event.currentTarget as HTMLSelectElement)
                                      .value,
                                  )}
                              >
                                <option value="">Sin topping</option>
                                {#each toppingOptions as addon (addon.id)}
                                  <option value={addon.id}>{addon.name}</option>
                                {/each}
                              </select>
                            </div>
                          </div>
                        {/if}

                        {#if jaleaOptions.length > 0}
                          <div
                            class="collapse collapse-arrow bg-base-100 border border-base-200/80 shadow-sm rounded-2xl"
                          >
                            <input type="checkbox" />
                            <div
                              class="collapse-title font-bold text-base-content/90"
                            >
                              Jalea opcional
                            </div>
                            <div class="collapse-content pt-0">
                              <select
                                class="select select-bordered bg-base-100 focus:bg-base-200 w-full rounded-xl transition-all"
                                value={jaleaOptions.find((addon) =>
                                  (item.included_addon_ids || []).includes(
                                    addon.id,
                                  ),
                                )?.id || ""}
                                onchange={(event) =>
                                  updateIncludedAddon(
                                    item,
                                    "jalea",
                                    (event.currentTarget as HTMLSelectElement)
                                      .value,
                                  )}
                              >
                                <option value="">Sin jalea</option>
                                {#each jaleaOptions as addon (addon.id)}
                                  <option value={addon.id}>{addon.name}</option>
                                {/each}
                              </select>
                            </div>
                          </div>
                        {/if}
                      {:else}
                        <p
                          class="text-sm font-medium text-base-content/60 px-4 py-2 bg-base-100 rounded-xl border border-base-200 shadow-inner"
                        >
                          Este producto no tiene opcionales.
                        </p>
                      {/if}
                    </div>

                    <input
                      type="radio"
                      name={`cart-item-tabs-${itemIndex}`}
                      class="tab h-10 font-bold rounded-xl [--tab-bg:var(--fallback-b1,oklch(var(--b1)))] border border-transparent checked:border-base-300 shadow-sm"
                      aria-label="Extras"
                      disabled={flavorIsRequired}
                    />
                    <div
                      class="tab-content bg-transparent p-2 sm:p-3 space-y-3 mt-2"
                    >
                      {#if flavorIsRequired}
                        <div class="alert alert-warning text-sm rounded-xl">
                          <span>Es necesario seleccionar un sabor.</span>
                        </div>
                      {/if}
                      {#if toppingOptions.length > 0}
                        <div
                          class="collapse collapse-arrow bg-base-100 border border-base-200/80 shadow-sm rounded-2xl"
                        >
                          <input type="checkbox" checked />
                          <div
                            class="collapse-title font-bold text-base-content/90"
                          >
                            Toppings extra
                          </div>
                          <div class="collapse-content pt-0 space-y-1">
                            {#each toppingOptions as addon (addon.id)}
                              <label
                                class="flex items-center gap-3 cursor-pointer p-2 hover:bg-base-200/50 rounded-xl transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  class="checkbox checkbox-sm checkbox-primary rounded-md"
                                  checked={(
                                    item.extra_addon_ids ||
                                    item.addons ||
                                    []
                                  ).includes(addon.id)}
                                  disabled={(
                                    item.included_addon_ids || []
                                  ).includes(addon.id)}
                                  onchange={(event) =>
                                    toggleItemExtraAddon(
                                      item,
                                      addon.id,
                                      (event.currentTarget as HTMLInputElement)
                                        .checked,
                                    )}
                                />
                                <span class="flex-1 font-medium"
                                  >{addon.name}</span
                                >
                                <span class="text-sm font-bold text-primary"
                                  >+{formatCurrency(addon.price)}</span
                                >
                              </label>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      {#if jaleaOptions.length > 0}
                        <div
                          class="collapse collapse-arrow bg-base-100 border border-base-200/80 shadow-sm rounded-2xl"
                        >
                          <input type="checkbox" />
                          <div
                            class="collapse-title font-bold text-base-content/90"
                          >
                            Jalea extra
                          </div>
                          <div class="collapse-content pt-0 space-y-1">
                            {#each jaleaOptions as addon (addon.id)}
                              <label
                                class="flex items-center gap-3 cursor-pointer p-2 hover:bg-base-200/50 rounded-xl transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  class="checkbox checkbox-sm checkbox-primary rounded-md"
                                  checked={(
                                    item.extra_addon_ids ||
                                    item.addons ||
                                    []
                                  ).includes(addon.id)}
                                  disabled={(
                                    item.included_addon_ids || []
                                  ).includes(addon.id)}
                                  onchange={(event) =>
                                    toggleItemExtraAddon(
                                      item,
                                      addon.id,
                                      (event.currentTarget as HTMLInputElement)
                                        .checked,
                                    )}
                                />
                                <span class="flex-1 font-medium"
                                  >{addon.name}</span
                                >
                                <span class="text-sm font-bold text-primary"
                                  >+{formatCurrency(addon.price)}</span
                                >
                              </label>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      {#if extraGroups.length > 0}
                        {#each extraGroups as group}
                          <div
                            class="collapse collapse-arrow bg-base-100 border border-base-200/80 shadow-sm rounded-2xl"
                          >
                            <input type="checkbox" />
                            <div
                              class="collapse-title font-bold text-base-content/90"
                            >
                              {group.label}
                            </div>
                            <div class="collapse-content pt-0 space-y-1">
                              {#each group.items as addon (addon.id)}
                                <label
                                  class="flex items-center gap-3 cursor-pointer p-2 hover:bg-base-200/50 rounded-xl transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    class="checkbox checkbox-sm checkbox-primary rounded-md"
                                    checked={(
                                      item.extra_addon_ids ||
                                      item.addons ||
                                      []
                                    ).includes(addon.id)}
                                    onchange={(event) =>
                                      toggleItemExtraAddon(
                                        item,
                                        addon.id,
                                        (
                                          event.currentTarget as HTMLInputElement
                                        ).checked,
                                      )}
                                  />
                                  <span class="flex-1 font-medium"
                                    >{addon.name}</span
                                  >
                                  <span class="text-sm font-bold text-primary"
                                    >+{formatCurrency(addon.price)}</span
                                  >
                                </label>
                              {/each}
                            </div>
                          </div>
                        {/each}
                      {/if}

                      {#if toppingOptions.length === 0 && jaleaOptions.length === 0 && extraGroups.length === 0}
                        <p
                          class="text-sm font-medium text-base-content/60 px-4 py-2 bg-base-100 rounded-xl border border-base-200 shadow-inner"
                        >
                          Este producto no tiene extras adicionales.
                        </p>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div class="pt-4 block lg:hidden">
            <a
              href="/menu"
              class="btn btn-ghost w-full rounded-full font-medium"
              >Seguir comprando</a
            >
          </div>
        </div>

        <!-- Right Column: Checkout Form (Sticky) -->
        <div
          class="lg:sticky lg:top-8 bg-base-100/50 backdrop-blur-md rounded-[2.5rem] shadow-2xl border border-base-200/60 p-6 md:p-8 flex flex-col pt-10"
        >
          <div class="mb-8 pb-6 border-b border-base-200/80">
            <h3 class="font-extrabold text-xl tracking-tight px-1 mb-4">
              Progreso de checkout
            </h3>
            <ul class="steps steps-vertical md:steps-horizontal w-full">
              <li
                class={`step ${customerStepComplete || activeCheckoutStep >= 1 ? "step-primary" : ""} ${activeCheckoutStep === 1 ? "checkout-step-live" : ""}`}
              >
                Datos
              </li>
              <li
                class={`step ${deliveryStepComplete || activeCheckoutStep >= 2 ? "step-primary" : ""} ${activeCheckoutStep === 2 ? "checkout-step-live" : ""}`}
              >
                Entrega
              </li>
              <li
                class={`step ${customizationsStepComplete || activeCheckoutStep >= 3 ? "step-primary" : ""} ${activeCheckoutStep === 3 ? "checkout-step-live" : ""}`}
              >
                Opciones
              </li>
              <li
                class={`step ${activeCheckoutStep === 4 ? "step-primary checkout-step-live" : ""}`}
              >
                Confirmar
              </li>
            </ul>
          </div>

          <div class="flex items-center justify-between text-xl mb-2 px-2">
            <span class="font-bold text-base-content/80">Total del pedido</span>
          </div>
          <div
            class="text-5xl font-extrabold text-primary mb-8 px-2 border-b border-base-200/80 pb-8"
          >
            {formatCurrency(total)}
          </div>

          <div id="checkout-form" class="space-y-6 shrink-0">
            <h3 class="font-extrabold text-2xl tracking-tight px-1">
              Detalles de orden
            </h3>

            <div
              class="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
            >
              <label class="form-control w-full">
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Nombre *</span
                >
                <input
                  type="text"
                  class="input input-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl transition-all"
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
                  class="input input-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl transition-all"
                  bind:value={form.customer_phone}
                />
              </label>

              <label
                class="form-control w-full md:col-span-2 lg:col-span-1 xl:col-span-2"
              >
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Email (opcional)</span
                >
                <input
                  class="input input-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl transition-all"
                  type="email"
                  bind:value={form.customer_email}
                />
              </label>

              <div
                class="divider md:col-span-2 lg:col-span-1 xl:col-span-2 my-1"
              ></div>

              <label class="form-control w-full">
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Tipo de pedido</span
                >
                <select
                  class="select select-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl font-medium transition-all"
                  bind:value={form.order_type}
                >
                  <option value="para_llevar">Para llevar 🛵</option>
                  <option value="en_local">En local 🏠</option>
                </select>
              </label>

              {#if form.order_type === "en_local"}
                <label class="form-control w-full">
                  <span
                    class="label-text font-bold text-base-content/70 ml-1 mb-1"
                    >Número de mesa *</span
                  >
                  <input
                    type="text"
                    inputmode="numeric"
                    class="input input-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl font-bold transition-all"
                    bind:value={form.table_number}
                  />
                </label>
              {:else}
                <div class="hidden md:block lg:hidden xl:block"></div>
              {/if}

              <label
                class="form-control w-full md:col-span-2 lg:col-span-1 xl:col-span-2"
              >
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Método de pago</span
                >
                <select
                  class="select select-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl font-medium transition-all"
                  bind:value={form.payment_method}
                >
                  <option value="efectivo">Efectivo 💵</option>
                  <option value="tarjeta">Tarjeta 💳</option>
                  <option value="transferencia">Transferencia 🏦</option>
                  <option value="otro">Otro</option>
                </select>
              </label>

              <label
                class="form-control w-full md:col-span-2 lg:col-span-1 xl:col-span-2"
              >
                <span
                  class="label-text font-bold text-base-content/70 ml-1 mb-1"
                  >Notas (opcional)</span
                >
                <textarea
                  class="textarea textarea-bordered bg-base-100 focus:bg-base-200 w-full rounded-2xl font-medium transition-all"
                  rows="2"
                  bind:value={form.notes}
                ></textarea>
              </label>
            </div>
          </div>

          <div
            class="mt-8 space-y-4 pt-4 border-t border-base-200/80 w-full mb-2"
          >
            {#if error}
              <div
                class="alert alert-error rounded-2xl shadow-sm text-sm font-medium"
              >
                <span class="text-xl">⚠️</span>
                <span>{error}</span>
              </div>
            {/if}
            {#if message}
              <div
                class="alert alert-success rounded-2xl shadow-sm text-sm font-medium bg-success/20 text-success-content border-success/30"
              >
                <span class="text-xl">✅</span>
                <span>{message}</span>
              </div>
            {/if}

            <button
              class="btn btn-primary w-full btn-lg rounded-2xl shadow-lg hover:shadow-xl transition-all font-extrabold text-lg tracking-wide border-2"
              type="button"
              onclick={submitOrder}
              disabled={submitting}
            >
              {submitting ? "Procesando orden..." : "Confirmar pedido"}
            </button>
            <div class="hidden lg:block text-center mt-4">
              <a
                href="/menu"
                class="btn btn-ghost btn-sm rounded-full font-bold text-base-content/60"
                >← Volver al menú</a
              >
            </div>
          </div>
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .checkout-step-live {
    animation: checkoutStepGlow 1.6s ease-in-out infinite;
  }

  @keyframes checkoutStepGlow {
    0%,
    100% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.08);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .checkout-step-live {
      animation: none;
    }
  }
</style>
