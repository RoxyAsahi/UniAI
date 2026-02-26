import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { AssessmentReport } from "@/api/uqa";
import { DIMENSIONS, getDimensionZone, ZONE_LABELS, Zone } from "@/data/uqa-questions";
import RadarChart from "@/components/uqa/RadarChart";
import DimensionCard from "@/components/uqa/DimensionCard";
import { useActionSheet } from "@/components/ui/action-sheet";
import {
  exportReviewAnalysisToPDF,
  exportReviewAnalysisToImage,
} from "@/utils/pdfExport";
import "@/assets/pages/uqa-questionnaire-result.less";

interface LocalResult {
  total_score: number;
  report: AssessmentReport;
  created_at: string;
}

const UqaResult: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<LocalResult | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const { show: showActionSheet, ActionSheetComponent } = useActionSheet();

  // 从 sessionStorage 读取问卷结果
  useEffect(() => {
    const raw = sessionStorage.getItem("uqa_result");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as LocalResult;
      setResult(data);
      setTimeout(() => setShowContent(true), 100);
    } catch {
      // 解析失败则 result 保持 null，显示错误页
    }
  }, []);

  // 动画计数器
  useEffect(() => {
    if (!result) return;
    const target = result.total_score;
    const duration = 1200;
    let startTime: number;
    const animate = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setAnimatedScore(Math.round(target * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [result]);

  const handleExport = () => {
    showActionSheet("导出报告", [
      {
        label: "导出为 PDF",
        onClick: () => exportReviewAnalysisToPDF("uqa-result-content", "UQA诊断报告"),
      },
      {
        label: "保存为图片",
        onClick: () => exportReviewAnalysisToImage("uqa-result-content", "uqa-report"),
      },
    ]);
  };

  if (!result) {
    return (
      <div className="uqa-result-page">
        <div className="uqa-page-header">
          <button className="back-btn" onClick={() => navigate("/uqa/questionnaire")}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title">诊断报告</h1>
        </div>
        <div className="error-container">
          <p>未找到诊断结果，请先完成问卷。</p>
          <button onClick={() => navigate("/uqa/questionnaire")}>去做问卷</button>
        </div>
      </div>
    );
  }

  const { report } = result;
  const totalMaxScore = DIMENSIONS.reduce((s, d) => s + d.maxScore, 0);
  const createdAt = new Date(result.created_at).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const radarData = DIMENSIONS.map((dim) => ({
    dimensionId: dim.id,
    score: report.scoresByCategory[dim.name] ?? 0,
  }));

  const zoneCounts = DIMENSIONS.reduce(
    (acc, dim) => {
      const score = report.scoresByCategory[dim.name] ?? 0;
      const zone = getDimensionZone(score, dim.maxScore);
      acc[zone] = (acc[zone] ?? 0) + 1;
      return acc;
    },
    {} as Record<Zone, number>,
  );

  return (
    <>
      {ActionSheetComponent}
      <div className="uqa-result-page">
        {/* 页面头部 */}
        <div className="uqa-page-header">
          <button className="back-btn" onClick={() => navigate("/uqa")}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title">诊断报告</h1>
          <button className="header-action-btn" onClick={handleExport}>
            <Download size={18} />
          </button>
        </div>

        <div id="uqa-result-content" className="result-content">
          {/* 报告标题卡片 */}
          <div className="report-header-card">
            <div className="card-header">
              <div className="header-info">
                <h1 className="card-title">UQA学能诊断报告</h1>
                <p className="card-subtitle">全人赋能 自成未来</p>
              </div>
              <div className="percentage-ring">
                <span className="num">{animatedScore}</span>
                <span className="unit">分</span>
              </div>
            </div>
            <div className="card-footer">
              <div className="report-date">
                <span className="date-label">测评日期</span>
                <span className="date-value">{createdAt}</span>
              </div>
              <div className="report-score">
                <span className="score-label">总得分</span>
                <span className="score-value">{result.total_score}/{totalMaxScore}</span>
              </div>
            </div>
          </div>

          {/* 总体评估卡片 */}
          <div
            className={`overall-card${showContent ? " animate-enter" : ""}`}
            style={{ "--delay": "0ms" } as React.CSSProperties}
          >
            <h2 className="card-title">总体评估</h2>
            <div className="overall-score">
              <div className="score-circle">
                <svg viewBox="0 0 100 100" className="score-svg">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E6EB" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#00C476"
                    strokeWidth="8"
                    strokeDasharray={`${Math.round((animatedScore / totalMaxScore) * 282.7)} 282.7`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="score-text">
                  <span className="score-number">{animatedScore}</span>
                  <span className="score-unit">分</span>
                </div>
              </div>
              <div className="score-details">
                <p className="score-label">总得分</p>
                <p className="score-value">{result.total_score} / {totalMaxScore}</p>
                <div className="zone-summary">
                  {(["advantage", "develop", "warning", "risk"] as Zone[]).map((z) =>
                    zoneCounts[z] ? (
                      <span key={z} className={`zone-tag ${z}`}>
                        {ZONE_LABELS[z]} {zoneCounts[z]}
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 七维雷达图 */}
          <div
            className={`radar-card${showContent ? " animate-enter" : ""}`}
            style={{ "--delay": "100ms" } as React.CSSProperties}
          >
            <h2 className="card-title">七维能力雷达图</h2>
            <div className="radar-container">
              <RadarChart data={radarData} size={300} />
            </div>
          </div>

          {/* 各维度详细分析 */}
          <div className="dimensions-section">
            <h2 className="section-title">各维度详细分析</h2>
            <div className="dimensions-list">
              {DIMENSIONS.map((dim, i) => (
                <div
                  key={dim.id}
                  className={showContent ? "animate-enter" : ""}
                  style={{ "--delay": `${200 + i * 50}ms` } as React.CSSProperties}
                >
                  <DimensionCard
                    dimension={dim}
                    score={report.scoresByCategory[dim.name] ?? 0}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 综合建议 */}
          {report.suggestions && (
            <div className="suggestions-section">
              <h2 className="section-title">综合建议</h2>
              <div className="suggestions-card">
                {report.suggestions.split("\n").map((line, i) => (
                  <p key={i} className="suggestion-line">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* 报告说明 */}
          <div className="report-footer">
            <p className="footer-text">
              本报告基于UQA学能探索系统，从七个维度综合评估孩子的学习能力。
              建议结合专业指导，制定个性化的提升方案。
            </p>
            <p className="footer-org">全人赋能中心 UNI QUEST ACADEMY</p>
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="result-actions">
          <button className="action-btn secondary" onClick={() => navigate("/uqa")}>
            返回首页
          </button>
          <button
            className="action-btn primary"
            onClick={() => navigate("/uqa/questionnaire")}
          >
            重新诊断
          </button>
        </div>
      </div>
    </>
  );
};

export default UqaResult;
