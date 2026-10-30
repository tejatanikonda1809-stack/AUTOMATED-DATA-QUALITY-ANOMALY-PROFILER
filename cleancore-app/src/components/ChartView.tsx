import React from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import Svg, { Rect, Line, Circle, Text as SvgText, G } from "react-native-svg";

interface ChartViewProps {
  type: "histogram" | "boxplot" | "bar" | "heatmap";
  title: string;
  data: any;
}

export const ChartView: React.FC<ChartViewProps> = ({ type, title, data }) => {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(Math.max(screenWidth - 40, 320), 750);
  const chartHeight = 220;

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.empty, { color: colors.textMuted }]}>No chart data available.</Text>
      </View>
    );
  }

  // ===== HISTOGRAM / DISTRIBUTION =====
  const renderHistogram = () => {
    const bins: Array<{ bin: string; count: number }> = data.bins || [];
    if (!bins.length) {
      return <Text style={[styles.empty, { color: colors.textMuted }]}>Insufficient values for distribution.</Text>;
    }

    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    const padding = 40;
    const innerW = chartWidth - padding * 2;
    const innerH = chartHeight - padding * 2;
    const barWidth = Math.max(innerW / bins.length - 4, 6);

    return (
      <Svg width={chartWidth} height={chartHeight}>
        {/* Axes */}
        <Line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke={colors.border} strokeWidth="1" />
        <Line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke={colors.border} strokeWidth="1" />

        {bins.map((b, i) => {
          const barH = (b.count / maxCount) * innerH;
          const x = padding + i * (innerW / bins.length) + 2;
          const y = chartHeight - padding - barH;

          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                fill={colors.primary}
                rx={2}
              />
              {bins.length <= 10 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight - padding + 14}
                  fontSize="9"
                  fill={colors.textMuted}
                  textAnchor="middle"
                >
                  {b.bin}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    );
  };

  // ===== CATEGORICAL BAR CHART =====
  const renderBarChart = () => {
    const items: Array<{ label: string; count: number; pct?: number }> = data.items || [];
    if (!items.length) {
      return <Text style={[styles.empty, { color: colors.textMuted }]}>No category data available.</Text>;
    }

    const maxVal = Math.max(...items.map((it) => it.count), 1);

    return (
      <View style={styles.barList}>
        {items.slice(0, 8).map((it, idx) => {
          const pct = Math.round((it.count / maxVal) * 100);
          return (
            <View key={idx} style={styles.barItem}>
              <View style={styles.barHeader}>
                <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>
                  {it.label || "null"}
                </Text>
                <Text style={[styles.barCount, { color: colors.textSecondary }]}>
                  {it.count} ({it.pct !== undefined ? `${it.pct}%` : `${pct}%`})
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.bgSecondary }]}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // ===== BOX PLOT =====
  const renderBoxPlot = () => {
    const q1 = data.q1 ?? 0;
    const median = data.median ?? data.q2 ?? 0;
    const q3 = data.q3 ?? 0;
    const min = data.min ?? 0;
    const max = data.max ?? 100;

    const span = Math.max(max - min, 1);
    const padding = 50;
    const innerW = chartWidth - padding * 2;
    const toX = (val: number) => padding + ((val - min) / span) * innerW;

    const yMid = chartHeight / 2;
    const boxH = 46;

    const xMin = toX(min);
    const xQ1 = toX(q1);
    const xMed = toX(median);
    const xQ3 = toX(q3);
    const xMax = toX(max);

    return (
      <Svg width={chartWidth} height={chartHeight}>
        {/* Whiskers */}
        <Line x1={xMin} y1={yMid} x2={xQ1} y2={yMid} stroke={colors.textSecondary} strokeWidth="2" strokeDasharray="4 3" />
        <Line x1={xQ3} y1={yMid} x2={xMax} y2={yMid} stroke={colors.textSecondary} strokeWidth="2" strokeDasharray="4 3" />

        {/* Min & Max Caps */}
        <Line x1={xMin} y1={yMid - 16} x2={xMin} y2={yMid + 16} stroke={colors.textSecondary} strokeWidth="2" />
        <Line x1={xMax} y1={yMid - 16} x2={xMax} y2={yMid + 16} stroke={colors.textSecondary} strokeWidth="2" />

        {/* IQR Box */}
        <Rect
          x={xQ1}
          y={yMid - boxH / 2}
          width={Math.max(xQ3 - xQ1, 4)}
          height={boxH}
          fill={colors.primaryBg}
          stroke={colors.primary}
          strokeWidth="2"
          rx={4}
        />

        {/* Median Line */}
        <Line x1={xMed} y1={yMid - boxH / 2} x2={xMed} y2={yMid + boxH / 2} stroke={colors.primary} strokeWidth="3" />

        {/* Labels */}
        <SvgText x={xMin} y={yMid + 32} fontSize="10" fill={colors.textMuted} textAnchor="middle">
          Min: {Number(min).toFixed(1)}
        </SvgText>
        <SvgText x={xMed} y={yMid - boxH / 2 - 8} fontSize="10" fill={colors.primary} textAnchor="middle" fontWeight="bold">
          Med: {Number(median).toFixed(1)}
        </SvgText>
        <SvgText x={xMax} y={yMid + 32} fontSize="10" fill={colors.textMuted} textAnchor="middle">
          Max: {Number(max).toFixed(1)}
        </SvgText>
      </Svg>
    );
  };

  // ===== CORRELATION HEATMAP =====
  const renderHeatmap = () => {
    const cols: string[] = data.columns || [];
    const matrix: number[][] = data.matrix || [];

    if (!cols.length || !matrix.length) {
      return <Text style={[styles.empty, { color: colors.textMuted }]}>Insufficient numerical features for correlation.</Text>;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={styles.heatmapTable}>
          {/* Header */}
          <View style={styles.heatmapRow}>
            <View style={[styles.heatmapCell, styles.heatmapHeaderCell]} />
            {cols.map((col, idx) => (
              <View key={idx} style={[styles.heatmapCell, styles.heatmapHeaderCell]}>
                <Text style={[styles.heatmapHeaderText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {col}
                </Text>
              </View>
            ))}
          </View>

          {/* Matrix Rows */}
          {matrix.map((row, rIdx) => (
            <View key={rIdx} style={styles.heatmapRow}>
              <View style={[styles.heatmapCell, styles.heatmapRowTitleCell]}>
                <Text style={[styles.heatmapHeaderText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {cols[rIdx]}
                </Text>
              </View>
              {row.map((val, cIdx) => {
                const num = Number(val);
                const absVal = Math.min(Math.abs(num), 1);
                const isPos = num >= 0;
                const cellColor = isPos
                  ? `rgba(37, 99, 235, ${0.1 + absVal * 0.8})`
                  : `rgba(239, 68, 68, ${0.1 + absVal * 0.8})`;

                return (
                  <View key={cIdx} style={[styles.heatmapCell, { backgroundColor: cellColor }]}>
                    <Text
                      style={[
                        styles.heatmapValText,
                        { color: absVal > 0.5 ? "#fff" : colors.text },
                      ]}
                    >
                      {num.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={styles.content}>
        {type === "histogram" && renderHistogram()}
        {type === "bar" && renderBarChart()}
        {type === "boxplot" && renderBoxPlot()}
        {type === "heatmap" && renderHeatmap()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  empty: {
    fontSize: 12,
    fontStyle: "italic",
    padding: 20,
  },
  barList: {
    width: "100%",
    gap: 10,
  },
  barItem: {
    gap: 4,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barLabel: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "60%",
  },
  barCount: {
    fontSize: 11,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  heatmapTable: {
    paddingVertical: 8,
  },
  heatmapRow: {
    flexDirection: "row",
  },
  heatmapCell: {
    width: 68,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    margin: 1,
    borderRadius: 4,
  },
  heatmapHeaderCell: {
    backgroundColor: "transparent",
  },
  heatmapRowTitleCell: {
    width: 80,
    alignItems: "flex-end",
    paddingRight: 6,
    backgroundColor: "transparent",
  },
  heatmapHeaderText: {
    fontSize: 10,
    fontWeight: "700",
  },
  heatmapValText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

