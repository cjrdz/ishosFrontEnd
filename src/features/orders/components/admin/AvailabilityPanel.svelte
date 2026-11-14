<script lang="ts">
  /**
   * Mark products sold out (or back) during service. Open to staff. Each
   * switch applies immediately on screen and is sent after a short undo window.
   */
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import type { Category, Product } from "@features/admin-management";
  import { setProductAvailability } from "@features/admin-management/lib/bff";
  import { undoableAction } from "@shared/toast/toast";

  interface Props {
    products: Product[];
    categories: Category[];
    onClose: () => void;
    /** A change was saved; the parent may refresh its product data. */
    onChanged?: () => void;
  }

  let { products, categories, onClose, onChanged }: Props = $props();

  let dialogRef = $state<HTMLDialogElement | null>(null);
  let query = $state("");
  /** Latest known availability by product id (saved or pending). */
  let availability = $state<Record<string, boolean>>({});

  $effect(() => {
    dialogRef?.showModal();
  });

  function isAvailable(product: Product): boolean {
    return availability[product.id] ?? product.is_available;
  }

  function normalize(value: string): string {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  const groups = $derived.by(() => {
    const term = normalize(query.trim());
    const visible = products.filter(
      (p) => !term || normalize(p.name).includes(term),
    );
    const byCategory = new Map<string, Product[]>();
    for (const product of visible) {
      const key = product.category_id || "";
      byCategory.set(key, [...(byCategory.get(key) ?? []), product]);
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

  const soldOutCount = $derived(products.filter((p) => !isAvailable(p)).length);

  function toggle(product: Product, next: boolean) {
    const previous = isAvailable(product);
    availability = { ...availability, [product.id]: next };
    undoableAction({
      message: next ? `${product.name} disponible` : `${product.name} agotado`,
      undo: () => {
        availability = { ...availability, [product.id]: previous };
      },
      commit: async () => {
        const saved = await setProductAvailability(product.id, next);
        availability = { ...availability, [product.id]: saved.is_available };
        onChanged?.();
      },
      delayMs: 3000,
      failureMessage: `No se pudo actualizar ${product.name}. Se revirtió.`,
    });
  }
</script>

<AdminModalShell
  bind:dialogRef
  title="Disponibilidad"
  icon="lucide:package-x"
  widthClass="max-w-xl"
  {onClose}
>
  <div class="space-y-4 p-5">
    <p class="text-sm text-base-content/70">
      Los productos agotados no aparecen en la tienda en línea.
      {#if soldOutCount > 0}
        <strong class="text-base-content"
          >{soldOutCount} agotado{soldOutCount === 1 ? "" : "s"}.</strong
        >
      {/if}
    </p>
    <label class="input w-full">
      <span class="sr-only">Buscar producto</span>
      <input
        type="search"
        placeholder="Buscar producto"
        bind:value={query}
        autocomplete="off"
      />
    </label>

    {#each groups as group (group.id)}
      <section aria-labelledby={`avail-${group.id || "none"}`}>
        <h4
          id={`avail-${group.id || "none"}`}
          class="mb-1 text-sm font-semibold text-base-content/70"
        >
          {group.name}
        </h4>
        <ul class="divide-y divide-base-300 rounded-box border border-base-300">
          {#each group.items as product (product.id)}
            {@const available = isAvailable(product)}
            <li class="flex items-center justify-between gap-3 px-3 py-2">
              <span
                class={`min-w-0 truncate ${available ? "" : "text-base-content/60"}`}
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
                    product,
                    (event.currentTarget as HTMLInputElement).checked,
                  )}
              />
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="text-center text-sm text-base-content/60">
        No hay productos que coincidan.
      </p>
    {/each}
  </div>
</AdminModalShell>
