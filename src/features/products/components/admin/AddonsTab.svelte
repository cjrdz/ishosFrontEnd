<script lang="ts">
  import type { Addon } from "@features/admin-management";
  import AdminModalShell from "@features/admin-management/components/shared/AdminModalShell.svelte";
  import AdminFormActions from "@features/admin-management/components/shared/AdminFormActions.svelte";
  import {
    addonGroupLabel,
    collectAddonGroupOptions,
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    normalizeAddonGroupName,
    openConfirmDialog,
    PRIMARY_ADDON_GROUPS,
    sortByDisplayOrderAndName,
  } from "@features/products";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";

  interface Props {
    addons: Addon[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: {
      name: string;
      price: number;
      group_name: string;
      display_order: number;
    }) => void;
    onUpdate: (
      id: string,
      payload: {
        name: string;
        price: number;
        group_name: string;
        display_order: number;
        is_active: boolean;
      },
    ) => void;
    onDelete: (id: string) => void;
  }

  type AddonFormState = {
    id: string;
    name: string;
    price: number;
    group_name: string;
    display_order: number;
    is_active: boolean;
  };

  let { addons, busy, moduleError, onCreate, onUpdate, onDelete }: Props =
    $props();
  let addonEditorDialog = $state<HTMLDialogElement | null>(null);
  let confirmDialog = $state(createConfirmDialogState());
  let editingAddonId = $state<string | null>(null);
  let customGroups = $state<string[]>([]);
  let customGroupName = $state("");
  let selectingCustomGroup = $state(false);
  const CUSTOM_GROUP_OPTION = "__custom_group__";

  let form = $state<AddonFormState>({
    id: "",
    name: "",
    price: 0,
    group_name: PRIMARY_ADDON_GROUPS[0],
    display_order: 0,
    is_active: true,
  });
  const addonGroupOptions = $derived(
    collectAddonGroupOptions(addons, customGroups),
  );

  let addonActivityFilter = $state<"all" | "active" | "inactive">("all");
  const filteredAddons = $derived(
    (addonActivityFilter === "all"
      ? addons
      : addons.filter((addon) =>
          addonActivityFilter === "active" ? addon.is_active : !addon.is_active,
        )
    )
      .slice()
      .sort((left, right) => {
        const leftGroup = normalizeAddonGroupName(left.group_name);
        const rightGroup = normalizeAddonGroupName(right.group_name);

        return (
          leftGroup.localeCompare(rightGroup) ||
          sortByDisplayOrderAndName(left, right)
        );
      }),
  );
  const addonActivityFilterLabel = $derived(
    addonActivityFilter === "all"
      ? "Todas"
      : addonActivityFilter === "active"
        ? "Activas"
        : "Inactivas",
  );

  const isEditing = $derived(!!editingAddonId);

  function resetForm() {
    editingAddonId = null;
    selectingCustomGroup = false;
    customGroupName = "";
    form = {
      id: "",
      name: "",
      price: 0,
      group_name: PRIMARY_ADDON_GROUPS[0],
      display_order: 0,
      is_active: true,
    };
  }

  function openCreateAddonModal() {
    resetForm();
    addonEditorDialog?.showModal();
  }

  function closeAddonEditor() {
    addonEditorDialog?.close();
    resetForm();
  }

  function editAddon(addon: Addon) {
    editingAddonId = addon.id;
    selectingCustomGroup = false;
    customGroupName = "";
    form = {
      id: addon.id,
      name: addon.name,
      price: addon.price,
      group_name: normalizeAddonGroupName(addon.group_name),
      display_order: addon.display_order,
      is_active: addon.is_active,
    };
    addonEditorDialog?.showModal();
  }

  function normalizeCustomGroupValue(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return normalizeAddonGroupName(trimmed);
  }

  function selectAddonGroup(event: Event) {
    const selected = (event.currentTarget as HTMLSelectElement).value;
    if (selected === CUSTOM_GROUP_OPTION) {
      selectingCustomGroup = true;
      return;
    }

    selectingCustomGroup = false;
    customGroupName = "";
    form.group_name = selected;
  }

  function addCustomGroup() {
    const normalized = normalizeCustomGroupValue(customGroupName);
    if (!normalized) {
      return;
    }

    if (!addonGroupOptions.includes(normalized)) {
      customGroups = [...customGroups, normalized];
    }

    form.group_name = normalized;
    selectingCustomGroup = false;
    customGroupName = "";
  }

  function applyPendingCustomGroup() {
    if (!selectingCustomGroup) {
      return;
    }

    addCustomGroup();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    applyPendingCustomGroup();
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      group_name: normalizeAddonGroupName(form.group_name),
      display_order: Number(form.display_order),
      is_active: Boolean(form.is_active),
    };

    if (form.id) {
      onUpdate(form.id, payload);
    } else {
      onCreate({
        name: payload.name,
        price: payload.price,
        group_name: payload.group_name,
        display_order: payload.display_order,
      });
    }

    closeAddonEditor();
  }

  function requestDeleteAddon(addon: Addon) {
    openConfirmDialog(
      confirmDialog,
      "Eliminar complemento",
      `Seguro que deseas eliminar ${addon.name}?`,
      () => onDelete(addon.id),
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
          <h2 class="card-title">Gestion de complementos</h2>
          <p class="text-sm text-base-content/70">
            Crea complementos globales que pueden asignarse a productos con
            precios personalizados.
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <button
            class="btn btn-primary"
            type="button"
            onclick={openCreateAddonModal}
            disabled={busy}
          >
            Crear complemento
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 class="card-title text-base">Listado de complementos</h4>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="label-text text-sm whitespace-nowrap">Mostrar</span>
            <div class="dropdown dropdown-right dropdown-center">
              <div
                tabindex="0"
                role="button"
                class="btn btn-sm btn-outline min-w-32 justify-between"
              >
                {addonActivityFilterLabel}
              </div>
              <ul
                tabindex="-1"
                class="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300"
              >
                <li>
                  <button
                    type="button"
                    onclick={() => (addonActivityFilter = "all")}>Todas</button
                  >
                </li>
                <li>
                  <button
                    type="button"
                    onclick={() => (addonActivityFilter = "active")}
                    >Activas</button
                  >
                </li>
                <li>
                  <button
                    type="button"
                    onclick={() => (addonActivityFilter = "inactive")}
                    >Inactivas</button
                  >
                </li>
              </ul>
            </div>
          </div>
          <div class="text-sm text-base-content/70 whitespace-nowrap">
            {filteredAddons.length} de {addons.length} complemento(s)
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
              <th class="text-center font-bold">Precio</th>
              <th class="text-center font-bold">Grupo</th>
              <th class="text-center font-bold">Orden</th>
              <th class="text-center font-bold">Estado</th>
              <th class="text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredAddons.length === 0}
              <tr
                ><td colspan="6" class="text-center">No hay complementos</td
                ></tr
              >
            {:else}
              {#each filteredAddons as addon}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>
                    <div class="font-medium">
                      {addon.name}
                    </div>
                  </td>
                  <td class="text-center align-middle"
                    >S/. {addon.price.toFixed(2)}</td
                  >
                  <td class="text-center align-middle"
                    ><span class="badge badge-outline"
                      >{addonGroupLabel(addon.group_name)}</span
                    ></td
                  >
                  <td class="text-center align-middle">{addon.display_order}</td
                  >
                  <td class="text-center align-middle">
                    <span
                      class={`badge ${addon.is_active ? "badge-success" : "badge-ghost"}`}
                    >
                      {addon.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td class="text-center align-middle">
                    <div
                      class="flex w-full flex-wrap items-center justify-center gap-2"
                    >
                      <button
                        class="btn btn-sm btn-soft btn-accent"
                        onclick={() => editAddon(addon)}>Editar</button
                      >
                      <button
                        class="btn btn-sm btn-soft btn-error"
                        onclick={() => requestDeleteAddon(addon)}
                        >Eliminar</button
                      >
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

<AdminModalShell
  bind:dialogRef={addonEditorDialog}
  title={isEditing ? "Editar complemento" : "Crear complemento"}
  icon="lucide:puzzle"
  widthClass="max-w-2xl"
  onClose={closeAddonEditor}
>
  <form class="space-y-3" onsubmit={submit}>
    <div class="form-control">
      <span id="addon-name-label" class="label-text text-xs mb-1">Nombre</span>
      <input
        id="addon-name"
        class="input input-bordered input-sm w-full"
        placeholder="Choco sprinkles"
        bind:value={form.name}
        required
        aria-labelledby="addon-name-label"
      />
    </div>

    <div class="form-control">
      <span id="addon-group-label" class="label-text text-xs mb-1">Grupo</span>
      <select
        id="addon-group"
        class="select select-bordered select-sm w-full"
        value={selectingCustomGroup
          ? CUSTOM_GROUP_OPTION
          : normalizeAddonGroupName(form.group_name)}
        onchange={selectAddonGroup}
        aria-labelledby="addon-group-label"
      >
        {#each addonGroupOptions as groupName}
          <option value={groupName}>{addonGroupLabel(groupName)}</option>
        {/each}
        <option value={CUSTOM_GROUP_OPTION}>+ Agregar nuevo grupo</option>
      </select>

      {#if selectingCustomGroup}
        <div class="mt-2 flex items-center gap-2">
          <input
            class="input input-bordered input-sm w-full"
            placeholder="Ej. Frutas"
            bind:value={customGroupName}
          />
          <button
            type="button"
            class="btn btn-outline btn-sm"
            onclick={addCustomGroup}
            disabled={!customGroupName.trim()}
          >
            Agregar
          </button>
        </div>
      {/if}
    </div>

    <div class="form-control">
      <span id="addon-price-label" class="label-text text-xs mb-1"
        >Precio ($)</span
      >
      <input
        id="addon-price"
        type="number"
        step="0.01"
        min="0"
        class="input input-bordered input-sm w-full"
        placeholder="1.50"
        bind:value={form.price}
        aria-labelledby="addon-price-label"
      />
    </div>

    <div class="form-control">
      <span id="addon-order-label" class="label-text text-xs mb-1"
        >Orden de visualizacion</span
      >
      <input
        id="addon-order"
        type="number"
        class="input input-bordered input-sm w-full"
        placeholder="0"
        bind:value={form.display_order}
        aria-labelledby="addon-order-label"
      />
    </div>

    {#if isEditing}
      <label
        class="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 px-3 py-2 cursor-pointer"
      >
        <span class="label-text text-sm">Activo</span>
        <input
          id="addon-active"
          type="checkbox"
          bind:checked={form.is_active}
          class="checkbox checkbox-sm"
        />
      </label>
    {/if}

    <AdminFormActions
      submitLabel={isEditing ? "Actualizar" : "Crear"}
      onCancel={closeAddonEditor}
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
