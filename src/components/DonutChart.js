import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme, createStyles } from '../theme';

/**
 * data: [{ value: number, color: string, label: string }]
 */
export default function DonutChart({
  data = [],
  size = 120,
  strokeWidth = 18,
  centerLabel = '',
  centerSub = '',
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let cumulativeDash = 0;
  const slices = data.map(d => {
    const length = total > 0 ? (d.value / total) * circumference : 0;
    const slice = {
      ...d,
      dashArray: `${length} ${circumference}`,
      dashOffset: -cumulativeDash,
    };
    cumulativeDash += length;
    return slice;
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <Circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={colors.card2}
          strokeWidth={strokeWidth}
        />
        {/* Slices */}
        {slices.map((s, i) => (
          <Circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            transform={`rotate(-90, ${cx}, ${cy})`}
            strokeLinecap="butt"
          />
        ))}
      </Svg>

      {/* Center label overlay */}
      {(centerLabel || centerSub) && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {centerLabel ? (
            <Text style={styles.centerLabel} numberOfLines={1}>{centerLabel}</Text>
          ) : null}
          {centerSub ? (
            <Text style={styles.centerSub} numberOfLines={1}>{centerSub}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  centerSub: {
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 1,
  },
}));
