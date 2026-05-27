import React, { useMemo } from 'react';
import { Heatmap } from 'react-native-maps';
import { useMapStore } from '../../store/mapStore';

export default function HeatmapLayer() {
  const { heatmapPoints } = useMapStore();

  const points = useMemo(
    () => heatmapPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude, weight: p.weight })),
    [heatmapPoints],
  );

  if (points.length === 0) return null;

  return (
    <Heatmap
      points={points}
      radius={40}
      opacity={0.7}
      gradient={{
        colors: ['rgba(34,211,238,0)', 'rgba(34,211,238,0.45)', 'rgba(37,99,235,0.55)', 'rgba(79,70,229,0.70)'],
        startPoints: [0, 0.3, 0.6, 1.0],
        colorMapSize: 256,
      }}
    />
  );
}
