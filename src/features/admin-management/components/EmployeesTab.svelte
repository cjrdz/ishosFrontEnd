<script lang="ts">
  import type { Employee } from "@features/admin-management/lib/api";
  import ConfirmDialog from "@shared/components/ConfirmDialog.svelte";
  import AdminModalShell from "./shared/AdminModalShell.svelte";
  import AdminFormActions from "./shared/AdminFormActions.svelte";
  import {
    closeConfirmDialog,
    confirmDialogNow,
    createConfirmDialogState,
    openConfirmDialog,
  } from "@shared/utils/confirm-dialog";
  import EmployeeList from "./EmployeeList.svelte";
  import { onMount } from "svelte";
  import {
    listLocations,
    type AdminLocation,
  } from "@features/admin-management/lib/bff";
  import { ROLE_LABELS } from "@features/admin-management/lib/roles";

  type Role = "admin" | "manager" | "employee";

  interface Props {
    employees: Employee[];
    busy: boolean;
    moduleError: string;
    onCreate: (payload: {
      email: string;
      password: string;
      name?: string;
      phone?: string;
      role: Role;
      location_id?: string;
      state: "active" | "inactive";
    }) => void;
    onUpdate: (
      id: string,
      payload: {
        email: string;
        password?: string;
        name?: string;
        phone?: string;
        role: Role;
        location_id?: string;
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
  let confirmDialog = $state(createConfirmDialogState());
  let editingEmployeeId = $state<string | null>(null);

  let form = $state({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "employee" as Role,
    location_id: "",
    state: "active" as "active" | "inactive",
  });

  let locations = $state<AdminLocation[]>([]);
  const locationNames = $derived(
    Object.fromEntries(locations.map((l) => [l.id, l.name])),
  );
  // Managers and employees work at exactly one location; admins see all.
  const needsLocation = $derived(form.role !== "admin");
  const locationMissing = $derived(needsLocation && !form.location_id);

  onMount(() => {
    void listLocations()
      .then(({ data }) => {
        locations = (data ?? []).filter((l) => l.is_active);
      })
      .catch(() => {
        locations = [];
      });
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
      location_id: locations.length === 1 ? locations[0].id : "",
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
      role: (["admin", "manager", "employee"].includes(employee.role)
        ? employee.role
        : "employee") as Role,
      location_id: employee.location_id || "",
      state: employee.state === "inactive" ? "inactive" : "active",
    };
    employeeEditorDialog?.showModal();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (locationMissing) return;
    const location_id = needsLocation ? form.location_id : "";

    if (editingEmployeeId) {
      onUpdate(editingEmployeeId, {
        email: form.email.trim(),
        password: form.password.trim() || undefined,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        role: form.role,
        location_id,
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
      location_id,
      state: form.state,
    });
    closeEmployeeEditor();
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
      `Eliminar permanentemente ${employee.email}? Esta acción no se puede deshacer.`,
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

  const lockoutOptions = $derived(
    lockoutCandidateEmployees.length === 0
      ? [{ id: "", label: "No hay empleados", disabled: true }]
      : lockoutCandidateEmployees.map((employee) => ({
          id: employee.id,
          label: `${employee.email} (${employee.role})`,
          disabled: false,
        })),
  );
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <EmployeeList
    {employees}
    {busy}
    {locationNames}
    onCreateEmployee={openCreateEmployeeModal}
    onToggleState={toggleEmployeeState}
    onEdit={editEmployee}
    onRequestDelete={requestDelete}
    onOpenLockoutReset={openLockoutResetModal}
  />
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
        >Contraseña {isEditing ? "(opcional)" : ""}</span
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
        >Teléfono</span
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
        <option value="employee">{ROLE_LABELS.employee}</option>
        <option value="manager">{ROLE_LABELS.manager}</option>
        <option value="admin">{ROLE_LABELS.admin}</option>
      </select>
      <span class="mt-1 text-xs text-ink-muted">
        {#if form.role === "admin"}
          Ve y administra todas las sucursales.
        {:else if form.role === "manager"}
          Órdenes, inventario y horario de su sucursal.
        {:else}
          Órdenes y agotados de su sucursal.
        {/if}
      </span>
    </div>

    {#if needsLocation}
      <div class="form-control">
        <span id="employee-location-label" class="label-text text-xs mb-1"
          >Sucursal</span
        >
        <select
          id="employee-location"
          class="select select-bordered select-sm w-full"
          bind:value={form.location_id}
          aria-labelledby="employee-location-label"
          aria-invalid={locationMissing}
          required
        >
          <option value="" disabled>Elige dónde trabaja</option>
          {#each locations as location (location.id)}
            <option value={location.id}>{location.name}</option>
          {/each}
        </select>
      </div>
    {/if}

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
        <!-- One {#each} only: an {#if} inside <select> leaves an invalid text anchor. -->
        {#each lockoutOptions as option (option.id)}
          <option value={option.id} disabled={option.disabled}
            >{option.label}</option
          >
        {/each}
      </select>
    </div>

    <p class="text-xs text-ink-muted">
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
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  {busy}
  variant="error"
  onConfirm={confirmNow}
  onCancel={closeConfirm}
/>
