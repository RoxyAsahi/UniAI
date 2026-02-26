import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { QuestionCard } from "@/components/uqa/QuestionCard";
import {
  dimensions,
  questions,
  getTotalQuestions
} from "@/data/uqa-questions";
import { createAssessment } from "@/api/uqa";
import { useToast } from "@/components/ui/use-toast";
import "@/assets/pages/uqa-questionnaire.less";

export default function UqaQuestionnaire() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentQuestionId, setCurrentQuestionId] = useState(1);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [openEndedAnswers, setOpenEndedAnswers] = useState<string[]>(["", "", ""]);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isAnimating, setIsAnimating] = useState(false);

  const totalQuestions = getTotalQuestions();
  const currentQuestion = questions.find(q => q.id === currentQuestionId);
  const answeredCount = Object.keys(answers).length;

  // 获取当前题目所属的维度
  const currentDimension = dimensions.find(d => d.id === currentQuestion?.dimension);

  const handleAnswer = (score: number) => {
    if (!currentQuestion) return;

    // 保存答案
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: score
    }));

    // 自动跳转到下一题
    setTimeout(() => {
      handleNext();
    }, 300);
  };

  const handleNext = () => {
    if (currentQuestionId < totalQuestions) {
      setDirection('next');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentQuestionId(currentQuestionId + 1);
        setIsAnimating(false);
      }, 300);
    } else {
      // 所有题目完成，滚动到开放性问题
      scrollToOpenEnded();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionId > 1) {
      setDirection('prev');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentQuestionId(currentQuestionId - 1);
        setIsAnimating(false);
      }, 300);
    }
  };

  const scrollToOpenEnded = () => {
    const element = document.getElementById("open-ended-section");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async () => {
    // 检查是否所有题目都已回答
    if (answeredCount < totalQuestions) {
      alert(`请完成所有题目！还有 ${totalQuestions - answeredCount} 题未回答。`);
      return;
    }

    try {
      // 计算各维度得分
      const scoresByCategory: Record<string, number> = {};
      dimensions.forEach(d => {
        const dQuestions = questions.filter(q => q.dimension === d.id);
        const score = dQuestions.reduce((sum, q) => sum + (answers[q.id] || 0), 0);
        scoresByCategory[d.name] = score;
      });

      const totalScore = Object.values(scoresByCategory).reduce((a, b) => a + b, 0);

      const suggestions = openEndedAnswers.filter(a => a.trim()).join("\n\n");

      const res = await createAssessment({
        total_score: totalScore,
        report: {
          scoresByCategory,
          suggestions,
        },
      });

      if (res && res.id) {
        navigate(`/student/uqa-result?id=${res.id}`);
      } else {
        throw new Error("保存失败或未返回ID");
      }
    } catch (error) {
      console.error("提交测评失败:", error);
      toast({
        title: "提交失败",
        description: "无法保存测评结果，请稍后重试。",
        variant: "destructive",
      });
    }
  };

  if (!currentQuestion || !currentDimension) {
    return <div>加载中...</div>;
  }

  return (
    <div className="uqa-questionnaire-page">
      {/* 悬浮返回按钮 */}
      <button className="floating-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* 进度条 */}
      <div className="progress-card">
        <div className="card-header">
          <div className="header-info">
            <h1 className="card-title">UQA学能诊断问卷</h1>
            <div className="dimension-tag">
              <span className="dot" />
              当前维度：{currentDimension.name}
            </div>
          </div>
          <div className="percentage-ring">
            <span className="num">{Math.round((answeredCount / totalQuestions) * 100)}</span>
            <span className="unit">%</span>
          </div>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
          />
        </div>

        <div className="card-footer">
          <div className="stat-item">
            <span className="label">已完成</span>
            <span className="value">{answeredCount}</span>
            <span className="total">/{totalQuestions}</span>
          </div>
          <div className="stat-item">
            <span className="label">剩余</span>
            <span className="value">{totalQuestions - answeredCount}</span>
            <span className="unit">题</span>
          </div>
        </div>
      </div>

      {/* 维度标题 */}
      <div className="dimension-header">
        <div className="dimension-badge">
          维度 {currentDimension.id}/7
        </div>
        <h2 className="dimension-title">{currentDimension.name}</h2>
        <p className="dimension-description">{currentDimension.description}</p>
      </div>

      {/* 题目卡片 */}
      <div className={`question-section ${isAnimating ? `slide-${direction}-exit` : `slide-${direction}-enter`}`}>
        <QuestionCard
          key={currentQuestionId}
          question={currentQuestion}
          questionNumber={currentQuestionId}
          totalQuestions={totalQuestions}
          selectedScore={answers[currentQuestion.id]}
          onAnswer={handleAnswer}
        />
      </div>

      {/* 导航按钮 */}
      <div className="navigation-buttons">
        <button
          className="nav-btn prev-btn"
          onClick={handlePrevious}
          disabled={currentQuestionId === 1}
        >
          上一题
        </button>
        <button
          className="nav-btn next-btn"
          onClick={handleNext}
          disabled={!answers[currentQuestion.id]}
        >
          {currentQuestionId === totalQuestions ? "进入开放性问题" : "下一题"}
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* 开放性问题部分 */}
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
          <div className="open-question-card">
            <label className="question-label">
              <span className="question-number">1</span>
              您觉得孩子在学习和生活中，最让您欣赏的三个特质是什么？
            </label>
            <textarea
              className="question-textarea"
              value={openEndedAnswers[0]}
              onChange={(e) => {
                const newAnswers = [...openEndedAnswers];
                newAnswers[0] = e.target.value;
                setOpenEndedAnswers(newAnswers);
              }}
              placeholder="请描述孩子的优点和特质..."
              rows={4}
            />
          </div>

          <div className="open-question-card">
            <label className="question-label">
              <span className="question-number">2</span>
              您觉得孩子目前在学习上，最困扰他的三类问题或情境是什么？
            </label>
            <textarea
              className="question-textarea"
              value={openEndedAnswers[1]}
              onChange={(e) => {
                const newAnswers = [...openEndedAnswers];
                newAnswers[1] = e.target.value;
                setOpenEndedAnswers(newAnswers);
              }}
              placeholder="请描述孩子遇到的困难..."
              rows={4}
            />
          </div>

          <div className="open-question-card">
            <label className="question-label">
              <span className="question-number">3</span>
              如果用一句话来形容您希望孩子长大后成为什么样的人，您会怎么说？
            </label>
            <textarea
              className="question-textarea"
              value={openEndedAnswers[2]}
              onChange={(e) => {
                const newAnswers = [...openEndedAnswers];
                newAnswers[2] = e.target.value;
                setOpenEndedAnswers(newAnswers);
              }}
              placeholder="请描述您的期望..."
              rows={4}
            />
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="submit-section">
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={answeredCount < totalQuestions}
          >
            查看诊断结果
          </button>
          {answeredCount < totalQuestions && (
            <p className="submit-hint">
              请先完成所有选择题（还有 {totalQuestions - answeredCount} 题未完成）
            </p>
          )}
        </div>
      </div>
    </div>
  );
}