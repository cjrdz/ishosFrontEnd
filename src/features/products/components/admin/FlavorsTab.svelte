<script lang="ts">
  import type { Flavor } from "@features/admin-management";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import { sortByDisplayOrderAndName } from "@features/products";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import AdminTableRowActions from "@features/admin-management/components/shared/AdminTableRowActions.svelte";

  interface Props {
    flavors: Flavor[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: { name: string; is_seasonal: boolean }) => void;
    onUpdate: (
      id: string,
      payload: {
        name: string;
        display_order: number;
        is_seasonal: boolean;
        is_active: boolean;
      },
    ) => void;
    onDelete: (id: string) => void;
  }

  let { flavors, busy, moduleError, onCreate, onUpdate, onDelete }: Props =
    $props();
  let flavorEditorDialog = $state<HTMLDialogElement | null>(null);
  let confirmDialog = $state(createConfirmDialogState());
  let editingFlavorId = $state<string | null>(null);

  let form = $state({
    id: "",
    name: "",
    display_order: 0,
    is_seasonal: false,
    is_active: true,
  });

  let flavorActivityFilter = $state<"all" | "active" | "inactive">("all");
  const filteredFlavors = $derived(
    (flavorActivityFilter === "all"
      ? flavors
      : flavors.filter((flavor) =>
          flavorActivityFilter === "active"
            ? flavor.is_active
            : !flavor.is_active,
        )
    )
      .slice()
      .sort((left, right) => sortByDisplayOrderAndName(left, right)),
  );
  const flavorActivityFilterLabel = $derived(
    flavorActivityFilter === "all"
      ? "Todas"
      : flavorActivityFilter === "active"
        ? "Activas"
        : "Inactivas",
  );

  const isEditing = $derived(!!editingFlavorId);

  function resetForm() {
    editingFlavorId = null;
    form = {
      id: "",
      name: "",
      display_order: 0,
      is_seasonal: false,
      is_active: true,
    };
  }

  function openCreateFlavorModal() {
    resetForm();
    flavorEditorDialog?.showModal();
  }

  function closeFlavorEditor() {
    flavorEditorDialog?.close();
    resetForm();
  }

  function editFlavor(flavor: Flavor) {
    editingFlavorId = flavor.id;
    form = {
      id: flavor.id,
      name: flavor.name,
      display_order: flavor.display_order,
      is_seasonal: flavor.is_seasonal,
      is_active: flavor.is_active,
    };
    flavorEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();

    if (form.id) {
      onUpdate(form.id, {
        name: form.name.trim(),
        display_order: Number(form.display_order),
        is_seasonal: Boolean(form.is_seasonal),
        is_active: Boolean(form.is_active),
      });
    } else {
      onCreate({
        name: form.name.trim(),
        is_seasonal: Boolean(form.is_seasonal),
      });
    }

    closeFlavorEditor();
  }

  function requestDeleteFlavor(flavor: Flavor) {
    openConfirmDialog(
      confirmDialog,
      "Eliminar sabor",
      `Seguro que deseas eliminar ${flavor.name}?`,
      () => onDelete(flavor.id),
    );
  }

  async function moveFlavor(flavor: Flavor, direction: -1 | 1) {
    if (flavorActivityFilter !== "all") return;
    const index = filteredFlavors.findIndex((f) => f.id === flavor.id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= filteredFlavors.length) return;

    const target = filteredFlavors[targetIndex];
    await onUpdate(flavor.id, {
      name: flavor.name,
      display_order: target.display_order,
      is_seasonal: flavor.is_seasonal,
      is_active: flavor.is_active,
    });
    await onUpdate(target.id, {
      name: target.name,
      display_order: flavor.display_order,
      is_seasonal: target.is_seasonal,
      is_active: target.is_active,
    });
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
          <h2 class="card-title">Gestion de sabores</h2>
          <p class="text-sm text-base-content/70">
            Crea sabores globales que pueden asignarse a productos.
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button
            class="btn btn-primary"
            type="button"
            onclick={openCreateFlavorModal}
            disabled={busy}
          >
            Crear sabor
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 class="card-title text-base">Listado de sabores</h4>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
            <div class="dropdown dropdown-right dropdown-center">
              <div
                tabindex="0"
                role="button"
                class="btn btn-sm btn-outline min-w-32 justify-between"
              >
                {flavorActivityFilterLabel}
              </div>
              <ul
                tabindex="-1"
                class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300"
              >
                <li>
                  <button
                    type="button"
                    onclick={() => (flavorActivityFilter = "all")}>Todas</button
                  >
                </li>
                <li>
                  <button
                    type="button"
                    onclick={() => (flavorActivityFilter = "active")}
                    >Activas</button
                  >
                </li>
                <li>
                  <button
                    type="button"
                    onclick={() => (flavorActivityFilter = "inactive")}
                    >Inactivas</button
                  >
                </li>
              </ul>
            </div>
          </div>
          <div class="text-sm text-base-content/70 whitespace-nowrap">
            {filteredFlavors.length} de {flavors.length} sabor(es)
          </div>
        </div>
      </div>

      <div
        class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4"
      >
        <table class="table">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Nombre</th>
              <th class="text-center font-bold">Orden</th>
              <th class="text-center font-bold">Seasonal</th>
              <th class="text-center font-bold">Estado</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredFlavors.length === 0}
              <tr><td colspan="5" class="text-center">No hay sabores</td></tr>
            {:else}
              {#each filteredFlavors as flavor}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>
                    <div class="font-medium">{flavor.name}</div>
                  </td>
                  <td class="text-center align-middle"
                    >{flavor.display_order + 1}</td
                  >
                  <td class="text-center align-middle">
                    <span
                      class={`badge ${flavor.is_seasonal ? "badge-warning" : "badge-ghost"}`}
                    >
                      {flavor.is_seasonal ? "Si" : "No"}
                    </span>
                  </td>
                  <td class="text-center align-middle">
                    <span
                      class={`badge ${flavor.is_active ? "badge-success" : "badge-ghost"}`}
                    >
                      {flavor.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td class="text-center align-middle">
                    <AdminTableRowActions
                      itemName={flavor.name}
                      {busy}
                      canMoveUp={flavorActivityFilter === "all" &&
                        filteredFlavors.findIndex((f) => f.id === flavor.id) >
                          0}
                      canMoveDown={flavorActivityFilter === "all" &&
                        filteredFlavors.findIndex((f) => f.id === flavor.id) <
                          filteredFlavors.length - 1}
                      onEdit={() => editFlavor(flavor)}
                      onDelete={() => requestDeleteFlavor(flavor)}
                      onMoveUp={() => moveFlavor(flavor, -1)}
                      onMoveDown={() => moveFlavor(flavor, 1)}
                    />
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

<AdminModalShell
  bind:dialogRef={flavorEditorDialog}
  title={isEditing ? "Editar sabor" : "Crear sabor"}
  icon="lucide:ice-cream-bowl"
  widthClass="max-w-2xl"
  onClose={closeFlavorEditor}
>
  <form class="space-y-3" onsubmit={submit}>
    <div class="form-control">
      <span id="flavor-name-label" class="label-text text-xs mb-1">Nombre</span>
      <input
        id="flavor-name"
        class="input input-bordered input-sm w-full"
        placeholder="Vainilla"
        bind:value={form.name}
        required
        aria-labelledby="flavor-name-label"
      />
    </div>

    <label
      class="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 px-3 py-2 cursor-pointer"
    >
      <span class="label-text text-sm">Marcar como sabor de temporada</span>
      <input
        id="flavor-seasonal"
        type="checkbox"
        bind:checked={form.is_seasonal}
        class="checkbox checkbox-sm"
      />
    </label>

    {#if isEditing}
      <label
        class="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 px-3 py-2 cursor-pointer"
      >
        <span class="label-text text-sm">Activo</span>
        <input
          id="flavor-active"
          type="checkbox"
          bind:checked={form.is_active}
          class="checkbox checkbox-sm"
        />
      </label>
    {/if}

    <AdminFormActions
      submitLabel={isEditing ? "Actualizar" : "Crear"}
      onCancel={closeFlavorEditor}
      {busy}
    />
  </form>
</AdminModalShell>

<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  {busy}
  variant="error"
  onConfirm={() => confirmDialogNow(confirmDialog)}
  onCancel={() => closeConfirmDialog(confirmDialog)}
/>
