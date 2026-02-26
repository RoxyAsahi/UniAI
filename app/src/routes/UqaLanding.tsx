import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, History, ChevronRight, Calendar } from "lucide-react";
import { listAssessments, AssessmentListItem } from "@/api/uqa";
import "@/assets/pages/uqa-landing.less";

const UqaLanding: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAssessments()
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="uqa-landing-page">
      {/* 页面头部 */}
      <div className="uqa-page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title">UQA 学能探索</h1>
      </div>

      <div className="uqa-inner">
      {/* 欢迎卡片 */}
      <div className="welcome-card">
        <div className="welcome-content">
          <h2 className="welcome-title">开启学能探索之旅</h2>
          <p className="welcome-desc">
            通过专业的测评工具，全方位了解孩子的学习能力与潜能，获取个性化的提升建议。
          </p>
          <button className="start-btn" onClick={() => navigate("/uqa/questionnaire")}>
            <Plus size={18} style={{ marginRight: 6 }} />
            开始新测评
          </button>
        </div>
      </div>

      {/* 历史记录 */}
      <div className="history-section">
        <div className="section-header">
          <History size={18} style={{ marginRight: 8, color: "#86909C" }} />
          <h3 className="section-title">历史记录</h3>
        </div>

        {loading ? (
          <div className="loading-state">加载中…</div>
        ) : history.length > 0 ? (
          <div className="history-list">
            {history.map((item) => (
              <div
                key={item.id}
                className="history-card"
                onClick={() => navigate(`/uqa/result/${item.id}`)}
              >
                <div className="history-info">
                  <div className="history-date">
                    <Calendar size={14} style={{ marginRight: 4 }} />
                    {new Date(item.created_at).toLocaleDateString("zh-CN")}
                  </div>
                  <div className="history-name">测评记录</div>
                </div>
                <div className="history-score">
                  <span className="score-value">{item.total_score}</span>
                  <span className="score-label">分</span>
                  <ChevronRight size={16} style={{ marginLeft: 8, color: "#C9CDD4" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>暂无测评记录，点击上方按钮开始第一次诊断</p>
          </div>
        )}
      </div>
      </div>{/* end .uqa-inner */}
    </div>
  );
};

export default UqaLanding;
