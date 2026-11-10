"use strict";

import { useCallback } from "react";
import { toast as sonner } from "sonner";

export type ToastVariant = "default" | "destructive" | "success";

export function useToast() {
  const show = useCallback(
    (message: string, options?: { variant?: ToastVariant; [key: string]: unknown }) => {
      const { variant, ...rest } = options ?? {};
      if (variant === "destructive") {
        return sonner.error(message, rest);
      }
      if (variant === "success") {
        return sonner.success(message, rest);
      }
      return sonner(message, rest);
    },
    [],
  );

  return { show };
}
