import React, { useRef, useEffect } from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value = '',
  onChange,
  disabled = false,
  error = false,
  autoFocus = true,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Convert string value to 4-character array
  const digits = [
    value[0] || '',
    value[1] || '',
    value[2] || '',
    value[3] || '',
  ];

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return;

    const char = val.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join('');
    onChange(combined);

    if (char && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    const numericPasted = pasted.replace(/\D/g, '').slice(0, 4);

    if (numericPasted) {
      onChange(numericPasted);
      const focusIndex = Math.min(numericPasted.length, 3);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-3.5 mb-6" onPaste={handlePaste}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => (inputsRef.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          aria-label={`Digit ${idx + 1}`}
          className={`w-14 h-16 text-center text-2xl font-bold font-mono rounded-2xl border transition-all shadow-inner focus:outline-none ${
            error
              ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-4 focus:ring-rose-500/15 focus:border-rose-500'
              : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      ))}
    </div>
  );
};

export default OtpInput;
