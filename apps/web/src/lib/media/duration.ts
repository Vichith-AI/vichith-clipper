export async function probeMediaDuration(file: File | Blob): Promise<number> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(video.duration || 0);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(0);
        };
    });
}
