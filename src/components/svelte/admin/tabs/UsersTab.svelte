<script lang="ts">
  import { formatCurrency } from "../../../../lib/utils/formatters";
  import type { User, UserOrderHistoryItem } from "../../../../lib/api/admin";

  interface Props {
    users: User[];
    busy: boolean;
    moduleError: string;
    historyBusy: boolean;
    selectedUserOrders: UserOrderHistoryItem[];
    onCreate: (payload: {
      name: string;
      user_type: "user" | "company";
      phone: string;
      email?: string;
      status: "active" | "inactive";
    }) => void;
    onUpdate: (id: string, payload: {
      name: string;
      user_type: "user" | "company";
      phone: string;
      email?: string;
      status: "active" | "inactive";
    }) => void;
    onDelete: (id: string) => void;
    onLoadOrders: (id: string) => void;
  }

  let { users, busy, moduleError, historyBusy, selectedUserOrders, onCreate, onUpdate, onDelete, onLoadOrders }: Props = $props();

  let userEditorDialog: HTMLDialogElement | null = null;
  let historyDialog: HTMLDialogElement | null = null;
  let confirmDialog: HTMLDialogElement | null = null;
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let editingUserId = $state<string | null>(null);
  let selectedUserName = $state("");

  let form = $state({
    name: "",
    user_type: "user" as "user" | "company",
    phone: "",
    email: "",
    status: "active" as "active" | "inactive",
  });

  const isEditing = $derived(!!editingUserId);

  function resetForm() {
    editingUserId = null;
    form = {
      name: "",
      user_type: "user",
      phone: "",
      email: "",
      status: "active",
    };
  }

  function openCreateUserModal() {
    resetForm();
    userEditorDialog?.showModal();
  }

  function closeUserEditor() {
    userEditorDialog?.close();
    resetForm();
  }

  function editUser(user: User) {
    editingUserId = user.id;
    form = {
      name: user.name,
      user_type: user.user_type,
      phone: user.phone,
      email: user.email ?? "",
      status: user.status,
    };
    userEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      user_type: form.user_type,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      status: form.status,
    };

    if (editingUserId) {
      onUpdate(editingUserId, payload);
      closeUserEditor();
      return;
    }

    onCreate(payload);
    closeUserEditor();
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

  function requestDelete(user: User) {
    openConfirm(
      "Eliminar usuario",
      `Eliminar permanentemente ${user.name}? Esta accion no se puede deshacer.`,
      () => onDelete(user.id),
    );
  }

  function openHistory(user: User) {
    selectedUserName = user.name;
    onLoadOrders(user.id);
    historyDialog?.showModal();
  }

  function closeHistory() {
    selectedUserName = "";
    historyDialog?.close();
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
          <h2 class="card-title">Gestion de usuarios</h2>
          <p class="text-sm text-base-content/70">Directorio de clientes para persona o empresa con historial de ordenes.</p>
        </div>
        <button class="btn btn-primary" type="button" onclick={openCreateUserModal} disabled={busy}>
          Crear usuario
        </button>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table class="table">
          <thead class="bg-base-200/60 text-base-content">
            <tr>
              <th class="font-bold">Nombre</th>
              <th class="font-bold">Tipo</th>
              <th class="font-bold">Telefono</th>
              <th class="font-bold">Correo</th>
              <th class="font-bold">Estado</th>
              <th class="font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {#if users.length === 0}
              <tr><td colspan="6" class="text-center">No hay usuarios</td></tr>
            {:else}
              {#each users as user}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>{user.name}</td>
                  <td>{user.user_type === "company" ? "empresa" : "usuario"}</td>
                  <td>{user.phone}</td>
                  <td>{user.email || "-"}</td>
                  <td>
                    <span class={`badge ${user.status === "inactive" ? "badge-ghost" : "badge-success"}`}>
                      {user.status === "inactive" ? "inactivo" : "activo"}
                    </span>
                  </td>
                  <td>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <button class="btn btn-sm btn-soft" type="button" onclick={() => openHistory(user)}>Historial</button>
                      <button class="btn btn-sm btn-soft btn-accent" type="button" onclick={() => editUser(user)}>Editar</button>
                      <button class="btn btn-sm btn-soft btn-error" type="button" onclick={() => requestDelete(user)}>Eliminar</button>
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

<dialog class="modal" bind:this={userEditorDialog} onclose={resetForm}>
  <div class="modal-box w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto">
    <h3 class="font-bold text-lg">{isEditing ? "Editar usuario" : "Crear usuario"}</h3>

    <form class="mt-5 grid gap-6" onsubmit={submit}>
      <div class="grid items-start gap-5 md:grid-cols-2">
        <div class="form-control w-full">
          <span id="user-name-label" class="label-text mb-1">Nombre</span>
          <input id="user-name" class="input input-bordered w-full" bind:value={form.name} required aria-labelledby="user-name-label" />
        </div>

        <div class="form-control w-full">
          <span id="user-type-label" class="label-text mb-1">Tipo de usuario</span>
          <select id="user-type" class="select select-bordered w-full" bind:value={form.user_type} aria-labelledby="user-type-label">
            <option value="user">usuario</option>
            <option value="company">empresa</option>
          </select>
        </div>

        <div class="form-control w-full">
          <span id="user-phone-label" class="label-text mb-1">Telefono</span>
          <input id="user-phone" class="input input-bordered w-full" bind:value={form.phone} required aria-labelledby="user-phone-label" />
        </div>

        <div class="form-control w-full">
          <span id="user-email-label" class="label-text mb-1">Correo (opcional)</span>
          <input id="user-email" class="input input-bordered w-full" type="email" bind:value={form.email} aria-labelledby="user-email-label" />
        </div>

        <div class="form-control w-full md:col-span-2">
          <span class="label-text mb-1">Estado</span>
          <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
            <input
              class="toggle toggle-sm"
              type="checkbox"
              checked={form.status === "active"}
              onchange={(event) => (form.status = (event.currentTarget as HTMLInputElement).checked ? "active" : "inactive")}
              aria-label="Estado de usuario"
            />
            <span class="label-text">{form.status === "active" ? "Activo" : "Inactivo"}</span>
          </label>
        </div>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary" type="submit" disabled={busy}>
          {isEditing ? "Actualizar" : "Crear"}
        </button>
        <button class="btn btn-ghost" type="button" onclick={closeUserEditor}>Cancelar</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeUserEditor}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={historyDialog}>
  <div class="modal-box max-w-3xl">
    <h3 class="font-bold text-lg">Historial de ordenes: {selectedUserName || "Usuario"}</h3>
    <div class="mt-4 rounded-box border border-base-300 overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Orden</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {#if historyBusy}
            <tr><td colspan="4">Cargando historial...</td></tr>
          {:else if selectedUserOrders.length === 0}
            <tr><td colspan="4">Sin ordenes registradas</td></tr>
          {:else}
            {#each selectedUserOrders as order}
              <tr>
                <td>{order.order_number}</td>
                <td>{order.status}</td>
                <td>{formatCurrency(order.total_amount)}</td>
                <td>{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    <div class="modal-action">
      <button class="btn btn-ghost" type="button" onclick={closeHistory}>Cerrar</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeHistory}>close</button>
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
