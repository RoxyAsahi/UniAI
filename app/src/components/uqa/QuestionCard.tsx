import React from "react";
import { Question } from "@/data/uqa-questions";

interface Props {
  question: Question;
  value: number | undefined;
  onChange: (value: number) => void;
  index: number;
  total: number;
}

const LABELS = ["完全不符合", "不太符合", "一般", "比较符合", "完全符合"];

const QuestionCard: React.FC<Props> = ({ question, value, onChange, index, total }) => {
  return (
    <div className="uqa-question-card">
      <div className="question-text">
        <span className="question-number">{index + 1} / {total}</span>
        <span className="question-content">{question.text}</span>
      </div>
      <div className="options" role="radiogroup">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            className={`option${value === score ? " selected" : ""}`}
            onClick={() => onChange(score)}
            type="button"
            role="radio"
            aria-checked={value === score}
          >
            <span className="radio-circle"><span className="radio-dot" /></span>
            <span className="option-label">{score} {LABELS[score - 1]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuestionCard;
