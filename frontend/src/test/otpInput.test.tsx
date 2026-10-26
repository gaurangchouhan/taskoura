import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpInput } from '../components/auth/OtpInput';

const ControlledOtpInput: React.FC<{ initialValue?: string; onChange?: (val: string) => void }> = ({
  initialValue = '',
  onChange: externalOnChange,
}) => {
  const [val, setVal] = useState(initialValue);
  return (
    <OtpInput
      value={val}
      onChange={(newVal) => {
        setVal(newVal);
        externalOnChange?.(newVal);
      }}
    />
  );
};

describe('OtpInput Component', () => {
  it('renders 4 input boxes with proper accessibility labels', () => {
    render(<ControlledOtpInput />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(4);
    expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 4')).toBeInTheDocument();
  });

  it('auto-advances focus upon typing digits', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ControlledOtpInput onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];

    // Type '1' in first input
    await user.type(inputs[0], '1');
    expect(handleChange).toHaveBeenCalledWith('1');
    expect(inputs[1]).toHaveFocus();

    // Type '2' in second input
    await user.type(inputs[1], '2');
    expect(handleChange).toHaveBeenCalledWith('12');
    expect(inputs[2]).toHaveFocus();

    // Type '3' in third input
    await user.type(inputs[2], '3');
    expect(handleChange).toHaveBeenCalledWith('123');
    expect(inputs[3]).toHaveFocus();

    // Type '4' in fourth input
    await user.type(inputs[3], '4');
    expect(handleChange).toHaveBeenCalledWith('1234');
  });

  it('supports pasting a 4-digit code', () => {
    const handleChange = vi.fn();
    render(<ControlledOtpInput onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];

    const pasteData = {
      getData: (format: string) => (format === 'text' ? '9876' : ''),
    };

    fireEvent.paste(inputs[0].parentElement!, {
      clipboardData: pasteData,
    });

    expect(handleChange).toHaveBeenCalledWith('9876');
  });

  it('navigates back on backspace when box is empty', async () => {
    const user = userEvent.setup();
    render(<ControlledOtpInput initialValue="12" />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];

    // Focus third box (which is currently empty)
    inputs[2].focus();
    expect(inputs[2]).toHaveFocus();

    // Press backspace in empty box 2 -> focus should move back to box 1 (index 1)
    await user.keyboard('{Backspace}');
    expect(inputs[1]).toHaveFocus();
  });

  it('navigates with left and right arrow keys', async () => {
    const user = userEvent.setup();
    render(<ControlledOtpInput initialValue="1234" />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];

    inputs[1].focus();
    expect(inputs[1]).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(inputs[2]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(inputs[1]).toHaveFocus();
  });
});
