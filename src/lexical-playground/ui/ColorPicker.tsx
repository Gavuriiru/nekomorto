/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {ColorPicker as AriaColorPicker} from '@/components/ui/color-picker';

interface ColorPickerProps {
  color: string;
  onChange?: (
    value: string,
    skipHistoryStack: boolean,
    skipRefocus: boolean,
  ) => void;
}

export default function ColorPicker({
  color,
  onChange,
}: Readonly<ColorPickerProps>): JSX.Element {
  const handleChange = (nextColor: unknown) => {
    if (!onChange) {
      return;
    }

    const next =
      typeof (nextColor as {toString?: (format?: string) => string})
        ?.toString === 'function'
        ? (nextColor as {toString: (format?: string) => string}).toString('hex')
        : String(nextColor);

    onChange(next, false, true);
  };

  return (
    <div className="lexical-aria-color-picker">
      <AriaColorPicker
        inline
        showSwatch={false}
        value={color || '#000000'}
        onChange={handleChange}
      />
    </div>
  );
}
