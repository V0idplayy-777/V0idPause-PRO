import React, { useEffect, useRef } from 'react';
import { Scissors, Copy, Trash2, Lock, Unlock, Volume2, VolumeX, CornerDownRight } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, clipId, onClose }) => {
  const { clips, updateClip, removeClips, duplicateClips, splitClip, currentTime } = useStore();
  const clip = clips.find(c => c.id === clipId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!clip) return null;

  const items = [
    {
      label: 'Split at Playhead', icon: <Scissors size={13} />,
      action: () => { splitClip(clipId, currentTime); onClose(); }
    },
    {
      label: 'Duplicate', icon: <Copy size={13} />,
      action: () => { duplicateClips([clipId]); onClose(); }
    },
    { separator: true },
    {
      label: clip.locked ? 'Unlock Clip' : 'Lock Clip',
      icon: clip.locked ? <Unlock size={13} /> : <Lock size={13} />,
      action: () => { updateClip(clipId, { locked: !clip.locked }); onClose(); }
    },
    {
      label: clip.muted ? 'Unmute Clip' : 'Mute Clip',
      icon: clip.muted ? <Volume2 size={13} /> : <VolumeX size={13} />,
      action: () => { updateClip(clipId, { muted: !clip.muted }); onClose(); }
    },
    {
      label: 'Transition: Fade',
      icon: <CornerDownRight size={13} />,
      action: () => { updateClip(clipId, { transition: 'fade' }); onClose(); }
    },
    { separator: true },
    {
      label: 'Delete Clip', icon: <Trash2 size={13} />, danger: true,
      action: () => { removeClips([clipId]); onClose(); }
    },
  ];

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) =>
        'separator' in item ? (
          <div key={i} className="context-menu-sep" />
        ) : (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={item.action}
          >
            <span className="context-menu-icon">{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
};
