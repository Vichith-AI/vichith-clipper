'use client';

import { useState } from 'react';

export interface ProjectSummary {
    id: string;
    title: string;
    updatedAt?: string;
}

export function useProjects() {
    const [projects, setProjects] = useState<ProjectSummary[]>([
        { id: 'proj-clipper-default', title: 'Clipper Project', updatedAt: new Date().toISOString() },
    ]);

    const create = async (title: string) => {
        const newProj = {
            id: `proj-${Date.now().toString(36)}`,
            title: title || 'New Clipper Project',
            updatedAt: new Date().toISOString(),
        };
        setProjects((prev) => [newProj, ...prev]);
        return newProj;
    };

    return { projects, create, loading: false };
}
