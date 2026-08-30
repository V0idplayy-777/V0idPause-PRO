import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, ChevronFirst, ChevronLast,
  SkipBack, SkipForward
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Clip } from '../types';

const formatTime = (secs: number, fps: number = 30) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const f = Math.floor((secs % 1) * fps);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};

const buildFilterString = (clip: Clip) => {
  if (!clip.filters) return '';
  const { brightness, contrast, saturation, hue, blur, sepia, grayscale } = clip.filters;
  const parts = [];
  if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
  if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
  if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
  if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
  if (blur > 0) parts.push(`blur(${blur}px)`);
  if (sepia > 0) parts.push(`sepia(${sepia}%)`);
  if (grayscale > 0) parts.push(`grayscale(${grayscale}%)`);
  return parts.join(' ');
};

export const PreviewPanel: React.FC = () => {
  const {
    clips, tracks, currentTime, setCurrentTime, playing, setPlaying,
    fps, playbackVolume, setPlaybackVolume, duration, resolution
  } = useStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const currentTimeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const clipsRef = useRef(clips);
  const tracksRef = useRef(tracks);
  const durationRef = useRef(duration);
  const playbackVolumeRef = useRef(playbackVolume);
  const mutedRef = useRef(false);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastSeekRef = useRef<Map<string, number>>(new Map());
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { playbackVolumeRef.current = playbackVolume; }, [playbackVolume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    const activeIds = new Set(
      clips.filter(c => c.src && (c.type === 'video' || c.type === 'audio')).map(c => c.id)
    );
    videoRefs.current.forEach((vid, id) => {
      if (!activeIds.has(id)) {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        videoRefs.current.delete(id);
        lastSeekRef.current.delete(id);
      }
    });
    audioRefs.current.forEach((aud, id) => {
      if (!activeIds.has(id)) {
        aud.pause();
        aud.removeAttribute('src');
        aud.load();
        audioRefs.current.delete(id);
        lastSeekRef.current.delete(id);
      }
    });
  }, [clips]);

  const syncMedia = useCallback((t: number, isPlaying: boolean) => {
    const activeClips = clipsRef.current.filter(c =>
      c.src && (c.type === 'video' || c.type === 'audio') &&
      t >= c.startTime && t < c.startTime + c.duration
    );

    const activeIds = new Set(activeClips.map(c => c.id));

    activeClips.forEach(clip => {
      const clipTime = t - clip.startTime + (clip.trimStart || 0);
      const track = tracksRef.current.find(tr => tr.id === clip.trackId);
      const vol = (clip.volume ?? 1) * playbackVolumeRef.current * (mutedRef.current ? 0 : 1) * (track?.muted ? 0 : 1);
      const shouldPlay = isPlaying && !track?.muted && !clip.muted;

      if (clip.type === 'video') {
        let vid = videoRefs.current.get(clip.id);
        if (!vid) {
          vid = document.createElement('video');
          vid.src = clip.src!;
          vid.preload = 'auto';
          vid.crossOrigin = 'anonymous';
          vid.playsInline = true;
          videoRefs.current.set(clip.id, vid);
        }
        vid.volume = Math.min(1, Math.max(0, vol));
        vid.playbackRate = clip.speed || 1;
        const lastSeek = lastSeekRef.current.get(clip.id) ?? -999;
        if (Math.abs(vid.currentTime - clipTime) > 0.25 || Math.abs(lastSeek - clipTime) > 0.25) {
          if (Math.abs(vid.currentTime - clipTime) > 0.08) {
            vid.currentTime = clipTime;
            lastSeekRef.current.set(clip.id, clipTime);
          }
        }
        if (shouldPlay) {
          if (vid.paused) vid.play().catch(() => {});
        } else {
          if (!vid.paused) vid.pause();
        }
      } else {
        let aud = audioRefs.current.get(clip.id);
        if (!aud) {
          aud = document.createElement('audio');
          aud.src = clip.src!;
          aud.preload = 'auto';
          audioRefs.current.set(clip.id, aud);
        }
        aud.volume = Math.min(1, Math.max(0, vol));
        aud.playbackRate = clip.speed || 1;
        const lastSeek = lastSeekRef.current.get(clip.id) ?? -999;
        if (Math.abs(aud.currentTime - clipTime) > 0.25 || Math.abs(lastSeek - clipTime) > 0.25) {
          if (Math.abs(aud.currentTime - clipTime) > 0.08) {
            aud.currentTime = clipTime;
            lastSeekRef.current.set(clip.id, clipTime);
          }
        }
        if (shouldPlay) {
          if (aud.paused) aud.play().catch(() => {});
        } else {
          if (!aud.paused) aud.pause();
        }
      }
    });

    videoRefs.current.forEach((vid, id) => {
      if (!activeIds.has(id) && !vid.paused) vid.pause();
    });
    audioRefs.current.forEach((aud, id) => {
      if (!activeIds.has(id) && !aud.paused) aud.pause();
    });
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = currentTimeRef.current;
    const clips = clipsRef.current;
    const tracks = tracksRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sortedClips = clips
      .filter(c => t >= c.startTime && t < c.startTime + c.duration)
      .sort((a, b) => {
        const aIdx = tracks.findIndex(tr => tr.id === a.trackId);
        const bIdx = tracks.findIndex(tr => tr.id === b.trackId);
        return bIdx - aIdx;
      });

    for (const clip of sortedClips) {
      const track = tracks.find(tr => tr.id === clip.trackId);
      if (track?.muted && clip.type !== 'audio') continue;
      const filterStr = buildFilterString(clip);
      ctx.filter = filterStr || 'none';
      ctx.globalAlpha = clip.opacity ?? 1;

      if (clip.type === 'video') {
        const vid = videoRefs.current.get(clip.id);
        if (vid && vid.readyState >= 2) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        }
      } else if (clip.type === 'image' && clip.src) {
        const img = document.getElementById(`img-asset-${clip.id}`) as HTMLImageElement;
        if (img?.complete) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else if (clip.type === 'text') {
        ctx.filter = 'none';
        const fs = (clip.fontSize || 64) * (canvas.width / resolution.width);
        ctx.font = `bold ${fs}px ${clip.fontFamily || 'Inter'}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (clip.textBgColor && clip.textBgColor !== 'transparent') {
          const metrics = ctx.measureText(clip.textContent || '');
          const pad = fs * 0.3;
          ctx.fillStyle = clip.textBgColor;
          ctx.fillRect(canvas.width / 2 - metrics.width / 2 - pad, canvas.height / 2 - fs / 2 - pad, metrics.width + pad * 2, fs + pad * 2);
        }
        ctx.fillStyle = clip.textColor || '#fff';
        ctx.fillText(clip.textContent || '', canvas.width / 2, canvas.height / 2);
      }
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }

    if (sortedClips.filter(c => c.type !== 'audio').length === 0) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2a2a2a';
      ctx.font = '28px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('V0idpause PRO', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = '#222';
      ctx.fillText('Import media and drag to the timeline', canvas.width / 2, canvas.height / 2 + 20);
    }
  }, [resolution]);

  useEffect(() => {
    let lastTs = 0;
    let lastSync = 0;
    const loop = (ts: number) => {
      if (playingRef.current) {
        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        lastTs = ts;
        const next = currentTimeRef.current + dt;
        if (next >= durationRef.current) {
          setPlaying(false);
          setCurrentTime(durationRef.current);
          currentTimeRef.current = durationRef.current;
        } else {
          currentTimeRef.current = next;
          setCurrentTime(next);
        }
      } else {
        lastTs = 0;
      }

      if (ts - lastSync > 40) {
        syncMedia(currentTimeRef.current, playingRef.current);
        lastSync = ts;
      }

      render();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [render, syncMedia, setPlaying, setCurrentTime]);

  useEffect(() => {
    syncMedia(currentTime, playing);
  }, [currentTime, playing, clips, tracks, playbackVolume, muted, syncMedia]);

  const togglePlay = () => setPlaying(!playing);
  const goToStart = () => { setCurrentTime(0); setPlaying(false); };
  const goToEnd = () => { setCurrentTime(duration); setPlaying(false); };
  const stepBack = () => setCurrentTime(Math.max(0, currentTime - 1 / fps));
  const stepForward = () => setCurrentTime(Math.min(duration, currentTime + 1 / fps));

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="preview-panel" ref={containerRef}>
      <div style={{ display: 'none' }}>
        {clips.filter(c => c.type === 'image' && c.src).map(c => (
          <img key={c.id} id={`img-asset-${c.id}`} src={c.src} alt="" crossOrigin="anonymous" />
        ))}
      </div>

      <div className="preview-header">
        <span className="panel-title">Program Monitor</span>
        <span className="preview-timecode">{formatTime(currentTime, fps)}</span>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="preview-canvas"
          style={{ aspectRatio: '16/9' }}
        />
      </div>

      <div className="preview-controls">
        <div className="transport-controls">
          <button className="transport-btn" onClick={goToStart} title="Go to start"><ChevronFirst size={16} /></button>
          <button className="transport-btn" onClick={stepBack} title="Step back 1 frame"><SkipBack size={14} /></button>
          <button className="transport-btn play-btn" onClick={togglePlay} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="transport-btn" onClick={stepForward} title="Step forward 1 frame"><SkipForward size={14} /></button>
          <button className="transport-btn" onClick={goToEnd} title="Go to end"><ChevronLast size={16} /></button>
        </div>

        <div className="preview-vol">
          <button className="icon-btn" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.01}
            value={muted ? 0 : playbackVolume}
            onChange={e => { setPlaybackVolume(Number(e.target.value)); setMuted(false); }}
            className="vol-slider"
          />
        </div>

        <button className="icon-btn" onClick={handleFullscreen} title="Fullscreen">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
};
