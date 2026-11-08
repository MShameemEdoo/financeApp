import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '../theme';

/**
 * months: [{ label, income, expense }]
 * The rightmost month is highlighted (the month being viewed).
 * onBarPress(index): optional — tapping a month column calls it
 */
export default function BarChart({ months = [], width = 300, height = 140, onBarPress }) {
  const { colors } = useTheme();
  if (!months.length) return null;

  const paddingLeft = 32;
  const paddingBottom = 22;
  const paddingTop = 10;
  const chartW = width - paddingLeft;
  const chartH = height - paddingBottom - paddingTop;

  const maxVal = Math.max(...months.flatMap(m => [m.income, m.expense]), 1);
  const barPairW = chartW / months.length;
  const barW = Math.min((barPairW / 2) - 3, 18);
  const gap = 3;

  function barH(val) {
    return (val / maxVal) * chartH;
  }

  // Grid lines at 0%, 50%, 100%
  const gridLines = [0, 0.5, 1].map(p => ({
    y: paddingTop + chartH * (1 - p),
    label: Math.round(maxVal * p / 1000) + 'k',
  }));

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {gridLines.map((g, i) => (
        <React.Fragment key={i}>
          <Line
            x1={paddingLeft} y1={g.y}
            x2={width} y2={g.y}
            stroke={colors.card2} strokeWidth={1}
          />
          <SvgText
            x={paddingLeft - 4} y={g.y + 4}
            fill={colors.muted} fontSize={8}
            textAnchor="end"
          >
            {g.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Bars */}
      {months.map((m, i) => {
        const isLast = i === months.length - 1;
        const pairX = paddingLeft + i * barPairW + (barPairW / 2) - barW - gap / 2;
        const incomeH = barH(m.income);
        const expenseH = barH(m.expense);

        return (
          <React.Fragment key={i}>
            {/* Income bar */}
            <Rect
              x={pairX}
              y={paddingTop + chartH - incomeH}
              width={barW}
              height={incomeH}
              rx={4}
              fill={colors.income}
              opacity={isLast ? 1 : 0.7}
            />
            {/* Expense bar */}
            <Rect
              x={pairX + barW + gap}
              y={paddingTop + chartH - expenseH}
              width={barW}
              height={expenseH}
              rx={4}
              fill={colors.expense}
              opacity={isLast ? 1 : 0.7}
            />
            {/* Month label */}
            <SvgText
              x={paddingLeft + i * barPairW + barPairW / 2}
              y={height - 4}
              fill={isLast ? colors.accent : colors.muted}
              fontSize={9}
              fontWeight={isLast ? '700' : '400'}
              textAnchor="middle"
            >
              {m.label}
            </SvgText>
            {/* Invisible touch target covering the whole month column */}
            {onBarPress && (
              <Rect
                x={paddingLeft + i * barPairW}
                y={0}
                width={barPairW}
                height={height}
                fill="#000"
                fillOpacity={0.01}
                onPress={() => onBarPress(i)}
              />
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
