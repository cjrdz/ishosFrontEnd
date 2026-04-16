<script lang="ts">
    import type { Addon } from "../../../../lib/api/admin";
    import Icon from "@iconify/svelte";
    import { normalizeAddonGroupName, addonGroupLabel } from "../../../../lib/admin/addon-groups";
    import ConfirmDialog from "../shared/ConfirmDialog.svelte";

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

    let { addons, busy, moduleError, onCreate, onUpdate, onDelete }: Props =
        $props();
    let addonEditorDialog: HTMLDialogElement | null = null;
    let confirmOpen = $state(false);
    let confirmTitle = $state("Confirmar accion");
    let confirmMessage = $state("");
    let confirmAction = $state<null | (() => void)>(null);
    let editingAddonId = $state<string | null>(null);

    let form = $state({
        id: "",
        name: "",
        price: 0,
        group_name: "extras",
        display_order: 0,
        is_active: true,
    });

    const DEFAULT_GROUP_NAME = "extras";

    let addonActivityFilter = $state<"all" | "active" | "inactive">("all");
    const filteredAddons = $derived(
        (addonActivityFilter === "all"
            ? addons
            : addons.filter((addon) =>
                  addonActivityFilter === "active"
                      ? addon.is_active
                      : !addon.is_active,
              )
        )
            .slice()
            .sort((left, right) => {
                const leftGroup = normalizeAddonGroupName(left.group_name);
                const rightGroup = normalizeAddonGroupName(right.group_name);

                return (
                    leftGroup.localeCompare(rightGroup) ||
                    left.display_order - right.display_order ||
                    left.name.localeCompare(right.name)
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
        form = {
            id: "",
            name: "",
            price: 0,
            group_name: DEFAULT_GROUP_NAME,
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

    function submit(event: SubmitEvent) {
        event.preventDefault();
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

    function requestDeleteAddon(addon: Addon) {
        openConfirm(
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
                        Crea complementos globales que pueden asignarse a
                        productos con precios personalizados.
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
            <div
                class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
            >
                <h4 class="card-title text-base">Listado de complementos</h4>
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <span class="label-text text-sm whitespace-nowrap"
                            >Mostrar</span
                        >
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
                                        onclick={() =>
                                            (addonActivityFilter = "all")}
                                        >Todas</button
                                    >
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onclick={() =>
                                            (addonActivityFilter = "active")}
                                        >Activas</button
                                    >
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onclick={() =>
                                            (addonActivityFilter = "inactive")}
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
                                ><td colspan="6" class="text-center"
                                    >No hay complementos</td
                                ></tr
                            >
                        {:else}
                            {#each filteredAddons as addon}
                                <tr
                                    class="hover:bg-base-300/40 transition-colors"
                                >
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
                                    <td class="text-center align-middle"
                                        >{addon.display_order}</td
                                    >
                                    <td class="text-center align-middle">
                                        <span
                                            class={`badge ${addon.is_active ? "badge-success" : "badge-ghost"}`}
                                        >
                                            {addon.is_active
                                                ? "Activo"
                                                : "Inactivo"}
                                        </span>
                                    </td>
                                    <td class="text-center align-middle">
                                        <div
                                            class="flex w-full flex-wrap items-center justify-center gap-2"
                                        >
                                            <button
                                                class="btn btn-sm btn-soft btn-accent"
                                                onclick={() => editAddon(addon)}
                                                >Editar</button
                                            >
                                            <button
                                                class="btn btn-sm btn-soft btn-error"
                                                onclick={() =>
                                                    requestDeleteAddon(addon)}
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

<dialog class="modal" bind:this={addonEditorDialog} onclose={resetForm}>
    <div class="modal-box w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-base-200 bg-base-100 px-5 py-4">
            <div class="flex items-center gap-2.5">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon icon="lucide:puzzle" width="16" height="16" class="text-primary" />
                </div>
                <h3 class="font-bold text-base leading-tight">
                    {isEditing ? "Editar complemento" : "Crear complemento"}
                </h3>
            </div>
            <button class="btn btn-ghost btn-sm btn-circle" type="button" onclick={closeAddonEditor} aria-label="Cerrar">
                <Icon icon="lucide:x" width="16" height="16" />
            </button>
        </div>

        <form class="p-5 space-y-5" onsubmit={submit}>
            <div class="grid gap-5">
                <div class="form-control w-full">
                    <span id="addon-name-label" class="label-text mb-1">Nombre</span>
                    <input
                        id="addon-name"
                        class="input input-bordered w-full"
                        placeholder="Choco sprinkles"
                        bind:value={form.name}
                        required
                        aria-labelledby="addon-name-label"
                    />
                </div>

                <div class="form-control w-full">
                    <span id="addon-group-label" class="label-text mb-1">Grupo</span>
                    <input
                        id="addon-group"
                        class="input input-bordered w-full"
                        placeholder="extras"
                        list="addon-group-options"
                        bind:value={form.group_name}
                        required
                        aria-labelledby="addon-group-label"
                    />
                    <datalist id="addon-group-options">
                        <option value="toppings"></option>
                        <option value="jalea"></option>
                        <option value="extras"></option>
                    </datalist>
                </div>

                <div class="form-control w-full">
                    <span id="addon-price-label" class="label-text mb-1">Precio ($)</span>
                    <input
                        id="addon-price"
                        type="number"
                        step="0.01"
                        min="0"
                        class="input input-bordered w-full"
                        placeholder="1.50"
                        bind:value={form.price}
                        aria-labelledby="addon-price-label"
                    />
                </div>

                <div class="form-control w-full">
                    <span id="addon-order-label" class="label-text mb-1">Orden de visualizacion</span>
                    <input
                        id="addon-order"
                        type="number"
                        class="input input-bordered w-full"
                        placeholder="0"
                        bind:value={form.display_order}
                        aria-labelledby="addon-order-label"
                    />
                </div>

                {#if isEditing}
                    <div class="form-control">
                        <label for="addon-active" class="label cursor-pointer">
                            <span class="label-text">Activo</span>
                            <input
                                id="addon-active"
                                type="checkbox"
                                bind:checked={form.is_active}
                                class="checkbox"
                            />
                        </label>
                    </div>
                {/if}
            </div>

            <div class="flex flex-wrap gap-2 pt-1">
                <button class="btn btn-primary" type="submit" disabled={busy || !form.name.trim()}>
                    {isEditing ? "Actualizar" : "Crear"}
                </button>
                <button type="button" class="btn btn-ghost" onclick={closeAddonEditor}>Cancelar</button>
            </div>
        </form>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button type="button" onclick={closeAddonEditor}>close</button>
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
