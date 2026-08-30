import React, { useState, useRef } from 'react';
import { X, Download, FileVideo, CheckCircle, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getClipProps } from '../utils/clipEval';
import { Clip } from '../types';

interface ExportModalProps {
  onClose: () => void;
}

type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

const QUALITY_BITRATES: Record<ExportQuality, number> = {
  low: 2_500_000,
  medium: 8_000_000,
  high: 16_000_000,
  ultra: 35_000_000,
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

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { clips, tracks, duration, fps, resolution, name } = useStore();
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [customWidth, setCustomWidth] = useState(resolution.width);
  const [customHeight, setCustomHeight] = useState(resolution.height);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const cancelRef = useRef(false);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setDone(false);
    cancelRef.current = false;
    setStatusMsg('Preparing...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = customWidth;
      canvas.height = customHeight;
      const ctx = canvas.getContext('2d')!;

      const videoStream = canvas.captureStream(fps);
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      const audioElements: HTMLAudioElement[] = [];
      const videoMap = new Map<string, HTMLVideoElement>();

      await Promise.all(
        clips.filter(c => c.src && (c.type === 'video' || c.type === 'audio')).map(c =>
          new Promise<void>(resolve => {
            if (c.type === 'video') {
              const v = document.createElement('video');
              v.src = c.src!;
              v.preload = 'auto';
              v.crossOrigin = 'anonymous';
              v.muted = true;
              v.onloadedmetadata = () => {
                videoMap.set(c.id, v);
                resolve();
              };
              v.onerror = () => resolve();
            } else {
              const a = document.createElement('audio');
              a.src = c.src!;
              a.preload = 'auto';
              a.crossOrigin = 'anonymous';
              a.onloadedmetadata = () => {
                audioElements.push(a);
                const src = audioCtx.createMediaElementSource(a);
                src.connect(dest);
                resolve();
              };
              a.onerror = () => resolve();
            }
          })
        )
      );

      for (const [id, v] of videoMap) {
        try {
          const src = audioCtx.createMediaElementSource(v);
          src.connect(dest);
        } catch {}
      }

      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm;codecs=vp8,opus';

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: QUALITY_BITRATES[quality],
        audioBitsPerSecond: 192000,
      });

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<void>(resolve => {
        recorder.onstop = () => resolve();
      });

      recorder.start(100);

      const frameInterval = 1 / fps;
      const totalFrames = Math.ceil(duration * fps);

      setStatusMsg('Rendering...');

      for (let f = 0; f < totalFrames; f++) {
        if (cancelRef.current) {
          recorder.stop();
          setStatusMsg('Export cancelled');
          setExporting(false);
          return;
        }

        const t = f * frameInterval;
        setProgress(Math.round((f / totalFrames) * 100));

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const activeClips = clips
          .filter(c => t >= c.startTime && t < c.startTime + c.duration)
          .sort((a, b) => {
            const ai = tracks.findIndex(tr => tr.id === a.trackId);
            const bi = tracks.findIndex(tr => tr.id === b.trackId);
            return bi - ai;
          });

        for (const clip of activeClips) {
          const track = tracks.find(tr => tr.id === clip.trackId);
          if (track?.muted && clip.type !== 'audio') continue;

          const localTime = t - clip.startTime;
          const props = getClipProps(clip, localTime);

          ctx.save();
          ctx.filter = buildFilterString(clip) || 'none';
          ctx.globalAlpha = props.opacity;

          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          ctx.translate(cx + props.x * (canvas.width / 1920), cy + props.y * (canvas.height / 1080));
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
            const vid = videoMap.get(clip.id);
            if (vid) {
              const clipT = localTime + (clip.trimStart || 0);
              if (Math.abs(vid.currentTime - clipT) > 0.05) {
                vid.currentTime = clipT;
              }
              if (vid.readyState >= 2) {
                ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              }
            }
          } else if (clip.type === 'image' && clip.src) {
            const img = new Image();
            img.src = clip.src;
            if (img.complete) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
          } else if (clip.type === 'text') {
            ctx.filter = 'none';
            const fs = (clip.fontSize || 64) * (canvas.width / 1920);
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
          }

          ctx.restore();
        }

        if (f % 5 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'export'}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setDone(true);
      setExporting(false);
      setStatusMsg('Export complete');
      audioCtx.close();
    } catch (err) {
      setStatusMsg(`Export failed: ${err}`);
      setExporting(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal export-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileVideo size={16} />
            Export Media
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="export-done">
              <CheckCircle size={40} className="export-done-icon" />
              <h3>Export Complete</h3>
              <p>{statusMsg}</p>
              <button className="btn-primary" onClick={onClose}>Close</button>
            </div>
          ) : exporting ? (
            <div className="export-progress-view">
              <Loader size={32} className="spin" />
              <p className="export-status-msg">{statusMsg}</p>
              <div className="export-progress-bar">
                <div className="export-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="export-progress-pct">{progress}%</span>
              <button className="btn-secondary" onClick={handleCancel} style={{ marginTop: 16 }}>
                Cancel Export
              </button>
            </div>
          ) : (
            <>
              <div className="export-section">
                <label className="export-label">Quality</label>
                <div className="export-options">
                  {(['low', 'medium', 'high', 'ultra'] as ExportQuality[]).map(q => (
                    <button key={q} className={`export-option-btn ${quality === q ? 'active' : ''}`} onClick={() => setQuality(q)}>
                      {q.charAt(0).toUpperCase() + q.slice(1)}
                      <span className="export-note">{(QUALITY_BITRATES[q] / 1_000_000).toFixed(0)}Mbps</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="export-section">
                <label className="export-label">Resolution</label>
                <div className="export-res-row">
                  <input type="number" value={customWidth} onChange={e => setCustomWidth(Number(e.target.value))} className="export-res-input" />
                  <span>x</span>
                  <input type="number" value={customHeight} onChange={e => setCustomHeight(Number(e.target.value))} className="export-res-input" />
                </div>
                <div className="export-presets">
                  {[
                    { label: '4K', w: 3840, h: 2160 },
                    { label: '1080p', w: 1920, h: 1080 },
                    { label: '720p', w: 1280, h: 720 },
                    { label: '480p', w: 854, h: 480 },
                  ].map(p => (
                    <button key={p.label} className="export-preset-btn" onClick={() => { setCustomWidth(p.w); setCustomHeight(p.h); }}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div className="export-summary">
                <div className="export-summary-row"><span>Duration</span><span>{duration.toFixed(1)}s</span></div>
                <div className="export-summary-row"><span>FPS</span><span>{fps}</span></div>
                <div className="export-summary-row"><span>Clips</span><span>{clips.length}</span></div>
                <div className="export-summary-row"><span>Output</span><span>WebM (VP9 + Opus)</span></div>
              </div>

              <button className="btn-primary export-start-btn" onClick={handleExport}>
                <Download size={15} />
                Start Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
