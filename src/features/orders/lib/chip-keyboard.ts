export function handleChipGroupKeydown(
  event: KeyboardEvent,
  selector = "button",
) {
  const target = event.currentTarget as HTMLElement;
  const buttons = Array.from(target.querySelectorAll<HTMLElement>(selector));
  const currentIndex = buttons.findIndex(
    (button) => button === document.activeElement,
  );
  if (currentIndex < 0) return;

  let nextIndex = currentIndex;
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
      event.preventDefault();
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = Math.max(currentIndex - 1, 0);
      event.preventDefault();
      break;
    case "Home":
      nextIndex = 0;
      event.preventDefault();
      break;
    case "End":
      nextIndex = buttons.length - 1;
      event.preventDefault();
      break;
    default:
      return;
  }

  if (nextIndex !== currentIndex) {
    buttons[currentIndex]?.setAttribute("tabindex", "-1");
    buttons[nextIndex]?.setAttribute("tabindex", "0");
    buttons[nextIndex]?.focus();
  }
}

export function initializeRovingTabindex(
  container: HTMLElement,
  selector = "button",
) {
  const buttons = Array.from(container.querySelectorAll<HTMLElement>(selector));
  buttons.forEach((button, index) => {
    button.setAttribute("tabindex", index === 0 ? "0" : "-1");
  });
}
