"use client";

import React from "react";
import Loader from "~/components/ui/loader";

const DefaultLoader = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader />
    </div>
  );
};

export default DefaultLoader;
