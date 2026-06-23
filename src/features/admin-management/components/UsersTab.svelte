<script lang="ts">
  import { formatCurrency } from "@shared/utils/formatters";
  import { getCurrentRowsPerTable } from "@features/admin-management";
  import type {
    User,
    UserOrderHistoryItem,
  } from "@features/admin-management/lib/api";
  import Icon from "@shared/components/AppIcon.svelte";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import AdminModalShell from "./shared/AdminModalShell.svelte";
  import AdminFormActions from "./shared/AdminFormActions.svelte";

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
  let confirmOpen = $state(false);
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let editingUserId = $state<string | null>(null);
  let selectedUserName = $state("");

  let userStatusFilter = $state<"all" | "active" | "inactive">("all");
  const filteredUsers = $derived(
    userStatusFilter === "all"
      ? users
      : users.filter((user) =>
          userStatusFilter === "active"
            ? user.status === "active"
            : user.status === "inactive",
        ),
  );
  const userStatusFilterLabel = $derived(
    userStatusFilter === "all"
      ? "Todos"
      : userStatusFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let userRowLimit = $state<number>(5);

  $effect(() => {
    userRowLimit = getCurrentRowsPerTable("usuarios");
  });

  const visibleUsers = $derived(
    userRowLimit <= 0 ? filteredUsers : filteredUsers.slice(0, userRowLimit),
  );

  const userRowLimitLabel = $derived(
    userRowLimit <= 0 ? "Todos" : String(userRowLimit),
  );

  function setUserRowLimit(limit: number) {
    userRowLimit = limit;
  }

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
    <div class="card-body gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="card-title shrink-0 mr-1">Usuarios</h2>

        <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

        <div class="dropdown w-full sm:w-auto dropdown-bottom">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm btn-outline w-full sm:w-40 justify-between"
          >
            {userStatusFilterLabel}
            <span class="opacity-50">▼</span>
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-52 p-2 mt-1 shadow-xl border border-base-300"
          >
            <li>
              <button type="button" onclick={() => (userStatusFilter = "all")}
                >Todos</button
              >
            </li>
            <li>
              <button
                type="button"
                onclick={() => (userStatusFilter = "active")}>Activos</button
              >
            </li>
            <li>
              <button
                type="button"
                onclick={() => (userStatusFilter = "inactive")}
                >Inactivos</button
              >
            </li>
          </ul>
        </div>

        <div class="dropdown w-full sm:w-auto dropdown-bottom">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm btn-outline w-full sm:w-24 justify-between"
          >
            {userRowLimitLabel}
            <span class="opacity-50">▼</span>
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
          >
            {#each rowLimitOptions as option}
              <li>
                <button type="button" onclick={() => setUserRowLimit(option)}
                  >{option}</button
                >
              </li>
            {/each}
            <li>
              <button type="button" onclick={() => setUserRowLimit(0)}
                >Todos</button
              >
            </li>
          </ul>
        </div>

        <div
          class="flex items-center gap-1.5 text-sm text-base-content/80 font-medium shrink-0"
        >
          <span
            class="badge badge-info badge-sm font-semibold rounded-md text-white!"
            >{filteredUsers.length}</span
          >
          <span>usuarios</span>
        </div>

        <button
          class="btn btn-sm btn-primary shrink-0 ml-auto"
          type="button"
          onclick={openCreateUserModal}
          disabled={busy}
        >
          + Crear usuario
        </button>
      </div>

      <div
        class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
      >
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
            {#if filteredUsers.length === 0}
              <tr
                ><td colspan="6" class="text-center py-6 text-base-content/50"
                  >No hay usuarios</td
                ></tr
              >
            {:else}
              {#each visibleUsers as user}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>{user.name}</td>
                  <td>{user.user_type === "company" ? "empresa" : "usuario"}</td
                  >
                  <td>{user.phone}</td>
                  <td>{user.email || "-"}</td>
                  <td>
                    <span
                      class={`badge ${user.status === "inactive" ? "badge-ghost" : "badge-success"}`}
                    >
                      {user.status === "inactive" ? "inactivo" : "activo"}
                    </span>
                  </td>
                  <td>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <button
                        class="btn btn-sm btn-soft"
                        type="button"
                        onclick={() => openHistory(user)}>Historial</button
                      >
                      <button
                        class="btn btn-sm btn-soft btn-accent"
                        type="button"
                        onclick={() => editUser(user)}>Editar</button
                      >
                      <button
                        class="btn btn-sm btn-soft btn-error"
                        type="button"
                        onclick={() => requestDelete(user)}>Eliminar</button
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
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  {busy}
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>
