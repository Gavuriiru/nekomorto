import React from "react";
import {
  Button,
  ColorArea,
  ColorPicker as AriaColorPicker,
  ColorPickerProps as AriaColorPickerProps,
  ColorPickerStateContext,
  ColorSlider,
  ColorSwatch,
  ColorThumb,
  Dialog,
  DialogTrigger,
  Input,
  Label,
  Popover,
  SliderTrack,
} from "react-aria-components";
import { parseColor } from "@react-stately/color";
import "./color-picker.css";

export interface ColorPickerProps extends Omit<AriaColorPickerProps, "children"> {
  label?: string;
  trigger?: React.ReactNode;
  showSwatch?: boolean;
  buttonClassName?: string;
  inline?: boolean;
  panelClassName?: string;
  popoverClassName?: string;
}

const HexField = ({ className }: { className: string }) => {
  const state = React.useContext(ColorPickerStateContext);
  const hexId = React.useId();
  const isEditingRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(
    () => state?.color?.toString("hex") ?? "",
  );

  React.useEffect(() => {
    if (!state || isEditingRef.current) {
      return;
    }
    setInputValue(state.color?.toString("hex") ?? "");
  }, [state?.color, state]);

  const normalizeHex = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  const isValidHex = (value: string) =>
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setInputValue(raw);
    if (!state) {
      return;
    }
    const normalized = normalizeHex(raw);
    if (!isValidHex(normalized)) {
      return;
    }
    try {
      const next = parseColor(normalized);
      state.setColor(next);
    } catch {
      // Ignore invalid parse while typing.
    }
  };

  const handleBlur = React.useCallback(() => {
    isEditingRef.current = false;
    setIsEditing(false);
    if (!state) {
      return;
    }
    const normalized = normalizeHex(inputValue);
    if (normalized && isValidHex(normalized)) {
      try {
        const next = parseColor(normalized);
        state.setColor(next);
        setInputValue(next.toString("hex"));
        return;
      } catch {
        // Fall through to reset.
      }
    }
    setInputValue(state.color?.toString("hex") ?? "");
  }, [inputValue, state]);

  React.useEffect(() => {
    if (!isEditing) {
      return;
    }
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest(".rainbow-color-picker-panel")) {
        return;
      }
      if (inputRef.current && inputRef.current.contains(target)) {
        return;
      }
      handleBlur();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [handleBlur, isEditing]);

  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={hexId}
        className="text-[11px] uppercase tracking-wide text-muted-foreground"
      >
        Hex
      </Label>
      <Input
        id={hexId}
        value={inputValue}
        onChange={handleChange}
        onFocus={() => {
          isEditingRef.current = true;
          setIsEditing(true);
        }}
        onBlur={handleBlur}
        ref={inputRef}
        className={className}
      />
    </div>
  );
};

export const ColorPicker = ({
  label,
  trigger,
  showSwatch = true,
  buttonClassName,
  inline = false,
  panelClassName,
  popoverClassName,
  ...props
}: ColorPickerProps) => {

  const panelClasses = panelClassName
    ? `rainbow-color-picker-panel flex flex-col ${panelClassName}`
    : "rainbow-color-picker-panel flex flex-col";
  const popoverClasses =
    popoverClassName ??
    "z-50 rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl";
  const panelContent = (
    <>
      <ColorArea
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
        className="block h-32 w-full overflow-hidden rounded-lg border border-border/60"
      >
        <ColorThumb className="absolute h-4 w-4 rounded-full border-2 border-white shadow-md data-dragging:scale-110 data-focus-visible:ring-2 data-focus-visible:ring-ring" />
      </ColorArea>
      <ColorSlider colorSpace="hsb" channel="hue" className="block w-full">
        <SliderTrack className="relative h-3 w-full rounded-full border border-border/60">
          <ColorThumb className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white shadow-md data-dragging:scale-110 data-focus-visible:ring-2 data-focus-visible:ring-ring" />
        </SliderTrack>
      </ColorSlider>
      <HexField className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
    </>
  );

  return (
    <AriaColorPicker {...props}>
      {inline ? (
        <div className={panelClasses}>{panelContent}</div>
      ) : (
        <DialogTrigger>
          <Button
            className={
              buttonClassName ??
              "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-sm text-foreground shadow-xs transition hover:border-primary/40 hover:bg-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            }
          >
            {trigger ? (
              trigger
            ) : (
              <>
                {showSwatch ? (
                  <ColorSwatch className="h-5 w-5 rounded-md border border-border/70 shadow-inner" />
                ) : null}
                <span className="truncate">{label}</span>
              </>
            )}
          </Button>
          <Popover placement="bottom start" className={popoverClasses}>
            <Dialog className={panelClasses}>{panelContent}</Dialog>
          </Popover>
        </DialogTrigger>
      )}
    </AriaColorPicker>
  );
};

