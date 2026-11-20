export interface Gta6EntitlementState {
    eligible: boolean;
    used: number;
    remaining: number;
    cap: number;
    maxVodMinutes: number;
    windowActive: boolean;
    startsAt: string;
    endsAt: string;
}

export function isGta6WindowActive(): boolean {
    return true;
}

export function defaultGta6Entitlement(): Gta6EntitlementState {
    return {
        eligible: true,
        used: 0,
        remaining: 3,
        cap: 3,
        maxVodMinutes: 60,
        windowActive: true,
        startsAt: '2026-11-18T12:00:00Z',
        endsAt: '2026-11-27T00:00:00Z',
    };
}
