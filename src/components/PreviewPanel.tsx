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
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const clipsRef = useRef(clips);
  const tracksRef = useRef(tracks);
  const durationRef = useRef(duration);
  const volumeRef = useRef(playbackVolume);
  const mutedRef = useRef(false);
  const videoMap = useRef(new Map<string, HTMLVideoElement>());
  const audioMap = useRef(new Map<string, HTMLAudioElement>());
  const lastUiPush = useRef(0);
  const lastSync = useRef(0);
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { clipsRef.current = clips; }, [clips]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { volumeRef.current = playbackVolume; }, [playbackVolume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!playingRef.current) {
      timeRef.current = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    playingRef.current = playing;
    if (playing) {
      lastUiPush.current = 0;
      lastSync.current = 0;
    }
  }, [playing]);

  useEffect(() => {
    const liveIds = new Set(
      clips.filter(c => c.src && (c.type === 'video' || c.type === 'audio')).map(c => c.id)
    );
    for (const [id, el] of videoMap.current) {
      if (!liveIds.has(id)) {
        el.pause();
        el.removeAttribute('src');
        el.load();
        videoMap.current.delete(id);
      }
    }
    for (const [id, el] of audioMap.current) {
      if (!liveIds.has(id)) {
        el.pause();
        el.removeAttribute('src');
        el.load();
        audioMap.current.delete(id);
      }
    }
  }, [clips]);

  const getOrCreateVideo = (clip: Clip) => {
    let v = videoMap.current.get(clip.id);
    if (!v) {
      v = document.createElement('video');
      v.src = clip.src!;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      v.playsInline = true;
      v.muted = false;
      videoMap.current.set(clip.id, v);
    }
    return v;
  };

  const getOrCreateAudio = (clip: Clip) => {
    let a = audioMap.current.get(clip.id);
    if (!a) {
      a = document.createElement('audio');
      a.src = clip.src!;
      a.preload = 'auto';
      audioMap.current.set(clip.id, a);
    }
    return a;
  };

  const syncMedia = (t: number, isPlaying: boolean) => {
    const active = clipsRef.current.filter(c =>
      c.src && (c.type === 'video' || c.type === 'audio') &&
      t >= c.startTime && t < c.startTime + c.duration
    );
    const activeIds = new Set(active.map(c => c.id));

    for (const clip of active) {
      const localTime = t - clip.startTime + (clip.trimStart || 0);
      const track = tracksRef.current.find(tr => tr.id === clip.trackId);
      const vol = (clip.volume ?? 1) * volumeRef.current * (mutedRef.current || track?.muted || clip.muted ? 0 : 1);
      const wantPlay = isPlaying && !track?.muted && !clip.muted;

      if (clip.type === 'video') {
        const v = getOrCreateVideo(clip);
        v.volume = Math.min(1, Math.max(0, vol));
        v.playbackRate = clip.speed || 1;
        if (Math.abs(v.currentTime - localTime) > 0.3) {
          try { v.currentTime = localTime; } catch {}
        }
        if (wantPlay) {
          if (v.paused) v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      } else {
        const a = getOrCreateAudio(clip);
        a.volume = Math.min(1, Math.max(0, vol));
        a.playbackRate = clip.speed || 1;
        if (Math.abs(a.currentTime - localTime) > 0.3) {
          try { a.currentTime = localTime; } catch {}
        }
        if (wantPlay) {
          if (a.paused) a.play().catch(() => {});
        } else if (!a.paused) {
          a.pause();
        }
      }
    }

    for (const [id, v] of videoMap.current) {
      if (!activeIds.has(id) && !v.paused) v.pause();
    }
    for (const [id, a] of audioMap.current) {
      if (!activeIds.has(id) && !a.paused) a.pause();
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = timeRef.current;
    const clips = clipsRef.current;
    const tracks = tracksRef.current;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const visible = clips
      .filter(c => t >= c.startTime && t < c.startTime + c.duration)
      .sort((a, b) => {
        const ai = tracks.findIndex(tr => tr.id === a.trackId);
        const bi = tracks.findIndex(tr => tr.id === b.trackId);
        return bi - ai;
      });

    let drewSomething = false;

    for (const clip of visible) {
      const track = tracks.find(tr => tr.id === clip.trackId);
      if (track?.muted && clip.type !== 'audio') continue;

      ctx.filter = buildFilterString(clip) || 'none';
      ctx.globalAlpha = clip.opacity ?? 1;

      if (clip.type === 'video') {
        const v = videoMap.current.get(clip.id);
        if (v && v.readyState >= 2) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          drewSomething = true;
        }
      } else if (clip.type === 'image' && clip.src) {
        const img = document.getElementById(`img-asset-${clip.id}`) as HTMLImageElement | null;
        if (img && img.complete) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          drewSomething = true;
        }
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
          ctx.fillRect(
            canvas.width / 2 - metrics.width / 2 - pad,
            canvas.height / 2 - fs / 2 - pad,
            metrics.width + pad * 2,
            fs + pad * 2
          );
        }
        ctx.fillStyle = clip.textColor || '#fff';
        ctx.fillText(clip.textContent || '', canvas.width / 2, canvas.height / 2);
        drewSomething = true;
      }

      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }

    if (!drewSomething) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2a2a2a';
      ctx.font = '24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('V0idpause PRO', canvas.width / 2, canvas.height / 2 - 16);
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#333';
      ctx.fillText('Import media and drag to the timeline', canvas.width / 2, canvas.height / 2 + 16);
    }
  };

  useEffect(() => {
    let lastTs = 0;

    const tick = (ts: number) => {
      if (playingRef.current) {
        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        lastTs = ts;
        timeRef.current += dt;

        if (timeRef.current >= durationRef.current) {
          timeRef.current = durationRef.current;
          playingRef.current = false;
          setPlaying(false);
          setCurrentTime(durationRef.current);
        } else if (ts - lastUiPush.current > 80) {
          lastUiPush.current = ts;
          setCurrentTime(timeRef.current);
        }
      } else {
        lastTs = 0;
      }

      if (ts - lastSync.current > 50) {
        lastSync.current = ts;
        syncMedia(timeRef.current, playingRef.current);
      }

      draw();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [setPlaying, setCurrentTime, resolution]);

  useEffect(() => {
    if (!playing) {
      timeRef.current = currentTime;
      syncMedia(currentTime, false);
      draw();
    }
  }, [currentTime, playing, clips, tracks, playbackVolume, muted]);

  const togglePlay = () => {
    if (!playing) {
      timeRef.current = currentTime;
      syncMedia(currentTime, true);
    }
    setPlaying(!playing);
  };

  const goToStart = () => {
    setPlaying(false);
    timeRef.current = 0;
    setCurrentTime(0);
  };

  const goToEnd = () => {
    setPlaying(false);
    timeRef.current = duration;
    setCurrentTime(duration);
  };

  const stepBack = () => {
    const next = Math.max(0, currentTime - 1 / fps);
    timeRef.current = next;
    setCurrentTime(next);
  };

  const stepForward = () => {
    const next = Math.min(duration, currentTime + 1 / fps);
    timeRef.current = next;
    setCurrentTime(next);
  };

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
          width={960}
          height={540}
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
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : playbackVolume}
            onChange={e => {
              setPlaybackVolume(Number(e.target.value));
              setMuted(false);
            }}
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
