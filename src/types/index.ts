export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'effect';

export interface Keyframe {
  time: number;
  value: number;
}

export interface ClipKeyframes {
  opacity?: Keyframe[];
  volume?: Keyframe[];
  x?: Keyframe[];
  y?: Keyframe[];
  scale?: Keyframe[];
}

export interface Clip {
  id: string;
  name: string;
  type: ClipType;
  trackId: string;
  startTime: number;
  duration: number;
  src?: string;
  color?: string;
  volume?: number;
  opacity?: number;
  speed?: number;
  trimStart?: number;
  trimEnd?: number;
  originalDuration?: number;
  textContent?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  textBgColor?: string;
  filters?: FilterSettings;
  transition?: TransitionType;
  transitionDuration?: number;
  muted?: boolean;
  locked?: boolean;
  x?: number;
  y?: number;
  scale?: number;
  keyframes?: ClipKeyframes;
}

export interface FilterSettings {
  brightness: number;
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
  zoom: number;
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
