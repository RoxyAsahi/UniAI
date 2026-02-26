import React from "react";
import { Dimension, Zone, ZONE_LABELS, ZONE_COLORS, getDimensionZone } from "@/data/uqa-questions";

interface Props {
  dimension: Dimension;
  score: number;
}

const DimensionCard: React.FC<Props> = ({ dimension, score }) => {
  const zone: Zone = getDimensionZone(score, dimension.maxScore);
  const zoneLabel = ZONE_LABELS[zone];
  const zoneColor = ZONE_COLORS[zone];
  const interpretation = dimension.interpretations[zone];
  const percentage = Math.round((score / dimension.maxScore) * 100);

  return (
    <div className="dimension-card" style={{ borderLeftColor: dimension.color }}>
      <div className="dimension-card-header">
        <div className="dimension-name" style={{ color: dimension.color }}>
          {dimension.name}
        </div>
        <div className="dimension-zone-badge" style={{ backgroundColor: zoneColor }}>
          {zoneLabel}
        </div>
      </div>

      <div className="dimension-score-row">
        <span className="dimension-score">
          {score}
          <span className="dimension-max">/{dimension.maxScore}</span>
        </span>
        <span className="dimension-percent">{percentage}%</span>
      </div>

      <div className="dimension-progress">
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${percentage}%`, backgroundColor: dimension.color }}
          />
        </div>
      </div>

      <p className="dimension-interpretation">{interpretation}</p>
    </div>
  );
};

export default DimensionCard;
