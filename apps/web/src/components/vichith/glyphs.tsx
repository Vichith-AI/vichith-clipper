import React from 'react';

export function VichithGlyph({ className = "w-4 h-4" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
}

export function GlyphWorking({ className = "w-4 h-4" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} animate-spin`}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="30 60" strokeLinecap="round"/>
        </svg>
    );
}
