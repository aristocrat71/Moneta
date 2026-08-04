export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  sticky?: boolean;
}

let nextId = 1;

class ToastStore {
  list = $state<Toast[]>([]);

  show(message: string, opts?: { action?: Toast['action']; sticky?: boolean }): number {
    const id = nextId++;
    this.list.push({ id, message, action: opts?.action, sticky: opts?.sticky });
    if (!opts?.sticky) {
      setTimeout(() => this.dismiss(id), 5000);
    }
    return id;
  }

  dismiss(id: number): void {
    this.list = this.list.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastStore();
