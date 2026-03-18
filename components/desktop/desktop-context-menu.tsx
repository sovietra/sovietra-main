"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import { StickyNote, Info, ImageIcon, LayoutDashboard } from "lucide-react";

interface DesktopContextMenuProps {
  children: React.ReactNode;
  onChangeWallpaper: () => void;
  onNewNote: () => void;
  onGetInfo: () => void;
  onEditWidgets: () => void;
}

export function DesktopContextMenu({
  children,
  onChangeWallpaper,
  onNewNote,
  onGetInfo,
  onEditWidgets,
}: DesktopContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="z-[95] min-w-[220px] rounded-lg overflow-hidden py-1 shadow-2xl border border-white/10"
          style={{ background: "rgba(30,30,30,0.92)", backdropFilter: "blur(30px)" }}
        >
          <MenuItem icon={<ImageIcon size={13} />} onClick={onChangeWallpaper}>
            Change Desktop Background…
          </MenuItem>
          <MenuItem icon={<LayoutDashboard size={13} />} onClick={onEditWidgets}>
            Edit Widgets
          </MenuItem>
          <MenuItem icon={<StickyNote size={13} />} onClick={onNewNote}>
            New Note
          </MenuItem>
          <ContextMenu.Separator className="my-1 h-px bg-white/10" />
          <MenuItem icon={<Info size={13} />} onClick={onGetInfo}>
            Get Info
          </MenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <ContextMenu.Item
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-white/90 cursor-default select-none outline-none
        data-[highlighted]:bg-blue-500/80 data-[highlighted]:text-white rounded-sm mx-1"
    >
      {icon && <span className="text-white/60">{icon}</span>}
      {children}
    </ContextMenu.Item>
  );
}
