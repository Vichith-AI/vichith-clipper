export function trackLaunchEvent(name: string, payload?: Record<string, unknown>) {
    // Standalone telemetry logger
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[telemetry] ${name}`, payload);
    }
}
