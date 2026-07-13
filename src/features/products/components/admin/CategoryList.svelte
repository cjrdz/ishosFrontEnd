<script lang="ts">
  import {
    getCurrentRowsPerTable,
    type Category,
  } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    categories: Category[];
    busy: boolean;
    onCreateCategory: () => void;
    onToggleAvailability: (category: Category, checked: boolean) => void;
    onEdit: (category: Category) => void;
    onRequestDelete: (category: Category) => void;
    onMoveCategory: (category: Category, target: Category) => void;
  }

  let {
    categories,
    busy,
    onCreateCategory,
    onToggleAvailability,
    onEdit,
    onRequestDelete,
    onMoveCategory,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let categoryRowLimit = $state<number>(5);

  let searchQuery = $state("");
  let debouncedSearchQuery = $state("");
  let searchTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchInput(value: string) {
    searchQuery = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearchQuery = value;
    }, 200);
  }

  let visibilityFilter = $state<"all" | "active" | "inactive">("all");

  $effect(() => {
    categoryRowLimit = getCurrentRowsPerTable("categorias");
  });

  function normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const filteredCategories = $derived(
    categories.filter((category) => {
      const matchesSearch =
        !debouncedSearchQuery ||
        normalizeText(category.name).includes(
          normalizeText(debouncedSearchQuery),
        );
      const matchesVisibility =
        visibilityFilter === "all"
          ? true
          : visibilityFilter === "active"
            ? category.is_active
            : !category.is_active;
      return matchesSearch && matchesVisibility;
    }),
  );

  const visibleCategories = $derived(
    categoryRowLimit <= 0
      ? filteredCategories
      : filteredCategories.slice(0, categoryRowLimit),
  );

  const visibilityFilterLabel = $derived(
    visibilityFilter === "all"
      ? "Estado"
      : visibilityFilter === "active"
        ? "Activas"
        : "Inactivas",
  );

  const rowLimitLabel = $derived(
    categoryRowLimit <= 0 ? "Todos" : String(categoryRowLimit),
  );

  function setCategoryRowLimit(limit: number) {
    categoryRowLimit = limit;
  }

  function setVisibilityFilter(value: "all" | "active" | "inactive") {
    visibilityFilter = value;
  }

  function moveCategory(category: Category, direction: -1 | 1) {
    if (categoryRowLimit > 0) return;
    const index = visibleCategories.findIndex((c) => c.id === category.id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= visibleCategories.length) return;
    onMoveCategory(category, visibleCategories[targetIndex]);
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <!-- Toolbar: title, search, filter, create -->
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="card-title shrink-0 mr-1">Categorias</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <input
        class="input input-sm input-bordered w-full sm:w-36 md:w-44 lg:w-52"
        type="text"
        placeholder="Buscar categoria"
        value={searchQuery}
        oninput={(event) =>
          handleSearchInput((event.currentTarget as HTMLInputElement).value)}
      />

      <!-- Visibility dropdown -->
      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-24 md:w-28 justify-between"
        >
          {visibilityFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setVisibilityFilter("all")}
              >Todas</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setVisibilityFilter("active")}
              >Activas</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => setVisibilityFilter("inactive")}>Inactivas</button
            >
          </li>
        </ul>
      </div>

      <button
        class="btn btn-sm btn-primary shrink-0 w-full sm:w-auto sm:ml-auto"
        type="button"
        onclick={onCreateCategory}
        disabled={busy}
      >
        <Icon icon="lucide:plus" class="h-4 w-4" />
        Categoria
      </button>
    </div>

    <!-- Table -->
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table w-full">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Nombre</th>
            <th class="text-center font-bold">Slug</th>
            <th class="text-center font-bold">Orden</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredCategories.length === 0}
            <tr
              ><td colspan="5" class="text-center py-6 text-base-content/50"
                >No hay categorias</td
              ></tr
            >
          {:else}
            {#each visibleCategories as category (category.id)}
              {@const index = visibleCategories.findIndex(
                (c) => c.id === category.id,
              )}
              {@const canMoveUp = categoryRowLimit <= 0 && index > 0}
              {@const canMoveDown =
                categoryRowLimit <= 0 && index < visibleCategories.length - 1}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>
                  <div class="font-medium">{category.name}</div>
                  {#if category.description}
                    <div class="text-xs text-base-content/60 line-clamp-2">
                      {category.description}
                    </div>
                  {/if}
                </td>
                <td class="text-center align-middle">{category.slug}</td>
                <td class="text-center align-middle"
                  >{category.display_order + 1}</td
                >
                <td class="text-center align-middle">
                  <input
                    class="toggle toggle-sm {category.is_active
                      ? 'toggle-primary'
                      : 'toggle-inactive'}"
                    type="checkbox"
                    checked={category.is_active}
                    onchange={(event) =>
                      onToggleAvailability(
                        category,
                        (event.currentTarget as HTMLInputElement).checked,
                      )}
                    disabled={busy}
                    aria-label={category.is_active ? "Activa" : "Inactiva"}
                  />
                </td>
                <td class="text-center align-middle">
                  <div
                    class="flex flex-wrap md:flex-nowrap items-center justify-center gap-1"
                  >
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-success"
                      type="button"
                      onclick={() => moveCategory(category, -1)}
                      disabled={busy || !canMoveUp}
                      aria-label="Subir categoria"
                      title="Subir"
                    >
                      <Icon icon="lucide:arrow-up" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-success"
                      type="button"
                      onclick={() => moveCategory(category, 1)}
                      disabled={busy || !canMoveDown}
                      aria-label="Bajar categoria"
                      title="Bajar"
                    >
                      <Icon icon="lucide:arrow-down" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                      type="button"
                      onclick={() => onEdit(category)}
                      disabled={busy}
                      aria-label="Editar categoria"
                    >
                      <Icon icon="lucide:pencil" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-error/70 hover:text-error hover:bg-error/10"
                      type="button"
                      onclick={() => onRequestDelete(category)}
                      disabled={busy}
                      aria-label="Eliminar categoria"
                    >
                      <Icon icon="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300/50 pt-3"
    >
      <span class="text-sm text-base-content/60">
        Mostrando {visibleCategories.length} de {filteredCategories.length}
      </span>

      <div class="flex items-center gap-2">
        <span class="text-sm text-base-content/60">Filas</span>
        <div class="dropdown w-full sm:w-auto dropdown-top dropdown-end">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm btn-outline w-full sm:w-24 justify-between"
          >
            {rowLimitLabel}
            <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-32 p-2 mb-1 shadow-xl border border-base-300"
          >
            {#each rowLimitOptions as option}
              <li>
                <button
                  type="button"
                  onclick={() => setCategoryRowLimit(option)}>{option}</button
                >
              </li>
            {/each}
            <li>
              <button type="button" onclick={() => setCategoryRowLimit(0)}
                >Todos</button
              >
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .toggle-inactive {
    --input-color: color-mix(in oklab, var(--color-error) 50%, transparent);
  }
</style>
