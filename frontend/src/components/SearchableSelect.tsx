import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
  value: any;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (id: string, value: any) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Tanlang...", 
  label,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);
  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) || 
    (o.subLabel && o.subLabel.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="form-label">{label}</label>}

      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-control bg-white border rounded-control px-3 py-1.5 flex items-center justify-between cursor-pointer transition-all duration-120 ${
          isOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900">{selectedOption.label}</span>
              {selectedOption.subLabel && <span className="text-xs text-slate-500">{selectedOption.subLabel}</span>}
            </div>
          ) : (
            <span className="text-sm text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-120 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-dropdown w-full mt-1.5 bg-white border border-slate-200 rounded-card shadow-md overflow-hidden animate-slide-up">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qidirish..."
                className="w-full h-control-sm bg-white border border-slate-200 rounded-control pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-120 placeholder-slate-400"
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scroll">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div 
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id, opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`px-3 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors duration-120 ${
                    value === opt.id ? 'bg-primary-50/60' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                    {opt.subLabel && <span className="text-xs text-slate-500">{opt.subLabel}</span>}
                  </div>
                  {value === opt.id && <Check size={16} className="text-primary-600" />}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                Hech narsa topilmadi
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
