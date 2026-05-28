import React from 'react';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

interface Props {
  selected?: boolean;
  verified?: boolean;
  size?: number;
}

export default function OwlPinMarker({ selected = false, verified = true, size = 52 }: Props) {
  const primary = verified ? '#2563EB' : '#6B7280';
  const eyeBg = verified ? '#EFF6FF' : '#F1F5F9';
  const h = Math.round(size * 82 / 60);

  // Tick marks at 12 clock positions
  const ticks = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const isCardinal = i % 3 === 0;
    const outerR = isCardinal ? 27.5 : 26;
    const innerR = isCardinal ? 21.5 : 23;
    const x1 = (30 + outerR * Math.cos(angle)).toFixed(2);
    const y1 = (30 + outerR * Math.sin(angle)).toFixed(2);
    const x2 = (30 + innerR * Math.cos(angle)).toFixed(2);
    const y2 = (30 + innerR * Math.sin(angle)).toFixed(2);
    return { i, x1, y1, x2, y2, isCardinal };
  });

  return (
    <Svg width={size} height={h} viewBox="0 0 60 82">
      {/* Pin stem */}
      <Path d="M30 80 L24 55 L36 55 Z" fill={primary} />

      {/* Circle fill */}
      <Circle cx="30" cy="30" r="27.5" fill="white" />

      {/* Tick marks */}
      {ticks.map(({ i, x1, y1, x2, y2, isCardinal }) => (
        <Path
          key={i}
          d={`M${x1} ${y1} L${x2} ${y2}`}
          stroke={primary}
          strokeWidth={isCardinal ? 2.5 : 1.5}
          strokeLinecap="round"
        />
      ))}

      {/* Circle border */}
      <Circle cx="30" cy="30" r="27.5" fill="none" stroke={primary} strokeWidth="3" />

      {/* Eye socket backgrounds */}
      <Ellipse cx="21" cy="29" rx="7.5" ry="8" fill={eyeBg} />
      <Ellipse cx="39" cy="29" rx="7.5" ry="8" fill={eyeBg} />

      {selected ? (
        /* Eyes OPEN */
        <G>
          <Circle cx="21" cy="29" r="5.5" fill="white" stroke={primary} strokeWidth="1.5" />
          <Circle cx="21" cy="29.5" r="3.5" fill="#F59E0B" />
          <Circle cx="21" cy="29.5" r="2" fill="#111827" />
          <Circle cx="22.3" cy="28.2" r="0.9" fill="white" />

          <Circle cx="39" cy="29" r="5.5" fill="white" stroke={primary} strokeWidth="1.5" />
          <Circle cx="39" cy="29.5" r="3.5" fill="#F59E0B" />
          <Circle cx="39" cy="29.5" r="2" fill="#111827" />
          <Circle cx="40.3" cy="28.2" r="0.9" fill="white" />
        </G>
      ) : (
        /* Eyes CLOSED */
        <G>
          <Path d="M15.5 29 Q21 23.5 26.5 29" stroke={primary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M33.5 29 Q39 23.5 44.5 29" stroke={primary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </G>
      )}

      {/* Beak */}
      <Path d="M27 37 L30 42 L33 37 Z" fill="#F59E0B" />

      {/* Forehead tufts */}
      <Path d="M22 7 Q19 3 16 6" stroke={primary} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M38 7 Q41 3 44 6" stroke={primary} strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}
