"use client";

import React, { useEffect, useState } from "react";
import { Progress } from "~/components/ui/progress";

const DefaultLoader = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-md space-y-2 px-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Загрузка...</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>
    </div>
  );
};

export default DefaultLoader;
