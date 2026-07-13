<script lang="ts">
  import { formatCurrency } from "@shared/utils/formatters";
  import type {
    User,
    UserOrderHistoryItem,
  } from "@features/admin-management/lib/api";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import AdminModalShell from "./shared/AdminModalShell.svelte";
  import AdminFormActions from "./shared/AdminFormActions.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import UserList from "./UserList.svelte";

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
    onUpdate: (
      id: string,
      payload: {
        name: string;
        user_type: "user" | "company";
        phone: string;
        email?: string;
        status: "active" | "inactive";
      },
    ) => void;
    onDelete: (id: string) => void;
    onLoadOrders: (id: string) => void;
  }

  let {
    users,
    busy,
    moduleError,
    historyBusy,
    selectedUserOrders,
    onCreate,
    onUpdate,
    onDelete,
    onLoadOrders,
  }: Props = $props();

  let userEditorDialog = $state<HTMLDialogElement | null>(null);
  let historyDialog = $state<HTMLDialogElement | null>(null);
  let confirmDialog = $state(createConfirmDialogState());
  let editingUserId = $state<string | null>(null);
  let selectedUserName = $state("");

  let pendingToggleUser = $state<User | null>(null);
  let pendingToggleValue = $state(false);

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
    openConfirmDialog(confirmDialog, title, message, action);
  }

  function confirmNow() {
    confirmDialogNow(confirmDialog);
  }

  function closeConfirm() {
    closeConfirmDialog(confirmDialog);
  }

  function requestDelete(user: User) {
    openConfirm(
      "Eliminar usuario",
      `Eliminar permanentemente ${user.name}? Esta accion no se puede deshacer.`,
      () => onDelete(user.id),
    );
  }

  function requestToggleUserStatus(user: User, checked: boolean) {
    const nextStatus = checked ? "active" : "inactive";
    if (nextStatus === user.status) return;
    pendingToggleUser = user;
    pendingToggleValue = checked;
    openConfirm(
      nextStatus === "active" ? "Activar usuario" : "Desactivar usuario",
      `${nextStatus === "active" ? "Activar" : "Desactivar"} ${user.name}?`,
      confirmToggleUserStatus,
    );
  }

  function confirmToggleUserStatus() {
    if (!pendingToggleUser) return;
    const user = pendingToggleUser;
    const nextStatus = pendingToggleValue ? "active" : "inactive";
    pendingToggleUser = null;
    pendingToggleValue = false;

    onUpdate(user.id, {
      name: user.name,
      user_type: user.user_type,
      phone: user.phone,
      email: user.email ?? undefined,
      status: nextStatus,
    });
  }

  function clearPendingToggle() {
    pendingToggleUser = null;
    pendingToggleValue = false;
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

  <UserList
    {users}
    {busy}
    onCreateUser={openCreateUserModal}
    onToggleStatus={requestToggleUserStatus}
    onEdit={editUser}
    onRequestDelete={requestDelete}
    onOpenHistory={openHistory}
  />
</section>

<AdminModalShell
  bind:dialogRef={userEditorDialog}
  title={isEditing ? "Editar usuario" : "Crear usuario"}
  icon="lucide:user"
  widthClass="max-w-3xl"
  onClose={closeUserEditor}
>
  <form class="grid gap-3 md:grid-cols-2" onsubmit={submit}>
    <div class="form-control">
      <span id="user-name-label" class="label-text text-xs mb-1">Nombre</span>
      <input
        id="user-name"
        class="input input-bordered input-sm w-full"
        bind:value={form.name}
        required
        aria-labelledby="user-name-label"
      />
    </div>

    <div class="form-control">
      <span id="user-type-label" class="label-text text-xs mb-1"
        >Tipo de usuario</span
      >
      <select
        id="user-type"
        class="select select-bordered select-sm w-full"
        bind:value={form.user_type}
        aria-labelledby="user-type-label"
      >
        <option value="user">usuario</option>
        <option value="company">empresa</option>
      </select>
    </div>

    <div class="form-control">
      <span id="user-phone-label" class="label-text text-xs mb-1">Telefono</span
      >
      <input
        id="user-phone"
        class="input input-bordered input-sm w-full"
        bind:value={form.phone}
        required
        aria-labelledby="user-phone-label"
      />
    </div>

    <div class="form-control">
      <span id="user-email-label" class="label-text text-xs mb-1"
        >Correo (opcional)</span
      >
      <input
        id="user-email"
        class="input input-bordered input-sm w-full"
        type="email"
        bind:value={form.email}
        aria-labelledby="user-email-label"
      />
    </div>

    <div class="form-control md:col-span-2">
      <span class="label-text text-xs mb-1">Estado</span>
      <label
        class="label h-9 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3"
      >
        <input
          class="toggle toggle-sm"
          type="checkbox"
          checked={form.status === "active"}
          onchange={(event) =>
            (form.status = (event.currentTarget as HTMLInputElement).checked
              ? "active"
              : "inactive")}
          aria-label="Estado de usuario"
        />
        <span class="label-text text-sm"
          >{form.status === "active" ? "Activo" : "Inactivo"}</span
        >
      </label>
    </div>

    <div class="md:col-span-2">
      <AdminFormActions
        submitLabel={isEditing ? "Actualizar" : "Crear"}
        onCancel={closeUserEditor}
        {busy}
      />
    </div>
  </form>
</AdminModalShell>

<AdminModalShell
  bind:dialogRef={historyDialog}
  title={`Historial de ordenes: ${selectedUserName || "Usuario"}`}
  icon="lucide:clock"
  widthClass="max-w-3xl"
  onClose={closeHistory}
>
  <div class="rounded-box border border-base-300 overflow-x-auto">
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
  <div class="flex justify-end">
    <button class="btn btn-ghost btn-sm" type="button" onclick={closeHistory}
      >Cerrar</button
    >
  </div>
</AdminModalShell>

<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  {busy}
  variant="error"
  onConfirm={confirmNow}
  onCancel={() => {
    clearPendingToggle();
    closeConfirm();
  }}
/>
