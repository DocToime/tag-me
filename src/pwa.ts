import { registerSW } from "virtual:pwa-register";
type Listener = () => void;
const listeners = new Set<Listener>();
let needRefresh = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
export function pwaNeedRefresh() {
  return needRefresh;
}
export function subscribePwa(listener: Listener) {
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
  };
}
export function applyPwaUpdate() {
  void updateSW?.(true);
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  try {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh = true;
        listeners.forEach((listener) => listener());
      },
    });
  } catch {
    /* Registration is optional; play still works online. */
  }
}
