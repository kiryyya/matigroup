"use client";

import { UpdateIcon } from "@radix-ui/react-icons";
import React from "react";

const DefaultLoader = () => (
  <div className="flex h-full w-full animate-pulse items-center justify-center text-muted-foreground">
    <UpdateIcon className="h-32 w-32 animate-spin" />
  </div>
);

export default DefaultLoader;
