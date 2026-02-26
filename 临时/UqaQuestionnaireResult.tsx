import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { RadarChart } from "@/components/uqa/RadarChart";
import { DimensionCard } from "@/components/uqa/DimensionCard";
import {
  dimensions,
  getDimensionZone
} from "@/data/uqa-questions";
import { useToast } from "@/components/ui/use-toast";
import { useActionSheet } from "@/components/ui/action-sheet";
import { exportReviewAnalysisToPDF, exportReviewAnalysisToImage } from "@/utils/pdfExport";
import { getAssessmentDetail } from "@/api/uqa";
import "@/assets/pages/uqa-questionnaire-result.less";

interface DimensionResult {
  name: string;
  description: string;
  score: number;
  maxScore: number;
  zone: 'advantage' | 'development' | 'warning' | 'risk';
  interpretation: string;
}

export default function UqaQuestionnaireResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { show: showActionSheet, ActionSheetComponent } = useActionSheet();
  
  const [dimensionResults, setDimensionResults] = useState<DimensionResult[]>([]);
  const [openEndedAnswers, setOpenEndedAnswers] = useState<string[]>([]);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const id = searchParams.get("id");
      
      // 1. 尝试从API获取数据 (如果有ID)
      if (id) {
        try {
          const assessment = await getAssessmentDetail(Number(id));
          if (assessment && assessment.report) {
            const reportData = JSON.parse(assessment.report);
            
            const results: DimensionResult[] = dimensions.map(dimension => {
              const score = reportData.scoresByCategory[dimension.name] || 0;
              const zone = getDimensionZone(score, dimension);
              
              return {
                name: dimension.name,
                description: dimension.description,
                score,
                maxScore: dimension.maxScore,
                zone,
                interpretation: dimension.interpretations[zone],
              };
            });
            
            setDimensionResults(results);
            // Assuming suggestions are the open-ended answers for now
            setOpenEndedAnswers([reportData.suggestions || ""]);
            setLoading(false);
            setTimeout(() => setShowContent(true), 100);
            return;
          }
        } catch (error) {
          console.error("获取测评详情失败:", error);
          toast({
            title: "获取数据失败",
            description: "无法加载测评结果。",
            variant: "destructive",
          });
        }
      }

      // 3. 既没有ID也没有State，报错并返回
      toast({
        title: "错误",
        description: "未找到问卷数据，请重新填写",
        variant: "destructive",
      });
      navigate("/student/uqa-landing");
    };

    loadData();
  }, [location.state, searchParams]);

  // 分数动画
  useEffect(() => {
    if (dimensionResults.length === 0) return;

    const totalScore = dimensionResults.reduce((sum, d) => sum + d.score, 0);
    const totalMaxScore = dimensionResults.reduce((sum, d) => sum + d.maxScore, 0);
    const targetPercentage = Math.round((totalScore / totalMaxScore) * 100);

    let startTime: number;
    const duration = 1500;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quart
      const ease = 1 - Math.pow(1 - progress, 4);
      
      setAnimatedScore(Math.round(targetPercentage * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [dimensionResults]);

  // 显示导出选项菜单
  const handleExportClick = async () => {
    await showActionSheet("选择导出格式", [
      {
        title: "下载PDF",
        icon: "picture_as_pdf",
        onClick: handleExportPDF
      },
      {
        title: "保存为PNG",
        icon: "image",
        onClick: () => handleExportImage('png')
      },
      {
        title: "保存为JPEG",
        icon: "photo",
        onClick: () => handleExportImage('jpeg')
      },
      {
        title: "取消",
        style: "cancel"
      }
    ]);
  };

  // 导出为PDF
  const handleExportPDF = async () => {
    try {
      toast({
        title: "正在生成PDF",
        description: "请稍候...",
      });
      
      const resultElement = document.querySelector('.result-content') as HTMLElement;
      if (!resultElement) {
        throw new Error('找不到要导出的内容');
      }
      
      await exportReviewAnalysisToPDF(resultElement, {
        title: "UQA学能诊断报告",
        subject: "学能评估",
        mistakeCount: 52,
        createdAt: new Date().toISOString(),
      });
      
      toast({
        title: "导出成功",
        description: "PDF文件已下载",
      });
    } catch (error) {
      console.error('导出失败:', error);
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : "PDF导出失败",
        variant: "destructive",
      });
    }
  };

  // 导出为图片
  const handleExportImage = async (format: 'png' | 'jpeg') => {
    try {
      toast({
        title: `正在生成${format.toUpperCase()}图片`,
        description: "请稍候...",
      });
      
      const resultElement = document.querySelector('.result-content') as HTMLElement;
      if (!resultElement) {
        throw new Error('找不到要导出的内容');
      }
      
      await exportReviewAnalysisToImage(resultElement, {
        title: "UQA学能诊断报告",
        subject: "学能评估",
        mistakeCount: 52,
        createdAt: new Date().toISOString(),
      }, format);
      
      toast({
        title: "导出成功",
        description: `${format.toUpperCase()}图片已下载`,
      });
    } catch (error) {
      console.error('导出失败:', error);
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : "图片导出失败",
        variant: "destructive",
      });
    }
  };

  if (loading || dimensionResults.length === 0) {
    return (
      <div className="uqa-result-page">
        <button className="floating-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="loading-container" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="loading-spinner">加载中...</div>
        </div>
      </div>
    );
  }

  // 计算总体评估
  const totalScore = dimensionResults.reduce((sum, d) => sum + d.score, 0);
  const totalMaxScore = dimensionResults.reduce((sum, d) => sum + d.maxScore, 0);

  // 统计各区域数量
  const zoneCounts = {
    advantage: dimensionResults.filter(d => d.zone === 'advantage').length,
    development: dimensionResults.filter(d => d.zone === 'development').length,
    warning: dimensionResults.filter(d => d.zone === 'warning').length,
    risk: dimensionResults.filter(d => d.zone === 'risk').length,
  };

  return (
    <>
      {ActionSheetComponent}
      <div className="uqa-result-page">
        {/* 悬浮返回按钮 */}
        <button className="floating-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* 悬浮下载按钮 */}
        <button className="floating-download-btn" onClick={handleExportClick}>
          <Download className="w-6 h-6" />
        </button>

        <div className="result-content">
          {/* 报告标题卡片 - 模仿问卷页面的进度卡片样式 */}
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
                <span className="date-value">{new Date().toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="report-score">
                <span className="score-label">总得分</span>
                <span className="score-value">{totalScore}/{totalMaxScore}</span>
              </div>
            </div>
          </div>

          {/* 总体评估卡片 */}
          <div className={`overall-card ${showContent ? 'animate-enter' : ''}`} style={{ '--delay': '0ms' } as React.CSSProperties}>
            <h2 className="card-title">总体评估</h2>
            <div className="overall-score">
              <div className="score-circle">
                <svg viewBox="0 0 100 100" className="score-svg">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#00C476"
                    strokeWidth="8"
                    strokeDasharray={`${animatedScore * 2.827} 282.7`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dasharray 0.1s linear' }}
                  />
                </svg>
                <div className="score-text">
                  <span className="score-number">{animatedScore}</span>
                  <span className="score-unit">分</span>
                </div>
              </div>
              <div className="score-details">
                <p className="score-label">总得分</p>
                <p className="score-value">{totalScore} / {totalMaxScore}</p>
                <div className="zone-summary">
                  {zoneCounts.advantage > 0 && (
                    <span className="zone-tag advantage">优势区 {zoneCounts.advantage}</span>
                  )}
                  {zoneCounts.development > 0 && (
                    <span className="zone-tag development">发展区 {zoneCounts.development}</span>
                  )}
                  {zoneCounts.warning > 0 && (
                    <span className="zone-tag warning">预警区 {zoneCounts.warning}</span>
                  )}
                  {zoneCounts.risk > 0 && (
                    <span className="zone-tag risk">风险区 {zoneCounts.risk}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 七维雷达图 */}
          <div className={`radar-card ${showContent ? 'animate-enter' : ''}`} style={{ '--delay': '100ms' } as React.CSSProperties}>
            <h2 className="card-title">七维能力雷达图</h2>
            <div className="radar-container">
              <RadarChart
                data={dimensionResults.map(d => ({
                  dimension: d.name,
                  score: d.score,
                  maxScore: d.maxScore,
                  zone: d.zone,
                }))}
                size={450}
              />
            </div>
          </div>

          {/* 各维度详细结果 */}
          <div className="dimensions-section">
            <h2 className="section-title">各维度详细分析</h2>
            <div className="dimensions-list">
              {dimensionResults.map((dimension, index) => (
                <div key={index} className={showContent ? 'animate-enter' : ''} style={{ '--delay': `${200 + index * 50}ms` } as React.CSSProperties}>
                  <DimensionCard dimension={dimension} />
                </div>
              ))}
            </div>
          </div>

          {/* 开放性问题回答 */}
          {openEndedAnswers.some(a => a.trim()) && (
            <div className="open-answers-section">
              <h2 className="section-title">补充信息</h2>
              <div className="open-answers-list">
                {openEndedAnswers[0] && (
                  <div className="answer-card">
                    <h3 className="answer-question">孩子最让您欣赏的特质</h3>
                    <p className="answer-content">{openEndedAnswers[0]}</p>
                  </div>
                )}
                {openEndedAnswers[1] && (
                  <div className="answer-card">
                    <h3 className="answer-question">孩子目前的困扰</h3>
                    <p className="answer-content">{openEndedAnswers[1]}</p>
                  </div>
                )}
                {openEndedAnswers[2] && (
                  <div className="answer-card">
                    <h3 className="answer-question">对孩子的期望</h3>
                    <p className="answer-content">{openEndedAnswers[2]}</p>
                  </div>
                )}
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
          <button className="action-btn secondary" onClick={() => navigate("/student/home")}>
            返回首页
          </button>
          <button className="action-btn primary" onClick={() => navigate("/student/uqa-questionnaire")}>
            重新测评
          </button>
        </div>
      </div>
    </>
  );
}