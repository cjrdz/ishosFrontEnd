<script lang="ts">
  import type { Category } from "../../../lib/api/admin";
  import { toSlug } from "../../../lib/utils/formatters";

  interface Props {
    categories: Category[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: {
      name: string;
      slug: string;
      description?: string;
      display_order: number;
      is_active: boolean;
    }) => void;
    onUpdate: (id: string, payload: {
      name: string;
      slug: string;
      description?: string;
      display_order: number;
      is_active: boolean;
    }) => void;
    onDelete: (id: string) => void;
  }

  let { categories, busy, moduleError, onCreate, onUpdate, onDelete }: Props = $props();
  let categoryEditorDialog: HTMLDialogElement | null = null;
  let confirmDialog: HTMLDialogElement | null = null;
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let editingCategoryId = $state<string | null>(null);

  let form = $state({
    id: "",
    name: "",
    slug: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  let categoryVisibilityFilter = $state<"all" | "active" | "inactive">("all");
  const filteredCategories = $derived(
    categoryVisibilityFilter === "all"
      ? categories
      : categories.filter((category) =>
          categoryVisibilityFilter === "active" ? category.is_active : !category.is_active,
        ),
  );
  const categoryVisibilityFilterLabel = $derived(
    categoryVisibilityFilter === "all"
      ? "Todas"
      : categoryVisibilityFilter === "active"
        ? "Activas"
        : "Inactivas",
  );

  const isEditing = $derived(!!editingCategoryId);

  function resetForm() {
    editingCategoryId = null;
    form = {
      id: "",
      name: "",
      slug: "",
      description: "",
      display_order: 0,
      is_active: true,
    };
  }

  function openCreateCategoryModal() {
    resetForm();
    categoryEditorDialog?.showModal();
  }

  function closeCategoryEditor() {
    categoryEditorDialog?.close();
    resetForm();
  }

  function editCategory(category: Category) {
    editingCategoryId = category.id;
    form = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      display_order: category.display_order,
      is_active: category.is_active,
    };
    categoryEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || toSlug(form.name),
      description: form.description.trim() || undefined,
      display_order: Number(form.display_order),
      is_active: Boolean(form.is_active),
    };

    if (form.id) {
      onUpdate(form.id, payload);
    } else {
      onCreate(payload);
    }

    closeCategoryEditor();
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

  function requestDeleteCategory(category: Category) {
    openConfirm(
      "Eliminar categoria",
      `Seguro que deseas eliminar ${category.name}?`,
      () => onDelete(category.id),
    );
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
          <h2 class="card-title">Gestion de categorias</h2>
          <p class="text-sm text-base-content/70">Crea y edita categorias manteniendo un orden claro para el catalogo.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button class="btn btn-primary" type="button" onclick={openCreateCategoryModal} disabled={busy}>
            Crear categoria
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 class="card-title text-base">Listado de categorias</h4>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
            <div class="dropdown dropdown-right dropdown-center">
              <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-32 justify-between">
                {categoryVisibilityFilterLabel}
              </div>
              <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300">
                <li><button type="button" onclick={() => (categoryVisibilityFilter = "all")}>Todas</button></li>
                <li><button type="button" onclick={() => (categoryVisibilityFilter = "active")}>Activas</button></li>
                <li><button type="button" onclick={() => (categoryVisibilityFilter = "inactive")}>Inactivas</button></li>
              </ul>
            </div>
          </div>
          <div class="text-sm text-base-content/70 whitespace-nowrap">{filteredCategories.length} de {categories.length} categoria(s)</div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
      <table class="table">
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
            <tr><td colspan="5" class="text-center">No hay categorias</td></tr>
          {:else}
            {#each filteredCategories as category}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>
                  <div class="font-medium">{category.name}</div>
                  {#if category.description}
                    <div class="text-xs text-base-content/60 line-clamp-2">{category.description}</div>
                  {/if}
                </td>
                <td class="text-center align-middle">{category.slug}</td>
                <td class="text-center align-middle">{category.display_order}</td>
                <td class="text-center align-middle">
                  <span class={`badge ${category.is_active ? "badge-success" : "badge-ghost"}`}>
                    {category.is_active ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td class="text-center align-middle">
                  <div class="flex w-full flex-wrap items-center justify-center gap-2">
                    <button class="btn btn-sm btn-soft btn-accent" onclick={() => editCategory(category)}>Editar</button>
                    <button class="btn btn-sm btn-soft btn-error" onclick={() => requestDeleteCategory(category)}>Eliminar</button>
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
</section>

<dialog class="modal" bind:this={categoryEditorDialog} onclose={resetForm}>
  <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar categoria" : "Crear categoria"}</h3>
    </div>

    <form class="mt-5 grid items-start gap-6 md:grid-cols-[1.15fr_0.85fr]" onsubmit={submit}>
      <div class="grid gap-5">
        <div class="grid items-start gap-5 md:grid-cols-2">
          <div class="form-control w-full md:col-span-2">
            <span id="category-name-label" class="label-text mb-1">Nombre</span>
            <input id="category-name" class="input input-bordered w-full" placeholder="Bebidas frias" bind:value={form.name} required aria-labelledby="category-name-label" />
          </div>

          <div class="form-control w-full">
            <span id="category-slug-label" class="label-text mb-1">Slug (URL)</span>
            <input id="category-slug" class="input input-bordered w-full" placeholder="bebidas-frias (opcional)" bind:value={form.slug} aria-labelledby="category-slug-label" />
          </div>

          <div class="form-control w-full">
            <span class="label-text mb-1">Generar slug</span>
            <button class="btn btn-outline h-12 w-full" type="button" onclick={() => (form.slug = toSlug(form.name))}>Auto desde nombre</button>
          </div>

          <div class="form-control w-full">
            <span id="category-order-label" class="label-text mb-1">Orden</span>
            <input id="category-order" class="input input-bordered h-12 w-full" type="number" min="0" bind:value={form.display_order} aria-labelledby="category-order-label" />
          </div>

          <div class="form-control w-full">
            <span class="label-text mb-1">Estado</span>
            <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
              <input id="category-is-active" class="toggle toggle-sm" type="checkbox" bind:checked={form.is_active} aria-labelledby="category-is-active-label" />
              <span id="category-is-active-label" class="label-text">Activa</span>
            </label>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {isEditing ? "Actualizar" : "Crear"}
          </button>
          <button class="btn btn-ghost" type="button" onclick={closeCategoryEditor}>Cancelar</button>
        </div>
      </div>

      <div class="form-control w-full self-start pt-0">
        <span id="category-description-label" class="label-text mb-1">Descripcion</span>
        <textarea id="category-description" class="textarea textarea-bordered w-full h-50 resize-none" placeholder="Descripcion" bind:value={form.description} aria-labelledby="category-description-label"></textarea>
        <p class="mt-2 text-xs text-base-content/60">El slug identifica la categoria en URLs y rutas internas.</p>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeCategoryEditor}>close</button>
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
  <form method="dialog" class="modal-backdrop"><button type="button" onclick={closeConfirm}>close</button></form>
</dialog>
