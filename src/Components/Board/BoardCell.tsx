import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Polygon } from 'react-native-svg';

const DINO_COLORS: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  yellow: '#f1c40f',
};

interface BoardCellProps {
  size: number;
  robotColor?: string;
  targetColor?: string;
  walls?: { direction: 'north' | 'east' | 'south' | 'west' }[];
  isSelected?: boolean;
}

const BoardCell: React.FC<BoardCellProps> = ({
  size,
  robotColor,
  targetColor,
  walls = [],
  isSelected,
}) => {
  const wallThickness = Math.max(2, size * 0.12);

  return (
    <View
      style={[
        styles.cell,
        { width: size, height: size },
        isSelected && styles.selected,
      ]}
    >
      <Svg width={size} height={size}>
        {targetColor && (
          <Polygon
            points={`${size / 2},${size * 0.15} ${size * 0.85},${size * 0.75} ${size * 0.15},${size * 0.75}`}
            fill={DINO_COLORS[targetColor] || '#999'}
            opacity={0.35}
          />
        )}
        {walls.some((w) => w.direction === 'north') && (
          <Rect x={0} y={0} width={size} height={wallThickness} fill="#5d4e37" />
        )}
        {walls.some((w) => w.direction === 'south') && (
          <Rect
            x={0}
            y={size - wallThickness}
            width={size}
            height={wallThickness}
            fill="#5d4e37"
          />
        )}
        {walls.some((w) => w.direction === 'west') && (
          <Rect x={0} y={0} width={wallThickness} height={size} fill="#5d4e37" />
        )}
        {walls.some((w) => w.direction === 'east') && (
          <Rect
            x={size - wallThickness}
            y={0}
            width={wallThickness}
            height={size}
            fill="#5d4e37"
          />
        )}
        {robotColor && (
          <>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.32}
              fill={DINO_COLORS[robotColor] || '#999'}
            />
            <Circle
              cx={size * 0.38}
              cy={size * 0.38}
              r={size * 0.06}
              fill="#fff"
            />
            <Circle
              cx={size * 0.62}
              cy={size * 0.38}
              r={size * 0.06}
              fill="#fff"
            />
          </>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  cell: {
    backgroundColor: '#f4f1ea',
    borderWidth: 0.5,
    borderColor: '#ddd',
  },
  selected: {
    backgroundColor: '#e8f4fc',
    borderColor: '#3498db',
    borderWidth: 2,
  },
});

export default BoardCell;
