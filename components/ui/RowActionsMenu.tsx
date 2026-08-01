"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const visibleActions = actions.filter((a) => !a.hidden);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 220px of space below the button, open upward to prevent overflow
      setOpenUpward(spaceBelow < 220);
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (visibleActions.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none"
        title="More Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 w-44 rounded-md shadow-xl bg-white border border-slate-200 ring-1 ring-black/5 divide-y divide-slate-100 focus:outline-none z-50 ${
            openUpward
              ? "bottom-full mb-1 origin-bottom-right"
              : "top-full mt-1 origin-top-right"
          }`}
        >
          <div className="py-1">
            {visibleActions.map((action, idx) => {
              const Icon = action.icon;
              const isDanger = action.variant === "danger";
              const isTeal = action.variant === "teal";

              return (
                <button
                  key={idx}
                  onClick={() => {
                    setIsOpen(false);
                    action.onClick();
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center space-x-2 transition ${
                    isDanger
                      ? "text-rose-600 hover:bg-rose-50"
                      : isTeal
                      ? "text-teal-700 font-semibold hover:bg-teal-50"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {Icon && (
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isDanger
                          ? "text-rose-500"
                          : isTeal
                          ? "text-teal-600"
                          : "text-slate-400"
                      }`}
                    />
                  )}
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
