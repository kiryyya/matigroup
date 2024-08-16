"use client";

import Link from "next/link";
import React from "react";
import { Button, buttonVariants } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

export type ErrorPageProps = {
  error: {
    message: string;
  };
};

const DefaultError = ({ error: { message } }: ErrorPageProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Whoops, error happened</CardTitle>
        <CardDescription>
          Please, try again later. If the problem persists, please contact IT
          team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <blockquote className="border-l-4 py-4 pl-4 font-mono text-sm italic">
          {message}
        </blockquote>
      </CardContent>
      <CardFooter className="space-x-2">
        <Button
          onClick={() => {
            window.location.reload();
          }}
          variant="secondary"
        >
          Refresh page
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home page
        </Link>
      </CardFooter>
    </Card>
  );
};

export default DefaultError;
