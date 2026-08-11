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
      {label && <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">{label}</label>}
      
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 border rounded-xl py-3 px-4 flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'border-slate-500 ring-4 ring-slate-500/10 bg-white' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">{selectedOption.label}</span>
              {selectedOption.subLabel && <span className="text-xs font-bold text-slate-600 uppercase">{selectedOption.subLabel}</span>}
            </div>
          ) : (
            <span className="text-sm font-bold text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                autoFocus
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qidirish..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:border-slate-400 focus:bg-white transition-all"
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
                  className={`px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors ${
                    value === opt.id ? 'bg-slate-50/50' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-sm ${value === opt.id ? 'font-bold text-slate-700' : 'font-bold text-slate-700'}`}>
                      {opt.label}
                    </span>
                    {opt.subLabel && <span className="text-xs font-bold text-slate-400 uppercase">{opt.subLabel}</span>}
                  </div>
                  {value === opt.id && <Check size={16} className="text-slate-600" />}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-slate-400 text-xs font-bold italic">
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
