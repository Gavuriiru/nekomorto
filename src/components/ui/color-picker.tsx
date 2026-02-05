import React from "react";
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker as AriaColorPicker,
  ColorPickerProps as AriaColorPickerProps,
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

export interface ColorPickerProps extends Omit<AriaColorPickerProps, "children"> {
  label?: string;
  trigger?: React.ReactNode;
  showSwatch?: boolean;
  buttonClassName?: string;
}

export const ColorPicker = ({
  label,
  trigger,
  showSwatch = true,
  buttonClassName,
  ...props
}: ColorPickerProps) => {
  return (
    <AriaColorPicker {...props}>
      <DialogTrigger>
        <Button
          className={
            buttonClassName ??
            "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm transition hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          }
        >
          {trigger ? (
            trigger
          ) : (
            <>
              {showSwatch ? (
                <ColorSwatch className="h-5 w-5 rounded-md border border-white/20 shadow-inner" />
              ) : null}
              <span className="truncate">{label}</span>
            </>
          )}
        </Button>
        <Popover
          placement="bottom start"
          className="z-50 rounded-xl border border-border/60 bg-card/95 p-3 shadow-xl"
        >
          <Dialog className="flex w-64 flex-col gap-3">
            <ColorArea
              colorSpace="hsb"
              xChannel="saturation"
              yChannel="brightness"
              className="relative h-32 w-full overflow-hidden rounded-lg border border-border/60"
            >
              <ColorThumb className="absolute h-4 w-4 rounded-full border-2 border-white shadow-md data-[dragging]:scale-110 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring" />
            </ColorArea>
            <ColorSlider colorSpace="hsb" channel="hue" className="w-full">
              <SliderTrack className="relative h-3 w-full rounded-full border border-border/60">
                <ColorThumb className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white shadow-md data-[dragging]:scale-110 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring" />
              </SliderTrack>
            </ColorSlider>
            <ColorField className="flex flex-col gap-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Hex</Label>
              <Input className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
            </ColorField>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </AriaColorPicker>
  );
};
