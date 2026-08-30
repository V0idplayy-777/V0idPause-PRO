import React, { useRef, useCallback } from 'react';
import {
  FolderOpen, Plus, Trash2, Music, Image, Type,
  FileVideo, Search, Grid2x2, List, Upload
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { MediaAsset, Clip, ClipType } from '../types';

const CLIP_COLORS: Record<ClipType, string> = {
  video: '#c0392b',
  audio: '#27ae60',
  image: '#8e44ad',
  text: '#2980b9',
  effect: '#f39c12',
};

const TypeIcon: React.FC<{ type: ClipType; size?: number }> = ({ type, size = 14 }) => {
  switch (type) {
    case 'video': return <FileVideo size={size} />;
    case 'audio': return <Music size={size} />;
    case 'image': return <Image size={size} />;
    case 'text': return <Type size={size} />;
    default: return <FileVideo size={size} />;
  }
};

const formatDuration = (secs?: number) => {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const MediaPanel: React.FC = () => {
  const { mediaAssets, addMediaAsset, removeMediaAsset, tracks, addClip, currentTime } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'list' | 'grid'>('list');

  const handleFileImport = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: ClipType = 'video';
      if (['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'].includes(ext)) type = 'audio';
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) type = 'image';

      const asset: MediaAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        src: url,
        size: file.size,
      };

      if (type === 'video' || type === 'audio') {
        const media = document.createElement(type === 'video' ? 'video' : 'audio');
        media.src = url;
        media.onloadedmetadata = () => {
          asset.duration = media.duration;
          if (type === 'video' && media instanceof HTMLVideoElement) {
            asset.width = media.videoWidth;
            asset.height = media.videoHeight;
          }
          addMediaAsset({ ...asset });
        };
        media.onerror = () => addMediaAsset(asset);
      } else if (type === 'image') {
        const img = new window.Image();
        img.src = url;
        img.onload = () => {
          asset.width = img.naturalWidth;
          asset.height = img.naturalHeight;
          asset.duration = 5;
          addMediaAsset({ ...asset });
        };
        img.onerror = () => addMediaAsset(asset);
      } else {
        addMediaAsset(asset);
      }
    });
  }, [addMediaAsset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileImport(e.dataTransfer.files);
  }, [handleFileImport]);

  const handleAddToTimeline = (asset: MediaAsset) => {
    const videoTracks = tracks.filter(t => t.type === 'video');
    const audioTracks = tracks.filter(t => t.type === 'audio');
    let trackId = '';
    if (asset.type === 'audio') trackId = audioTracks[0]?.id || tracks[0]?.id;
    else trackId = videoTracks[0]?.id || tracks[0]?.id;
    if (!trackId) return;

    const clip: Clip = {
      id: crypto.randomUUID(),
      name: asset.name,
      type: asset.type,
      trackId,
      startTime: currentTime,
      duration: asset.duration || 5,
      src: asset.src,
      color: CLIP_COLORS[asset.type],
      volume: 1,
      opacity: 1,
      speed: 1,
      originalDuration: asset.duration || 5,
      filters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0 },
      transition: 'none',
    };
    addClip(clip);
  };

  const addTextClip = () => {
    const videoTracks = tracks.filter(t => t.type === 'video');
    const trackId = videoTracks[0]?.id || tracks[0]?.id;
    if (!trackId) return;
    const clip: Clip = {
      id: crypto.randomUUID(),
      name: 'Title Text',
      type: 'text',
      trackId,
      startTime: currentTime,
      duration: 5,
      color: CLIP_COLORS.text,
      textContent: 'Title Text',
      fontSize: 64,
      fontFamily: 'Inter',
      textColor: '#ffffff',
      textBgColor: 'transparent',
      volume: 1,
      opacity: 1,
      speed: 1,
      filters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0 },
      transition: 'none',
    };
    addClip(clip);
  };

  const filtered = mediaAssets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="panel media-panel">
      <div className="panel-header">
        <span className="panel-title">Media</span>
        <div className="panel-header-actions">
          <button className={`icon-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="List view"><List size={13} /></button>
          <button className={`icon-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')} title="Grid view"><Grid2x2 size={13} /></button>
        </div>
      </div>

      <div className="panel-toolbar">
        <button className="panel-action-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={13} /> Import
        </button>
        <button className="panel-action-btn" onClick={addTextClip}>
          <Type size={13} /> Text
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          style={{ display: 'none' }}
          onChange={e => handleFileImport(e.target.files)}
        />
      </div>

      <div className="search-bar">
        <Search size={12} className="search-icon" />
        <input
          className="search-input"
          placeholder="Search media..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div
        className="media-list-container"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {filtered.length === 0 ? (
          <div className="media-empty">
            <div
              className="media-drop-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <FolderOpen size={28} className="drop-icon" />
              <p>Drop media files here</p>
              <p className="drop-sub">or click to import</p>
              <p className="drop-sub">MP4, MOV, MP3, WAV, JPG, PNG...</p>
            </div>
          </div>
        ) : (
          <div className={view === 'grid' ? 'media-grid' : 'media-list'}>
            {filtered.map(asset => (
              <div
                key={asset.id}
                className={`media-item ${view}`}
                draggable
                onDragStart={e => { e.dataTransfer.setData('assetId', asset.id); }}
                onDoubleClick={() => handleAddToTimeline(asset)}
                title={`${asset.name}\n${formatDuration(asset.duration)} · ${formatSize(asset.size)}\nDouble-click or drag to add`}
              >
                <div className="media-item-thumb" style={{ background: `${CLIP_COLORS[asset.type]}22`, border: `1px solid ${CLIP_COLORS[asset.type]}44` }}>
                  {asset.src && asset.type === 'image' ? (
                    <img src={asset.src} alt={asset.name} className="thumb-img" />
                  ) : (
                    <span style={{ color: CLIP_COLORS[asset.type] }}>
                      <TypeIcon type={asset.type} size={view === 'grid' ? 22 : 16} />
                    </span>
                  )}
                </div>
                {view === 'list' && (
                  <div className="media-item-info">
                    <span className="media-item-name">{asset.name}</span>
                    <span className="media-item-meta">
                      {formatDuration(asset.duration)} {asset.width ? `· ${asset.width}×${asset.height}` : ''} {formatSize(asset.size) ? `· ${formatSize(asset.size)}` : ''}
                    </span>
                  </div>
                )}
                {view === 'grid' && (
                  <div className="media-item-label">{asset.name.length > 16 ? asset.name.slice(0, 14) + '…' : asset.name}</div>
                )}
                <div className="media-item-actions">
                  <button className="icon-btn-sm" onClick={() => handleAddToTimeline(asset)} title="Add to timeline"><Plus size={11} /></button>
                  <button className="icon-btn-sm danger" onClick={() => removeMediaAsset(asset.id)} title="Remove"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
