import React, { useRef, useEffect, useState } from 'react';
import {
  Lock, Unlock, Volume2, VolumeX,
  Trash2, Film, Mic
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Clip, ClipType } from '../types';
import { ContextMenu } from './ContextMenu';

const MIN_CLIP_WIDTH = 4;
const TRACK_LABEL_WIDTH = 180;

const CLIP_COLORS: Record<ClipType, string> = {
  video: '#c0392b',
  audio: '#27ae60',
  image: '#8e44ad',
  text: '#2980b9',
  effect: '#f39c12',
};

const formatRulerTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface DragState {
  type: 'move' | 'trim-left' | 'trim-right';
  clipId: string;
  startX: number;
  startTime: number;
  startDuration: number;
  startTrimStart: number;
}

export const Timeline: React.FC = () => {
  const {
    tracks, clips, currentTime, setCurrentTime, zoom, duration,
    selectedClipIds, selectClips, updateClip,
    selectedTool, addTrack, updateTrack, removeTrack, addClip,
    mediaAssets, snapEnabled, splitClip, markers
  } = useStore();

  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setScrollLeft(el.scrollLeft);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { useStore.getState().undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { useStore.getState().redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = useStore.getState().selectedClipIds;
        if (ids.length > 0) useStore.getState().removeClips(ids);
      } else if (e.key === 'v' || e.key === 'V') { useStore.getState().setSelectedTool('select'); }
      else if (e.key === 'c' || e.key === 'C') { useStore.getState().setSelectedTool('razor'); }
      else if (e.key === 'h' || e.key === 'H') { useStore.getState().setSelectedTool('hand'); }
      else if (e.key === 'ArrowLeft') { setCurrentTime(Math.max(0, currentTime - (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'ArrowRight') { setCurrentTime(Math.min(duration, currentTime + (e.shiftKey ? 1 : 1 / 30))); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTime, setCurrentTime, duration]);

  const timeToX = (t: number) => t * zoom;
  const xToTime = (x: number) => x / zoom;

  const snapTime = (t: number, excludeId?: string) => {
    if (!snapEnabled) return t;
    const snapPoints: number[] = [0, duration];
    clips.forEach(c => {
      if (c.id !== excludeId) {
        snapPoints.push(c.startTime);
        snapPoints.push(c.startTime + c.duration);
      }
    });
    markers.forEach(m => snapPoints.push(m.time));
    const SNAP_DIST = 5 / zoom;
    let closest = t;
    let minDist = SNAP_DIST;
    snapPoints.forEach(p => {
      const d = Math.abs(t - p);
      if (d < minDist) { minDist = d; closest = p; }
    });
    return closest;
  };

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + scrollLeft;
    setCurrentTime(Math.max(0, Math.min(duration, xToTime(x))));
    const onMove = (ev: MouseEvent) => {
      const x2 = ev.clientX - (rulerRef.current?.getBoundingClientRect().left || 0) + scrollLeft;
      setCurrentTime(Math.max(0, Math.min(duration, xToTime(x2))));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: Clip, action: DragState['type']) => {
    if (selectedTool === 'razor') {
      e.stopPropagation();
      const trackEl = (e.currentTarget as HTMLElement).closest('.timeline-track-body');
      const rect = trackEl?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + scrollLeft;
      const t = snapTime(xToTime(x));
      splitClip(clip.id, t);
      return;
    }
    e.stopPropagation();
    if (selectedTool !== 'select') return;

    if (!e.shiftKey && !selectedClipIds.includes(clip.id)) selectClips([clip.id]);
    else if (e.shiftKey) {
      selectClips(selectedClipIds.includes(clip.id)
        ? selectedClipIds.filter(id => id !== clip.id)
        : [...selectedClipIds, clip.id]);
    }

    dragRef.current = {
      type: action,
      clipId: clip.id,
      startX: e.clientX,
      startTime: clip.startTime,
      startDuration: clip.duration,
      startTrimStart: clip.trimStart || 0,
    };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dt = xToTime(dx);

      if (drag.type === 'move') {
        const newStart = snapTime(Math.max(0, drag.startTime + dt), drag.clipId);
        const delta = newStart - drag.startTime;
        updateClip(drag.clipId, { startTime: newStart });
        selectedClipIds.filter(id => id !== drag.clipId).forEach(id => {
          const oc = clips.find(c => c.id === id);
          if (oc) updateClip(id, { startTime: Math.max(0, oc.startTime + delta) });
        });
      } else if (drag.type === 'trim-left') {
        const maxTrim = drag.startTime + drag.startDuration - 0.1;
        const newStart = snapTime(Math.max(0, Math.min(maxTrim, drag.startTime + dt)));
        const delta = newStart - drag.startTime;
        updateClip(drag.clipId, {
          startTime: newStart,
          duration: Math.max(0.1, drag.startDuration - delta),
          trimStart: Math.max(0, drag.startTrimStart + delta),
        });
      } else if (drag.type === 'trim-right') {
        const rawEnd = drag.startTime + drag.startDuration + dt;
        const snappedEnd = snapTime(rawEnd, drag.clipId);
        const newDur = snappedEnd - drag.startTime;
        const maxDur = clip.originalDuration ? clip.originalDuration - (clip.trimStart || 0) : 9999;
        updateClip(drag.clipId, { duration: Math.min(maxDur, Math.max(0.1, newDur)) });
      }
    };

    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTrackAreaMouseDown = (e: React.MouseEvent) => {
    if (selectedTool === 'razor') return;
    if (e.target !== e.currentTarget) return;
    selectClips([]);
  };

  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;
    const asset = mediaAssets.find(a => a.id === assetId);
    if (!asset) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const startTime = snapTime(Math.max(0, xToTime(x)));

    addClip({
      id: crypto.randomUUID(),
      name: asset.name,
      type: asset.type,
      trackId,
      startTime,
      duration: asset.duration || 5,
      src: asset.src,
      color: CLIP_COLORS[asset.type],
      volume: 1,
      opacity: 1,
      speed: 1,
      originalDuration: asset.duration || 5,
      filters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0 },
      transition: 'none',
    });
  };

  const rulerTicks = () => {
    const ticks: { t: number; x: number; major: boolean }[] = [];
    const interval = zoom >= 200 ? 0.5 : zoom >= 80 ? 1 : zoom >= 30 ? 5 : zoom >= 10 ? 10 : 30;
    for (let t = 0; t <= duration + interval; t += interval) {
      const x = timeToX(t);
      ticks.push({ t, x, major: true });
      if (interval >= 1 && zoom >= 60) {
        for (let sub = 1; sub < 5; sub++) {
          const st = t + sub * (interval / 5);
          ticks.push({ t: st, x: timeToX(st), major: false });
        }
      }
    }
    return ticks;
  };

  const addVideoTrack = () => {
    const vCount = tracks.filter(t => t.type === 'video').length + 1;
    addTrack({ id: crypto.randomUUID(), name: `Video ${vCount}`, type: 'video', locked: false, muted: false, solo: false, height: 64, color: '#c0392b' });
  };

  const addAudioTrack = () => {
    const aCount = tracks.filter(t => t.type === 'audio').length + 1;
    addTrack({ id: crypto.randomUUID(), name: `Audio ${aCount}`, type: 'audio', locked: false, muted: false, solo: false, height: 48, color: '#27ae60' });
  };

  const totalTimelineWidth = Math.max(timeToX(duration) + 300, 1200);

  const renderClip = (clip: Clip) => {
    const left = timeToX(clip.startTime);
    const width = Math.max(MIN_CLIP_WIDTH, timeToX(clip.duration));
    const isSelected = selectedClipIds.includes(clip.id);
    const clipColor = clip.color || CLIP_COLORS[clip.type];
    const isRazor = selectedTool === 'razor';

    return (
      <div
        key={clip.id}
        className={`timeline-clip ${isSelected ? 'selected' : ''} type-${clip.type} ${isRazor ? 'cursor-razor' : ''}`}
        style={{
          left, width, height: '100%',
          background: `linear-gradient(180deg, ${clipColor}dd 0%, ${clipColor}99 100%)`,
          borderColor: isSelected ? '#fff' : `${clipColor}ff`,
        }}
        onMouseDown={e => handleClipMouseDown(e, clip, 'move')}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          selectClips([clip.id]);
          setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
        }}
        onClick={e => {
          if (selectedTool === 'razor') return;
          e.stopPropagation();
          if (e.shiftKey) {
            selectClips(selectedClipIds.includes(clip.id)
              ? selectedClipIds.filter(id => id !== clip.id)
              : [...selectedClipIds, clip.id]);
          } else {
            selectClips([clip.id]);
          }
        }}
      >
        <div className="trim-handle left" onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip, 'trim-left'); }} />
        <div className="clip-content">
          <span className="clip-label">{clip.name}</span>
          {clip.type === 'audio' && width > 60 && (
            <div className="waveform-placeholder">
              {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
                <div key={i} className="waveform-bar" style={{ height: `${20 + Math.sin(i * 0.8) * 15 + Math.random() * 10}%` }} />
              ))}
            </div>
          )}
          {clip.type === 'video' && width > 80 && clip.src && (
            <div className="clip-filmstrip">
              {Array.from({ length: Math.ceil(width / 40) }).map((_, i) => (
                <div key={i} className="filmstrip-frame" style={{ width: 38 }}>
                  <video src={clip.src} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} muted />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="trim-handle right" onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip, 'trim-right'); }} />
      </div>
    );
  };

  return (
    <div className="timeline-panel" style={{ position: 'relative' }}>
      <div className="timeline-header">
        <div className="timeline-header-label" style={{ width: TRACK_LABEL_WIDTH, minWidth: TRACK_LABEL_WIDTH }}>
          <span className="timeline-title">Timeline</span>
          <div className="timeline-add-track">
            <button className="icon-btn-sm" onClick={addVideoTrack} title="Add video track"><Film size={11} /> V</button>
            <button className="icon-btn-sm" onClick={addAudioTrack} title="Add audio track"><Mic size={11} /> A</button>
          </div>
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div
            ref={rulerRef}
            className="ruler"
            style={{ width: totalTimelineWidth, marginLeft: -scrollLeft }}
            onMouseDown={handleRulerMouseDown}
          >
            {rulerTicks().map((tick, i) => (
              tick.major ? (
                <div key={i} className="ruler-tick major" style={{ left: tick.x }}>
                  <span className="ruler-label">{formatRulerTime(tick.t)}</span>
                </div>
              ) : (
                <div key={i} className="ruler-tick minor" style={{ left: tick.x }} />
              )
            ))}
            {markers.map(m => (
              <div key={m.id} className="ruler-marker" style={{ left: timeToX(m.time), background: m.color }} title={m.label} />
            ))}
            <div className="ruler-playhead" style={{ left: timeToX(currentTime) }} />
          </div>
        </div>
      </div>

      <div className="tracks-container">
        <div className="track-labels" style={{ width: TRACK_LABEL_WIDTH, minWidth: TRACK_LABEL_WIDTH }}>
          {tracks.map(track => (
            <div
              key={track.id}
              className={`track-label ${track.type}`}
              style={{ height: track.height, borderLeft: `3px solid ${track.color}` }}
            >
              <div className="track-label-top">
                <span className="track-name">{track.name}</span>
              </div>
              <div className="track-label-actions">
                <button className={`icon-btn-sm ${track.locked ? 'active' : ''}`} onClick={() => updateTrack(track.id, { locked: !track.locked })} title={track.locked ? 'Unlock' : 'Lock'}>
                  {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
                <button className={`icon-btn-sm ${track.muted ? 'active danger' : ''}`} onClick={() => updateTrack(track.id, { muted: !track.muted })} title={track.muted ? 'Unmute' : 'Mute'}>
                  {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                </button>
                <button className="icon-btn-sm danger" onClick={() => removeTrack(track.id)} title="Remove track">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          className="track-bodies-scroll"
          ref={scrollRef}
          onScroll={e => setScrollLeft((e.target as HTMLElement).scrollLeft)}
        >
          <div style={{ width: totalTimelineWidth, position: 'relative' }}>
            {tracks.map(track => (
              <div
                key={track.id}
                className={`timeline-track-body ${track.muted ? 'muted' : ''} ${track.locked ? 'locked' : ''}`}
                style={{ height: track.height }}
                onMouseDown={handleTrackAreaMouseDown}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={e => handleTrackDrop(e, track.id)}
              >
                {clips.filter(c => c.trackId === track.id).map(clip => renderClip(clip))}
              </div>
            ))}

            <div
              className="timeline-playhead"
              style={{ left: timeToX(currentTime), height: tracks.reduce((s, t) => s + t.height, 0) }}
            />
          </div>
        </div>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipId={contextMenu.clipId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
