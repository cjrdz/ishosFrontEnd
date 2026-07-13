<script lang="ts">
  import {
    getCurrentRowsPerTable,
    type User,
  } from "@features/admin-management";
  import Icon from "@shared/components/AppIcon.svelte";

  interface Props {
    users: User[];
    busy: boolean;
    onCreateUser: () => void;
    onToggleStatus: (user: User, checked: boolean) => void;
    onEdit: (user: User) => void;
    onRequestDelete: (user: User) => void;
    onOpenHistory: (user: User) => void;
  }

  let {
    users,
    busy,
    onCreateUser,
    onToggleStatus,
    onEdit,
    onRequestDelete,
    onOpenHistory,
  }: Props = $props();

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let userRowLimit = $state<number>(5);

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

  let statusFilter = $state<"all" | "active" | "inactive">("all");

  $effect(() => {
    userRowLimit = getCurrentRowsPerTable("usuarios");
  });

  function normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const filteredUsers = $derived(
    users.filter((user) => {
      const matchesSearch =
        !debouncedSearchQuery ||
        normalizeText(user.name).includes(normalizeText(debouncedSearchQuery));
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? user.status === "active"
            : user.status === "inactive";
      return matchesSearch && matchesStatus;
    }),
  );

  const visibleUsers = $derived(
    userRowLimit <= 0 ? filteredUsers : filteredUsers.slice(0, userRowLimit),
  );

  const statusFilterLabel = $derived(
    statusFilter === "all"
      ? "Estado"
      : statusFilter === "active"
        ? "Activos"
        : "Inactivos",
  );

  const rowLimitLabel = $derived(
    userRowLimit <= 0 ? "Todos" : String(userRowLimit),
  );

  function setUserRowLimit(limit: number) {
    userRowLimit = limit;
  }

  function setStatusFilter(value: "all" | "active" | "inactive") {
    statusFilter = value;
  }
</script>

<div class="card bg-base-100 shadow">
  <div class="card-body gap-4">
    <!-- Toolbar: title, search, filter, create -->
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="card-title shrink-0 mr-1">Usuarios</h2>

      <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

      <input
        class="input input-sm input-bordered w-full sm:w-36 md:w-44 lg:w-52"
        type="text"
        placeholder="Buscar usuario"
        value={searchQuery}
        oninput={(event) =>
          handleSearchInput((event.currentTarget as HTMLInputElement).value)}
      />

      <!-- Status dropdown -->
      <div class="dropdown w-full sm:w-auto dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-outline w-full sm:w-24 md:w-28 justify-between"
        >
          {statusFilterLabel}
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </div>
        <ul
          tabindex="-1"
          class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-40 p-2 mt-1 shadow-xl border border-base-300"
        >
          <li>
            <button type="button" onclick={() => setStatusFilter("all")}
              >Todos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setStatusFilter("active")}
              >Activos</button
            >
          </li>
          <li>
            <button type="button" onclick={() => setStatusFilter("inactive")}
              >Inactivos</button
            >
          </li>
        </ul>
      </div>

      <button
        class="btn btn-sm btn-primary shrink-0 w-full sm:w-auto sm:ml-auto"
        type="button"
        onclick={onCreateUser}
        disabled={busy}
      >
        <Icon icon="lucide:plus" class="h-4 w-4" />
        Usuario
      </button>
    </div>

    <!-- Table -->
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table w-full">
        <thead class="bg-base-200/60 text-base-content">
          <tr>
            <th class="font-bold">Nombre</th>
            <th class="font-bold">Tipo</th>
            <th class="font-bold">Telefono</th>
            <th class="font-bold">Correo</th>
            <th class="text-center font-bold">Estado</th>
            <th class="text-center font-bold">Acciones</th>
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
            {#each visibleUsers as user (user.id)}
              <tr class="hover:bg-base-300/40 transition-colors">
                <td>{user.name}</td>
                <td>{user.user_type === "company" ? "empresa" : "usuario"}</td>
                <td>{user.phone}</td>
                <td>{user.email || "-"}</td>
                <td class="text-center align-middle">
                  <input
                    class="toggle toggle-sm {user.status === 'active'
                      ? 'toggle-primary'
                      : 'toggle-inactive'}"
                    type="checkbox"
                    checked={user.status === "active"}
                    onchange={(event) =>
                      onToggleStatus(
                        user,
                        (event.currentTarget as HTMLInputElement).checked,
                      )}
                    disabled={busy}
                    aria-label={user.status === "active"
                      ? "Activo"
                      : "Inactivo"}
                  />
                </td>
                <td class="text-center align-middle">
                  <div
                    class="flex flex-wrap md:flex-nowrap items-center justify-center gap-1"
                  >
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-warning"
                      type="button"
                      onclick={() => onOpenHistory(user)}
                      disabled={busy}
                      aria-label="Ver historial"
                      title="Historial"
                    >
                      <Icon icon="lucide:clock" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                      type="button"
                      onclick={() => onEdit(user)}
                      disabled={busy}
                      aria-label="Editar usuario"
                    >
                      <Icon icon="lucide:pencil" class="h-4 w-4" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs sm:btn-sm btn-square text-error/70 hover:text-error hover:bg-error/10"
                      type="button"
                      onclick={() => onRequestDelete(user)}
                      disabled={busy}
                      aria-label="Eliminar usuario"
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
        Mostrando {visibleUsers.length} de {filteredUsers.length}
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
      </div>
    </div>
  </div>
</div>

<style>
  .toggle-inactive {
    --input-color: color-mix(in oklab, var(--color-error) 50%, transparent);
  }
</style>
