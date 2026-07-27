<script lang="ts">
  import { type Category } from "@features/admin-management";
  import { toSlug } from "@shared/utils/formatters";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import CategoryList from "./CategoryList.svelte";

  interface Props {
    categories: Category[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: {
      name: string;
      slug: string;
      description?: string;
      is_active: boolean;
    }) => void;
    onUpdate: (
      id: string,
      payload: {
        name: string;
        slug: string;
        description?: string;
        display_order: number;
        is_active: boolean;
      },
    ) => void;
    onDelete: (id: string) => void;
  }

  let { categories, busy, moduleError, onCreate, onUpdate, onDelete }: Props =
    $props();
  let categoryEditorDialog = $state<HTMLDialogElement | null>(null);
  let confirmDialog = $state(createConfirmDialogState());
  let editingCategoryId = $state<string | null>(null);

  let form = $state({
    id: "",
    name: "",
    slug: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  let pendingToggleCategory = $state<Category | null>(null);
  let pendingToggleValue = $state(false);

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

    if (form.id) {
      onUpdate(form.id, {
        name: form.name.trim(),
        slug: form.slug.trim() || toSlug(form.name),
        description: form.description.trim() || undefined,
        display_order: Number(form.display_order),
        is_active: Boolean(form.is_active),
      });
    } else {
      onCreate({
        name: form.name.trim(),
        slug: form.slug.trim() || toSlug(form.name),
        description: form.description.trim() || undefined,
        is_active: Boolean(form.is_active),
      });
    }

    closeCategoryEditor();
  }

  function requestDeleteCategory(category: Category) {
    openConfirmDialog(
      confirmDialog,
      "Eliminar categoria",
      `Seguro que deseas eliminar ${category.name}?`,
      () => onDelete(category.id),
    );
  }

  function requestToggleCategoryAvailability(
    category: Category,
    checked: boolean,
  ) {
    if (checked === category.is_active) return;
    pendingToggleCategory = category;
    pendingToggleValue = checked;
    openConfirmDialog(
      confirmDialog,
      checked ? "Activar categoria" : "Desactivar categoria",
      checked
        ? `Seguro que deseas activar ${category.name}?`
        : `Seguro que deseas desactivar ${category.name}?`,
      confirmToggleCategoryAvailability,
    );
  }

  function confirmToggleCategoryAvailability() {
    if (!pendingToggleCategory) return;
    const category = pendingToggleCategory;
    const nextActive = pendingToggleValue;
    pendingToggleCategory = null;
    pendingToggleValue = false;

    onUpdate(category.id, {
      name: category.name,
      slug: category.slug,
      description: category.description,
      display_order: category.display_order,
      is_active: nextActive,
    });
  }

  function clearPendingToggle() {
    pendingToggleCategory = null;
    pendingToggleValue = false;
  }

  async function moveCategory(category: Category, target: Category) {
    await onUpdate(category.id, {
      name: category.name,
      slug: category.slug,
      description: category.description,
      display_order: target.display_order,
      is_active: category.is_active,
    });
    await onUpdate(target.id, {
      name: target.name,
      slug: target.slug,
      description: target.description,
      display_order: category.display_order,
      is_active: target.is_active,
    });
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <CategoryList
    {categories}
    {busy}
    onCreateCategory={openCreateCategoryModal}
    onToggleAvailability={requestToggleCategoryAvailability}
    onEdit={editCategory}
    onRequestDelete={requestDeleteCategory}
    onMoveCategory={moveCategory}
  />
</section>

<AdminModalShell
  bind:dialogRef={categoryEditorDialog}
  title={isEditing ? "Editar categoria" : "Crear categoria"}
  icon="lucide:folder"
  widthClass="max-w-3xl"
  onClose={closeCategoryEditor}
>
  <form class="grid gap-3 md:grid-cols-2" onsubmit={submit}>
    <div class="form-control md:col-span-2">
      <span id="category-name-label" class="label-text text-xs mb-1"
        >Nombre</span
      >
      <input
        id="category-name"
        class="input input-bordered input-sm w-full"
        placeholder="Bebidas frias"
        bind:value={form.name}
        required
        aria-labelledby="category-name-label"
      />
    </div>

    <div class="form-control">
      <span id="category-slug-label" class="label-text text-xs mb-1"
        >Slug (URL)</span
      >
      <input
        id="category-slug"
        class="input input-bordered input-sm w-full"
        placeholder="bebidas-frias (opcional)"
        bind:value={form.slug}
        aria-labelledby="category-slug-label"
      />
    </div>

    <div class="form-control">
      <span class="label-text text-xs mb-1">Generar slug</span>
      <button
        class="btn btn-outline btn-sm w-full"
        type="button"
        onclick={() => (form.slug = toSlug(form.name))}
        >Auto desde nombre</button
      >
    </div>

    <div class="form-control">
      <span class="label-text text-xs mb-1">Estado</span>
      <label
        class="label h-9 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3"
      >
        <input
          id="category-is-active"
          class="toggle toggle-sm"
          type="checkbox"
          bind:checked={form.is_active}
          aria-labelledby="category-is-active-label"
        />
        <span id="category-is-active-label" class="label-text text-sm"
          >Activa</span
        >
      </label>
    </div>

    <div class="form-control md:col-span-2">
      <span id="category-description-label" class="label-text text-xs mb-1"
        >Descripcion</span
      >
      <textarea
        id="category-description"
        class="textarea textarea-bordered textarea-sm w-full h-32 resize-none"
        placeholder="Descripcion"
        bind:value={form.description}
        aria-labelledby="category-description-label"
      ></textarea>
      <p class="mt-1 text-xs text-base-content/60">
        El slug identifica la categoria en URLs y rutas internas.
      </p>
    </div>

    <div class="md:col-span-2">
      <AdminFormActions
        submitLabel={isEditing ? "Actualizar" : "Crear"}
        onCancel={closeCategoryEditor}
        {busy}
      />
    </div>
  </form>
</AdminModalShell>

<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  {busy}
  variant="error"
  onConfirm={() => confirmDialogNow(confirmDialog)}
  onCancel={() => {
    clearPendingToggle();
    closeConfirmDialog(confirmDialog);
  }}
/>
