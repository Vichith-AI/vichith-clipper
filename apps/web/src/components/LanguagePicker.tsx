'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Globe } from 'lucide-react';

export interface LanguageOption {
    code: string;
    label: string;
    nativeName?: string;
    engine: 'sarvam' | 'cloud' | 'auto';
    engineLabel: string;
}

export const CLIPPER_LANGUAGES: LanguageOption[] = [
    { code: 'auto', label: 'Auto-detect', engine: 'auto', engineLabel: 'Cloud Whisper' },

    // Indic Languages (Sarvam AI)
    { code: 'en-IN', label: 'English (India)', nativeName: 'Indian English', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'hi-IN', label: 'Hinglish', nativeName: 'Hindi + English', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'mr', label: 'Marathi', nativeName: 'मराठी', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', engine: 'sarvam', engineLabel: 'Sarvam AI' },
    { code: 'or', label: 'Odia', nativeName: 'ଓଡ଼ିଆ', engine: 'sarvam', engineLabel: 'Sarvam AI' },

    // Global Languages (Cloud Whisper)
    { code: 'en-US', label: 'English (US)', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'en-GB', label: 'English (UK)', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'es', label: 'Spanish', nativeName: 'Español', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'pt', label: 'Portuguese', nativeName: 'Português', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'fr', label: 'French', nativeName: 'Français', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'de', label: 'German', nativeName: 'Deutsch', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'ja', label: 'Japanese', nativeName: '日本語', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'ko', label: 'Korean', nativeName: '한국어', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'ar', label: 'Arabic', nativeName: 'العربية', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'ru', label: 'Russian', nativeName: 'Русский', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'tr', label: 'Turkish', nativeName: 'Türkçe', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'it', label: 'Italian', nativeName: 'Italiano', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'nl', label: 'Dutch', nativeName: 'Nederlands', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'pl', label: 'Polish', nativeName: 'Polski', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'sv', label: 'Swedish', nativeName: 'Svenska', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'vi', label: 'Vietnamese', nativeName: 'Tiếng Việt', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'th', label: 'Thai', nativeName: 'ไทย', engine: 'cloud', engineLabel: 'Cloud Whisper' },
    { code: 'zh', label: 'Chinese (Mandarin)', nativeName: '中文', engine: 'cloud', engineLabel: 'Cloud Whisper' },
];

interface LanguagePickerProps {
    value: string;
    onChange: (code: string) => void;
    disabled?: boolean;
}

export function LanguagePicker({ value, onChange, disabled }: LanguagePickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => {
        return CLIPPER_LANGUAGES.find((lang) => lang.code === value) ?? CLIPPER_LANGUAGES[0];
    }, [value]);

    const filteredLanguages = useMemo(() => {
        if (!search.trim()) return CLIPPER_LANGUAGES;
        const q = search.toLowerCase().trim();
        return CLIPPER_LANGUAGES.filter(
            (lang) =>
                lang.label.toLowerCase().includes(q) ||
                lang.code.toLowerCase().includes(q) ||
                (lang.nativeName && lang.nativeName.toLowerCase().includes(q)),
        );
    }, [search]);

    const grouped = useMemo(() => {
        const auto = filteredLanguages.filter((l) => l.engine === 'auto');
        const indic = filteredLanguages.filter((l) => l.engine === 'sarvam');
        const global = filteredLanguages.filter((l) => l.engine === 'cloud');
        return { auto, indic, global };
    }, [filteredLanguages]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="group flex h-11 w-full items-center justify-between rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-3.5 text-left text-[13px] text-vichith-white transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
                <div className="flex items-center gap-2.5 truncate">
                    <Globe className="h-4 w-4 shrink-0 text-vichith-silver transition-colors group-hover:text-vichith-white" />
                    <span className="truncate font-medium">{selectedOption.label}</span>
                    {selectedOption.nativeName && (
                        <span className="hidden font-mono text-[11px] text-vichith-muted sm:inline">({selectedOption.nativeName})</span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-2">
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-vichith-silver">
                        {selectedOption.engineLabel}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-vichith-muted transition-transform duration-200 ${open ? 'rotate-180 text-vichith-white' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="absolute left-0 top-full z-50 mt-1.5 flex max-h-80 w-full flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#121214] p-2 shadow-2xl backdrop-blur-xl">
                    <div className="relative mb-2 shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-vichith-muted" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search languages..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.05] pl-8 pr-3 text-[12px] text-white placeholder:text-zinc-500 focus:border-white/20 focus:bg-white/[0.08] focus:outline-none"
                        />
                    </div>

                    <div className="overflow-y-auto space-y-3 pr-1 text-[13px]" style={{ maxHeight: '240px' }}>
                        {filteredLanguages.length === 0 ? (
                            <div className="py-6 text-center text-[12px] text-vichith-muted">No language matches &ldquo;{search}&rdquo;</div>
                        ) : (
                            <>
                                {grouped.auto.length > 0 && (
                                    <div className="space-y-1">
                                        {grouped.auto.map((lang) => (
                                            <LanguageItem
                                                key={lang.code}
                                                lang={lang}
                                                isSelected={value === lang.code}
                                                onSelect={() => {
                                                    onChange(lang.code);
                                                    setOpen(false);
                                                    setSearch('');
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {grouped.indic.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="px-2 pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-vichith-muted">
                                            Indic Languages · Sarvam AI
                                        </div>
                                        {grouped.indic.map((lang) => (
                                            <LanguageItem
                                                key={lang.code}
                                                lang={lang}
                                                isSelected={value === lang.code}
                                                onSelect={() => {
                                                    onChange(lang.code);
                                                    setOpen(false);
                                                    setSearch('');
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {grouped.global.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="px-2 pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-vichith-muted">
                                            Global Languages · Cloud Whisper
                                        </div>
                                        {grouped.global.map((lang) => (
                                            <LanguageItem
                                                key={lang.code}
                                                lang={lang}
                                                isSelected={value === lang.code}
                                                onSelect={() => {
                                                    onChange(lang.code);
                                                    setOpen(false);
                                                    setSearch('');
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function LanguageItem({
    lang,
    isSelected,
    onSelect,
}: {
    lang: LanguageOption;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left transition-colors ${
                isSelected ? 'bg-white/[0.08] text-vichith-white font-medium' : 'text-vichith-silver hover:bg-white/[0.04] hover:text-white'
            }`}
        >
            <div className="flex items-center gap-2 truncate">
                <span className="truncate">{lang.label}</span>
                {lang.nativeName && (
                    <span className="font-mono text-[11px] text-zinc-500">({lang.nativeName})</span>
                )}
            </div>
            <div className="flex items-center gap-2 pl-2 shrink-0">
                <span className="text-[11px] font-mono text-zinc-500">{lang.code}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-vichith-white" />}
            </div>
        </button>
    );
}
