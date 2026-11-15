<script lang="ts">
  /**
   * Floating "Ver mi orden" bar for phones on the menu: item count, label
   * and running total. Hidden on wider screens (the header cart is enough)
   * and while the cart is empty.
   */
  import { onMount } from "svelte";
  import { formatCurrency } from "@shared/utils/formatters";
  import { getCartItems } from "@features/catalog/lib/cart";

  let count = $state(0);
  let total = $state(0);

  function refresh() {
    const items = getCartItems();
    count = items.reduce((sum, item) => sum + item.quantity, 0);
    total = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
  }

  onMount(() => {
    refresh();
    window.addEventListener("storefront-cart-count", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("storefront-cart-count", refresh);
      window.removeEventListener("storage", refresh);
    };
  });
</script>

{#if count > 0}
  <div class="cart-bar">
    <a href="/order/cart" class="cart-bar__link">
      <span class="cart-bar__count" aria-hidden="true">{count}</span>
      <span class="cart-bar__label"
        >Ver mi orden<span class="sr-only">
          , {count} {count === 1 ? "producto" : "productos"}</span
        ></span
      >
      <span class="cart-bar__total">{formatCurrency(total)}</span>
    </a>
  </div>
{/if}

<style>
  .cart-bar {
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 40;
  }
  .cart-bar__link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 3.75rem;
    padding: 0 0.625rem 0 1.125rem;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-weight: 700;
    text-decoration: none;
    box-shadow: 0 10px 24px rgb(var(--brand-shadow) / 0.28);
  }
  .cart-bar__link:focus-visible {
    outline: 3px solid var(--brand-price);
    outline-offset: 3px;
  }
  .cart-bar__count {
    display: grid;
    place-items: center;
    min-width: 1.875rem;
    height: 1.875rem;
    padding: 0 0.375rem;
    border-radius: 999px;
    background: var(--color-primary-content);
    color: var(--color-primary);
    font-weight: 900;
    font-size: 0.875rem;
  }
  .cart-bar__label {
    font-size: 1rem;
  }
  .cart-bar__total {
    margin-left: auto;
    padding: 0.625rem 1rem;
    border-radius: 999px;
    background: var(--brand-rays-a);
    color: var(--brand-hero-ink);
    font-weight: 900;
  }
  @media (min-width: 768px) {
    .cart-bar {
      display: none;
    }
  }
</style>
