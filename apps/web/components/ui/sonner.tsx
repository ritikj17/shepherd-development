"use client";

import { Toaster as SonnerToaster } from "sonner";

function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-card !text-foreground !shadow-[0_16px_40px_-16px_rgba(11,18,16,0.32)]",
          title: "!text-sm !font-semibold",
          description: "!text-sm !text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
          closeButton: "!border-border !bg-card",
          success: "!border-[#c9e2d3]",
          error: "!border-[#f0cdc8]",
          warning: "!border-[#ecd9b4]",
        },
      }}
    />
  );
}

export { Toaster };
