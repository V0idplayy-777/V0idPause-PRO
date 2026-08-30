export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'effect';

export interface Clip {
  id: string;
  name: string;
  type: ClipType;
  trackId: string;
  startTime: number;   // seconds on timeline
  duration: number;    // seconds
  src?: string;        // object URL or data URL
  color?: string;
  volume?: number;     // 0-1
  opacity?: number;    // 0-1
  speed?: number;      // 0.25-4
  trimStart?: number;  // seconds trimmed from original start
  trimEnd?: number;    // seconds trimmed from original end
  originalDuration?: number;
  textContent?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  textBgColor?: string;
  filters?: FilterSettings;
  transition?: TransitionType;
  muted?: boolean;
  locked?: boolean;
}

export interface FilterSettings {
  brightness: number;  // 0-200 (100 = normal)
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
  grayscale: number;
}

export type TransitionType = 'none' | 'fade' | 'slide' | 'wipe' | 'dissolve';

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  locked: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
  color: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: ClipType;
  src: string;
  duration?: number;
  thumbnail?: string;
  width?: number;
  height?: number;
  size?: number;
}

export type Tool = 'select' | 'razor' | 'hand' | 'zoom';

export interface ProjectState {
  name: string;
  tracks: Track[];
  clips: Clip[];
  duration: number;
  currentTime: number;
  playing: boolean;
  zoom: number;           // pixels per second
  selectedClipIds: string[];
  selectedTool: Tool;
  mediaAssets: MediaAsset[];
  fps: number;
  resolution: { width: number; height: number };
  snapEnabled: boolean;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  playbackVolume: number;
  markers: Marker[];
}

export interface HistoryEntry {
  tracks: Track[];
  clips: Clip[];
  label: string;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
}
