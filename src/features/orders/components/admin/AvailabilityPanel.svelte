<script lang="ts">
  /**
   * Mark products and flavours sold out ("Agotado") at one location during
   * service. Staff change their own location; admins the location chosen in
   * the header. Each switch applies immediately on screen and is sent after a
   * short undo window.
   */
  import { onMount } from "svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import type { Category, Flavor, Product } from "@features/admin-management";
  import {
    getLocationAvailability,
    listFlavors,
    setLocationAvailability,
    type AdminLocation,
  } from "@features/admin-management/lib/bff";
  import { resolveWorkingLocation } from "@features/admin-management/lib/location-selection";
  import { undoableAction } from "@shared/toast/toast";

  interface Props {
    products: Product[];
    categories: Category[];
    onClose: () => void;
    /** A change was saved; the parent may refresh its product data. */
    onChanged?: () => void;
  }

  let { products, categories, onClose, onChanged }: Props = $props();

  type ItemType = "product" | "flavor";

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let query = $state("");
  let loading = $state(true);
  let loadError = $state("");
  let location = $state<AdminLocation | null>(null);
  let flavors = $state<Flavor[]>([]);
  /** Sold-out state by "type:id" (saved or pending). */
  let soldOut = $state<Record<string, boolean>>({});

  $effect(() => {
    dialogRef?.showModal();
  });

  onMount(() => {
    void (async () => {
      try {
        location = await resolveWorkingLocation();
        if (!location) return;

        const [items, flavorList] = await Promise.all([
          getLocationAvailability(location.id),
          listFlavors(false),
        ]);
        flavors = flavorList ?? [];
        const next: Record<string, boolean> = {};
        for (const id of items.products ?? []) next[`product:${id}`] = true;
        for (const id of items.flavors ?? []) next[`flavor:${id}`] = true;
        soldOut = next;
      } catch {
        loadError = "No se pudo cargar la disponibilidad. Intenta de nuevo.";
      } finally {
        loading = false;
      }
    })();
  });

  function key(type: ItemType, id: string) {
    return `${type}:${id}`;
  }

  function isAvailable(type: ItemType, id: string): boolean {
    return !soldOut[key(type, id)];
  }

  function normalize(value: string): string {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Products hidden from the whole catalog are managed in Productos, not here.
  const catalogProducts = $derived(products.filter((p) => p.is_available));

  const groups = $derived.by(() => {
    const term = normalize(query.trim());
    const visible = catalogProducts.filter(
      (p) => !term || normalize(p.name).includes(term),
    );
    const byCategory = new Map<string, Product[]>();
    for (const product of visible) {
      const k = product.category_id || "";
      byCategory.set(k, [...(byCategory.get(k) ?? []), product]);
    }
    const ordered = [...categories]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: byCategory.get(c.id) ?? [],
      }));
    const uncategorized = byCategory.get("") ?? [];
    if (uncategorized.length)
      ordered.push({ id: "", name: "Sin categoría", items: uncategorized });
    return ordered.filter((g) => g.items.length > 0);
  });

  const visibleFlavors = $derived.by(() => {
    const term = normalize(query.trim());
    return flavors.filter((f) => !term || normalize(f.name).includes(term));
  });

  const soldOutCount = $derived(Object.values(soldOut).filter(Boolean).length);

  function toggle(
    type: ItemType,
    id: string,
    name: string,
    available: boolean,
  ) {
    if (!location) return;
    const locationId = location.id;
    const k = key(type, id);
    const previous = soldOut[k] ?? false;
    soldOut = { ...soldOut, [k]: !available };
    undoableAction({
      message: available ? `${name} disponible` : `${name} agotado`,
      undo: () => {
        soldOut = { ...soldOut, [k]: previous };
      },
      commit: async () => {
        const saved = await setLocationAvailability(locationId, {
          item_type: type,
          item_id: id,
          sold_out: !available,
        });
        const list = type === "product" ? saved.products : saved.flavors;
        soldOut = { ...soldOut, [k]: (list ?? []).includes(id) };
        onChanged?.();
      },
      delayMs: 3000,
      failureMessage: `No se pudo actualizar ${name}. Se revirtió.`,
    });
  }
</script>

<AdminModalShell
  bind:dialogRef
  title={location ? `Agotados · ${location.name}` : "Agotados"}
  icon="lucide:package-x"
  widthClass="max-w-xl"
  {onClose}
>
  <div class="space-y-4 p-5">
    {#if loading}
      <div class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md" aria-label="Cargando"
        ></span>
      </div>
    {:else if loadError}
      <div role="alert" class="alert alert-error alert-soft">{loadError}</div>
    {:else if !location}
      <div role="status" class="alert alert-info alert-soft">
        Elige una sucursal en la parte superior del panel para marcar sus
        productos y sabores agotados.
      </div>
    {:else}
      <p class="text-sm text-base-content/70">
        Lo agotado solo afecta a {location.name}: no se puede pedir aquí, pero
        sigue disponible en las demás sucursales.
        {#if soldOutCount > 0}
          <strong class="text-base-content"
            >{soldOutCount} agotado{soldOutCount === 1 ? "" : "s"}.</strong
          >
        {/if}
      </p>
      <label class="input w-full">
        <span class="sr-only">Buscar producto o sabor</span>
        <input
          type="search"
          placeholder="Buscar producto o sabor"
          bind:value={query}
          autocomplete="off"
        />
      </label>

      {#if visibleFlavors.length > 0}
        <section aria-labelledby="avail-flavors">
          <h4
            id="avail-flavors"
            class="mb-1 text-sm font-semibold text-base-content/70"
          >
            Sabores
          </h4>
          <ul
            class="divide-y divide-base-300 rounded-box border border-base-300"
          >
            {#each visibleFlavors as flavor (flavor.id)}
              {@const available = isAvailable("flavor", flavor.id)}
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <span
                  class={`min-w-0 truncate ${available ? "" : "text-ink-muted"}`}
                >
                  {flavor.name}
                  {#if !available}
                    <span
                      class="badge badge-sm ml-1 border-0 bg-error/15 text-error"
                      >Agotado</span
                    >
                  {/if}
                </span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  checked={available}
                  aria-label={`${flavor.name} disponible`}
                  onchange={(event) =>
                    toggle(
                      "flavor",
                      flavor.id,
                      flavor.name,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#each groups as group (group.id)}
        <section aria-labelledby={`avail-${group.id || "none"}`}>
          <h4
            id={`avail-${group.id || "none"}`}
            class="mb-1 text-sm font-semibold text-base-content/70"
          >
            {group.name}
          </h4>
          <ul
            class="divide-y divide-base-300 rounded-box border border-base-300"
          >
            {#each group.items as product (product.id)}
              {@const available = isAvailable("product", product.id)}
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <span
                  class={`min-w-0 truncate ${available ? "" : "text-ink-muted"}`}
                >
                  {product.name}
                  {#if !available}
                    <span
                      class="badge badge-sm ml-1 border-0 bg-error/15 text-error"
                      >Agotado</span
                    >
                  {/if}
                </span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  checked={available}
                  aria-label={`${product.name} disponible`}
                  onchange={(event) =>
                    toggle(
                      "product",
                      product.id,
                      product.name,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              </li>
            {/each}
          </ul>
        </section>
      {:else}
        {#if visibleFlavors.length === 0}
          <p class="text-center text-sm text-ink-muted">
            No hay productos ni sabores que coincidan.
          </p>
        {/if}
      {/each}
    {/if}
  </div>
</AdminModalShell>
