'use client';

import { useState } from 'react';

interface SettingToggleProps {
  label: string;
  description?: string;
  icon: string;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
}

export default function SettingToggle({ 
  label, 
  description, 
  icon, 
  defaultValue = false,
  onChange 
}: SettingToggleProps) {
  const [enabled, setEnabled] = useState(defaultValue);

  const handleToggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    onChange?.(newValue);
  };

  return (
    <button 
      className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between group"
      onClick={handleToggle}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
    >
      <span className="flex items-center gap-3 flex-1">
        <span className="text-lg" aria-hidden="true">{icon}</span>
        <span className="flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {description && (
            <span className="block text-xs text-gray-400 mt-0.5">{description}</span>
          )}
        </span>
      </span>
      
      {/* Toggle Switch */}
      <div 
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-gray-600'
        }`}
        aria-hidden="true"
      >
        <div 
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}
