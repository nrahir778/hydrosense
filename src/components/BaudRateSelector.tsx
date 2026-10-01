import React from 'react';
import { Settings2 } from 'lucide-react';
import { SUPPORTED_BAUD_RATES } from '../services/webSerial';
import { triggerHaptic } from '../utils/androidOptimizations';

interface BaudRateSelectorProps {
  value: number;
  onChange: (baudRate: number) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  label?: string;
  showIcon?: boolean;
}

export const BaudRateSelector: React.FC<BaudRateSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  className = '',
  label,
  showIcon = true,
}) => {
  const currentBaud = Number(value) || 9600;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRate = parseInt(e.target.value, 10);
    if (!isNaN(newRate)) {
      triggerHaptic('tap');
      onChange(newRate);
    }
  };

  if (compact) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <label htmlFor="baud-rate-select-compact" className="sr-only">
          {label || 'Baud Rate'}
        </label>
        <select
          id="baud-rate-select-compact"
          value={currentBaud}
          onChange={handleChange}
          disabled={disabled}
          title={`USB Serial Baud Rate પસંદ કરો (હાલનું: ${currentBaud} Baud)`}
          aria-label="USB Serial Baud Rate"
          className="appearance-none bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 pr-6 text-xs font-mono font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-hidden focus:ring-2 focus:ring-sky-500 shadow-xs"
        >
          {SUPPORTED_BAUD_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate === 9600 ? '9600 (ડીફોલ્ટ)' : rate === 115200 ? '115200 (હાઈ સ્પીડ)' : `${rate}`}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-1.5 flex items-center text-slate-400">
          <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
          {showIcon && <Settings2 className="w-3.5 h-3.5 text-sky-500" />}
          <span>{label}</span>
        </span>
      )}
      <div className="relative inline-flex items-center">
        <select
          value={currentBaud}
          onChange={handleChange}
          disabled={disabled}
          title={`USB Serial Baud Rate પસંદ કરો (Arduino ફર્મવેર ડીફોલ્ટ: 9600)`}
          aria-label="USB Serial Baud Rate"
          className="appearance-none bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 pr-8 text-xs sm:text-sm font-mono font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-hidden focus:ring-2 focus:ring-sky-500 shadow-xs"
        >
          {SUPPORTED_BAUD_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate === 9600
                ? '9600 Baud (Arduino ડીફોલ્ટ)'
                : rate === 115200
                ? '115200 Baud (હાઈ સ્પીડ)'
                : `${rate} Baud`}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 flex items-center text-slate-400">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
