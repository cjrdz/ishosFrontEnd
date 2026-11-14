<script lang="ts">
  /**
   * Which location (sucursal) the panel shows.
   *
   * Admins choose one or "Todas"; the choice is a cookie the BFF forwards to
   * the backend, so the page reloads to refetch every list with the new
   * scope. Managers and employees just see the location they work at.
   */
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import {
    listLocations,
    type AdminLocation,
  } from "@features/admin-management/lib/bff";
  import {
    ALL_LOCATIONS,
    readSelectedLocation,
    selectLocation,
  } from "@features/admin-management/lib/location-selection";

  interface Props {
    role: string;
    /** The staff member's own location (managers and employees). */
    locationName: string | null;
  }

  let { role, locationName }: Props = $props();

  let locations = $state<AdminLocation[]>([]);
  let selected = $state(ALL_LOCATIONS);
  let loadError = $state(false);

  onMount(() => {
    if (role !== "admin") return;
    selected = readSelectedLocation();
    void (async () => {
      try {
        const { data } = await listLocations();
        locations = data ?? [];
        // A stored selection that no longer exists falls back to "all".
        if (
          selected !== ALL_LOCATIONS &&
          !locations.some((l) => l.id === selected)
        ) {
          selectLocation(ALL_LOCATIONS);
          selected = ALL_LOCATIONS;
        }
      } catch {
        loadError = true;
      }
    })();
  });

  function handleChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (value === selected) return;
    selectLocation(value);
    window.location.reload();
  }
</script>

{#if role === "admin"}
  <label class="flex items-center gap-2" title="Sucursal que estás viendo">
    <Icon icon="lucide:store" class="h-5 w-5 text-primary" />
    <span class="sr-only">Sucursal</span>
    <select
      class="select select-sm select-bordered max-w-[13rem]"
      value={selected}
      onchange={handleChange}
      disabled={loadError}
      aria-label="Sucursal"
    >
      <option value={ALL_LOCATIONS}>Todas las sucursales</option>
      {#each locations as location (location.id)}
        <option value={location.id}>
          {location.name}{location.is_active ? "" : " (inactiva)"}
        </option>
      {/each}
    </select>
  </label>
{:else if locationName}
  <span
    class="badge badge-primary badge-outline gap-1 py-3"
    title="Tu sucursal"
  >
    <Icon icon="lucide:store" class="h-4 w-4" />
    {locationName}
  </span>
{/if}
