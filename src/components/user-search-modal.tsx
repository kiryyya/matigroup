"use client";

import React from "react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from "~/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "~/lib/utils";
import UserSearch from "~/components/user-search";
import { Button } from "~/components/ui/button";

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
CustomDialogContent.displayName = "CustomDialogContent";

export default function UserSearchModal({ isOpen, onClose }: UserSearchModalProps) {
  return (
    <Dialog open={isOpen}>
      <CustomDialogContent className="max-w-2xl max-h-full overflow-y-auto pt-28 pb-4">
        <DialogHeader>
          <DialogTitle>Поиск пользователей</DialogTitle>
          <DialogDescription>
            Найдите пользователей по имени или email и управляйте их ролями
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <UserSearch />
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Закрыть</Button>
          </div>
        </div>
      </CustomDialogContent>
    </Dialog>
  );
}


