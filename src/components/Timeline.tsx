import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
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

const Playhead = memo(() => {
  const currentTime = useStore(s => s.currentTime);
  const zoom = useStore(s => s.zoom);
  const tracks = useStore(s => s.tracks);
  const left = currentTime * zoom;
  const height = tracks.reduce((s, t) => s + t.height, 0);
  return (
    <>
      <div className="ruler-playhead" style={{ left }} />
      <div className="timeline-playhead" style={{ left, height }} />
    </>
  );
});

export const Timeline: React.FC = () => {
  const tracks = useStore(s => s.tracks);
  const clips = useStore(s => s.clips);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const zoom = useStore(s => s.zoom);
  const duration = useStore(s => s.duration);
  const selectedClipIds = useStore(s => s.selectedClipIds);
  const selectClips = useStore(s => s.selectClips);
  const updateClip = useStore(s => s.updateClip);
  const selectedTool = useStore(s => s.selectedTool);
  const addTrack = useStore(s => s.addTrack);
  const updateTrack = useStore(s => s.updateTrack);
  const removeTrack = useStore(s => s.removeTrack);
  const addClip = useStore(s => s.addClip);
  const mediaAssets = useStore(s => s.mediaAssets);
  const snapEnabled = useStore(s => s.snapEnabled);
  const splitClip = useStore(s => s.splitClip);
  const markers = useStore(s => s.markers);

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
      else if (e.key === 'ArrowLeft') {
        const t = useStore.getState().currentTime;
        setCurrentTime(Math.max(0, t - (e.shiftKey ? 1 : 1 / 30)));
      } else if (e.key === 'ArrowRight') {
        const t = useStore.getState().currentTime;
        const d = useStore.getState().duration;
        setCurrentTime(Math.min(d, t + (e.shiftKey ? 1 : 1 / 30)));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCurrentTime]);

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
      const x2 = ev.clientX - rect.left + scrollLeft;
      setCurrentTime(Math.max(0, Math.min(duration, xToTime(x2))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: Clip, type: DragState['type']) => {
    e.stopPropagation();
    if (tracks.find(t => t.id === clip.trackId)?.locked) return;
    selectClips([clip.id]);
    dragRef.current = {
      type,
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
      const dt = dx / zoom;
      if (drag.type === 'move') {
        const newStart = snapTime(Math.max(0, drag.startTime + dt), drag.clipId);
        updateClip(drag.clipId, { startTime: newStart });
      } else if (drag.type === 'trim-left') {
        const newStart = Math.max(0, drag.startTime + dt);
        const maxStart = drag.startTime + drag.startDuration - 0.1;
        const clamped = Math.min(newStart, maxStart);
        const delta = clamped - drag.startTime;
        updateClip(drag.clipId, {
          startTime: clamped,
          duration: drag.startDuration - delta,
          trimStart: drag.startTrimStart + delta,
        });
      } else if (drag.type === 'trim-right') {
        const newDur = Math.max(0.1, drag.startDuration + dt);
        updateClip(drag.clipId, { duration: newDur });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTrackAreaMouseDown = (e: React.MouseEvent) => {
    if (selectedTool === 'razor') return;
    selectClips([]);
  };

  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    const asset = mediaAssets.find(a => a.id === assetId);
    if (!asset) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const startTime = snapTime(Math.max(0, xToTime(x)));
    const newClip: Clip = {
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
      trimStart: 0,
      originalDuration: asset.duration,
    };
    addClip(newClip);
  };

  const rulerTicks = useMemo(() => {
  const ticks: { t: number; x: number; major: boolean }[] = [];
  const interval = zoom >= 200 ? 1 : zoom >= 80 ? 2 : zoom >= 30 ? 5 : zoom >= 10 ? 10 : 30;
  const maxTicks = 250;
  let count = 0;
  for (let t = 0; t <= duration + interval && count < maxTicks; t += interval) {
    ticks.push({ t, x: timeToX(t), major: true });
    count++;
  }
  return ticks;
}, [zoom, duration]);

  const totalTimelineWidth = Math.min(Math.max(timeToX(duration) + 300, 1200), 12000);

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
          if (selectedTool === 'razor') {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const cutTime = clip.startTime + xToTime(x);
            splitClip(clip.id, cutTime);
          }
        }}
      >
        <div className="clip-label">{clip.name}</div>
        <div
          className="clip-trim-handle left"
          onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip, 'trim-left'); }}
        />
        <div
          className="clip-trim-handle right"
          onMouseDown={e => { e.stopPropagation(); handleClipMouseDown(e, clip, 'trim-right'); }}
        />
      </div>
    );
  };

  const addVideoTrack = () => {
    const vCount = tracks.filter(t => t.type === 'video').length + 1;
    addTrack({ id: crypto.randomUUID(), name: `Video ${vCount}`, type: 'video', locked: false, muted: false, solo: false, height: 64, color: '#c0392b' });
  };

  const addAudioTrack = () => {
    const aCount = tracks.filter(t => t.type === 'audio').length + 1;
    addTrack({ id: crypto.randomUUID(), name: `Audio ${aCount}`, type: 'audio', locked: false, muted: false, solo: false, height: 48, color: '#27ae60' });
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
            {rulerTicks.map((tick, i) => (
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
            <Playhead />
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
