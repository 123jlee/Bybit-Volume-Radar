import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    label: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(s => s !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const handleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange(options);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-xs uppercase text-gray-400 mb-1">{label} ({selected.length}/{options.length})</label>

            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between bg-[#121418] border border-white/10 rounded px-3 py-2 cursor-pointer hover:border-white/20 transition-colors"
            >
                <span className="text-xs text-gray-300 truncate">
                    {selected.length === 0 ? 'Select Symbols...' :
                        selected.length === options.length ? 'All Active Symbols' :
                            `${selected.length} Selected`}
                </span>
                <ChevronDown size={14} className={clsx("text-gray-500 transition-transform", isOpen && "rotate-180")} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#121418] border border-white/10 rounded shadow-xl max-h-60 overflow-y-auto z-50 p-2 space-y-1">
                    <div
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer text-xs font-bold text-blue-400 mb-2 border-b border-white/5"
                    >
                        <div className={clsx("w-3 h-3 border rounded flex items-center justify-center", selected.length === options.length ? "bg-blue-600 border-blue-600" : "border-gray-500")}>
                            {selected.length === options.length && <Check size={10} className="text-white" />}
                        </div>
                        Select All
                    </div>

                    {options.map(opt => {
                        const isSelected = selected.includes(opt);
                        return (
                            <div
                                key={opt}
                                onClick={() => toggleOption(opt)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer text-xs text-gray-300"
                            >
                                <div className={clsx("w-3 h-3 border rounded flex items-center justify-center transition-colors", isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600")}>
                                    {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                {opt}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
