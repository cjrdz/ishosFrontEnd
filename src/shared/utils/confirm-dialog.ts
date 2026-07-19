type ConfirmAction = () => void;

type ConfirmDialogState = {
  open: boolean;
  title: string;
  message: string;
  action: ConfirmAction | null;
};

export function createConfirmDialogState(
  defaultTitle = "Confirmar accion",
): ConfirmDialogState {
  return {
    open: false,
    title: defaultTitle,
    message: "",
    action: null,
  };
}

export function openConfirmDialog(
  state: ConfirmDialogState,
  title: string,
  message: string,
  action: ConfirmAction,
): void {
  state.title = title;
  state.message = message;
  state.action = action;
  state.open = true;
}

export function confirmDialogNow(state: ConfirmDialogState): void {
  const action = state.action;
  closeConfirmDialog(state);
  if (action) {
    action();
  }
}

export function closeConfirmDialog(state: ConfirmDialogState): void {
  state.action = null;
  state.open = false;
}
