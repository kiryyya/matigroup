"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface LoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const Loader = ({ className, size = "md" }: LoaderProps) => {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-9 h-9 border-4",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div
      className={cn(
        "border-solid rounded-full loader-spin",
        sizeClasses[size],
        className
      )}
      style={{
        borderColor: "rgba(0, 0, 0, 0.1)",
        borderLeftColor: "transparent",
      }}
    />
  );
};

export default Loader;
