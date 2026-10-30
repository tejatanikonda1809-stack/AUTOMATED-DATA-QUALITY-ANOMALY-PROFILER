import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

interface QualityScoreCardProps {
  scoreData?: {
    score?: number;
    label?: string;
    factors?: Array<{
      name: string;
      penalty: number;
      value: string;
      weight: number;
      explanation: string;
      informational?: boolean;
    }>;
  };
}

export const QualityScoreCard: React.FC<QualityScoreCardProps> = ({ scoreData }) => {
  const { colors } = useTheme();

  if (!scoreData || scoreData.score === undefined) {
    return null;
  }

  const score = Math.round(scoreData.score);
  const label = scoreData.label || (score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Fair" : "Poor");

  const getScoreColor = () => {
    if (score >= 90) return colors.success;
    if (score >= 75) return colors.primary;
    if (score >= 50) return colors.warning;
    return colors.danger;
  };

  const scoreColor = getScoreColor();

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={styles.scoreContainer}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor, backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
            <Text style={[styles.scoreScale, { color: colors.textMuted }]}>/ 100</Text>
          </View>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.labelRow}>
            <Text style={[styles.title, { color: colors.text }]}>Dataset Quality Score</Text>
            <View style={[styles.statusBadge, { backgroundColor: scoreColor + "20", borderColor: scoreColor }]}>
              <Text style={[styles.statusText, { color: scoreColor }]}>{label}</Text>
            </View>
          </View>
          <Text style={[styles.description, { color: colors.textMuted }]}>
            Calculated objectively from weighted data health factors: completeness, uniqueness, type integrity, and anomaly detection.
          </Text>
        </View>
      </View>

      {/* Factor Breakdown */}
      {scoreData.factors && scoreData.factors.length > 0 && (
        <View style={[styles.factorsSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.factorsTitle, { color: colors.textSecondary }]}>Quality Score Factor Breakdown</Text>
          <View style={styles.factorsGrid}>
            {scoreData.factors.map((factor, idx) => {
              const isInfo = factor.informational || factor.weight === 0;
              const hasPenalty = factor.penalty > 0;
              return (
                <View
                  key={idx}
                  style={[
                    styles.factorCard,
                    {
                      backgroundColor: colors.bgSecondary,
                      borderColor: hasPenalty ? colors.danger : colors.border,
                    },
                  ]}
                >
                  <View style={styles.factorHeader}>
                    <Text style={[styles.factorName, { color: colors.text }]} numberOfLines={1}>
                      {factor.name}
                    </Text>
                    {isInfo ? (
                      <View style={[styles.penaltyBadge, { backgroundColor: colors.infoBg }]}>
                        <Text style={[styles.penaltyText, { color: colors.info }]}>Info Only</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.penaltyBadge,
                          { backgroundColor: hasPenalty ? colors.dangerBg : colors.successBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.penaltyText,
                            { color: hasPenalty ? colors.danger : colors.success },
                          ]}
                        >
                          {hasPenalty ? `-${factor.penalty} pts` : "0 pts penalty"}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.factorValue, { color: colors.textSecondary }]}>{factor.value}</Text>
                  <Text style={[styles.factorExplanation, { color: colors.textMuted }]}>{factor.explanation}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  scoreContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  scoreScale: {
    fontSize: 11,
    fontWeight: "600",
  },
  summaryContainer: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
  factorsSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  factorsTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
  factorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  factorCard: {
    flex: 1,
    minWidth: 200,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  factorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 6,
  },
  factorName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  penaltyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  penaltyText: {
    fontSize: 10,
    fontWeight: "700",
  },
  factorValue: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  factorExplanation: {
    fontSize: 11,
    lineHeight: 15,
  },
});

