import React from 'react';
import { useStore } from '../store/useStore';

export const StatusBar: React.FC = () => {
  const { clips, tracks, duration, fps, selectedClipIds, zoom, snapEnabled } = useStore();
  const selected = selectedClipIds.length;
  const totalDurMin = Math.floor(duration / 60);
  const totalDurSec = Math.floor(duration % 60);

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item">
          <span className="status-key">Clips:</span> {clips.length}
        </span>
        <span className="status-sep" />
        <span className="status-item">
          <span className="status-key">Tracks:</span> {tracks.length}
        </span>
        <span className="status-sep" />
        <span className="status-item">
          <span className="status-key">Duration:</span> {totalDurMin}:{totalDurSec.toString().padStart(2, '0')}
        </span>
        {selected > 0 && (
          <>
            <span className="status-sep" />
            <span className="status-item selected-indicator">
              {selected} clip{selected > 1 ? 's' : ''} selected
            </span>
          </>
        )}
      </div>
      <div className="status-right">
        <span className="status-item">
          <span className="status-key">Zoom:</span> {Math.round(zoom)}px/s
        </span>
        <span className="status-sep" />
        <span className="status-item">
          <span className="status-key">FPS:</span> {fps}
        </span>
        <span className="status-sep" />
        <span className={`status-item ${snapEnabled ? 'active' : ''}`}>
          Snap {snapEnabled ? 'ON' : 'OFF'}
        </span>
        <span className="status-sep" />
        <span className="status-item hint">
          V=Select · C=Razor · H=Hand · Space=Play · Del=Delete · Ctrl+Z=Undo
        </span>
      </div>
    </div>
  );
};
