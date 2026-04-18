<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    deleteAdminImage,
    getAdminTabsSettings,
    getAdminPanelConfig,
    listAdminImages,
    listCategories,
    listEmployees,
    listUserOrders,
    listUsers,
    listOrders,
    listProducts,
    uploadAdminImage,
    linkProductFlavor,
    unlinkProductFlavor,
    linkProductAddon,
    unlinkProductAddon,
    listFlavors,
    listAddons,
  } from "../../../lib/bff/admin";
  // Re-export types from the original admin API for compatibility
  import type { Order, UserOrderHistoryItem } from "../../../lib/api/admin";
  import AdminHeader from "./AdminHeader.svelte";
  import AdminTabPanels from "./AdminTabPanels.svelte";
  import { trackAction, trackError } from "../../../lib/admin/analytics";
  import { createDashboardCrudHandlers } from "../../../lib/admin/dashboard/crud-handlers";
  import { createDashboardOrderHandlers } from "../../../lib/admin/dashboard/order-handlers";
  import {
    createPollingInterval,
    createSessionRefresh,
    type PollingController,
    type SessionRefreshController,
  } from "../../../lib/admin/dashboard/polling-helpers";
  import {
    adminData,
    adminDashboardUi,
    defaultAdminDashboardUi,
    defaultAdminData,
  } from "../../../lib/stores/admin";
  import {
    DEFAULT_TAB_ORDER,
    normalizeTabOrder,
    type TabKey,
  } from "./config/tabs";
  import type { PanelConfigValues } from "./tabs/SettingsTab.svelte";

  type Session = {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "admin" | "employee";
    active?: boolean;
  };
  type LazyTabKey = Exclude<TabKey, "ordenes">;

  let loading = $state(true);
  let sessionError = $state("");
  let notice = $state("");
  let session = $state<Session | null>(null);

  let activeTab = $state<TabKey>("ordenes");

  const categories = $derived($adminData.categories);
  const products = $derived($adminData.products);
  const productImages = $derived($adminData.productImages);
  const orders = $derived($adminData.orders);
  const employees = $derived($adminData.employees);
  const users = $derived($adminData.users);
  const selectedUserOrders = $derived($adminDashboardUi.selectedUserOrders);
  const usersHistoryBusy = $derived($adminDashboardUi.usersHistoryBusy);
  const flavors = $derived($adminData.flavors);
  const addons = $derived($adminData.addons);
  const selectedOrder = $derived($adminDashboardUi.selectedOrder);
  const orderStatusFilter = $derived($adminDashboardUi.orderStatusFilter);
  const productGalleryBusy = $derived($adminDashboardUi.productGalleryBusy);
  let hasLoadedOrdersOnce = false;
  let knownOrderIds = new Set<string>();
  let newOrdersToast = $state<{ count: number; orderNumber?: string } | null>(
    null,
  );
  let newOrdersToastTimer: ReturnType<typeof setTimeout> | null = null;
  let inactivityWarningToast = $state<{ secondsRemaining: number } | null>(
    null,
  );
  let inactivityWarningTimer: ReturnType<typeof setTimeout> | null = null;
  let inactivityWarningCountdownTimer: ReturnType<typeof setInterval> | null =
    null;
  let ordersPollingController: PollingController | null = null;
  let sessionRefreshController: SessionRefreshController | null = null;
  let inactivityLogoutTimer: ReturnType<typeof setTimeout> | null = null;
  let inactivityListenersAttached = false;
  let lazyLoadedModules = new Set<string>();
  let lazyLoadingModules = new Set<string>();
  const DEFAULT_TAB_LAZY_STATE: Record<
    LazyTabKey,
    { loading: boolean; hydrated: boolean }
  > = {
    categorias: { loading: false, hydrated: false },
    productos: { loading: false, hydrated: false },
    personas: { loading: false, hydrated: false },
    ofertas: { loading: false, hydrated: false },
    herramientas: { loading: false, hydrated: false },
  };
  let tabLazyState = $state(structuredClone(DEFAULT_TAB_LAZY_STATE));
  let tabOrder = $state<TabKey[]>([...DEFAULT_TAB_ORDER]);
  const DEFAULT_PANEL_CONFIG: PanelConfigValues = {
    auth_cookie_ttl_hours: 24,
    auth_token_ttl_hours: 168,
    tracking_token_ttl_hours: 720,
    inactivity_logout_seconds: 900,
  };
  let panelConfig = $state<PanelConfigValues>({ ...DEFAULT_PANEL_CONFIG });
  const ORDERS_POLLING_INTERVAL_MS = 15000;
  const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

  const moduleErrors = $derived($adminDashboardUi.moduleErrors);

  const busy = $derived($adminDashboardUi.busy);

  const isAdmin = $derived(session?.role === "admin");

  function setNotice(message: string) {
    notice = message;
    setTimeout(() => {
      notice = "";
    }, 3000);
  }

  function patchAdminData(patch: Partial<typeof defaultAdminData>) {
    adminData.update((current) => ({
      ...current,
      ...patch,
    }));
  }

  function patchAdminUi(patch: Partial<typeof defaultAdminDashboardUi>) {
    adminDashboardUi.update((current) => ({
      ...current,
      ...patch,
      busy: patch.busy ? { ...current.busy, ...patch.busy } : current.busy,
      moduleErrors: patch.moduleErrors
        ? { ...current.moduleErrors, ...patch.moduleErrors }
        : current.moduleErrors,
    }));
  }

  function setBusy(
    module: keyof typeof defaultAdminDashboardUi.busy,
    value: boolean,
  ) {
    adminDashboardUi.update((current) => ({
      ...current,
      busy: {
        ...current.busy,
        [module]: value,
      },
    }));
  }

  function setProductGalleryBusy(value: boolean) {
    patchAdminUi({ productGalleryBusy: value });
  }

  function setUsersHistoryBusy(value: boolean) {
    patchAdminUi({ usersHistoryBusy: value });
  }

  function setOrderStatusFilter(value: string) {
    patchAdminUi({ orderStatusFilter: value });
  }

  function setSelectedOrder(value: Order | null) {
    patchAdminUi({ selectedOrder: value });
  }

  function setSelectedUserOrders(value: UserOrderHistoryItem[]) {
    patchAdminUi({ selectedUserOrders: value });
  }

  function setModuleError(
    module: keyof typeof defaultAdminDashboardUi.moduleErrors,
    message: string,
  ) {
    adminDashboardUi.update((current) => ({
      ...current,
      moduleErrors: {
        ...current.moduleErrors,
        [module]: message,
      },
    }));
  }

  function clearModuleError(
    module: keyof typeof defaultAdminDashboardUi.moduleErrors,
  ) {
    if (!moduleErrors[module]) return;
    adminDashboardUi.update((current) => ({
      ...current,
      moduleErrors: {
        ...current.moduleErrors,
        [module]: "",
      },
    }));
  }

  async function runModuleAction<T>(params: {
    module: keyof typeof defaultAdminDashboardUi.busy;
    requireAdmin?: boolean;
    errorMessage: string;
    action: () => Promise<T>;
    defaultValue: T;
    analyticsAction?: string;
    analyticsMeta?: Record<string, unknown>;
    onSuccess?: (result: T) => void | Promise<void>;
    onError?: (error: unknown) => void;
  }): Promise<T> {
    const {
      module,
      requireAdmin = false,
      errorMessage,
      action,
      defaultValue,
      analyticsAction,
      analyticsMeta,
      onSuccess,
      onError,
    } = params;
    if (requireAdmin && !isAdmin) return defaultValue;

    const actionName = analyticsAction ?? `admin_${module}_action`;
    trackAction(`${actionName}_start`, {
      module,
      ...analyticsMeta,
    });

    setBusy(module, true);
    clearModuleError(module);
    try {
      const result = await action();
      await onSuccess?.(result);
      trackAction(`${actionName}_success`, {
        module,
        ...analyticsMeta,
      });
      return result;
    } catch (requestError) {
      onError?.(requestError);
      trackError(requestError, `AdminDashboard.runModuleAction:${actionName}`, {
        module,
        ...analyticsMeta,
      });
      setModuleError(
        module,
        requestError instanceof Error ? requestError.message : errorMessage,
      );
      return defaultValue;
    } finally {
      setBusy(module, false);
    }
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
    if (!ordersPollingController) return;
    ordersPollingController.cleanup();
    ordersPollingController = null;
  }

  function stopSessionRefresh() {
    if (!sessionRefreshController) return;
    sessionRefreshController.cleanup();
    sessionRefreshController = null;
  }

  function stopInactivityLogoutTracking() {
    if (inactivityLogoutTimer) {
      clearTimeout(inactivityLogoutTimer);
      inactivityLogoutTimer = null;
    }

    if (inactivityWarningTimer) {
      clearTimeout(inactivityWarningTimer);
      inactivityWarningTimer = null;
    }

    if (inactivityWarningCountdownTimer) {
      clearInterval(inactivityWarningCountdownTimer);
      inactivityWarningCountdownTimer = null;
    }

    inactivityWarningToast = null;

    if (typeof window !== "undefined" && inactivityListenersAttached) {
      for (const eventName of [
        "mousemove",
        "mousedown",
        "keydown",
        "scroll",
        "touchstart",
      ]) {
        window.removeEventListener(eventName, resetInactivityLogoutTimer, true);
      }
      inactivityListenersAttached = false;
    }
  }

  function scheduleInactivityLogout() {
    if (!session || typeof window === "undefined") return;

    const timeoutSeconds = Math.max(
      1,
      panelConfig.inactivity_logout_seconds ||
        DEFAULT_PANEL_CONFIG.inactivity_logout_seconds,
    );
    const timeoutMs = timeoutSeconds * 1000;

    if (inactivityLogoutTimer) {
      clearTimeout(inactivityLogoutTimer);
    }

    if (inactivityWarningTimer) {
      clearTimeout(inactivityWarningTimer);
      inactivityWarningTimer = null;
    }

    if (inactivityWarningCountdownTimer) {
      clearInterval(inactivityWarningCountdownTimer);
      inactivityWarningCountdownTimer = null;
    }

    inactivityWarningToast = null;

    if (timeoutSeconds > 30) {
      inactivityWarningTimer = setTimeout(
        () => {
          inactivityWarningToast = { secondsRemaining: 30 };
          inactivityWarningCountdownTimer = setInterval(() => {
            if (!inactivityWarningToast) return;
            if (inactivityWarningToast.secondsRemaining <= 1) {
              clearInterval(inactivityWarningCountdownTimer!);
              inactivityWarningCountdownTimer = null;
              return;
            }

            inactivityWarningToast = {
              secondsRemaining: inactivityWarningToast.secondsRemaining - 1,
            };
          }, 1000);
        },
        timeoutMs - 30 * 1000,
      );
    }

    inactivityLogoutTimer = setTimeout(() => {
      inactivityWarningToast = null;
      void handleLogout();
    }, timeoutMs);
  }

  function resetInactivityLogoutTimer() {
    scheduleInactivityLogout();
  }

  function startInactivityLogoutTracking() {
    if (typeof window === "undefined" || !session) return;

    if (!inactivityListenersAttached) {
      for (const eventName of [
        "mousemove",
        "mousedown",
        "keydown",
        "scroll",
        "touchstart",
      ]) {
        window.addEventListener(eventName, resetInactivityLogoutTimer, true);
      }
      inactivityListenersAttached = true;
    }

    scheduleInactivityLogout();
  }

  async function runLazyModuleLoad(key: string, loader: () => Promise<void>) {
    if (lazyLoadedModules.has(key) || lazyLoadingModules.has(key)) return;
    lazyLoadingModules.add(key);
    try {
      await loader();
      lazyLoadedModules.add(key);
    } finally {
      lazyLoadingModules.delete(key);
    }
  }

  function isLazyTabKey(tab: TabKey): tab is LazyTabKey {
    return tab !== "ordenes";
  }

  async function ensureTabDataLoaded(tab: TabKey) {
    if (!isAdmin) return;

    if (!isLazyTabKey(tab)) return;
    if (tabLazyState[tab].hydrated || tabLazyState[tab].loading) return;

    tabLazyState = {
      ...tabLazyState,
      [tab]: {
        ...tabLazyState[tab],
        loading: true,
      },
    };

    try {
      if (tab === "categorias") {
        await runLazyModuleLoad("categorias", loadCategories);
      } else if (tab === "productos") {
        await Promise.allSettled([
          runLazyModuleLoad("categorias", loadCategories),
          runLazyModuleLoad("flavors", loadFlavors),
          runLazyModuleLoad("addons", loadAddons),
          runLazyModuleLoad("product-images", loadProductImages),
        ]);
      } else if (tab === "personas") {
        await Promise.allSettled([
          runLazyModuleLoad("empleados", loadEmployees),
          runLazyModuleLoad("usuarios", loadUsers),
        ]);
      } else if (tab === "ofertas") {
        await runLazyModuleLoad("productos-core", loadProducts);
      }

      tabLazyState = {
        ...tabLazyState,
        [tab]: {
          ...tabLazyState[tab],
          loading: false,
          hydrated: true,
        },
      };
    } catch {
      tabLazyState = {
        ...tabLazyState,
        [tab]: {
          ...tabLazyState[tab],
          loading: false,
        },
      };
    }
  }

  async function refreshSession() {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "No se pudo refrescar sesion");
    }
    session = payload as Session;
  }

  function startOrdersPolling() {
    stopOrdersPolling();
    ordersPollingController = createPollingInterval(async () => {
      if (!session) return;
      console.debug("[admin-polling] orders", new Date().toISOString());
      void loadOrders({ silent: true });
    }, ORDERS_POLLING_INTERVAL_MS);
  }

  function startSessionRefresh() {
    stopSessionRefresh();
    sessionRefreshController = createSessionRefresh(async () => {
      if (!session) return;
      await refreshSession();
      console.debug(
        "[admin-polling] session-refresh",
        new Date().toISOString(),
      );
      trackAction("admin_session_refresh_success", {
        at: new Date().toISOString(),
      });
    }, SESSION_REFRESH_INTERVAL_MS);
  }

  async function loadSession() {
    loading = true;
    sessionError = "";
    lazyLoadedModules = new Set<string>();
    lazyLoadingModules = new Set<string>();
    tabLazyState = structuredClone(DEFAULT_TAB_LAZY_STATE);
    adminData.set({ ...defaultAdminData });
    adminDashboardUi.set({
      ...defaultAdminDashboardUi,
      busy: { ...defaultAdminDashboardUi.busy },
      moduleErrors: { ...defaultAdminDashboardUi.moduleErrors },
    });
    try {
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Sesion invalida");
      }

      session = payload as Session;
    } catch (requestError) {
      stopOrdersPolling();
      stopSessionRefresh();
      trackError(requestError, "AdminDashboard.loadSession");
      sessionError =
        requestError instanceof Error
          ? requestError.message
          : "Sesion invalida";
      loading = false;
      return;
    }

    // Show dashboard immediately after session resolves.
    loading = false;
    trackAction("admin_session_loaded", { role: session?.role ?? "unknown" });

    // Load modules in background so a slow endpoint cannot block the UI forever.
    void (async () => {
      await Promise.allSettled([
        runLazyModuleLoad("ordenes", async () => {
          await loadOrders();
        }),
        runLazyModuleLoad("productos-core", async () => {
          await loadProducts();
        }),
        runLazyModuleLoad("tabs-settings", async () => {
          await loadTabsSettings();
        }),
        runLazyModuleLoad("panel-config", async () => {
          await loadPanelConfig();
        }),
      ]);

      // Prefetch data only for the currently visible tab after initial paint.
      await ensureTabDataLoaded(activeTab);

      startInactivityLogoutTracking();
      startOrdersPolling();
      startSessionRefresh();
    })();
  }

  async function handleLogout() {
    stopOrdersPolling();
    stopSessionRefresh();
    stopInactivityLogoutTracking();
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {}
    window.location.href = "/admin/login";
  }

  async function loadCategories() {
    if (!isAdmin) return;
    setBusy("categorias", true);
    clearModuleError("categorias");
    try {
      const nextCategories = await listCategories(true);
      patchAdminData({ categories: nextCategories });
    } catch (requestError) {
      setModuleError(
        "categorias",
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar categorias",
      );
    } finally {
      setBusy("categorias", false);
    }
  }

  async function loadProducts() {
    setBusy("productos", true);
    clearModuleError("productos");
    try {
      const nextProducts = await listProducts();
      patchAdminData({ products: nextProducts });
    } catch (requestError) {
      setModuleError(
        "productos",
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar productos",
      );
    } finally {
      setBusy("productos", false);
    }
  }

  async function loadProductImages() {
    if (!isAdmin) return;
    setProductGalleryBusy(true);
    clearModuleError("productos");
    try {
      const response = await listAdminImages();
      patchAdminData({ productImages: response.images || [] });
    } catch (requestError) {
      setModuleError(
        "productos",
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar galeria de imagenes",
      );
    } finally {
      setProductGalleryBusy(false);
    }
  }

  async function loadOrders(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) {
      setBusy("ordenes", true);
      clearModuleError("ordenes");
    }

    try {
      const response = await listOrders(orderStatusFilter);
      const incomingOrders = response.orders;

      if (hasLoadedOrdersOnce && silent) {
        const freshOrders = incomingOrders.filter(
          (order: Order) => !knownOrderIds.has(order.id),
        );
        if (freshOrders.length > 0) {
          trackAction("admin_new_orders_detected", {
            count: freshOrders.length,
          });
          showNewOrdersToast(freshOrders.length, freshOrders[0]);
        }
      }

      knownOrderIds = new Set(incomingOrders.map((order: Order) => order.id));
      hasLoadedOrdersOnce = true;
      patchAdminData({ orders: incomingOrders });
    } catch (requestError) {
      if (!silent) {
        setModuleError(
          "ordenes",
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar ordenes",
        );
      }
    } finally {
      if (!silent) {
        setBusy("ordenes", false);
      }
    }
  }

  async function loadEmployees() {
    if (!isAdmin) return;
    setBusy("empleados", true);
    clearModuleError("empleados");
    try {
      const nextEmployees = await listEmployees();
      patchAdminData({ employees: nextEmployees });
    } catch (requestError) {
      setModuleError(
        "empleados",
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar empleados",
      );
    } finally {
      setBusy("empleados", false);
    }
  }

  async function loadUsers() {
    if (!isAdmin) return;
    setBusy("usuarios", true);
    clearModuleError("usuarios");
    try {
      const nextUsers = await listUsers();
      patchAdminData({ users: nextUsers });
    } catch (requestError) {
      setModuleError(
        "usuarios",
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar usuarios",
      );
    } finally {
      setBusy("usuarios", false);
    }
  }

  async function loadUserOrders(userId: string) {
    if (!isAdmin) return;
    setUsersHistoryBusy(true);
    clearModuleError("usuarios");
    try {
      const response = await listUserOrders(userId, 50);
      setSelectedUserOrders(response.orders ?? []);
    } catch (requestError) {
      setModuleError(
        "usuarios",
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar historial del usuario",
      );
      setSelectedUserOrders([]);
    } finally {
      setUsersHistoryBusy(false);
    }
  }

  async function loadTabsSettings() {
    if (!isAdmin) return;
    setBusy("configuracion", true);
    clearModuleError("configuracion");
    try {
      const settings = await getAdminTabsSettings();
      tabOrder = normalizeTabOrder(settings.tab_order);
    } catch (requestError) {
      setModuleError(
        "configuracion",
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar configuracion",
      );
      tabOrder = [...DEFAULT_TAB_ORDER];
    } finally {
      setBusy("configuracion", false);
    }
  }

  async function loadPanelConfig() {
    if (!isAdmin) return;
    setBusy("configuracion", true);
    clearModuleError("configuracion");
    try {
      const config = await getAdminPanelConfig();
      panelConfig = {
        auth_cookie_ttl_hours: config.auth_cookie_ttl_hours,
        auth_token_ttl_hours: config.auth_token_ttl_hours,
        tracking_token_ttl_hours: config.tracking_token_ttl_hours,
        inactivity_logout_seconds: config.inactivity_logout_seconds ?? 900,
      };
      if (session) {
        startInactivityLogoutTracking();
      }
    } catch (requestError) {
      setModuleError(
        "configuracion",
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar configuracion",
      );
      panelConfig = { ...DEFAULT_PANEL_CONFIG };
    } finally {
      setBusy("configuracion", false);
    }
  }

  async function loadFlavors() {
    if (!isAdmin) return;
    try {
      const nextFlavors = await listFlavors(true);
      patchAdminData({ flavors: nextFlavors });
    } catch (requestError) {
      // Silently fail for flavors as they're supplementary
      console.error("Error loading flavors:", requestError);
    }
  }

  async function loadAddons() {
    if (!isAdmin) return;
    try {
      const nextAddons = await listAddons(true);
      patchAdminData({ addons: nextAddons });
    } catch (requestError) {
      // Silently fail for addons as they're supplementary
      console.error("Error loading addons:", requestError);
    }
  }

  const {
    handleCreateOrder,
    handleDeleteOrder,
    handleOpenOrder,
    handleApprove,
    handleReject,
    handleStatusChange,
    handleUpdateOrder,
  } = createDashboardOrderHandlers({
    runModuleAction,
    loadOrders,
    setNotice,
    setOrderModuleError: (message: string) => {
      setModuleError("ordenes", message);
    },
    getSelectedOrder: () => selectedOrder,
    setSelectedOrder: (value) => {
      setSelectedOrder(value);
    },
  });

  async function handleUploadProductImage(file: File): Promise<string | null> {
    if (!isAdmin) return null;
    setProductGalleryBusy(true);
    clearModuleError("productos");
    trackAction("admin_product_image_upload_start", {
      fileName: file.name,
      fileSize: file.size,
    });
    try {
      const uploaded = await uploadAdminImage(file);
      setNotice("Imagen subida al bucket");
      await loadProductImages();
      trackAction("admin_product_image_upload_success", {
        path: uploaded.path,
        fileName: file.name,
      });
      return uploaded.path;
    } catch (requestError) {
      trackError(requestError, "AdminDashboard.handleUploadProductImage", {
        fileName: file.name,
      });
      setModuleError(
        "productos",
        requestError instanceof Error
          ? requestError.message
          : "No se pudo subir imagen",
      );
      return null;
    } finally {
      setProductGalleryBusy(false);
    }
  }

  async function handleDeleteProductImage(path: string): Promise<boolean> {
    if (!isAdmin) return false;
    setProductGalleryBusy(true);
    clearModuleError("productos");
    trackAction("admin_product_image_delete_start", { path });
    try {
      await deleteAdminImage(path);
      setNotice("Imagen eliminada del bucket");
      await loadProductImages();
      trackAction("admin_product_image_delete_success", { path });
      return true;
    } catch (requestError) {
      trackError(requestError, "AdminDashboard.handleDeleteProductImage", {
        path,
      });
      setModuleError(
        "productos",
        requestError instanceof Error
          ? requestError.message
          : "No se pudo eliminar imagen",
      );
      return false;
    } finally {
      setProductGalleryBusy(false);
    }
  }

  async function runProductRelationMutation(params: {
    actionName: string;
    action: () => Promise<void>;
    successNotice: string;
    errorMessage: string;
  }) {
    if (!isAdmin) return;
    setBusy("productos", true);
    clearModuleError("productos");
    trackAction(`${params.actionName}_start`);
    try {
      await params.action();
      setNotice(params.successNotice);
      await loadProducts();
      trackAction(`${params.actionName}_success`);
    } catch (requestError) {
      trackError(requestError, `AdminDashboard.${params.actionName}`);
      setModuleError(
        "productos",
        requestError instanceof Error
          ? requestError.message
          : params.errorMessage,
      );
    } finally {
      setBusy("productos", false);
    }
  }

  async function handleLinkProductFlavor(productId: string, flavorId: string) {
    await runProductRelationMutation({
      actionName: "admin_product_flavor_link",
      action: async () => {
        await linkProductFlavor(productId, flavorId);
      },
      successNotice: "Sabor añadido al producto",
      errorMessage: "No se pudo añadir sabor",
    });
  }

  async function handleUnlinkProductFlavor(
    productId: string,
    flavorId: string,
  ) {
    await runProductRelationMutation({
      actionName: "admin_product_flavor_unlink",
      action: async () => {
        await unlinkProductFlavor(productId, flavorId);
      },
      successNotice: "Sabor removido del producto",
      errorMessage: "No se pudo remover sabor",
    });
  }

  async function handleLinkProductAddon(productId: string, addonId: string) {
    await runProductRelationMutation({
      actionName: "admin_product_addon_link",
      action: async () => {
        await linkProductAddon(productId, addonId);
      },
      successNotice: "Adicional añadido al producto",
      errorMessage: "No se pudo añadir adicional",
    });
  }

  async function handleUnlinkProductAddon(productId: string, addonId: string) {
    await runProductRelationMutation({
      actionName: "admin_product_addon_unlink",
      action: async () => {
        await unlinkProductAddon(productId, addonId);
      },
      successNotice: "Adicional removido del producto",
      errorMessage: "No se pudo remover adicional",
    });
  }

  const {
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateFlavor,
    handleUpdateFlavor,
    handleDeleteFlavor,
    handleCreateAddon,
    handleUpdateAddon,
    handleDeleteAddon,
    handleCreateEmployee,
    handleUpdateEmployee,
    handleDeleteEmployee,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleSaveUserFromOrder,
  } = createDashboardCrudHandlers({
    runModuleAction,
    loadCategories,
    loadProducts,
    loadFlavors,
    loadAddons,
    loadEmployees,
    loadUsers,
    setNotice,
    trackAction,
    trackError,
  });

  function handleFilterChange(status: string) {
    setOrderStatusFilter(status);
    loadOrders();
  }

  function handleTabChange(tab: TabKey) {
    if (!isAdmin && tab !== "ordenes") {
      activeTab = "ordenes";
      return;
    }
    activeTab = tab;
    void ensureTabDataLoaded(tab);
  }

  const sharedPanelProps = $derived({
    isAdmin,
    activeTab,
    busy,
    moduleErrors,
    lazyTabState: tabLazyState,
  });
  const ordersPanelProps = $derived({
    isAdmin,
    orders,
    products,
    employees,
    selectedOrder,
    busy: busy.ordenes,
    moduleError: moduleErrors.ordenes,
    orderStatusFilter,
    onFilterChange: handleFilterChange,
    onReload: loadOrders,
    onOpenOrder: handleOpenOrder,
    onApprove: handleApprove,
    onReject: handleReject,
    onStatusChange: handleStatusChange,
    onUpdateOrder: handleUpdateOrder,
    onDelete: handleDeleteOrder,
    onCreate: handleCreateOrder,
    saveUserFromOrder: handleSaveUserFromOrder,
  });
  const categoriesPanelProps = $derived({
    categories,
    onCreate: handleCreateCategory,
    onUpdate: handleUpdateCategory,
    onDelete: handleDeleteCategory,
  });
  const productsPanelProps = $derived({
    categories,
    products,
    flavors,
    addons,
    galleryImages: productImages,
    busy: busy.productos,
    galleryBusy: productGalleryBusy,
    moduleError: moduleErrors.productos,
    onCreate: handleCreateProduct,
    onUpdate: handleUpdateProduct,
    onDelete: handleDeleteProduct,
    onCreateFlavor: handleCreateFlavor,
    onUpdateFlavor: handleUpdateFlavor,
    onDeleteFlavor: handleDeleteFlavor,
    onCreateAddon: handleCreateAddon,
    onUpdateAddon: handleUpdateAddon,
    onDeleteAddon: handleDeleteAddon,
    flavorBusy: busy.sabores,
    addonBusy: busy.complementos,
    flavorError: moduleErrors.sabores,
    addonError: moduleErrors.complementos,
    onLinkFlavor: handleLinkProductFlavor,
    onUnlinkFlavor: handleUnlinkProductFlavor,
    onLinkAddon: handleLinkProductAddon,
    onUnlinkAddon: handleUnlinkProductAddon,
    onReloadGallery: loadProductImages,
    onUploadGalleryImage: handleUploadProductImage,
    onDeleteGalleryImage: handleDeleteProductImage,
  });
  const employeesPanelProps = $derived({
    employees,
    onCreate: handleCreateEmployee,
    onUpdate: handleUpdateEmployee,
    onDelete: handleDeleteEmployee,
  });
  const usersPanelProps = $derived({
    users,
    selectedUserOrders,
    usersHistoryBusy,
    onCreate: handleCreateUser,
    onUpdate: handleUpdateUser,
    onDelete: handleDeleteUser,
    onLoadUserOrders: loadUserOrders,
  });

  function openSettingsPage() {
    if (!isAdmin) return;
    window.location.href = "/admin/settings";
  }

  onMount(() => {
    loadSession();
  });

  onDestroy(() => {
    stopOrdersPolling();
    stopSessionRefresh();
    stopInactivityLogoutTracking();
    if (newOrdersToastTimer) {
      clearTimeout(newOrdersToastTimer);
      newOrdersToastTimer = null;
    }
    if (inactivityWarningTimer) {
      clearTimeout(inactivityWarningTimer);
      inactivityWarningTimer = null;
    }
    if (inactivityWarningCountdownTimer) {
      clearInterval(inactivityWarningCountdownTimer);
      inactivityWarningCountdownTimer = null;
    }
  });
</script>

{#if loading}
  <div class="flex min-h-[45vh] w-full items-center justify-center">
    <div class="flex items-center gap-3">
      <span class="loading loading-spinner loading-md"></span>
      <span>Cargando sesion...</span>
    </div>
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
      userName={session.name}
      {activeTab}
      {isAdmin}
      {tabOrder}
      onLogout={handleLogout}
      onTabChange={handleTabChange}
      onOpenSettings={openSettingsPage}
    />

    {#if newOrdersToast}
      <div class="toast toast-top toast-end z-50 mt-24 mr-2 md:mr-4">
        <div class="alert alert-success">
          <span>
            {#if newOrdersToast.count === 1}
              Nueva orden recibida{newOrdersToast.orderNumber
                ? `: ${newOrdersToast.orderNumber}`
                : ""}
            {:else}
              {newOrdersToast.count} nuevas ordenes recibidas
            {/if}
          </span>
        </div>
      </div>
    {/if}

    {#if inactivityWarningToast}
      <div class="toast toast-top toast-end z-50 mt-24 mr-2 md:mr-4">
        <div class="alert alert-warning shadow-lg">
          <span
            >Tu sesión expirará en {inactivityWarningToast.secondsRemaining} segundos
            por inactividad.</span
          >
        </div>
      </div>
    {/if}

    {#if notice}
      <div class="alert alert-success"><span>{notice}</span></div>
    {/if}

    <AdminTabPanels
      shared={sharedPanelProps}
      orders={ordersPanelProps}
      categories={categoriesPanelProps}
      products={productsPanelProps}
      employees={employeesPanelProps}
      users={usersPanelProps}
    />
  </div>
{/if}
