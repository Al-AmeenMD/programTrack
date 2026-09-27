"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type RowActionItem = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "danger" | "teal";
  hidden?: boolean;
};

interface RowActionsMenuProps {
  actions: RowActionItem[];
}

export function RowActionsMenu({ actions }: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number; openUpward: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const visibleActions = actions.filter((a) => !a.hidden);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > 220;

    setCoords({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      right: Math.max(window.innerWidth - rect.right, 8),
      openUpward,
    });
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  if (visibleActions.length === 0) return null;

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none cursor-pointer"
        title="More Actions"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords.openUpward ? undefined : `${coords.top}px`,
              bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : undefined,
              right: `${coords.right}px`,
            }}
            className="w-48 rounded-md shadow-xl bg-white border border-slate-200 ring-1 ring-black/5 divide-y divide-slate-100 focus:outline-none z-9999 animate-in fade-in-0 zoom-in-95 duration-75"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              {visibleActions.map((action, idx) => {
                const Icon = action.icon;
                const isDanger = action.variant === "danger";
                const isTeal = action.variant === "teal";

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      action.onClick();
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center space-x-2 transition cursor-pointer ${
                      isDanger
                        ? "text-rose-600 hover:bg-rose-50"
                        : isTeal
                        ? "text-teal-700 font-semibold hover:bg-teal-50"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {Icon && (
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isDanger
                            ? "text-rose-500"
                            : isTeal
                            ? "text-teal-600"
                            : "text-slate-400"
                        }`}
                      />
                    )}
                    <span className="truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
