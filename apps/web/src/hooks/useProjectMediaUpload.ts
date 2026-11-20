'use client';

import { useState } from 'react';

export function useProjectMediaUpload(projectId: string | null) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const upload = async (file: File) => {
        setUploading(true);
        setProgress(0.1);

        try {
            // Create local object URL for instant preview
            const objectUrl = URL.createObjectURL(file);
            const assetId = `asset-${Date.now().toString(36)}`;

            setProgress(1.0);
            setUploading(false);

            return {
                id: assetId,
                url: objectUrl,
                kind: 'video' as const,
                status: 'ready',
                source: 'uploaded',
                createdAt: new Date().toISOString(),
                file,
            };
        } catch (err) {
            setUploading(false);
            throw err;
        }
    };

    return { upload, uploading, progress };
}
