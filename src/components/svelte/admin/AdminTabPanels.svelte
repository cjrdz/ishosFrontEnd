<script lang="ts">
  import type { AdminTabsProps } from "../../../types/admin";
  import OrdersTab from "./tabs/OrdersTab.svelte";
  import CategoriesTab from "./tabs/CategoriesTab.svelte";
  import ProductsTab from "./tabs/ProductsTab.svelte";
  import EmployeesTab from "./tabs/EmployeesTab.svelte";
  import UsersTab from "./tabs/UsersTab.svelte";
  import ToolsTab from "./tabs/ToolsTab.svelte";

  let { shared, orders, products, categories, employees, users }: AdminTabsProps = $props();
</script>

{#if shared.activeTab === "ordenes"}
  <OrdersTab
    isAdmin={orders.isAdmin}
    orders={orders.orders}
    products={orders.products}
    employees={orders.employees}
    selectedOrder={orders.selectedOrder}
    busy={orders.busy}
    moduleError={orders.moduleError}
    orderStatusFilter={orders.orderStatusFilter}
    onFilterChange={orders.onFilterChange}
    onReload={orders.onReload}
    onOpenOrder={orders.onOpenOrder}
    onApprove={orders.onApprove}
    onReject={orders.onReject}
    onStatusChange={orders.onStatusChange}
    onUpdateOrder={orders.onUpdateOrder}
    onDelete={orders.onDelete}
    onCreate={orders.onCreate}
    saveUserFromOrder={orders.saveUserFromOrder}
  />
{/if}

{#if shared.isAdmin && shared.activeTab === "categorias"}
  {#if shared.lazyTabState.categorias.loading && !shared.lazyTabState.categorias.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="flex items-center justify-between">
        <div class="skeleton h-8 w-44"></div>
        <div class="skeleton h-10 w-44"></div>
      </div>
      <div class="space-y-3">
        {#each [1, 2, 3, 4, 5] as item (item)}
          <div class="card bg-base-100 shadow border border-base-300/50 p-4 space-y-2" aria-hidden="true">
            <div class="skeleton h-4 w-1/2"></div>
            <div class="skeleton h-4 w-1/3"></div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <CategoriesTab
      categories={categories.categories}
      busy={shared.busy.categorias}
      moduleError={shared.moduleErrors.categorias}
      onCreate={categories.onCreate}
      onUpdate={categories.onUpdate}
      onDelete={categories.onDelete}
    />
  {/if}
{/if}

{#if shared.isAdmin && shared.activeTab === "productos"}
  {#if shared.lazyTabState.productos.loading && !shared.lazyTabState.productos.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="flex items-center justify-between">
        <div class="skeleton h-8 w-44"></div>
        <div class="skeleton h-10 w-44"></div>
      </div>
      <div class="space-y-3">
        {#each [1, 2, 3, 4, 5] as item (item)}
          <div class="card bg-base-100 shadow border border-base-300/50 p-4 space-y-2" aria-hidden="true">
            <div class="skeleton h-4 w-2/3"></div>
            <div class="skeleton h-4 w-1/2"></div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <ProductsTab
      categories={products.categories}
      products={products.products}
      flavors={products.flavors}
      addons={products.addons}
      galleryImages={products.galleryImages}
      busy={products.busy}
      galleryBusy={products.galleryBusy}
      moduleError={products.moduleError}
      onCreate={products.onCreate}
      onUpdate={products.onUpdate}
      onDelete={products.onDelete}
      onReloadGallery={products.onReloadGallery}
      onUploadGalleryImage={products.onUploadGalleryImage}
      onDeleteGalleryImage={products.onDeleteGalleryImage}
      onLinkFlavor={products.onLinkFlavor}
      onUnlinkFlavor={products.onUnlinkFlavor}
      onLinkAddon={products.onLinkAddon}
      onUnlinkAddon={products.onUnlinkAddon}
      onCreateFlavor={products.onCreateFlavor}
      onUpdateFlavor={products.onUpdateFlavor}
      onDeleteFlavor={products.onDeleteFlavor}
      onCreateAddon={products.onCreateAddon}
      onUpdateAddon={products.onUpdateAddon}
      onDeleteAddon={products.onDeleteAddon}
      flavorBusy={products.flavorBusy}
      addonBusy={products.addonBusy}
      flavorError={products.flavorError}
      addonError={products.addonError}
    />
  {/if}
{/if}

{#if shared.isAdmin && shared.activeTab === "empleados"}
  {#if shared.lazyTabState.empleados.loading && !shared.lazyTabState.empleados.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="flex items-center justify-between">
        <div class="skeleton h-8 w-44"></div>
        <div class="skeleton h-10 w-40"></div>
      </div>
      <div class="space-y-3">
        {#each [1, 2, 3, 4, 5] as item (item)}
          <div class="card bg-base-100 shadow border border-base-300/50 p-4 space-y-2" aria-hidden="true">
            <div class="skeleton h-4 w-1/3"></div>
            <div class="skeleton h-4 w-2/3"></div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <EmployeesTab
      employees={employees.employees}
      busy={shared.busy.empleados}
      moduleError={shared.moduleErrors.empleados}
      onCreate={employees.onCreate}
      onUpdate={employees.onUpdate}
      onDelete={employees.onDelete}
    />
  {/if}
{/if}

{#if shared.isAdmin && shared.activeTab === "usuarios"}
  {#if shared.lazyTabState.usuarios.loading && !shared.lazyTabState.usuarios.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="flex items-center justify-between">
        <div class="skeleton h-8 w-44"></div>
        <div class="skeleton h-10 w-44"></div>
      </div>
      <div class="space-y-3">
        {#each [1, 2, 3, 4, 5] as item (item)}
          <div class="card bg-base-100 shadow border border-base-300/50 p-4 space-y-2" aria-hidden="true">
            <div class="skeleton h-4 w-2/3"></div>
            <div class="skeleton h-4 w-1/2"></div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <UsersTab
      users={users.users}
      busy={shared.busy.usuarios}
      moduleError={shared.moduleErrors.usuarios}
      historyBusy={users.usersHistoryBusy}
      selectedUserOrders={users.selectedUserOrders}
      onCreate={users.onCreate}
      onUpdate={users.onUpdate}
      onDelete={users.onDelete}
      onLoadOrders={users.onLoadUserOrders}
    />
  {/if}
{/if}

{#if shared.isAdmin && shared.activeTab === "herramientas"}
  <ToolsTab />
{/if}
