<script lang="ts">
  import { onMount } from "svelte";
  import { ApiError } from "../../../lib/errors";
  import { createPublicOrder, listPublicProducts, type PublicProduct } from "../../../lib/api/store";
  import { clearCartItems, getCartItems, setCartItems, type StoreCartItem } from "../../../lib/store/cart";
  import { saveTracking } from "../../../lib/store/tracking";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { normalizeAddonGroupName, addonGroupLabel } from "../../../lib/admin/addon-groups";
  import { normalizeIdList, arraysEqualUnordered } from "../../../lib/utils/collections";

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
      const payableAddonIds = item.extra_addon_ids && item.extra_addon_ids.length > 0
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

  function itemEffectivePrice(item: StoreCartItem): number {
    let price = item.unit_price;
    const payableAddonIds = item.extra_addon_ids && item.extra_addon_ids.length > 0
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

  function cartItemsMatch(left: StoreCartItem, right: StoreCartItem): boolean {
    return (
      left.product_id === right.product_id &&
      (left.flavor_id || null) === (right.flavor_id || null) &&
      (left.notes || "") === (right.notes || "") &&
      arraysEqualUnordered(left.addons || [], right.addons || []) &&
      arraysEqualUnordered(left.included_addon_ids || [], right.included_addon_ids || []) &&
      arraysEqualUnordered(left.extra_addon_ids || [], right.extra_addon_ids || [])
    );
  }

  function productById(productId: string): PublicProduct | undefined {
    return products.find((product) => product.id === productId);
  }

  function activeFlavors(product: PublicProduct | undefined): ProductFlavor[] {
    return (product?.flavors ?? [])
      .filter((flavor) => flavor.is_active)
      .slice()
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name));
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

  function addonsForGroup(product: PublicProduct | undefined, groupName: string): ProductAddon[] {
    return activeAddons(product).filter((addon) => normalizeAddonGroupName(addon.group_name) === groupName);
  }

  function paidAddonGroups(product: PublicProduct | undefined): Array<{ key: string; label: string; items: ProductAddon[] }> {
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

  function hasEditableCustomizations(product: PublicProduct | undefined): boolean {
    return activeFlavors(product).length > 0 || activeAddons(product).length > 0;
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
          const addon = product.addons?.find((candidate) => candidate.id === id);
          if (addon) return addon.name;
        }
        return null;
      })
      .filter((name): name is string => !!name);
  }

  function resolveItemAddonNames(item: StoreCartItem): { included: string[]; extras: string[] } {
    const included = resolveAddonNames(item.included_addon_ids || []);
    const extras = resolveAddonNames(
      item.extra_addon_ids && item.extra_addon_ids.length > 0 ? item.extra_addon_ids : item.addons || [],
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

  function mergeOrPush(list: StoreCartItem[], candidate: StoreCartItem): StoreCartItem[] {
    const existingIndex = list.findIndex((entry) => cartItemsMatch(entry, candidate));
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        quantity: list[existingIndex].quantity + candidate.quantity,
      };
      return list;
    }

    list.push(candidate);
    return list;
  }

  function applyCustomizationUpdate(item: StoreCartItem, mutate: (base: StoreCartItem) => StoreCartItem) {
    const snapshot = getCartItems();
    const sourceItem = snapshot.find((entry) => cartItemsMatch(entry, item));
    if (!sourceItem) {
      items = snapshot;
      return;
    }
    const baseList = snapshot.filter((entry) => !cartItemsMatch(entry, sourceItem));

    const sanitize = (value: StoreCartItem): StoreCartItem => ({
      ...value,
      flavor_id: value.flavor_id || undefined,
      addons: undefined,
      included_addon_ids: normalizeIdList(value.included_addon_ids),
      extra_addon_ids: normalizeIdList(value.extra_addon_ids),
    });

    let nextList = [...baseList];

    if (sourceItem.quantity > 1) {
      const remainder = sanitize({ ...sourceItem, quantity: sourceItem.quantity - 1 });
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

  function updateIncludedAddon(item: StoreCartItem, groupName: "toppings" | "jalea", addonId: string) {
    const product = productById(item.product_id);
    const groupIds = new Set(addonsForGroup(product, groupName).map((addon) => addon.id));
    const nextIncluded = normalizeIdList((item.included_addon_ids || []).filter((id) => !groupIds.has(id)));
    if (addonId) {
      nextIncluded.push(addonId);
      nextIncluded.sort();
    }

    const existingExtras = item.extra_addon_ids && item.extra_addon_ids.length > 0
      ? item.extra_addon_ids
      : item.addons || [];
    const nextExtras = normalizeIdList(existingExtras.filter((id) => id !== addonId));

    applyCustomizationUpdate(item, (base) => ({
      ...base,
      addons: undefined,
      included_addon_ids: nextIncluded,
      extra_addon_ids: nextExtras,
    }));
  }

  function toggleItemExtraAddon(item: StoreCartItem, addonId: string, checked: boolean) {
    if ((item.included_addon_ids || []).includes(addonId)) {
      return;
    }

    const existingExtras = item.extra_addon_ids && item.extra_addon_ids.length > 0
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

  function buildCustomizations(item: StoreCartItem): Record<string, unknown> | undefined {
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
    const safeQty = Math.max(0, Math.floor(nextQty));
    const snapshot = getCartItems();
    const updated = snapshot
      .map((entry) => (cartItemsMatch(entry, item) ? { ...entry, quantity: safeQty } : entry))
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
      error = "Debes seleccionar un sabor en todos los productos que tienen sabores disponibles.";
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
        table_number: form.order_type === "en_local" ? Number(form.table_number) : undefined,
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
      message = `${created.message} N° ${created.order_number}. Guarda tu token para seguimiento seguro.`;
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 429) {
        error = "Has alcanzado el límite de pedidos. Intenta más tarde.";
      } else {
        error = requestError instanceof Error ? requestError.message : "No se pudo crear la orden.";
      }
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-8">
  <section class="mb-6 flex items-center justify-between flex-wrap gap-2">
    <h1 class="text-4xl font-bold">Tu carrito y checkout</h1>
    <div class="flex items-center gap-2 flex-wrap">
      <a href="/order/tracking" class="btn btn-outline">Ir a seguimiento</a>
      {#if items.length > 0}
        <a href="#checkout-form" class="btn btn-primary btn-outline">Checkout</a>
        <button type="button" class="btn btn-error btn-outline" onclick={clearCart}>Cancelar carrito</button>
      {/if}
    </div>
  </section>

  <section id="checkout" class="space-y-4">
    {#if items.length === 0}
      <div class="space-y-3 p-6 bg-base-100 border border-base-300 rounded-lg">
        <p class="text-base-content/70">Tu carrito está vacío.</p>
        <a href="/menu" class="btn btn-primary w-fit">Ir al menú</a>
      </div>
    {:else}
      {#each items as item, itemIndex (cartItemKey(item))}
        {@const product = productById(item.product_id)}
        {@const flavorOptions = activeFlavors(product)}
        {@const toppingOptions = addonsForGroup(product, "toppings")}
        {@const jaleaOptions = addonsForGroup(product, "jalea")}
        {@const extraGroups = paidAddonGroups(product)}
        {@const flavorIsRequired = flavorOptions.length > 0 && !item.flavor_id}
        {@const flavorSummary = itemFlavorSummary(item)}
        <div class="border border-base-300 rounded-lg p-4 space-y-4 bg-base-100">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="font-medium">{item.name}</h4>
                    {#if flavorSummary}
                      <span class={`badge ${flavorIsRequired ? "badge-warning" : "badge-outline"}`}>
                        Sabor: {flavorSummary}
                      </span>
                    {/if}
                    <span class="badge badge-outline">Cantidad: {item.quantity}</span>
                  </div>
                  <div class="ml-auto flex items-center gap-3">
                    <div class="join">
                      <button
                        class="btn btn-sm join-item"
                        type="button"
                        onclick={() => updateQty(item, item.quantity - 1)}
                        aria-label="Reducir cantidad"
                      >
                        -
                      </button>
                      <span class="btn btn-sm join-item no-animation min-w-14 text-sm">{item.quantity}</span>
                      <button
                        class="btn btn-sm join-item"
                        type="button"
                        onclick={() => updateQty(item, item.quantity + 1)}
                        aria-label="Aumentar cantidad"
                      >
                        +
                      </button>
                    </div>
                    <span class="text-sm font-semibold whitespace-nowrap">{formatCurrency(itemEffectivePrice(item) * item.quantity)}</span>
                  </div>
                </div>

                {#if flavorIsRequired}
                  <div class="alert alert-warning text-sm">
                    <span>Selecciona un sabor primero para continuar.</span>
                  </div>
                {/if}

                <div role="tablist" class="tabs tabs-bordered tabs-sm sm:tabs-md w-full">
                  <input type="radio" name={`cart-item-tabs-${itemIndex}`} class="tab" aria-label="Opcionales" checked />
                  <div class="tab-content border-base-300 bg-base-100 p-3 sm:p-4 rounded-box space-y-3">
                    {#if hasEditableCustomizations(product) && (flavorOptions.length > 0 || toppingOptions.length > 0 || jaleaOptions.length > 0)}
                      {#if flavorOptions.length > 0}
                        <div class="collapse collapse-plus border border-base-300 bg-base-200/40">
                          <input type="checkbox" checked />
                          <div class="collapse-title font-medium py-3">Sabor</div>
                          <div class="collapse-content pt-0">
                            <label class="form-control">
                              <div class="flex items-center justify-between mb-1">
                                <span class="label-text">Seleccion de sabor</span>
                                {#if flavorOptions.find((flavor) => flavor.id === item.flavor_id)?.is_seasonal}
                                  <span class="badge badge-warning badge-sm">Temporada</span>
                                {/if}
                              </div>
                              <select
                                class="select select-bordered w-full"
                                value={item.flavor_id || ""}
                                onchange={(event) => updateItemFlavor(item, (event.currentTarget as HTMLSelectElement).value)}
                              >
                                <option value="">Sin sabor seleccionado</option>
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
                        <div class="collapse collapse-plus border border-base-300 bg-base-200/40">
                          <input type="checkbox" />
                          <div class="collapse-title font-medium py-3">Topping opcional</div>
                          <div class="collapse-content pt-0">
                            <select
                              class="select select-bordered w-full"
                              value={toppingOptions.find((addon) => (item.included_addon_ids || []).includes(addon.id))?.id || ""}
                              onchange={(event) => updateIncludedAddon(item, "toppings", (event.currentTarget as HTMLSelectElement).value)}
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
                        <div class="collapse collapse-plus border border-base-300 bg-base-200/40">
                          <input type="checkbox" />
                          <div class="collapse-title font-medium py-3">Jalea opcional</div>
                          <div class="collapse-content pt-0">
                            <select
                              class="select select-bordered w-full"
                              value={jaleaOptions.find((addon) => (item.included_addon_ids || []).includes(addon.id))?.id || ""}
                              onchange={(event) => updateIncludedAddon(item, "jalea", (event.currentTarget as HTMLSelectElement).value)}
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
                      <p class="text-sm text-base-content/70">Este producto no tiene opcionales configurables.</p>
                    {/if}
                  </div>

                  <input
                    type="radio"
                    name={`cart-item-tabs-${itemIndex}`}
                    class="tab"
                    aria-label="Extras"
                    disabled={flavorIsRequired}
                  />
                  <div class="tab-content border-base-300 bg-base-100 p-3 sm:p-4 rounded-box space-y-3">
                    {#if flavorIsRequired}
                      <div class="alert alert-warning text-sm">
                        <span>Selecciona un sabor primero para habilitar esta seccion.</span>
                      </div>
                    {/if}
                    {#if toppingOptions.length > 0}
                      <div class="collapse collapse-plus border border-base-300 bg-base-200/40">
                        <input type="checkbox" checked />
                        <div class="collapse-title font-medium py-3">Toppings extra</div>
                        <div class="collapse-content pt-0 space-y-2">
                          {#each toppingOptions as addon (addon.id)}
                            <label class="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                class="checkbox"
                                checked={(item.extra_addon_ids || item.addons || []).includes(addon.id)}
                                disabled={(item.included_addon_ids || []).includes(addon.id)}
                                onchange={(event) => toggleItemExtraAddon(item, addon.id, (event.currentTarget as HTMLInputElement).checked)}
                              />
                              <span class="flex-1">{addon.name}</span>
                              <span class="text-sm font-semibold text-primary">+{formatCurrency(addon.price)}</span>
                            </label>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    {#if jaleaOptions.length > 0}
                      <div class="collapse collapse-plus border border-base-300 bg-base-200/40">
                        <input type="checkbox" />
                        <div class="collapse-title font-medium py-3">Jalea extra</div>
                        <div class="collapse-content pt-0 space-y-2">
                          {#each jaleaOptions as addon (addon.id)}
                            <label class="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                class="checkbox"
                                checked={(item.extra_addon_ids || item.addons || []).includes(addon.id)}
                                disabled={(item.included_addon_ids || []).includes(addon.id)}
                                onchange={(event) => toggleItemExtraAddon(item, addon.id, (event.currentTarget as HTMLInputElement).checked)}
                              />
                              <span class="flex-1">{addon.name}</span>
                              <span class="text-sm font-semibold text-primary">+{formatCurrency(addon.price)}</span>
                            </label>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    {#if extraGroups.length > 0}
                      {#each extraGroups as group}
                        <div class="collapse collapse-plus border border-base-300 bg-base-200/40">
                          <input type="checkbox" />
                          <div class="collapse-title font-medium py-3">{group.label}</div>
                          <div class="collapse-content pt-0 space-y-2">
                            {#each group.items as addon (addon.id)}
                              <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  class="checkbox"
                                  checked={(item.extra_addon_ids || item.addons || []).includes(addon.id)}
                                  onchange={(event) => toggleItemExtraAddon(item, addon.id, (event.currentTarget as HTMLInputElement).checked)}
                                />
                                <span class="flex-1">{addon.name}</span>
                                <span class="text-sm font-semibold text-primary">+{formatCurrency(addon.price)}</span>
                              </label>
                            {/each}
                          </div>
                        </div>
                      {/each}
                    {/if}

                    {#if toppingOptions.length === 0 && jaleaOptions.length === 0 && extraGroups.length === 0}
                      <p class="text-sm text-base-content/70">Este producto no tiene extras disponibles.</p>
                    {/if}
                  </div>
                </div>
        </div>
      {/each}

      <div class="divider"></div>
      <div class="font-semibold text-lg mb-3">Total: {formatCurrency(total)}</div>

      <div id="checkout-form" class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">Nombre *</span>
            <input class="input input-bordered w-full" bind:value={form.customer_name} />
          </label>

          <label class="form-control">
            <span class="label-text">Teléfono *</span>
            <input class="input input-bordered w-full" bind:value={form.customer_phone} />
          </label>

          <label class="form-control">
            <span class="label-text">Email (opcional)</span>
            <input class="input input-bordered w-full" type="email" bind:value={form.customer_email} />
          </label>

          <label class="form-control">
            <span class="label-text">Tipo de pedido</span>
            <select class="select select-bordered w-full" bind:value={form.order_type}>
              <option value="para_llevar">Para llevar</option>
              <option value="en_local">En local</option>
            </select>
          </label>

          {#if form.order_type === "en_local"}
            <label class="form-control">
              <span class="label-text">Número de mesa *</span>
              <input class="input input-bordered w-full" bind:value={form.table_number} />
            </label>
          {/if}

          <label class="form-control">
            <span class="label-text">Pago</span>
            <select class="select select-bordered w-full" bind:value={form.payment_method}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </label>
        </div>

        <label class="form-control">
          <span class="label-text">Notas generales (opcional)</span>
          <textarea class="textarea textarea-bordered w-full" rows="2" bind:value={form.notes}></textarea>
        </label>

        <div class="mt-6 space-y-3">
          {#if error}
            <div class="alert alert-error">{error}</div>
          {/if}
          {#if message}
            <div class="alert alert-success">{message}</div>
          {/if}

          <div class="flex gap-2">
            <button class="btn btn-primary flex-1" type="button" onclick={submitOrder} disabled={submitting}>
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
            <a href="/menu" class="btn btn-ghost flex-1">Seguir comprando</a>
          </div>
        </div>
      {/if}
  </section>
</div>
