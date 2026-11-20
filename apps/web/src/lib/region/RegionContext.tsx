'use client';

import React, { createContext, useContext } from 'react';

const RegionCtx = createContext<{ region: string }>({ region: 'IN' });

export function RegionProvider({ children }: { children: React.ReactNode }) {
    return <RegionCtx.Provider value={{ region: 'IN' }}>{children}</RegionCtx.Provider>;
}

export function useRegion() {
    return useContext(RegionCtx);
}
