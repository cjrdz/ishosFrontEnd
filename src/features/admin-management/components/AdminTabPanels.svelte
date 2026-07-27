<script lang="ts">
  import type { AdminTabsProps } from "../../../types/admin";
  import { OrdersTab } from "@features/orders";
  import { CategoriesTab, ProductsTab } from "@features/products";
  import EmployeesTab from "@features/admin-management/components/EmployeesTab.svelte";
  import UsersTab from "@features/admin-management/components/UsersTab.svelte";
  import { Analytics, ExportTool } from "@features/analytics";
  import { InventoryTab } from "@features/inventory";

  let {
    shared,
    orders,
    products,
    inventory,
    categories,
    employees,
    users,
  }: AdminTabsProps = $props();

  const orderEditorProducts = $derived(orders.allProducts ?? orders.products);
</script>

{#if shared.activeTab === "ordenes"}
  <OrdersTab
    isAdmin={orders.isAdmin}
    orders={orders.orders}
    products={orders.products}
    allProducts={orders.allProducts}
    categories={categories.categories}
    employees={orders.employees}
    selectedOrder={orders.selectedOrder}
    busy={orders.busy}
    moduleError={orders.moduleError}
    orderStatusFilter={orders.orderStatusFilter}
    showArchived={orders.showArchived}
    pagination={orders.pagination}
    onFilterChange={orders.onFilterChange}
    onToggleArchivedView={orders.onToggleArchivedView}
    onReload={orders.onReload}
    onPageChange={orders.onPageChange}
    onPerPageChange={orders.onPerPageChange}
    onOpenOrder={orders.onOpenOrder}
    onClearSelectedOrder={orders.onClearSelectedOrder}
    onApprove={orders.onApprove}
    onReject={orders.onReject}
    onStatusChange={orders.onStatusChange}
    onUpdateOrder={orders.onUpdateOrder}
    onDelete={orders.onDelete}
    onCreate={orders.onCreate}
    onArchive={orders.onArchive}
    saveUserFromOrder={orders.saveUserFromOrder}
  />
{/if}

{#if shared.isAdmin && shared.activeTab === "categorias"}
  {#if shared.lazyTabState.categorias.loading && !shared.lazyTabState.categorias.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="card bg-base-100 shadow" aria-hidden="true">
        <div class="card-body gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="skeleton h-8 w-48"></div>
            <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>
            <div class="skeleton h-9 w-36"></div>
            <div class="skeleton h-9 w-20"></div>
            <div class="skeleton h-5 w-24"></div>
            <div class="skeleton h-9 w-36 ml-auto"></div>
          </div>
          <div class="rounded-box border border-base-content/5 overflow-hidden">
            <div class="bg-base-200/60 p-3">
              <div class="skeleton h-5 w-full"></div>
            </div>
            <div class="p-3 space-y-3">
              {#each [1, 2, 3, 4, 5] as item (item)}
                <div class="skeleton h-10 w-full"></div>
              {/each}
            </div>
          </div>
        </div>
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
      <div class="card bg-base-100 shadow" aria-hidden="true">
        <div class="card-body gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="skeleton h-8 w-48"></div>
            <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>
            <div class="skeleton h-9 w-36"></div>
            <div class="skeleton h-9 w-20"></div>
            <div class="skeleton h-5 w-24"></div>
            <div class="skeleton h-9 w-32 ml-auto"></div>
            <div class="skeleton h-9 w-36"></div>
            <div class="skeleton h-9 w-36"></div>
          </div>
          <div class="rounded-box border border-base-content/5 overflow-hidden">
            <div class="bg-base-200/60 p-3">
              <div class="skeleton h-5 w-full"></div>
            </div>
            <div class="p-3 space-y-3">
              {#each [1, 2, 3, 4, 5] as item (item)}
                <div class="skeleton h-10 w-full"></div>
              {/each}
            </div>
          </div>
        </div>
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

{#if shared.isAdmin && shared.activeTab === "personas"}
  {#if shared.lazyTabState.personas.loading && !shared.lazyTabState.personas.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="card bg-base-100 shadow" aria-hidden="true">
        <div class="card-body gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="skeleton h-8 w-48"></div>
            <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>
            <div class="skeleton h-9 w-36"></div>
            <div class="skeleton h-9 w-20"></div>
            <div class="skeleton h-5 w-24"></div>
            <div class="skeleton h-9 w-36 ml-auto"></div>
          </div>
          <div class="rounded-box border border-base-content/5 overflow-hidden">
            <div class="bg-base-200/60 p-3">
              <div class="skeleton h-5 w-full"></div>
            </div>
            <div class="p-3 space-y-3">
              {#each [1, 2, 3, 4, 5, 6] as item (item)}
                <div class="skeleton h-10 w-full"></div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </section>
  {:else}
    <section class="space-y-6">
      <EmployeesTab
        employees={employees.employees}
        busy={shared.busy.empleados}
        moduleError={shared.moduleErrors.empleados}
        onCreate={employees.onCreate}
        onUpdate={employees.onUpdate}
        onDelete={employees.onDelete}
        resetLoginLockout={employees.resetLoginLockout}
      />

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
    </section>
  {/if}
{/if}

{#if shared.isAdmin && shared.activeTab === "inventario"}
  {#if shared.lazyTabState.inventario.loading && !shared.lazyTabState.inventario.hydrated}
    <section class="space-y-4" aria-busy="true" aria-live="polite">
      <div class="card bg-base-100 shadow" aria-hidden="true">
        <div class="card-body gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="skeleton h-8 w-48"></div>
            <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>
            <div class="skeleton h-9 w-36"></div>
            <div class="skeleton h-9 w-20"></div>
          </div>
          <div class="rounded-box border border-base-content/5 overflow-hidden">
            <div class="bg-base-200/60 p-3">
              <div class="skeleton h-5 w-full"></div>
            </div>
            <div class="p-3 space-y-3">
              {#each [1, 2, 3, 4, 5] as item (item)}
                <div class="skeleton h-10 w-full"></div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </section>
  {:else}
    <InventoryTab
      busy={shared.busy.inventario}
      moduleError={shared.moduleErrors.inventario}
      flavors={products.flavors}
      addons={products.addons}
      flavorBusy={products.flavorBusy}
      addonBusy={products.addonBusy}
      flavorError={products.flavorError}
      addonError={products.addonError}
      onCreateFlavor={products.onCreateFlavor}
      onUpdateFlavor={products.onUpdateFlavor}
      onDeleteFlavor={products.onDeleteFlavor}
      onCreateAddon={products.onCreateAddon}
      onUpdateAddon={products.onUpdateAddon}
      onDeleteAddon={products.onDeleteAddon}
    />
  {/if}
{/if}

{#if shared.isAdmin && shared.activeTab === "analitica"}
  <section class="space-y-5 md:space-y-6">
    <Analytics />
    <ExportTool />
  </section>
{/if}
