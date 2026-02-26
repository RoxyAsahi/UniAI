import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { QUESTIONS, DIMENSIONS, getDimensionZone } from "@/data/uqa-questions";
import QuestionCard from "@/components/uqa/QuestionCard";
import "@/assets/pages/uqa-questionnaire.less";

const TOTAL = QUESTIONS.length;

const UqaQuestionnaire: React.FC = () => {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openEndedAnswers, setOpenEndedAnswers] = useState(["", "", ""]);

  const safeIndex = Math.min(currentIndex, TOTAL - 1);
  const currentQuestion = QUESTIONS[safeIndex];
  const answered = Object.keys(answers).length;
  const progress = Math.round((answered / TOTAL) * 100);
  const currentDimension = currentQuestion
    ? DIMENSIONS.find((d) => d.id === currentQuestion.dimensionId)
    : undefined;

  if (!currentQuestion) {
    return (
      <div className="uqa-questionnaire-page">
        <div className="uqa-page-header">
          <button className="back-btn" onClick={() => navigate("/uqa")}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title">学能诊断问卷</h1>
        </div>
        <div style={{ padding: 32, textAlign: "center", color: "#86909C" }}>
          问卷数据加载中…
        </div>
      </div>
    );
  }

  const handleAnswer = (value: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    if (safeIndex < TOTAL - 1) {
      setCurrentIndex((i) => Math.min(i + 1, TOTAL - 1));
    }
  };

  const handlePrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));
  const handleNext = () => setCurrentIndex((i) => Math.min(i + 1, TOTAL - 1));

  const scrollToOpenEnded = () => {
    document.getElementById("open-ended-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const canSubmit = answered === TOTAL;

  const handleSubmit = () => {
    if (!canSubmit) return;

    // 本地计算各维度得分
    const scoresByCategory: Record<string, number> = {};
    for (const dim of DIMENSIONS) {
      const dimQuestions = QUESTIONS.filter((q) => q.dimensionId === dim.id);
      const score = dimQuestions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
      scoresByCategory[dim.name] = score;
    }
    const totalScore = Object.values(scoresByCategory).reduce((a, b) => a + b, 0);

    const suggestionParts = DIMENSIONS.map((dim) => {
      const score = scoresByCategory[dim.name] ?? 0;
      const zone = getDimensionZone(score, dim.maxScore);
      return `${dim.name}（${dim.interpretations[zone]}）`;
    });
    const openSuggestions = openEndedAnswers.filter((a) => a.trim()).join("\n\n");
    const suggestions = [suggestionParts.join("\n"), openSuggestions].filter(Boolean).join("\n\n");

    // 存入 sessionStorage，结果页直接读取，无需 API
    sessionStorage.setItem(
      "uqa_result",
      JSON.stringify({
        total_score: totalScore,
        report: { scoresByCategory, suggestions },
        created_at: new Date().toISOString(),
      }),
    );

    navigate("/uqa/result");
  };

  return (
    <div className="uqa-questionnaire-page">
      {/* 页面头部 */}
      <div className="uqa-page-header">
        <button className="back-btn" onClick={() => navigate("/uqa")}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title">学能诊断问卷</h1>
      </div>

      <div className="uqa-inner">

      {/* 进度卡片 */}
      <div className="progress-card">
        <div className="card-header">
          <div className="header-info">
            <h1 className="card-title">UQA学能诊断问卷</h1>
            {currentDimension && (
              <div className="dimension-tag">
                <span className="dot" />
                当前维度：{currentDimension.name}
              </div>
            )}
          </div>
          <div className="percentage-ring">
            <span className="num">{progress}</span>
            <span className="unit">%</span>
          </div>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="card-footer">
          <div className="stat-item">
            <span className="label">已完成</span>
            <span className="value">{answered}</span>
            <span className="total">/{TOTAL}</span>
          </div>
          <div className="stat-item">
            <span className="label">剩余</span>
            <span className="value">{TOTAL - answered}</span>
            <span className="unit">题</span>
          </div>
        </div>
      </div>

      {/* 维度标题 */}
      {currentDimension && (
        <div className="dimension-header">
          <div className="dimension-badge">维度 {DIMENSIONS.indexOf(currentDimension) + 1}/7</div>
          <h2 className="dimension-title">{currentDimension.name}</h2>
        </div>
      )}

      {/* 题目卡片 */}
      <div className="question-section">
        <QuestionCard
          question={currentQuestion}
          value={answers[currentQuestion.id]}
          onChange={handleAnswer}
          index={safeIndex}
          total={TOTAL}
        />
      </div>

      {/* 导航按钮 */}
      <div className="navigation-buttons">
        <button
          className="nav-btn prev-btn"
          onClick={handlePrev}
          disabled={safeIndex === 0}
        >
          上一题
        </button>
        <button
          className="nav-btn next-btn"
          onClick={safeIndex === TOTAL - 1 ? scrollToOpenEnded : handleNext}
          disabled={answers[currentQuestion.id] === undefined}
        >
          {safeIndex === TOTAL - 1 ? "进入开放性问题" : "下一题"}
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 开放性问题 */}
      <div id="open-ended-section" className="open-ended-section">
        <div className="section-divider">
          <div className="divider-line" />
          <span className="divider-text">开放性问题</span>
          <div className="divider-line" />
        </div>

        <div className="open-ended-intro">
          <p>以下三个问题将帮助我们更全面地了解孩子的学习状态，请根据实际情况填写：</p>
        </div>

        <div className="open-ended-questions">
          {[
            { q: "您觉得孩子在学习和生活中，最让您欣赏的三个特质是什么？", ph: "请描述孩子的优点和特质…" },
            { q: "您觉得孩子目前在学习上，最困扰他的三类问题或情境是什么？", ph: "请描述孩子遇到的困难…" },
            { q: "如果用一句话来形容您希望孩子长大后成为什么样的人，您会怎么说？", ph: "请描述您的期望…" },
          ].map((item, i) => (
            <div key={i} className="open-question-card">
              <label className="question-label">
                <span className="question-number">{i + 1}</span>
                {item.q}
              </label>
              <textarea
                className="question-textarea"
                value={openEndedAnswers[i]}
                onChange={(e) => {
                  const next = [...openEndedAnswers];
                  next[i] = e.target.value;
                  setOpenEndedAnswers(next);
                }}
                placeholder={item.ph}
                rows={4}
              />
            </div>
          ))}
        </div>

        <div className="submit-section">
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            查看诊断结果
          </button>
          {!canSubmit && (
            <p className="submit-hint">
              请先完成所有选择题（还有 {TOTAL - answered} 题未完成）
            </p>
          )}
        </div>
      </div>
      </div>{/* end .uqa-inner */}
    </div>
  );
};

export default UqaQuestionnaire;
