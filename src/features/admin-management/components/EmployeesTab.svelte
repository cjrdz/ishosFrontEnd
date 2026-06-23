<script lang="ts">
  import type { Employee } from "@features/admin-management/lib/api";
  import { getCurrentRowsPerTable } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import AdminModalShell from "./shared/AdminModalShell.svelte";
  import AdminFormActions from "./shared/AdminFormActions.svelte";

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
    onUpdate: (
      id: string,
      payload: {
        email: string;
        password?: string;
        name?: string;
        phone?: string;
        role: "admin" | "employee";
        state: "active" | "inactive";
      },
    ) => void;
    onDelete: (id: string) => void;
    resetLoginLockout: (payload: {
      employee_id?: string;
      email?: string;
    }) => void;
  }

  let {
    employees,
    busy,
    moduleError,
    onCreate,
    onUpdate,
    onDelete,
    resetLoginLockout,
  }: Props = $props();

  let employeeEditorDialog = $state<HTMLDialogElement | null>(null);
  let lockoutResetDialog = $state<HTMLDialogElement | null>(null);
  let confirmOpen = $state(false);
  let confirmTitle = $state("Confirmar accion");
  let confirmMessage = $state("");
  let confirmAction = $state<null | (() => void)>(null);
  let editingEmployeeId = $state<string | null>(null);

  let employeeStateFilter = $state<"all" | "active" | "inactive">("all");
  const filteredEmployees = $derived(
    employeeStateFilter === "all"
      ? employees
      : employees.filter((employee) =>
          employeeStateFilter === "active"
            ? employee.state === "active"
            : employee.state === "inactive",
        ),
  );
  const employeeStateFilterLabel = $derived(
    employeeStateFilter === "all"
      ? "Todos"
      : employeeStateFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let employeeRowLimit = $state<number>(5);

  $effect(() => {
    employeeRowLimit = getCurrentRowsPerTable("empleados");
  });

  const visibleEmployees = $derived(
    employeeRowLimit <= 0
      ? filteredEmployees
      : filteredEmployees.slice(0, employeeRowLimit),
  );

  const employeeRowLimitLabel = $derived(
    employeeRowLimit <= 0 ? "Todos" : String(employeeRowLimit),
  );

  function setEmployeeRowLimit(limit: number) {
    employeeRowLimit = limit;
  }

  let form = $state({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "employee" as "admin" | "employee",
    state: "active" as "active" | "inactive",
  });

  const isEditing = $derived(!!editingEmployeeId);
  let lockoutResetForm = $state({
    employeeID: "",
  });

  const lockoutCandidateEmployees = $derived(
    [...employees].sort((a, b) => a.email.localeCompare(b.email)),
  );

  const selectedLockoutEmployee = $derived(
    lockoutCandidateEmployees.find(
      (employee) => employee.id === lockoutResetForm.employeeID,
    ) || null,
  );

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

  function toggleEmployeeState(employee: Employee, checked: boolean) {
    const nextState = checked ? "active" : "inactive";
    if (nextState === (employee.state === "inactive" ? "inactive" : "active"))
      return;

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

  function openLockoutResetModal() {
    const firstEmployeeID = lockoutCandidateEmployees[0]?.id || "";
    lockoutResetForm = { employeeID: firstEmployeeID };
    lockoutResetDialog?.showModal();
  }

  function closeLockoutResetModal() {
    lockoutResetDialog?.close();
    lockoutResetForm = { employeeID: "" };
  }

  function submitLockoutReset(event: SubmitEvent) {
    event.preventDefault();

    if (!selectedLockoutEmployee) {
      return;
    }

    openConfirm(
      "Confirmar desbloqueo",
      "Vas a restablecer el bloqueo de login del empleado seleccionado. Deseas continuar?",
      () => {
        resetLoginLockout({
          employee_id: selectedLockoutEmployee.id,
          email: selectedLockoutEmployee.email,
        });
        closeLockoutResetModal();
      },
    );
  }
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="card-title shrink-0 mr-1">Empleados</h2>

        <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

        <div class="dropdown w-full sm:w-auto dropdown-bottom">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm btn-outline w-full sm:w-40 justify-between"
          >
            {employeeStateFilterLabel}
            <span class="opacity-50">▼</span>
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-52 p-2 mt-1 shadow-xl border border-base-300"
          >
            <li>
              <button
                type="button"
                onclick={() => (employeeStateFilter = "all")}>Todos</button
              >
            </li>
            <li>
              <button
                type="button"
                onclick={() => (employeeStateFilter = "active")}>Activos</button
              >
            </li>
            <li>
              <button
                type="button"
                onclick={() => (employeeStateFilter = "inactive")}
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
            {employeeRowLimitLabel}
            <span class="opacity-50">▼</span>
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
          >
            {#each rowLimitOptions as option}
              <li>
                <button
                  type="button"
                  onclick={() => setEmployeeRowLimit(option)}>{option}</button
                >
              </li>
            {/each}
            <li>
              <button type="button" onclick={() => setEmployeeRowLimit(0)}
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
            >{filteredEmployees.length}</span
          >
          <span>empleados</span>
        </div>

        <button
          class="btn btn-sm btn-soft btn-warning shrink-0"
          type="button"
          onclick={openLockoutResetModal}
          disabled={busy}
        >
          Desbloquear usuario
        </button>

        <button
          class="btn btn-sm btn-primary shrink-0 ml-auto"
          type="button"
          onclick={openCreateEmployeeModal}
          disabled={busy}
        >
          + Crear empleado
        </button>
      </div>

      <div
        class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
      >
        <table class="table">
          <thead class="bg-base-200/60 text-base-content"
            ><tr
              ><th class="font-bold">Email</th><th class="font-bold">Nombre</th
              ><th class="font-bold">Rol</th><th class="font-bold">Estado</th
              ><th class="font-bold"></th></tr
            ></thead
          >
          <tbody>
            {#if filteredEmployees.length === 0}
              <tr
                ><td colspan="5" class="text-center py-6 text-base-content/50"
                  >No hay empleados</td
                ></tr
              >
            {:else}
              {#each visibleEmployees as employee}
                <tr class="hover:bg-base-300/40 transition-colors">
                  <td>{employee.email}</td>
                  <td>{employee.name || "-"}</td>
                  <td>{employee.role}</td>
                  <td>
                    <span
                      class={`badge ${employee.state === "inactive" ? "badge-ghost" : "badge-success"}`}
                    >
                      {employee.state || "-"}
                    </span>
                  </td>
                  <td>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <button
                        class="btn btn-sm btn-soft btn-accent"
                        type="button"
                        onclick={() => editEmployee(employee)}
                      >
                        Editar
                      </button>
                      <label
                        class="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-2 py-1"
                      >
                        <input
                          class="toggle toggle-xs"
                          type="checkbox"
                          checked={employee.state !== "inactive"}
                          onchange={(event) =>
                            toggleEmployeeState(
                              employee,
                              (event.currentTarget as HTMLInputElement).checked,
                            )}
                          disabled={busy}
                        />
                        <span class="label-text text-xs"
                          >{employee.state === "inactive"
                            ? "Inactivo"
                            : "Activo"}</span
                        >
                      </label>
                      <button
                        class="btn btn-sm btn-soft btn-error"
                        type="button"
                        onclick={() => requestDelete(employee)}
                      >
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

<AdminModalShell
  bind:dialogRef={employeeEditorDialog}
  title={isEditing ? "Editar empleado" : "Crear empleado"}
  icon="lucide:user-check"
  widthClass="max-w-3xl"
  onClose={closeEmployeeEditor}
>
  <form class="grid gap-3 md:grid-cols-2" onsubmit={submit}>
    <div class="form-control">
      <span id="employee-email-label" class="label-text text-xs mb-1"
        >Correo</span
      >
      <input
        id="employee-email"
        class="input input-bordered input-sm w-full"
        type="email"
        bind:value={form.email}
        required
        aria-labelledby="employee-email-label"
      />
    </div>

    <div class="form-control">
      <span id="employee-password-label" class="label-text text-xs mb-1"
        >Contrasena {isEditing ? "(opcional)" : ""}</span
      >
      <input
        id="employee-password"
        class="input input-bordered input-sm w-full"
        type="password"
        bind:value={form.password}
        required={!isEditing}
        minlength={isEditing ? undefined : 8}
        aria-labelledby="employee-password-label"
      />
    </div>

    <div class="form-control">
      <span id="employee-name-label" class="label-text text-xs mb-1"
        >Nombre</span
      >
      <input
        id="employee-name"
        class="input input-bordered input-sm w-full"
        bind:value={form.name}
        aria-labelledby="employee-name-label"
      />
    </div>

    <div class="form-control">
      <span id="employee-phone-label" class="label-text text-xs mb-1"
        >Telefono</span
      >
      <input
        id="employee-phone"
        class="input input-bordered input-sm w-full"
        bind:value={form.phone}
        aria-labelledby="employee-phone-label"
      />
    </div>

    <div class="form-control">
      <span id="employee-role-label" class="label-text text-xs mb-1">Rol</span>
      <select
        id="employee-role"
        class="select select-bordered select-sm w-full"
        bind:value={form.role}
        aria-labelledby="employee-role-label"
      >
        <option value="employee">employee</option>
        <option value="admin">admin</option>
      </select>
    </div>

    <div class="form-control">
      <span class="label-text text-xs mb-1">Estado</span>
      <label
        class="label h-9 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3"
      >
        <input
          class="toggle toggle-sm"
          type="checkbox"
          checked={form.state === "active"}
          onchange={(event) =>
            (form.state = (event.currentTarget as HTMLInputElement).checked
              ? "active"
              : "inactive")}
          aria-label="Estado del empleado"
        />
        <span class="label-text text-sm"
          >{form.state === "active" ? "Activo" : "Inactivo"}</span
        >
      </label>
    </div>

    <div class="md:col-span-2">
      <AdminFormActions
        submitLabel={isEditing ? "Actualizar" : "Crear"}
        onCancel={closeEmployeeEditor}
        {busy}
      />
    </div>
  </form>
</AdminModalShell>

<AdminModalShell
  bind:dialogRef={lockoutResetDialog}
  title="Restablecer bloqueo de usuario"
  icon="lucide:unlock"
  widthClass="max-w-lg"
  onClose={closeLockoutResetModal}
>
  <p class="text-sm text-base-content/70">
    Selecciona el empleado que quieres desbloquear.
  </p>

  <form class="grid gap-3" onsubmit={submitLockoutReset}>
    <div class="form-control">
      <span class="label-text text-xs mb-1">Empleado</span>
      <select
        class="select select-bordered select-sm w-full"
        bind:value={lockoutResetForm.employeeID}
        required
      >
        {#if lockoutCandidateEmployees.length === 0}
          <option value="" disabled selected>No hay empleados</option>
        {:else}
          {#each lockoutCandidateEmployees as employee}
            <option value={employee.id}>
              {employee.email} ({employee.role})
            </option>
          {/each}
        {/if}
      </select>
    </div>

    <p class="text-xs text-base-content/60">
      Por seguridad, los identificadores sensibles del empleado no se muestran
      aqui.
    </p>

    <AdminFormActions
      submitLabel="Restablecer"
      submitVariant="warning"
      onCancel={closeLockoutResetModal}
      disabled={!selectedLockoutEmployee}
      {busy}
    />
  </form>
</AdminModalShell>

<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  {busy}
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>
