import { type RefObject, useEffect } from "react";

interface UseDismissibleLayerOptions {
  open: boolean;
  onDismiss: () => void;
  refs: Array<RefObject<HTMLElement | null>>;
}

export function useDismissibleLayer({ open, onDismiss, refs }: UseDismissibleLayerOptions) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const clickedInside = refs.some((ref) => ref.current?.contains(target));

      if (!clickedInside) {
        onDismiss();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss, open, refs]);
}
