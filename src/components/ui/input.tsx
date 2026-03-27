import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentPropsWithoutRef<"input"> & {
  onCancel?: React.ReactEventHandler<HTMLInputElement>;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onCancel, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      const node = inputRef.current;
      if (!node || !onCancel) {
        return;
      }

      const handleCancel = (event: Event) => {
        onCancel(event as unknown as React.SyntheticEvent<HTMLInputElement, Event>);
      };

      node.addEventListener("cancel", handleCancel);
      return () => {
        node.removeEventListener("cancel", handleCancel);
      };
    }, [onCancel]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 min-w-0 w-full appearance-none rounded-md border border-input bg-background px-3 py-0 text-base leading-normal file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:leading-normal placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50 md:text-[14px]",
          className,
        )}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") {
            ref(node);
            return;
          }
          if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
