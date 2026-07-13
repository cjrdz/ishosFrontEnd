<script lang="ts">
  import {
    getCurrentRowsPerTable,
    type Employee,
  } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    employees: Employee[];
    busy: boolean;
    onCreateEmployee: () => void;
    onToggleState: (employee: Employee, checked: boolean) => void;
    onEdit: (employee: Employee) => void;
    onRequestDelete: (employee: Employee) => void;
    onOpenLockoutReset: () => void;
  }

  let {
    employees,
    busy,
    onCreateEmployee,
    onToggleState,
    onEdit,
    onRequestDelete,
    onOpenLockoutReset,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let employeeRowLimit = $state<number>(5);

  let searchQuery = $state("");
  let debouncedSearchQuery = $state("");
  let searchTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchInput(value: string) {
    searchQuery = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearchQuery = value;
    }, 200);
  }

  let stateFilter = $state<"all" | "active" | "inactive">("all");

  $effect(() => {
    employeeRowLimit = getCurrentRowsPerTable("empleados");
  });

  function normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const filteredEmployees = $derived(
    employees.filter((employee) => {
      const matchesSearch =
        !debouncedSearchQuery ||
        normalizeText(employee.email).includes(
          normalizeText(debouncedSearchQuery),
        ) ||
        normalizeText(employee.name || "").includes(
          normalizeText(debouncedSearchQuery),
        );
      const matchesState =
        stateFilter === "all"
          ? true
          : stateFilter === "active"
            ? employee.state === "active"
            : employee.state === "inactive";
      return matchesSearch && matchesState;
    }),
  );

  const visibleEmployees = $derived(
    employeeRowLimit <= 0
      ? filteredEmployees
      : filteredEmployees.slice(0, employeeRowLimit),
  );

  const stateFilterLabel = $derived(
    stateFilter === "all"
      ? "Estado"
      : stateFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  const rowLimitLabel = $derived(
    employeeRowLimit <= 0 ? "Todos" : String(employeeRowLimit),
  );

  function setEmployeeRowLimit(limit: number) {
    employeeRowLimit = limit;
  }

  function setStateFilter(value: "all" | "active" | "inactive") {
    stateFilter = value;
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <!-- Toolbar: title, search, filter, actions -->
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="card-title shrink-0 mr-1">Empleados</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <input
        class="input input-sm input-bordered w-full sm:w-36 md:w-44 lg:w-52"
        type="text"
        placeholder="Buscar empleado"
        value={searchQuery}
        oninput={(event) =>
          handleSearchInput((event.currentTarget as HTMLInputElement).value)}
      />

      <!-- State dropdown -->
      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-24 md:w-28 justify-between"
        >
          {stateFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setStateFilter("all")}
              >Todos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setStateFilter("active")}
              >Activos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setStateFilter("inactive")}
              >Inactivos</button
            >
          </li>
        </ul>
      </div>

      <button
        class="btn btn-sm btn-soft btn-warning shrink-0"
        type="button"
        onclick={onOpenLockoutReset}
        disabled={busy}
      >
        <Icon icon="lucide:unlock" class="h-4 w-4" />
        Desbloquear
      </button>

      <button
        class="btn btn-sm btn-primary shrink-0 w-full sm:w-auto sm:ml-auto"
        type="button"
        onclick={onCreateEmployee}
        disabled={busy}
      >
        <Icon icon="lucide:plus" class="h-4 w-4" />
        Empleado
      </button>
    </div>

    <!-- Table -->
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table w-full">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Email</th>
            <th class="font-bold">Nombre</th>
            <th class="font-bold">Rol</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-center font-bold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredEmployees.length === 0}
            <tr
              ><td colspan="5" class="text-center py-6 text-base-content/50"
                >No hay empleados</td
              ></tr
            >
          {:else}
            {#each visibleEmployees as employee (employee.id)}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>{employee.email}</td>
                <td>{employee.name || "-"}</td>
                <td>{employee.role}</td>
                <td class="text-center align-middle">
                  <input
                    class="toggle toggle-sm {employee.state !== 'inactive'
                      ? 'toggle-primary'
                      : 'toggle-inactive'}"
                    type="checkbox"
                    checked={employee.state !== "inactive"}
                    onchange={(event) =>
                      onToggleState(
                        employee,
                        (event.currentTarget as HTMLInputElement).checked,
                      )}
                    disabled={busy}
                    aria-label={employee.state !== "inactive"
                      ? "Activo"
                      : "Inactivo"}
                  />
                </td>
                <td class="text-center align-middle">
                  <div
                    class="flex flex-wrap md:flex-nowrap items-center justify-center gap-1"
                  >
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                      type="button"
                      onclick={() => onEdit(employee)}
                      disabled={busy}
                      aria-label="Editar empleado"
                    >
                      <Icon icon="lucide:pencil" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-error/70 hover:text-error hover:bg-error/10"
                      type="button"
                      onclick={() => onRequestDelete(employee)}
                      disabled={busy}
                      aria-label="Eliminar empleado"
                    >
                      <Icon icon="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300/50 pt-3"
    >
      <span class="text-sm text-base-content/60">
        Mostrando {visibleEmployees.length} de {filteredEmployees.length}
      </span>

      <div class="flex items-center gap-2">
        <span class="text-sm text-base-content/60">Filas</span>
        <div class="dropdown w-full sm:w-auto dropdown-top dropdown-end">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm btn-outline w-full sm:w-24 justify-between"
          >
            {rowLimitLabel}
            <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
          </div>
          <ul
            tabindex="-1"
            class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-32 p-2 mb-1 shadow-xl border border-base-300"
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
      </div>
    </div>
  </div>
</div>

<style>
  .toggle-inactive {
    --input-color: color-mix(in oklab, var(--color-error) 50%, transparent);
  }
</style>
