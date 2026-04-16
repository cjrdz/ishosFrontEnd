<script lang="ts">
  import type { Flavor } from "../../../../lib/api/admin";
  import Icon from "@iconify/svelte";
  import ConfirmDialog from "../shared/ConfirmDialog.svelte";

  interface Props {
    flavors: Flavor[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: {
      name: string;
      display_order: number;
      is_seasonal: boolean;
    }) => void;
    onUpdate: (id: string, payload: {
      name: string;
      display_order: number;
      is_seasonal: boolean;
      is_active: boolean;
    }) => void;
    onDelete: (id: string) => void;
  }

  let { flavors, busy, moduleError, onCreate, onUpdate, onDelete }: Props = $props();
  let flavorEditorDialog: HTMLDialogElement | null = null;
  let confirmOpen = $state(false);
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
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
    flavorActivityFilter === "all"
      ? flavors
      : flavors.filter((flavor) =>
          flavorActivityFilter === "active" ? flavor.is_active : !flavor.is_active,
        ),
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
    const payload = {
      name: form.name.trim(),
      display_order: Number(form.display_order),
      is_seasonal: Boolean(form.is_seasonal),
      is_active: Boolean(form.is_active),
    };

    if (form.id) {
      onUpdate(form.id, payload);
    } else {
      onCreate({ name: payload.name, display_order: payload.display_order, is_seasonal: payload.is_seasonal });
    }

    closeFlavorEditor();
  }

  function openConfirm(title: string, message: string, action: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmAction = action;
    confirmOpen = true;
  }

  function confirmNow() {
    const action = confirmAction;
    confirmAction = null;
    confirmOpen = false;
    if (action) action();
  }

  function closeConfirm() {
    confirmAction = null;
    confirmOpen = false;
  }

  function requestDeleteFlavor(flavor: Flavor) {
    openConfirm(
      "Eliminar sabor",
      `Seguro que deseas eliminar ${flavor.name}?`,
      () => onDelete(flavor.id),
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
          <h2 class="card-title">Gestion de sabores</h2>
          <p class="text-sm text-base-content/70">Crea sabores globales que pueden asignarse a productos.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button class="btn btn-primary" type="button" onclick={openCreateFlavorModal} disabled={busy}>
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
              <div tabindex="0" role="button" class="btn btn-sm btn-outline min-w-32 justify-between">
                {flavorActivityFilterLabel}
              </div>
              <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300">
                <li><button type="button" onclick={() => (flavorActivityFilter = "all")}>Todas</button></li>
                <li><button type="button" onclick={() => (flavorActivityFilter = "active")}>Activas</button></li>
                <li><button type="button" onclick={() => (flavorActivityFilter = "inactive")}>Inactivas</button></li>
              </ul>
            </div>
          </div>
          <div class="text-sm text-base-content/70 whitespace-nowrap">{filteredFlavors.length} de {flavors.length} sabor(es)</div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
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
                <td class="text-center align-middle">{flavor.display_order}</td>
                <td class="text-center align-middle">
                  <span class={`badge ${flavor.is_seasonal ? "badge-warning" : "badge-ghost"}`}>
                    {flavor.is_seasonal ? "Si" : "No"}
                  </span>
                </td>
                <td class="text-center align-middle">
                  <span class={`badge ${flavor.is_active ? "badge-success" : "badge-ghost"}`}>
                    {flavor.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td class="text-center align-middle">
                  <div class="flex w-full flex-wrap items-center justify-center gap-2">
                    <button class="btn btn-sm btn-soft btn-accent" onclick={() => editFlavor(flavor)}>Editar</button>
                    <button class="btn btn-sm btn-soft btn-error" onclick={() => requestDeleteFlavor(flavor)}>Eliminar</button>
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

<dialog class="modal" bind:this={flavorEditorDialog} onclose={resetForm}>
  <div class="modal-box w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto p-0">
    <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4">
      <div class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon icon="lucide:ice-cream-bowl" width="16" height="16" class="text-primary" />
        </div>
        <h3 class="font-bold text-base leading-tight">{isEditing ? "Editar sabor" : "Crear sabor"}</h3>
      </div>
      <button class="btn btn-ghost btn-sm btn-circle" type="button" onclick={closeFlavorEditor} aria-label="Cerrar">
        <Icon icon="lucide:x" width="16" height="16" />
      </button>
    </div>

    <form class="p-5 space-y-5" onsubmit={submit}>
      <div class="grid gap-5">
        <div class="form-control w-full">
          <span id="flavor-name-label" class="label-text mb-1">Nombre</span>
          <input id="flavor-name" class="input input-bordered w-full" placeholder="Vainilla" bind:value={form.name} required aria-labelledby="flavor-name-label" />
        </div>

        <div class="form-control w-full">
          <span id="flavor-order-label" class="label-text mb-1">Orden de visualizacion</span>
          <input id="flavor-order" type="number" class="input input-bordered w-full" placeholder="0" bind:value={form.display_order} aria-labelledby="flavor-order-label" />
        </div>

        <div class="form-control">
          <label for="flavor-seasonal" class="label cursor-pointer">
            <span class="label-text">Marcar como sabor de temporada</span>
            <input id="flavor-seasonal" type="checkbox" bind:checked={form.is_seasonal} class="checkbox" />
          </label>
        </div>

        {#if isEditing}
          <div class="form-control">
            <label for="flavor-active" class="label cursor-pointer">
              <span class="label-text">Activo</span>
              <input id="flavor-active" type="checkbox" bind:checked={form.is_active} class="checkbox" />
            </label>
          </div>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2 pt-1">
        <button class="btn btn-primary" type="submit" disabled={busy || !form.name.trim()}>
          {isEditing ? "Actualizar" : "Crear"}
        </button>
        <button type="button" class="btn btn-ghost" onclick={closeFlavorEditor}>Cancelar</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeFlavorEditor}>close</button>
  </form>
</dialog>

<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  busy={busy}
  variant="error"
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>
