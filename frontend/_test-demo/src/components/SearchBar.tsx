'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSearch(value);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <div
      className={`relative flex items-center rounded-xl border transition-all ${className}`}
      style={{
        borderColor: focused ? '#6366f1' : '#6366f140',
        background: '#6366f110',
        boxShadow: focused ? '0 0 0 3px #6366f120' : 'none',
      }}
    >
      <Search
        className="w-5 h-5 ml-4 flex-shrink-0"
        style={{ color: focused ? '#6366f1' : '#e2e8f050' }}
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full px-3 py-3 bg-transparent outline-none text-sm"
        style={{ color: '#e2e8f0' }}
      />
      {query && (
        <button
          onClick={handleClear}
          className="mr-3 p-1 rounded-lg transition-colors hover:bg-white/10"
        >
          <X className="w-4 h-4" style={{ color: '#e2e8f050' }} />
        </button>
      )}
    </div>
  );
}
