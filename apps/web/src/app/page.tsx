import { Suspense } from 'react';
import { ClipperWorkspace } from '@/components/ClipperWorkspace';

export default function ClipperHomePage() {
  return (
    <main className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[#060707]">
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-[#8E959E]">
          Loading Vichith Clipper studio...
        </div>
      }>
        <ClipperWorkspace />
      </Suspense>
    </main>
  );
}
