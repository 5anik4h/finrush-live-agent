"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {icon && (
        <div className="text-4xl mb-4 opacity-60">{icon}</div>
      )}
      <h3 className="text-foreground font-medium text-base mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-xs mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
