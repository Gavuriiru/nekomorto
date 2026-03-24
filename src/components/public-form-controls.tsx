import * as React from "react";

import { publicStrongFocusFieldClassName } from "@/components/public-page-tokens";
import { Input as BaseInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger as BaseSelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PublicInputProps = React.ComponentPropsWithoutRef<typeof BaseInput>;
type PublicTextareaProps = React.ComponentPropsWithoutRef<typeof BaseTextarea>;
type PublicSelectTriggerProps = React.ComponentPropsWithoutRef<typeof BaseSelectTrigger>;

const Input = React.forwardRef<HTMLInputElement, PublicInputProps>(({ className, ...props }, ref) => (
  <BaseInput ref={ref} className={cn(publicStrongFocusFieldClassName, className)} {...props} />
));
Input.displayName = "PublicInput";

const Textarea = React.forwardRef<HTMLTextAreaElement, PublicTextareaProps>(
  ({ className, ...props }, ref) => (
    <BaseTextarea ref={ref} className={cn(publicStrongFocusFieldClassName, className)} {...props} />
  ),
);
Textarea.displayName = "PublicTextarea";

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof BaseSelectTrigger>,
  PublicSelectTriggerProps
>(({ className, ...props }, ref) => (
  <BaseSelectTrigger
    ref={ref}
    className={cn(publicStrongFocusFieldClassName, className)}
    {...props}
  />
));
SelectTrigger.displayName = "PublicSelectTrigger";

export { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea };
