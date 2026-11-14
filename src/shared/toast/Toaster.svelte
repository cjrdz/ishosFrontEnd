<script lang="ts">
  import { fly } from "svelte/transition";
  import { dismissToast, toasts } from "./toast";
  import { prefersReducedMotion } from "@shared/motion/motion";

  interface Props {
    /** "center" for the phone-first store, "end" for the admin panel. */
    placement?: "center" | "end";
  }
  let { placement = "center" }: Props = $props();

  const motion = (node: Element) =>
    fly(node, { y: 12, duration: prefersReducedMotion() ? 0 : 200 });

  let root = $state<HTMLDivElement | null>(null);
  let home: ParentNode | null = null;

  // A modal <dialog> makes everything outside it inert and paints above it,
  // so a "Deshacer" toast behind it could be neither seen nor clicked.
  // While one is open, host the toaster inside the topmost modal dialog.
  function placeToaster() {
    if (!root) return;
    home ??= root.parentNode;
    const modals = [...document.querySelectorAll("dialog[open]")].filter((d) =>
      d.matches(":modal"),
    );
    const host = modals.at(-1) ?? home;
    if (host && root.parentNode !== host) host.appendChild(root);
  }

  $effect(() => {
    if ($toasts.length > 0) placeToaster();
  });

  $effect(() => {
    // "close" doesn't bubble; listen in the capture phase for any dialog.
    const onDialogClose = () => queueMicrotask(placeToaster);
    document.addEventListener("close", onDialogClose, true);
    return () => document.removeEventListener("close", onDialogClose, true);
  });
</script>

<div
  bind:this={root}
  class={`toaster toaster--${placement}`}
  role="region"
  aria-label="Notificaciones"
>
  <ul aria-live="polite" aria-relevant="additions">
    {#each $toasts as toast (toast.id)}
      <li
        class={`toaster-item toaster-item--${toast.tone}`}
        in:motion
        out:motion
      >
        <span>{toast.message}</span>
        {#if toast.actionLabel}
          <button
            type="button"
            class="toaster-action"
            onclick={() => toast.onAction?.()}>{toast.actionLabel}</button
          >
        {/if}
        <button
          type="button"
          class="toaster-close"
          aria-label="Cerrar notificación"
          onclick={() => dismissToast(toast.id)}>×</button
        >
      </li>
    {/each}
  </ul>
</div>

<style>
  .toaster {
    position: fixed;
    z-index: 80;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    pointer-events: none;
  }
  .toaster--center {
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, calc(100vw - 32px));
  }
  .toaster--end {
    right: max(16px, env(safe-area-inset-right, 0px));
    width: min(380px, calc(100vw - 32px));
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .toaster-item {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 10px 12px 16px;
    border-radius: var(--radius-box);
    background: var(--color-neutral);
    color: var(--color-neutral-content);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
    font-size: 0.92rem;
  }
  .toaster-item span {
    flex: 1;
    min-width: 0;
  }
  .toaster-item--error {
    background: var(--color-error);
    color: var(--color-error-content);
  }
  .toaster-item--success {
    background: var(--color-success);
    color: var(--color-success-content);
  }
  .toaster-action {
    border: 0;
    background: transparent;
    color: var(--color-accent);
    font-weight: 700;
    padding: 8px 6px;
    min-height: 40px;
    cursor: pointer;
  }
  .toaster-close {
    border: 0;
    background: transparent;
    color: inherit;
    opacity: 0.7;
    font-size: 1.2rem;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    cursor: pointer;
  }
  .toaster-action:focus-visible,
  .toaster-close:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
