'use client';

export function useWallet() {
    return {
        balance: 100,
        loading: false,
        refresh: async () => {},
    };
}
