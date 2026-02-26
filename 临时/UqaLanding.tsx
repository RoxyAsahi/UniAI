import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, History, ChevronRight, Calendar } from "lucide-react";
import { getAssessmentList, Assessment } from "@/api/uqa";
import { useToast } from "@/components/ui/use-toast";
import "@/assets/pages/uqa-landing.less";

export default function UqaLanding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await getAssessmentList();
      setHistory(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("Failed to fetch history:", error);
      toast({
        title: "获取历史记录失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartNew = () => {
    navigate("/student/uqa-questionnaire");
  };

  const handleViewResult = (id: number) => {
    navigate(`/student/uqa-result?id=${id}`);
  };

  return (
    <div className="uqa-landing-page">
      {/* 悬浮返回按钮 */}
      <button className="floating-back-btn" onClick={() => navigate("/#home")}>
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="welcome-card">
        <div className="welcome-content">
          <h2 className="welcome-title">开启学能探索之旅</h2>
          <p className="welcome-desc">
            通过专业的测评工具，全方位了解孩子的学习能力与潜能，获取个性化的提升建议。
          </p>
          <button className="start-btn" onClick={handleStartNew}>
            <Plus className="w-5 h-5 mr-2" />
            开始新测评
          </button>
        </div>
      </div>

      <div className="history-section">
        <div className="section-header">
          <History className="w-5 h-5 mr-2 text-gray-500" />
          <h3 className="section-title">历史记录</h3>
        </div>

        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : history.length > 0 ? (
          <div className="history-list">
            {history.map((item) => (
              <div
                key={item.id}
                className="history-card"
                onClick={() => handleViewResult(item.id)}
              >
                <div className="history-info">
                  <div className="history-date">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(item.created_at).toLocaleDateString('zh-CN')}
                  </div>
                  <div className="history-name">测评记录</div>
                </div>
                <div className="history-score">
                  <span className="score-value">{item.total_score}</span>
                  <span className="score-label">分</span>
                  <ChevronRight className="w-4 h-4 ml-2 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>暂无测评记录</p>
          </div>
        )}
      </div>
    </div>
  );
}