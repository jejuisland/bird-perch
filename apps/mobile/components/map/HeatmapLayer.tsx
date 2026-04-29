import React from 'react';
import { Circle } from 'react-native-maps';
import { useMapStore } from '../../store/mapStore';

// Renders heatmap as colored circles since react-native-maps Heatmap
// component only works on Android with Google Maps provider.
export default function HeatmapLayer() {
  const { heatmapPoints } = useMapStore();

  return (
    <>
      {heatmapPoints.map((point, idx) => {
        const alpha = 0.15 + point.weight * 0.5;
        // Interpolate blue (low) → red (high) based on weight
        const r = Math.round(point.weight * 239);
        const g = Math.round((1 - point.weight) * 100);
        const b = Math.round((1 - point.weight) * 235);

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
