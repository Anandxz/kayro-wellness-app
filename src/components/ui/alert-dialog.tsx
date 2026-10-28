"use client";
// shadcn/ui composition, customized to Kayro's existing design tokens.
// https://ui.shadcn.com/docs/components/radix/alert-dialog
import * as Primitive from "@radix-ui/react-alert-dialog";
import type { ComponentProps } from "react";
export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogTitle = Primitive.Title;
export const AlertDialogDescription = Primitive.Description;
export const AlertDialogCancel = Primitive.Cancel;
export const AlertDialogAction = Primitive.Action;
export function AlertDialogContent({
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content {...props} className="dialog-content">
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
