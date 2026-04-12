<script lang="ts">
  import type { Employee } from "../../../../lib/api/admin";

  interface Props {
    employees: Employee[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: {
      email: string;
      password: string;
      name?: string;
      phone?: string;
      role: "admin" | "employee";
      state: "active" | "inactive";
    }) => void;
    onUpdate: (id: string, payload: {
      email: string;
      password?: string;
      name?: string;
      phone?: string;
      role: "admin" | "employee";
      state: "active" | "inactive";
    }) => void;
    onDelete: (id: string) => void;
  }

  let { employees, busy, moduleError, onCreate, onUpdate, onDelete }: Props = $props();

  let employeeEditorDialog: HTMLDialogElement | null = null;
  let confirmDialog: HTMLDialogElement | null = null;
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let editingEmployeeId = $state<string | null>(null);

  let form = $state({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "employee" as "admin" | "employee",
    state: "active" as "active" | "inactive",
  });

  const isEditing = $derived(!!editingEmployeeId);

  function resetForm() {
    editingEmployeeId = null;
    form = {
      email: "",
      password: "",
      name: "",
      phone: "",
      role: "employee",
      state: "active",
    };
  }

  function openCreateEmployeeModal() {
    resetForm();
    employeeEditorDialog?.showModal();
  }

  function closeEmployeeEditor() {
    employeeEditorDialog?.close();
    resetForm();
  }

  function editEmployee(employee: Employee) {
    editingEmployeeId = employee.id;
    form = {
      email: employee.email,
      password: "",
      name: employee.name || "",
      phone: employee.phone || "",
      role: employee.role,
      state: employee.state === "inactive" ? "inactive" : "active",
    };
    employeeEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();

    if (editingEmployeeId) {
      onUpdate(editingEmployeeId, {
        email: form.email.trim(),
        password: form.password.trim() || undefined,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        role: form.role,
        state: form.state,
      });
      closeEmployeeEditor();
      return;
    }

    onCreate({
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim() || undefined,
      phone: form.phone.trim() || undefined,
      role: form.role,
      state: form.state,
    });
    closeEmployeeEditor();
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

  function toggleEmployeeState(employee: Employee, checked: boolean) {
    const nextState = checked ? "active" : "inactive";
    if (nextState === (employee.state === "inactive" ? "inactive" : "active")) return;

    openConfirm(
      nextState === "active" ? "Activar empleado" : "Desactivar empleado",
      `${nextState === "active" ? "Activar" : "Desactivar"} ${employee.email}?`,
      () =>
        onUpdate(employee.id, {
          email: employee.email,
          name: employee.name || undefined,
          phone: employee.phone || undefined,
          role: employee.role,
          state: nextState,
        }),
    );
  }

  function requestDelete(employee: Employee) {
    openConfirm(
      "Eliminar empleado",
      `Eliminar permanentemente ${employee.email}? Esta accion no se puede deshacer.`,
      () => onDelete(employee.id),
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
          <h2 class="card-title">Gestion de empleados</h2>
          <p class="text-sm text-base-content/70">Crea, edita, desactiva o elimina cuentas de personal.</p>
        </div>
        <button class="btn btn-primary" type="button" onclick={openCreateEmployeeModal} disabled={busy}>
          Crear empleado
        </button>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
      <table class="table">
        <thead class="bg-base-200/60 text-base-content"><tr><th class="font-bold">Email</th><th class="font-bold">Nombre</th><th class="font-bold">Rol</th><th class="font-bold">Estado</th><th class="font-bold"></th></tr></thead>
        <tbody>
          {#if employees.length === 0}
            <tr><td colspan="5" class="text-center">No hay empleados</td></tr>
          {:else}
          {#each employees as employee}
            <tr class="hover:bg-base-300/40 transition-colors">
              <td>{employee.email}</td>
              <td>{employee.name || "-"}</td>
              <td>{employee.role}</td>
              <td>
                <span class={`badge ${employee.state === "inactive" ? "badge-ghost" : "badge-success"}`}>
                  {employee.state || "-"}
                </span>
              </td>
              <td>
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <button class="btn btn-sm btn-soft btn-accent" type="button" onclick={() => editEmployee(employee)}>
                    Editar
                  </button>
                  <label class="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-2 py-1">
                    <input
                      class="toggle toggle-xs"
                      type="checkbox"
                      checked={employee.state !== "inactive"}
                      onchange={(event) => toggleEmployeeState(employee, (event.currentTarget as HTMLInputElement).checked)}
                      disabled={busy}
                    />
                    <span class="label-text text-xs">{employee.state === "inactive" ? "Inactivo" : "Activo"}</span>
                  </label>
                  <button class="btn btn-sm btn-soft btn-error" type="button" onclick={() => requestDelete(employee)}>
                    Eliminar
                  </button>
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

<dialog class="modal" bind:this={employeeEditorDialog} onclose={resetForm}>
  <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-lg">{isEditing ? "Editar empleado" : "Crear empleado"}</h3>
    </div>

    <form class="mt-5 grid gap-6" onsubmit={submit}>
      <div class="grid items-start gap-5 md:grid-cols-2">
        <div class="form-control w-full">
          <span id="employee-email-label" class="label-text mb-1">Correo</span>
          <input id="employee-email" class="input input-bordered w-full" type="email" bind:value={form.email} required aria-labelledby="employee-email-label" />
        </div>

        <div class="form-control w-full">
          <span id="employee-password-label" class="label-text mb-1">Contrasena {isEditing ? "(opcional)" : ""}</span>
          <input
            id="employee-password"
            class="input input-bordered w-full"
            type="password"
            bind:value={form.password}
            required={!isEditing}
            minlength={isEditing ? undefined : 8}
            aria-labelledby="employee-password-label"
          />
        </div>

        <div class="form-control w-full">
          <span id="employee-name-label" class="label-text mb-1">Nombre</span>
          <input id="employee-name" class="input input-bordered w-full" bind:value={form.name} aria-labelledby="employee-name-label" />
        </div>

        <div class="form-control w-full">
          <span id="employee-phone-label" class="label-text mb-1">Telefono</span>
          <input id="employee-phone" class="input input-bordered w-full" bind:value={form.phone} aria-labelledby="employee-phone-label" />
        </div>

        <div class="form-control w-full">
          <span id="employee-role-label" class="label-text mb-1">Rol</span>
          <select id="employee-role" class="select select-bordered w-full" bind:value={form.role} aria-labelledby="employee-role-label">
            <option value="employee">employee</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div class="form-control w-full">
          <span class="label-text mb-1">Estado</span>
          <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
            <input
              class="toggle toggle-sm"
              type="checkbox"
              checked={form.state === "active"}
              onchange={(event) => (form.state = (event.currentTarget as HTMLInputElement).checked ? "active" : "inactive")}
              aria-label="Estado del empleado"
            />
            <span class="label-text">{form.state === "active" ? "Activo" : "Inactivo"}</span>
          </label>
        </div>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary" type="submit" disabled={busy}>
          {isEditing ? "Actualizar" : "Crear"}
        </button>
        <button class="btn btn-ghost" type="button" onclick={closeEmployeeEditor}>Cancelar</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeEmployeeEditor}>close</button>
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
