import React, { useRef, useEffect, useState } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, ChevronFirst, ChevronLast,
  SkipBack, SkipForward
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Clip } from '../types';
import { getClipProps } from '../utils/clipEval';

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
  const clips = useStore(s => s.clips);
  const tracks = useStore(s => s.tracks);
  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const playing = useStore(s => s.playing);
  const setPlaying = useStore(s => s.setPlaying);
  const fps = useStore(s => s.fps);
  const playbackVolume = useStore(s => s.playbackVolume);
  const setPlaybackVolume = useStore(s => s.setPlaybackVolume);
  const duration = useStore(s => s.duration);
  const resolution = useStore(s => s.resolution);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
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
  const lastDraw = useRef(0);
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { clipsRef.current = clips; }, [clips]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { volumeRef.current = playbackVolume; }, [playbackVolume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!playingRef.current) timeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    playingRef.current = playing;
    if (playing) {
      lastUiPush.current = 0;
      lastSync.current = 0;
    } else {
      timeRef.current = currentTime;
    }
  }, [playing, currentTime]);

  useEffect(() => {
    const live = new Set(
      clips.filter(c => c.src && (c.type === 'video' || c.type === 'audio')).map(c => c.id)
    );
    for (const [id, el] of videoMap.current) {
      if (!live.has(id)) {
        el.pause();
        el.removeAttribute('src');
        el.load();
        videoMap.current.delete(id);
      }
    }
    for (const [id, el] of audioMap.current) {
      if (!live.has(id)) {
        el.pause();
        el.removeAttribute('src');
        el.load();
        audioMap.current.delete(id);
      }
    }
  }, [clips]);

  const getVideo = (clip: Clip) => {
    let v = videoMap.current.get(clip.id);
    if (!v) {
      v = document.createElement('video');
      v.src = clip.src!;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      v.playsInline = true;
      videoMap.current.set(clip.id, v);
    }
    return v;
  };

  const getAudio = (clip: Clip) => {
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
      const local = t - clip.startTime + (clip.trimStart || 0);
      const track = tracksRef.current.find(tr => tr.id === clip.trackId);
      const localTime = t - clip.startTime;
const props = getClipProps(clip, localTime);
const vol = props.volume * volumeRef.current * (mutedRef.current || track?.muted || clip.muted ? 0 : 1);
      const wantPlay = isPlaying && !track?.muted && !clip.muted;

      if (clip.type === 'video') {
        const v = getVideo(clip);
        v.volume = Math.min(1, Math.max(0, vol));
        v.playbackRate = clip.speed || 1;
        if (Math.abs(v.currentTime - local) > 0.4) {
          try { v.currentTime = local; } catch {}
        }
        if (wantPlay) {
          if (v.paused) v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      } else {
        const a = getAudio(clip);
        a.volume = Math.min(1, Math.max(0, vol));
        a.playbackRate = clip.speed || 1;
        if (Math.abs(a.currentTime - local) > 0.4) {
          try { a.currentTime = local; } catch {}
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
  const ctx = canvas.getContext('2d', { alpha: false });
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

  let drew = false;

  for (const clip of visible) {
    const track = tracks.find(tr => tr.id === clip.trackId);
    if (track?.muted && clip.type !== 'audio') continue;

    const localTime = t - clip.startTime;
    const props = getClipProps(clip, localTime);

    ctx.save();
    ctx.filter = buildFilterString(clip) || 'none';
    ctx.globalAlpha = props.opacity;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx + props.x, cy + props.y);
    ctx.scale(props.scale, props.scale);
    ctx.translate(-cx, -cy);

    if (props.transitionType === 'wipe' && props.transitionProgress < 1) {
      const w = canvas.width * props.transitionProgress;
      ctx.beginPath();
      ctx.rect(0, 0, w, canvas.height);
      ctx.clip();
    } else if (props.transitionType === 'slide' && props.transitionProgress < 1) {
      const offset = canvas.width * (1 - props.transitionProgress);
      ctx.translate(-offset, 0);
    }

    if (clip.type === 'video') {
      const v = videoMap.current.get(clip.id);
      if (v && v.readyState >= 2) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        drew = true;
      }
    } else if (clip.type === 'image' && clip.src) {
      const img = document.getElementById(`img-asset-${clip.id}`) as HTMLImageElement | null;
      if (img?.complete) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drew = true;
      }
    } else if (clip.type === 'text') {
      ctx.filter = 'none';
      const fs = (clip.fontSize || 64) * (canvas.width / resolution.width);
      ctx.font = `bold ${fs}px ${clip.fontFamily || 'Inter'}, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (clip.textBgColor && clip.textBgColor !== 'transparent') {
        const m = ctx.measureText(clip.textContent || '');
        const pad = fs * 0.3;
        ctx.fillStyle = clip.textBgColor;
        ctx.fillRect(canvas.width / 2 - m.width / 2 - pad, canvas.height / 2 - fs / 2 - pad, m.width + pad * 2, fs + pad * 2);
      }
      ctx.fillStyle = clip.textColor || '#fff';
      ctx.fillText(clip.textContent || '', canvas.width / 2, canvas.height / 2);
      drew = true;
    }

    ctx.restore();
  }

  if (!drew) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2a2a2a';
    ctx.font = '22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V0idpause PRO', canvas.width / 2, canvas.height / 2 - 14);
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#333';
    ctx.fillText('Import media and drag to the timeline', canvas.width / 2, canvas.height / 2 + 14);
  }
};

useEffect(() => {
  let lastTs = 0;
  let lastUiPush = 0;
  let lastSync = 0;
  let lastDraw = 0;
  let running = true;

  const tick = (ts: number) => {
    if (!running) return;

    if (playingRef.current) {
      const dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      timeRef.current += dt;

      if (timeRef.current >= durationRef.current) {
        timeRef.current = durationRef.current;
        playingRef.current = false;
        setPlaying(false);
        setCurrentTime(durationRef.current);
      } else if (ts - lastUiPush > 200) {
        lastUiPush = ts;
        setCurrentTime(timeRef.current);
      }

      if (ts - lastSync > 80) {
        lastSync = ts;
        syncMedia(timeRef.current, true);
      }

      if (ts - lastDraw > 33) {
        lastDraw = ts;
        draw();
      }

      animRef.current = requestAnimationFrame(tick);
    } else {
      lastTs = 0;
    }
  };

  if (playing) {
    animRef.current = requestAnimationFrame(tick);
  }

  return () => {
    running = false;
    cancelAnimationFrame(animRef.current);
  };
}, [playing, setPlaying, setCurrentTime, resolution]);

useEffect(() => {
  if (!playing) {
    timeRef.current = currentTime;
    syncMedia(currentTime, false);
    draw();
  }
}, [currentTime, playing, clips, tracks, playbackVolume, muted, resolution]);

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
          width={854}
          height={480}
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
