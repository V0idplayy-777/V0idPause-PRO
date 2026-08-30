import { useState } from 'react';
import { X, Download, FileVideo, CheckCircle, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ExportModalProps {
  onClose: () => void;
}

type ExportFormat = 'webm' | 'mp4' | 'gif';
type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

const QUALITY_BITRATES: Record<ExportQuality, number> = {
  low: 1_000_000,
  medium: 4_000_000,
  high: 8_000_000,
  ultra: 16_000_000,
};

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { clips, tracks, duration, fps, resolution } = useStore();
  const [format, setFormat] = useState<ExportFormat>('webm');
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [customWidth, setCustomWidth] = useState(resolution.width);
  const [customHeight, setCustomHeight] = useState(resolution.height);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setDone(false);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = customWidth;
      canvas.height = customHeight;
      const ctx = canvas.getContext('2d')!;

      const mimeType = format === 'webm' ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
      const bitrate = QUALITY_BITRATES[quality];

      let stream: MediaStream;
      try {
        stream = canvas.captureStream(fps);
      } catch {
        setStatusMsg('Canvas capture not supported in this browser. Try Chrome.');
        setExporting(false);
        return;
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${format === 'mp4' ? 'webm' : format}`;
        a.click();
        URL.revokeObjectURL(url);
        setDone(true);
        setExporting(false);
        setStatusMsg('Export complete! File downloaded.');
      };

      recorder.start(100);

      const videoMap = new Map<string, HTMLVideoElement>();

      await Promise.all(
        clips.filter(c => c.src && c.type === 'video').map(c => new Promise<void>(resolve => {
          const v = document.createElement('video');
          v.src = c.src!;
          v.preload = 'auto';
          v.crossOrigin = 'anonymous';
          v.onloadedmetadata = () => { videoMap.set(c.id, v); resolve(); };
          v.onerror = () => resolve();
        }))
      );

      const frameInterval = 1 / fps;
      const totalFrames = Math.ceil(duration * fps);

      const renderFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));

      setStatusMsg('Rendering frames...');

      for (let f2 = 0; f2 < totalFrames; f2++) {
        const t = f2 * frameInterval;
        setProgress(Math.round((f2 / totalFrames) * 100));

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
          ctx.globalAlpha = clip.opacity ?? 1;
          if (clip.type === 'video') {
            const vid = videoMap.get(clip.id);
            if (vid) {
              const clipT = t - clip.startTime + (clip.trimStart || 0);
              vid.currentTime = clipT;
              if (vid.readyState >= 2) ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            }
          } else if (clip.type === 'image' && clip.src) {
            const img = new Image();
            img.src = clip.src;
            if (img.complete) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          } else if (clip.type === 'text') {
            const fs = clip.fontSize || 64;
            ctx.font = `bold ${fs}px ${clip.fontFamily || 'Inter'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = clip.textColor || '#fff';
            ctx.fillText(clip.textContent || '', canvas.width / 2, canvas.height / 2);
          }
          ctx.globalAlpha = 1;
        }

        if (f2 % 10 === 0) await renderFrame();
      }

      recorder.stop();
    } catch (err) {
      setStatusMsg(`Export failed: ${err}`);
      setExporting(false);
    }
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
              <p className="export-warning">Note: Browser export captures frames. Large projects may take a while. Do not close this window.</p>
            </div>
          ) : (
            <>
              <div className="export-section">
                <label className="export-label">Format</label>
                <div className="export-options">
                  {(['webm', 'mp4', 'gif'] as ExportFormat[]).map(f2 => (
                    <button key={f2} className={`export-option-btn ${format === f2 ? 'active' : ''}`} onClick={() => setFormat(f2)}>
                      {f2.toUpperCase()}
                      {f2 === 'mp4' && <span className="export-note">(.webm)</span>}
                    </button>
                  ))}
                </div>
              </div>

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
                <div className="export-summary-row"><span>Tracks</span><span>{tracks.length}</span></div>
              </div>

              <div className="export-warning-box">
                Browser-based export uses WebM format via MediaRecorder API. For production MP4 exports, use a dedicated encoder. Chrome/Edge recommended.
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

import React from 'react';
