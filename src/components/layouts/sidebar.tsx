"use client";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarSections } from "~/lib/app";

export function Sidebar({ className }: { className?: string }) {
  const route = usePathname();

  return (
    <div
      className={cn(
        "bg-card min-h-[calc(100vh-66px)] max-w-[70px] pb-12 md:max-w-[240px]",
        className,
      )}
    >
      <div className="space-y-4 overflow-hidden py-4">
        {sidebarSections.map((section) => (
          <div key={section.title} className="px-3 py-2">
            <h2 className="mb-2 hidden items-center truncate px-4 text-lg font-semibold tracking-tight md:flex">
              {section.title}
              {section.subtext && (
                <p className="text-muted-foreground ml-1 text-xs">
                  {section.subtext}
                </p>
              )}
            </h2>
            <div className="space-y-1">
              {section.buttons.map((button) => (
                <Link
                  href={button.href || "/"}
                  key={button.text}
                  className={cn("w-full justify-start")}
                  target={button.external ? "_blank" : "_self"}
                >
                  <Button
                    variant={route === button.href ? "secondary" : "ghost"}
                    disabled={button.disabled}
                    className="w-full justify-start truncate"
                  >
                    <button.icon className="mr-2 h-4 min-h-4 w-4 min-w-4" />
                    <div className="hidden md:flex">
                      {button.text}
                      {button.subtext && (
                        <>
                          {" "}
                          <p className="text-muted-foreground ml-1 text-xs">
                            {button.subtext}
                          </p>
                        </>
                      )}
                    </div>
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
