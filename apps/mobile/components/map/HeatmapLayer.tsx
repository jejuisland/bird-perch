import React from 'react';
import { Circle } from 'react-native-maps';
import { useMapStore } from '../../store/mapStore';
import { HEAT_RAMP } from '../../constants';

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

// Maps a 0–1 weight onto the cool→intense ramp: cyan (low) → blue → indigo (high).
function rampColor(weight: number): { r: number; g: number; b: number } {
  const { low, mid, high } = HEAT_RAMP;
  if (weight < 0.5) {
    const t = weight * 2; // low → mid
    return { r: lerp(low[0], mid[0], t), g: lerp(low[1], mid[1], t), b: lerp(low[2], mid[2], t) };
  }
  const t = (weight - 0.5) * 2; // mid → high
  return { r: lerp(mid[0], high[0], t), g: lerp(mid[1], high[1], t), b: lerp(mid[2], high[2], t) };
}

// Renders heatmap as colored circles since react-native-maps Heatmap
// component only works on Android with Google Maps provider.
export default function HeatmapLayer() {
  const { heatmapPoints } = useMapStore();

  return (
    <>
      {heatmapPoints.map((point, idx) => {
        // Ramp alpha from the low stop (0.45) up to the high stop (0.70).
        const alpha = 0.45 + point.weight * 0.25;
        const { r, g, b } = rampColor(point.weight);

        return (
          <Circle
            key={`h-${idx}`}
            center={{ latitude: point.latitude, longitude: point.longitude }}
            radius={80}
            fillColor={`rgba(${r},${g},${b},${alpha})`}
            strokeWidth={0}
          />
        );
      })}
    </>
  );
}
