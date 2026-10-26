(() => {
  const toastEl = document.getElementById("store-cart-toast");
  const textEl = document.getElementById("store-cart-toast-text");
  if (!toastEl || !textEl) return;

  let hideTimeout;

  const onCartAdded = (event) => {
    const customEvent = event;
    const detail = customEvent?.detail || {};
    const name = typeof detail.name === "string" ? detail.name : "Producto";
    const quantity = Number(detail.quantity || 1);
    const qtyLabel = quantity > 1 ? `${quantity}x ` : "";

    textEl.textContent = `${qtyLabel}${name} agregado al carrito`;

    toastEl.classList.remove("hidden");
    toastEl.classList.remove("store-cart-toast-visible");
    void toastEl.offsetWidth;
    toastEl.classList.add("store-cart-toast-visible");

    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      toastEl.classList.remove("store-cart-toast-visible");
      setTimeout(() => {
        toastEl.classList.add("hidden");
      }, 220);
    }, 2100);
  };

  document.addEventListener("astro:page-load", () => {
    window.removeEventListener("storefront-cart-added", onCartAdded);
    window.addEventListener("storefront-cart-added", onCartAdded);
  });

  window.removeEventListener("storefront-cart-added", onCartAdded);
  window.addEventListener("storefront-cart-added", onCartAdded);
})();
