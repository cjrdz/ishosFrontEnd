<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    approveOrder,
    createCategory,
    createEmployee,
    createOrder,
    createProduct,
    deleteAdminImage,
    deleteEmployee,
    deleteCategory,
    deleteOrder,
    deleteProduct,
    getOrder,
    listAdminImages,
    listCategories,
    listEmployees,
    listOrders,
    listProducts,
    rejectOrder,
    uploadAdminImage,
    updateCategory,
    updateEmployee,
    updateOrder,
    updateOrderNotes,
    updateOrderStatus,
    updateProduct,
    linkProductFlavor,
    unlinkProductFlavor,
    linkProductAddon,
    unlinkProductAddon,
    listFlavors,
    listAddons,
    createFlavor,
    createAddon,
    updateFlavor,
    updateAddon,
    deleteFlavor,
    deleteAddon,
  } from "../../../lib/bff/admin";
  // Re-export types from the original admin API for compatibility
  import type {
    Addon,
    AdminImage,
    Category,
    Employee,
    Flavor,
    Order,
    Product,
  } from "../../../lib/api/admin";
  import AdminHeader, { type TabKey } from "./AdminHeader.svelte";
  import OrdersTab from "./tabs/OrdersTab.svelte";
  import CategoriesTab from "./tabs/CategoriesTab.svelte";
  import ProductsTab from "./tabs/ProductsTab.svelte";
  import EmployeesTab from "./tabs/EmployeesTab.svelte";
  import ToolsTab from "./tabs/ToolsTab.svelte";

  type Session = {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "admin" | "employee";
    active?: boolean;
  };

  let loading = $state(true);
  let sessionError = $state("");
  let notice = $state("");
  let session = $state<Session | null>(null);

  let activeTab = $state<TabKey>("ordenes");

  let categories = $state<Category[]>([]);
  let products = $state<Product[]>([]);
  let productImages = $state<AdminImage[]>([]);
  let orders = $state<Order[]>([]);
  let employees = $state<Employee[]>([]);
  let flavors = $state<Flavor[]>([]);
  let addons = $state<Addon[]>([]);
  let selectedOrder = $state<Order | null>(null);
  let orderStatusFilter = $state("");
  let productGalleryBusy = $state(false);
  let hasLoadedOrdersOnce = false;
  let knownOrderIds = new Set<string>();
  let newOrdersToast = $state<{ count: number; orderNumber?: string } | null>(null);
  let newOrdersToastTimer: ReturnType<typeof setTimeout> | null = null;
  let ordersPollingTimer: ReturnType<typeof setInterval> | null = null;

  let moduleErrors = $state({
    ordenes: "",
    categorias: "",
    productos: "",
    sabores: "",
    complementos: "",
    empleados: "",
  });

  let busy = $state({
    categorias: false,
    productos: false,
    sabores: false,
    complementos: false,
    ordenes: false,
    empleados: false,
  });

  const isAdmin = $derived(session?.role === "admin");

  function setNotice(message: string) {
    notice = message;
    setTimeout(() => {
      notice = "";
    }, 3000);
  }

  function setModuleError(module: keyof typeof moduleErrors, message: string) {
    moduleErrors = { ...moduleErrors, [module]: message };
  }

  function clearModuleError(module: keyof typeof moduleErrors) {
    if (!moduleErrors[module]) return;
    moduleErrors = { ...moduleErrors, [module]: "" };
  }

  function showNewOrdersToast(count: number, latestOrder?: Order) {
    newOrdersToast = {
      count,
      orderNumber: latestOrder?.order_number,
    };

    if (newOrdersToastTimer) {
      clearTimeout(newOrdersToastTimer);
    }

    newOrdersToastTimer = setTimeout(() => {
      newOrdersToast = null;
      newOrdersToastTimer = null;
    }, 4500);
  }

  function stopOrdersPolling() {
    if (!ordersPollingTimer) return;
    clearInterval(ordersPollingTimer);
    ordersPollingTimer = null;
  }

  function startOrdersPolling() {
    stopOrdersPolling();
    ordersPollingTimer = setInterval(() => {
      if (!session) return;
      void loadOrders({ silent: true });
    }, 15000);
  }

  async function loadSession() {
    loading = true;
    sessionError = "";
    try {
      const response = await fetch("/api/admin/session", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Sesion invalida");
      }

      session = payload as Session;
    } catch (requestError) {
      stopOrdersPolling();
      sessionError = requestError instanceof Error ? requestError.message : "Sesion invalida";
      loading = false;
      return;
    }

    // Show dashboard immediately after session resolves.
    loading = false;

    // Load modules in background so a slow endpoint cannot block the UI forever.
    void (async () => {
      await Promise.allSettled([
        loadOrders(),
        loadProducts(),
      ]);
      if (session?.role === "admin") {
        await Promise.allSettled([loadCategories(), loadEmployees(), loadProductImages(), loadFlavors(), loadAddons()]);
      }
      startOrdersPolling();
    })();
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
    }
    window.location.href = "/admin/login";
  }

  async function loadCategories() {
    if (!isAdmin) return;
    busy.categorias = true;
    clearModuleError("categorias");
    try {
      categories = await listCategories(true);
    } catch (requestError) {
      setModuleError("categorias", requestError instanceof Error ? requestError.message : "No se pudieron cargar categorias");
    } finally {
      busy.categorias = false;
    }
  }

  async function loadProducts() {
    busy.productos = true;
    clearModuleError("productos");
    try {
      products = await listProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudieron cargar productos");
    } finally {
      busy.productos = false;
    }
  }

  async function loadProductImages() {
    if (!isAdmin) return;
    productGalleryBusy = true;
    clearModuleError("productos");
    try {
      const response = await listAdminImages();
      productImages = response.images || [];
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo cargar galeria de imagenes");
    } finally {
      productGalleryBusy = false;
    }
  }

  async function loadOrders(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) {
      busy.ordenes = true;
      clearModuleError("ordenes");
    }

    try {
      const response = await listOrders(orderStatusFilter);
      const incomingOrders = response.orders;

      if (hasLoadedOrdersOnce) {
        const freshOrders = incomingOrders.filter((order: Order) => !knownOrderIds.has(order.id));
        if (freshOrders.length > 0) {
          showNewOrdersToast(freshOrders.length, freshOrders[0]);
        }
      }

      knownOrderIds = new Set(incomingOrders.map((order: Order) => order.id));
      hasLoadedOrdersOnce = true;
      orders = incomingOrders;
    } catch (requestError) {
      if (!silent) {
        setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudieron cargar ordenes");
      }
    } finally {
      if (!silent) {
        busy.ordenes = false;
      }
    }
  }

  async function loadEmployees() {
    if (!isAdmin) return;
    busy.empleados = true;
    clearModuleError("empleados");
    try {
      employees = await listEmployees();
    } catch (requestError) {
      setModuleError("empleados", requestError instanceof Error ? requestError.message : "No se pudieron cargar empleados");
    } finally {
      busy.empleados = false;
    }
  }

  async function loadFlavors() {
    if (!isAdmin) return;
    try {
      flavors = await listFlavors(true);
    } catch (requestError) {
      // Silently fail for flavors as they're supplementary
      console.error("Error loading flavors:", requestError);
    }
  }

  async function loadAddons() {
    if (!isAdmin) return;
    try {
      addons = await listAddons(true);
    } catch (requestError) {
      // Silently fail for addons as they're supplementary
      console.error("Error loading addons:", requestError);
    }
  }

  async function handleCreateOrder(payload: Parameters<typeof createOrder>[0]) {
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      await createOrder(payload);
      setNotice("Orden creada");
      await loadOrders();
      return true;
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo crear la orden");
      return false;
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!isAdmin) return;
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      await deleteOrder(orderId);
      if (selectedOrder?.id === orderId) {
        selectedOrder = null;
      }
      setNotice("Orden eliminada");
      await loadOrders();
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo eliminar la orden");
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleOpenOrder(orderId: string) {
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      selectedOrder = await getOrder(orderId);
      return selectedOrder;
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo cargar detalle de orden");
      return null;
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleApprove(orderId: string, reactivationReason?: string) {
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      const updated = await approveOrder(orderId);
      let finalUpdated = updated;

      if (reactivationReason?.trim()) {
        const normalizedReason = reactivationReason.trim();
        const currentNotes = updated.notes?.trim() || "";
        const reactivationEntry = `Reactivacion: ${normalizedReason}`;
        const mergedNotes = currentNotes
          ? `${currentNotes}\n\n${reactivationEntry}`
          : reactivationEntry;
        finalUpdated = await updateOrderNotes(orderId, mergedNotes);
      }

      if (selectedOrder?.id === orderId) {
        selectedOrder = { ...selectedOrder, ...finalUpdated };
      }
      setNotice(reactivationReason?.trim() ? "Orden reactivada" : "Orden aprobada");
      await loadOrders();
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo aprobar orden");
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleReject(orderId: string, reason: string) {
    if (!reason.trim()) {
      setModuleError("ordenes", "Debes indicar el motivo de rechazo");
      return;
    }
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      const updated = await rejectOrder(orderId, reason);
      if (selectedOrder?.id === orderId) {
        selectedOrder = { ...selectedOrder, ...updated };
      }
      setNotice("Orden rechazada");
      await loadOrders();
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo rechazar orden");
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleStatusChange(orderId: string, status: "recibida" | "en_proceso" | "lista" | "entregada") {
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      const updated = await updateOrderStatus(orderId, status);
      if (selectedOrder?.id === orderId) {
        selectedOrder = { ...selectedOrder, ...updated };
      }
      setNotice(`Estado actualizado a ${status}`);
      await loadOrders();
      return updated;
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo actualizar estado");
      return null;
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleUpdateOrder(orderId: string, payload: Parameters<typeof updateOrder>[1]) {
    busy.ordenes = true;
    clearModuleError("ordenes");
    try {
      const updated = await updateOrder(orderId, payload);
      if (selectedOrder?.id === orderId) {
        selectedOrder = { ...selectedOrder, ...updated };
      }
      setNotice("Orden actualizada");
      await loadOrders();
      return updated;
    } catch (requestError) {
      setModuleError("ordenes", requestError instanceof Error ? requestError.message : "No se pudo actualizar la orden");
      return null;
    } finally {
      busy.ordenes = false;
    }
  }

  async function handleCreateCategory(payload: Parameters<typeof createCategory>[0]) {
    if (!isAdmin) return;
    busy.categorias = true;
    clearModuleError("categorias");
    try {
      await createCategory(payload);
      setNotice("Categoria creada");
      await loadCategories();
    } catch (requestError) {
      setModuleError("categorias", requestError instanceof Error ? requestError.message : "No se pudo guardar categoria");
    } finally {
      busy.categorias = false;
    }
  }

  async function handleUpdateCategory(id: string, payload: Parameters<typeof updateCategory>[1]) {
    if (!isAdmin) return;
    busy.categorias = true;
    clearModuleError("categorias");
    try {
      await updateCategory(id, payload);
      setNotice("Categoria actualizada");
      await loadCategories();
    } catch (requestError) {
      setModuleError("categorias", requestError instanceof Error ? requestError.message : "No se pudo guardar categoria");
    } finally {
      busy.categorias = false;
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!isAdmin) return;
    busy.categorias = true;
    clearModuleError("categorias");
    try {
      await deleteCategory(id);
      setNotice("Categoria eliminada");
      await loadCategories();
    } catch (requestError) {
      setModuleError("categorias", requestError instanceof Error ? requestError.message : "No se pudo eliminar categoria");
    } finally {
      busy.categorias = false;
    }
  }

  async function handleCreateProduct(payload: Parameters<typeof createProduct>[0]) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await createProduct(payload);
      setNotice("Producto creado");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo guardar producto");
    } finally {
      busy.productos = false;
    }
  }

  async function handleUpdateProduct(id: string, payload: Parameters<typeof updateProduct>[1]) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await updateProduct(id, payload);
      setNotice("Producto actualizado");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo guardar producto");
    } finally {
      busy.productos = false;
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await deleteProduct(id);
      setNotice("Producto eliminado");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo eliminar producto");
    } finally {
      busy.productos = false;
    }
  }

  async function handleUploadProductImage(file: File): Promise<string | null> {
    if (!isAdmin) return null;
    productGalleryBusy = true;
    clearModuleError("productos");
    try {
      const uploaded = await uploadAdminImage(file, "menu");
      setNotice("Imagen subida al bucket");
      await loadProductImages();
      return uploaded.path;
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo subir imagen");
      return null;
    } finally {
      productGalleryBusy = false;
    }
  }

  async function handleDeleteProductImage(path: string): Promise<boolean> {
    if (!isAdmin) return false;
    productGalleryBusy = true;
    clearModuleError("productos");
    try {
      await deleteAdminImage(path);
      setNotice("Imagen eliminada del bucket");
      await loadProductImages();
      return true;
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo eliminar imagen");
      return false;
    } finally {
      productGalleryBusy = false;
    }
  }

  async function handleLinkProductFlavor(productId: string, flavorId: string) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await linkProductFlavor(productId, flavorId);
      setNotice("Sabor añadido al producto");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo añadir sabor");
    } finally {
      busy.productos = false;
    }
  }

  async function handleUnlinkProductFlavor(productId: string, flavorId: string) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await unlinkProductFlavor(productId, flavorId);
      setNotice("Sabor removido del producto");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo remover sabor");
    } finally {
      busy.productos = false;
    }
  }

  async function handleLinkProductAddon(productId: string, addonId: string) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await linkProductAddon(productId, addonId);
      setNotice("Adicional añadido al producto");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo añadir adicional");
    } finally {
      busy.productos = false;
    }
  }

  async function handleUnlinkProductAddon(productId: string, addonId: string) {
    if (!isAdmin) return;
    busy.productos = true;
    clearModuleError("productos");
    try {
      await unlinkProductAddon(productId, addonId);
      setNotice("Adicional removido del producto");
      await loadProducts();
    } catch (requestError) {
      setModuleError("productos", requestError instanceof Error ? requestError.message : "No se pudo remover adicional");
    } finally {
      busy.productos = false;
    }
  }

  async function handleCreateFlavor(payload: Parameters<typeof createFlavor>[0]) {
    if (!isAdmin) return;
    busy.sabores = true;
    clearModuleError("sabores");
    try {
      await createFlavor(payload);
      setNotice("Sabor creado");
      await loadFlavors();
    } catch (requestError) {
      setModuleError("sabores", requestError instanceof Error ? requestError.message : "No se pudo crear sabor");
    } finally {
      busy.sabores = false;
    }
  }

  async function handleUpdateFlavor(id: string, payload: Parameters<typeof updateFlavor>[1]) {
    if (!isAdmin) return;
    busy.sabores = true;
    clearModuleError("sabores");
    try {
      await updateFlavor(id, payload);
      setNotice("Sabor actualizado");
      await loadFlavors();
    } catch (requestError) {
      setModuleError("sabores", requestError instanceof Error ? requestError.message : "No se pudo actualizar sabor");
    } finally {
      busy.sabores = false;
    }
  }

  async function handleDeleteFlavor(id: string) {
    if (!isAdmin) return;
    busy.sabores = true;
    clearModuleError("sabores");
    try {
      await deleteFlavor(id);
      setNotice("Sabor eliminado");
      await loadFlavors();
    } catch (requestError) {
      setModuleError("sabores", requestError instanceof Error ? requestError.message : "No se pudo eliminar sabor");
    } finally {
      busy.sabores = false;
    }
  }

  async function handleCreateAddon(payload: Parameters<typeof createAddon>[0]) {
    if (!isAdmin) return;
    busy.complementos = true;
    clearModuleError("complementos");
    try {
      await createAddon(payload);
      setNotice("Complemento creado");
      await loadAddons();
    } catch (requestError) {
      setModuleError("complementos", requestError instanceof Error ? requestError.message : "No se pudo crear complemento");
    } finally {
      busy.complementos = false;
    }
  }

  async function handleUpdateAddon(id: string, payload: Parameters<typeof updateAddon>[1]) {
    if (!isAdmin) return;
    busy.complementos = true;
    clearModuleError("complementos");
    try {
      await updateAddon(id, payload);
      setNotice("Complemento actualizado");
      await loadAddons();
    } catch (requestError) {
      setModuleError("complementos", requestError instanceof Error ? requestError.message : "No se pudo actualizar complemento");
    } finally {
      busy.complementos = false;
    }
  }

  async function handleDeleteAddon(id: string) {
    if (!isAdmin) return;
    busy.complementos = true;
    clearModuleError("complementos");
    try {
      await deleteAddon(id);
      setNotice("Complemento eliminado");
      await loadAddons();
    } catch (requestError) {
      setModuleError("complementos", requestError instanceof Error ? requestError.message : "No se pudo eliminar complemento");
    } finally {
      busy.complementos = false;
    }
  }

  async function handleCreateEmployee(payload: Parameters<typeof createEmployee>[0]) {
    if (!isAdmin) return;
    busy.empleados = true;
    clearModuleError("empleados");
    try {
      await createEmployee(payload);
      setNotice("Empleado creado");
      await loadEmployees();
    } catch (requestError) {
      setModuleError("empleados", requestError instanceof Error ? requestError.message : "No se pudo crear empleado");
    } finally {
      busy.empleados = false;
    }
  }

  async function handleUpdateEmployee(id: string, payload: Parameters<typeof updateEmployee>[1]) {
    if (!isAdmin) return;
    busy.empleados = true;
    clearModuleError("empleados");
    try {
      await updateEmployee(id, payload);
      setNotice("Empleado actualizado");
      await loadEmployees();
    } catch (requestError) {
      setModuleError("empleados", requestError instanceof Error ? requestError.message : "No se pudo actualizar empleado");
    } finally {
      busy.empleados = false;
    }
  }

  async function handleDeleteEmployee(id: string) {
    if (!isAdmin) return;
    busy.empleados = true;
    clearModuleError("empleados");
    try {
      await deleteEmployee(id);
      setNotice("Empleado eliminado permanentemente");
      await loadEmployees();
    } catch (requestError) {
      setModuleError("empleados", requestError instanceof Error ? requestError.message : "No se pudo eliminar empleado");
    } finally {
      busy.empleados = false;
    }
  }

  function handleFilterChange(status: string) {
    orderStatusFilter = status;
    loadOrders();
  }

  onMount(() => {
    loadSession();
  });

  onDestroy(() => {
    stopOrdersPolling();
    if (newOrdersToastTimer) {
      clearTimeout(newOrdersToastTimer);
      newOrdersToastTimer = null;
    }
  });
</script>

{#if loading}
  <div class="flex items-center gap-3">
    <span class="loading loading-spinner loading-md"></span>
    <span>Cargando sesion...</span>
  </div>
{:else if sessionError}
  <div class="space-y-4">
    <div class="alert alert-warning">
      <span>{sessionError}</span>
    </div>
    <a href="/admin/login" class="btn btn-primary">Ir al login</a>
  </div>
{:else if session}
  <div class="space-y-6">
    <AdminHeader
      role={session.role}
      activeTab={activeTab}
      isAdmin={isAdmin}
      onLogout={handleLogout}
      onTabChange={(tab) => (activeTab = tab)}
    />

    {#if newOrdersToast}
      <div class="toast toast-top toast-end z-50 mt-24 mr-2 md:mr-4">
        <div class="alert alert-success">
          <span>
            {#if newOrdersToast.count === 1}
              Nueva orden recibida{newOrdersToast.orderNumber ? `: ${newOrdersToast.orderNumber}` : ""}
            {:else}
              {newOrdersToast.count} nuevas ordenes recibidas
            {/if}
          </span>
        </div>
      </div>
    {/if}

    {#if notice}
      <div class="alert alert-success"><span>{notice}</span></div>
    {/if}

    {#if activeTab === "ordenes"}
      <OrdersTab
        isAdmin={isAdmin}
        orders={orders}
        products={products}
        employees={employees}
        selectedOrder={selectedOrder}
        busy={busy.ordenes}
        moduleError={moduleErrors.ordenes}
        orderStatusFilter={orderStatusFilter}
        onFilterChange={handleFilterChange}
        onReload={loadOrders}
        onOpenOrder={handleOpenOrder}
        onApprove={handleApprove}
        onReject={handleReject}
        onStatusChange={handleStatusChange}
        onUpdateOrder={handleUpdateOrder}
        onDelete={handleDeleteOrder}
        onCreate={handleCreateOrder}
      />
    {/if}

    {#if isAdmin && activeTab === "categorias"}
      <CategoriesTab
        categories={categories}
        busy={busy.categorias}
        moduleError={moduleErrors.categorias}
        onCreate={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />
    {/if}

    {#if isAdmin && activeTab === "productos"}
      <ProductsTab
        categories={categories}
        products={products}
        flavors={flavors}
        addons={addons}
        galleryImages={productImages}
        busy={busy.productos}
        galleryBusy={productGalleryBusy}
        moduleError={moduleErrors.productos}
        onCreate={handleCreateProduct}
        onUpdate={handleUpdateProduct}
        onDelete={handleDeleteProduct}
        onReloadGallery={loadProductImages}
        onUploadGalleryImage={handleUploadProductImage}
        onDeleteGalleryImage={handleDeleteProductImage}
        onLinkFlavor={handleLinkProductFlavor}
        onUnlinkFlavor={handleUnlinkProductFlavor}
        onLinkAddon={handleLinkProductAddon}
        onUnlinkAddon={handleUnlinkProductAddon}
        onCreateFlavor={handleCreateFlavor}
        onUpdateFlavor={handleUpdateFlavor}
        onDeleteFlavor={handleDeleteFlavor}
        onCreateAddon={handleCreateAddon}
        onUpdateAddon={handleUpdateAddon}
        onDeleteAddon={handleDeleteAddon}
        flavorBusy={busy.sabores}
        addonBusy={busy.complementos}
        flavorError={moduleErrors.sabores}
        addonError={moduleErrors.complementos}
      />
    {/if}

    {#if isAdmin && activeTab === "empleados"}
      <EmployeesTab
        employees={employees}
        busy={busy.empleados}
        moduleError={moduleErrors.empleados}
        onCreate={handleCreateEmployee}
        onUpdate={handleUpdateEmployee}
        onDelete={handleDeleteEmployee}
      />
    {/if}

    {#if isAdmin && activeTab === "herramientas"}
      <ToolsTab />
    {/if}
  </div>
{/if}
