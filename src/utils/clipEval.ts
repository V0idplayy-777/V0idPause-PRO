import { Clip, Keyframe } from '../types';

export function evalKeyframes(kfs: Keyframe[] | undefined, localTime: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  const sorted = [...kfs].sort((a, b) => a.time - b.time);
  if (localTime <= sorted[0].time) return sorted[0].value;
  if (localTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (localTime >= a.time && localTime <= b.time) {
      const t = (localTime - a.time) / (b.time - a.time || 1);
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

export function getClipProps(clip: Clip, localTime: number) {
  const kf = clip.keyframes || {};
  const opacity = evalKeyframes(kf.opacity, localTime, clip.opacity ?? 1);
  const volume = evalKeyframes(kf.volume, localTime, clip.volume ?? 1);
  const x = evalKeyframes(kf.x, localTime, clip.x ?? 0);
  const y = evalKeyframes(kf.y, localTime, clip.y ?? 0);
  const scale = evalKeyframes(kf.scale, localTime, clip.scale ?? 1);

  const td = clip.transitionDuration ?? 0.5;
  let transOpacity = 1;
  if (clip.transition && clip.transition !== 'none' && td > 0) {
    if (localTime < td) {
      const p = localTime / td;
      if (clip.transition === 'fade' || clip.transition === 'dissolve') {
        transOpacity = p;
      } else {
        transOpacity = p;
      }
    }
  }

  return {
    opacity: opacity * transOpacity,
    volume,
    x,
    y,
    scale,
    transitionProgress: td > 0 && localTime < td ? localTime / td : 1,
    transitionType: clip.transition || 'none',
  };
}
