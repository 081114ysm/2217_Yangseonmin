'use client';

import { ReactNode } from 'react';

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function Empty({ icon, title, description }: EmptyProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      {icon && <div className="text-gray-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-black">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}
