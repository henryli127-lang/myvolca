import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface QuizModuleProps {
  questions: QuizQuestion[];
}

const QuizModule: React.FC<QuizModuleProps> = ({ questions }) => {
  const [userAnswers, setUserAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  if (!questions || questions.length === 0) return null;

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    if (isSubmitted) return; // Prevent changing answers after submission
    
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };

  const calculateScore = () => {
    return userAnswers.reduce((score, answer, index) => {
      return answer === questions[index].correctAnswerIndex ? score + 1 : score;
    }, 0);
  };

  const handleSubmit = () => {
    if (userAnswers.includes(-1)) {
      alert("Please answer all questions before submitting!");
      return;
    }
    setIsSubmitted(true);
  };

  const getOptionStyle = (qIndex: number, optIndex: number) => {
    const isSelected = userAnswers[qIndex] === optIndex;
    const isCorrect = questions[qIndex].correctAnswerIndex === optIndex;

    if (!isSubmitted) {
      return isSelected 
        ? 'bg-primary-start/20 border-primary-start text-white shadow-[0_0_10px_rgba(129,162,255,0.3)]' 
        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/30';
    }

    // Grading Logic
    if (isCorrect) {
      return 'bg-green-500/20 border-green-500 text-green-100';
    }
    if (isSelected && !isCorrect) {
      return 'bg-red-500/20 border-red-500 text-red-100';
    }
    return 'bg-white/5 border-white/10 text-gray-500 opacity-50';
  };

  const score = calculateScore();

  return (
    <div className="mt-12 pt-12 border-t border-white/10">
      <div className="mb-8 text-center">
        <h3 className="text-2xl font-display font-bold text-white mb-2">Knowledge Check 🧠</h3>
        <p className="text-gray-400">Test how well you understood the story!</p>
      </div>

      <div className="space-y-8">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-dark-bg/50 p-6 rounded-xl border border-white/5">
            <p className="text-lg font-medium text-white mb-4">
              <span className="text-primary-start font-bold mr-2">{qIndex + 1}.</span>
              {q.question}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {q.options.map((option, optIndex) => (
                <button
                  key={optIndex}
                  onClick={() => handleOptionSelect(qIndex, optIndex)}
                  disabled={isSubmitted}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
                    ${getOptionStyle(qIndex, optIndex)}
                  `}
                >
                  <div className="flex items-center">
                     <span className={`
                        w-6 h-6 rounded-full border flex items-center justify-center text-xs mr-3 flex-shrink-0
                        ${isSubmitted && questions[qIndex].correctAnswerIndex === optIndex ? 'border-green-500 bg-green-500 text-white' : ''}
                        ${isSubmitted && userAnswers[qIndex] === optIndex && questions[qIndex].correctAnswerIndex !== optIndex ? 'border-red-500 bg-red-500 text-white' : ''}
                        ${!isSubmitted && userAnswers[qIndex] === optIndex ? 'border-primary-start bg-primary-start text-dark-bg' : 'border-gray-500'}
                     `}>
                       {String.fromCharCode(65 + optIndex)}
                     </span>
                     {option}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-gradient-to-r from-primary-start to-primary-end text-dark-bg font-bold rounded-full text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            Submit Answers
          </button>
        ) : (
          <div className="text-center animate-fade-in p-6 bg-primary-start/10 rounded-2xl border border-primary-start/20">
            <p className="text-3xl font-bold text-white mb-2">
              You scored {score} / {questions.length}
            </p>
            <p className="text-primary-start">
              {score === questions.length ? "🌟 Perfect Score! Amazing reading!" : 
               score > questions.length / 2 ? "👍 Great job! Keep reading!" : 
               "📚 Good effort! Try reading the story one more time."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizModule;
