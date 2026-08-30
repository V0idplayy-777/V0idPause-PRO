import { create } from 'zustand';
import { ProjectState, Track, Clip, MediaAsset, Tool, HistoryEntry, Marker } from '../types';

const DEFAULT_TRACKS: Track[] = [
  { id: 'v1', name: 'Video 1', type: 'video', locked: false, muted: false, solo: false, height: 64, color: '#c0392b' },
  { id: 'v2', name: 'Video 2', type: 'video', locked: false, muted: false, solo: false, height: 64, color: '#e67e22' },
  { id: 'a1', name: 'Audio 1', type: 'audio', locked: false, muted: false, solo: false, height: 48, color: '#27ae60' },
  { id: 'a2', name: 'Audio 2', type: 'audio', locked: false, muted: false, solo: false, height: 48, color: '#2980b9' },
];

interface StoreActions {
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackVolume: (vol: number) => void;
  setZoom: (zoom: number) => void;
  setSelectedTool: (tool: Tool) => void;
  setSnapEnabled: (snap: boolean) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  removeClips: (ids: string[]) => void;
  selectClips: (ids: string[]) => void;
  splitClip: (clipId: string, time: number) => void;
  duplicateClips: (ids: string[]) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (id: string) => void;
  setProjectName: (name: string) => void;
  setDuration: (duration: number) => void;
  setFps: (fps: number) => void;
  pushHistory: (label: string) => void;
  undo: () => void;
  redo: () => void;
  addMarker: (marker: Marker) => void;
  removeMarker: (id: string) => void;
}

const computeDuration = (clips: Clip[]) => {
  if (clips.length === 0) return 60;
  return Math.max(60, ...clips.map(c => c.startTime + c.duration)) + 10;
};

export const useStore = create<ProjectState & StoreActions>((set, get) => ({
  name: 'Untitled Project',
  tracks: DEFAULT_TRACKS,
  clips: [],
  duration: 60,
  currentTime: 0,
  playing: false,
  zoom: 80,
  selectedClipIds: [],
  selectedTool: 'select',
  mediaAssets: [],
  fps: 30,
  resolution: { width: 1920, height: 1080 },
  snapEnabled: true,
  undoStack: [],
  redoStack: [],
  playbackVolume: 1,
  markers: [],

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setPlaying: (playing) => set({ playing }),
  setPlaybackVolume: (vol) => set({ playbackVolume: Math.max(0, Math.min(1, vol)) }),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSnapEnabled: (snap) => set({ snapEnabled: snap }),

  addClip: (clip) => {
    get().pushHistory('Add clip');
    set(state => {
      const clips = [...state.clips, clip];
      return { clips, duration: computeDuration(clips), selectedClipIds: [clip.id] };
    });
  },

  updateClip: (id, updates) => {
    set(state => {
      const clips = state.clips.map(c => c.id === id ? { ...c, ...updates } : c);
      return { clips, duration: computeDuration(clips) };
    });
  },

  removeClips: (ids) => {
    get().pushHistory('Delete clips');
    set(state => {
      const clips = state.clips.filter(c => !ids.includes(c.id));
      return { clips, selectedClipIds: [], duration: computeDuration(clips) };
    });
  },

  selectClips: (ids) => set({ selectedClipIds: ids }),

  splitClip: (clipId, time) => {
    const state = get();
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    if (time <= clip.startTime || time >= clip.startTime + clip.duration) return;
    state.pushHistory('Split clip');
    const leftDuration = time - clip.startTime;
    const rightDuration = clip.duration - leftDuration;
    const rightTrimStart = (clip.trimStart || 0) + leftDuration;
    const left: Clip = { ...clip, duration: leftDuration };
    const right: Clip = { ...clip, id: crypto.randomUUID(), startTime: time, duration: rightDuration, trimStart: rightTrimStart };
    set(state => ({ clips: state.clips.map(c => c.id === clipId ? left : c).concat(right) }));
  },

  duplicateClips: (ids) => {
    get().pushHistory('Duplicate clips');
    const state = get();
    const newClips: Clip[] = state.clips
      .filter(c => ids.includes(c.id))
      .map(c => ({ ...c, id: crypto.randomUUID(), startTime: c.startTime + c.duration + 0.1 }));
    set(s => ({ clips: [...s.clips, ...newClips], selectedClipIds: newClips.map(c => c.id) }));
  },

  addTrack: (track) => {
    get().pushHistory('Add track');
    set(state => ({ tracks: [...state.tracks, track] }));
  },

  updateTrack: (id, updates) => {
    set(state => ({ tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  },

  removeTrack: (id) => {
    get().pushHistory('Remove track');
    set(state => ({
      tracks: state.tracks.filter(t => t.id !== id),
      clips: state.clips.filter(c => c.trackId !== id),
    }));
  },

  addMediaAsset: (asset) => set(state => ({ mediaAssets: [...state.mediaAssets, asset] })),
  removeMediaAsset: (id) => set(state => ({ mediaAssets: state.mediaAssets.filter(a => a.id !== id) })),
  setProjectName: (name) => set({ name }),
  setDuration: (duration) => set({ duration }),
  setFps: (fps) => set({ fps }),

  pushHistory: (label) => {
    const state = get();
    const entry: HistoryEntry = {
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      clips: JSON.parse(JSON.stringify(state.clips)),
      label,
    };
    set(s => ({ undoStack: [...s.undoStack.slice(-49), entry], redoStack: [] }));
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack[state.undoStack.length - 1];
    const currentEntry: HistoryEntry = {
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      clips: JSON.parse(JSON.stringify(state.clips)),
      label: 'redo',
    };
    set(s => ({
      tracks: prev.tracks, clips: prev.clips,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, currentEntry],
      duration: computeDuration(prev.clips),
      selectedClipIds: [],
    }));
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const next = state.redoStack[state.redoStack.length - 1];
    const currentEntry: HistoryEntry = {
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      clips: JSON.parse(JSON.stringify(state.clips)),
      label: 'undo',
    };
    set(s => ({
      tracks: next.tracks, clips: next.clips,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, currentEntry],
      duration: computeDuration(next.clips),
      selectedClipIds: [],
    }));
  },

  addMarker: (marker) => set(state => ({ markers: [...state.markers, marker] })),
  removeMarker: (id) => set(state => ({ markers: state.markers.filter(m => m.id !== id) })),
}));
