"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "./button";
import { clsx } from "clsx";

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void | Promise<void>;
  href?: string;
  target?: string;
  variant?: "default" | "danger";
  confirm?: string; // Prompt message if confirmation is needed
  disabled?: boolean;
  loading?: boolean;
  "data-testid"?: string;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  trigger?: React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
  menuClassName?: string;
}

export function ActionMenu({
  items,
  trigger,
  align = "right",
  triggerClassName,
  menuClassName,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Toggle open state
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleItemClick = async (e: React.MouseEvent, item: ActionMenuItem) => {
    e.preventDefault();
    e.stopPropagation();

    if (item.disabled || item.loading) return;

    if (item.confirm) {
      const confirmed = window.confirm(item.confirm);
      if (!confirmed) return;
    }

    setOpen(false);

    if (item.onClick) {
      await item.onClick(e);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <div onClick={handleToggle} className="inline-block cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className={clsx("hover:bg-slate-100 text-slate-500 hover:text-slate-800", triggerClassName)}
          aria-label="Actions menu"
          data-testid="action-menu-trigger"
        >
          ⋯
        </Button>
      )}

      {open && (
        <div
          className={clsx(
            "absolute mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-30 focus:outline-none dark:border-slate-800 dark:bg-slate-900",
            align === "right" ? "right-0" : "left-0",
            menuClassName
          )}
          role="menu"
        >
          {items.map((item, index) => {
            const isDanger = item.variant === "danger";
            const classes = clsx(
              "flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium transition cursor-pointer select-none",
              isDanger
                ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
              (item.disabled || item.loading) && "opacity-40 cursor-not-allowed pointer-events-none"
            );

            if (item.href) {
              return (
                <Link
                  key={index}
                  href={item.href}
                  target={item.target}
                  className={classes}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  data-testid={item["data-testid"]}
                >
                  {item.icon && <span className="h-3.5 w-3.5 shrink-0">{item.icon}</span>}
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={index}
                type="button"
                className={classes}
                role="menuitem"
                onClick={(e) => handleItemClick(e, item)}
                disabled={item.disabled || item.loading}
                data-testid={item["data-testid"]}
              >
                {item.icon && <span className="h-3.5 w-3.5 shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
