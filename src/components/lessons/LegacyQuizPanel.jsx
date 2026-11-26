import { useCallback, useEffect, useState } from 'react';
import { request } from '../../contexts/auth-api';
import { Notice } from '../classes/LmsCommon';
import QuizQuestionBody from '../classes/QuizQuestionBody';
import '../classes/classes.css';
import '../classes/quiz.css';

export default function LegacyQuizPanel({ labId, lessonId, title = '', kind = 'quiz' }) {
  const [quiz, setQuiz] = useState(null);
  const [selections, setSelections] = useState({});
  const [draftText, setDraftText] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setSelections({});
    setDraftText({});
    try {
      const data = await request(
        `/api/curriculum/legacy/labs/${labId}/quiz/${encodeURIComponent(lessonId)}`,
      );
      setQuiz(data);
    } catch (err) {
      setError(err.message || 'Không tải được bộ câu hỏi.');
      setQuiz(null);
    } finally {
      setLoading(false);
    }
  }, [labId, lessonId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const choose = (questionId, value) => {
    if (result) return;
    setSelections(current => {
      const next = { ...current };
      if (value === '') {
        delete next[questionId];
      } else {
        next[questionId] = value;
      }
      return next;
    });
  };

  const submit = async () => {
    if (!quiz || submitting || result) return;
    setSubmitting(true);
    setError('');
    try {
      const answers = { ...selections };
      for (const item of quiz.items) {
        if ((item.question_type || 'single_choice') === 'short_answer' && draftText[item.question_id] !== undefined) {
          const trimmed = String(draftText[item.question_id]).trim();
          if (trimmed) answers[item.question_id] = trimmed;
        }
      }
      const graded = await request(
        `/api/curriculum/legacy/labs/${labId}/quiz/${encodeURIComponent(lessonId)}/grade`,
        {
          method: 'POST',
          body: JSON.stringify({
            question_ids: quiz.items.map(item => item.question_id),
            answers,
          }),
        },
      );
      setResult(graded);
    } catch (err) {
      setError(err.message || 'Không chấm được bài làm.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !quiz) {
    return <section className="quiz-panel"><p role="status">Đang tải bộ câu hỏi…</p></section>;
  }

  if (error && !quiz) {
    return <section className="quiz-panel"><Notice error={error} /></section>;
  }

  if (!quiz) return null;

  const displayItems = result ? result.items : quiz.items;
  const heading = kind === 'labtest' ? `Lab Test cuối Lab ${labId}` : (title || 'Câu hỏi kiểm tra');

  return (
    <section className="quiz-panel">
      <Notice error={error} />
      <div className="quiz-status">
        <div>
          <strong>{heading}</strong>
          <p>
            Đề ngẫu nhiên {quiz.num_questions} câu từ ngân hàng {quiz.total_pool} câu · Đạt từ {quiz.pass_score}/{quiz.num_questions} câu · Tham khảo {quiz.time_limit_minutes} phút
          </p>
        </div>
        <button type="button" className="quiz-btn quiz-btn--secondary" onClick={loadQuiz} disabled={loading || submitting}>
          Làm đề ngẫu nhiên khác
        </button>
      </div>

      {result && (
        <Notice
          message={result.passed ? `Đạt (${result.score}/${result.total} câu đúng, yêu cầu từ ${result.pass_score}).` : ''}
          error={!result.passed ? `Chưa đạt (${result.score}/${result.total} câu đúng, yêu cầu từ ${result.pass_score}).` : ''}
        />
      )}

      {displayItems.map((item, index) => (
        <QuizQuestionBody
          key={item.question_id}
          item={item}
          index={index}
          questionId={item.question_id}
          radioName={`legacy-${lessonId}-${item.question_id}`}
          currentAns={selections[item.question_id] || ''}
          draftValue={draftText[item.question_id]}
          revealed={Boolean(result)}
          disabled={Boolean(result) || submitting}
          requireToneForExplanation
          allowEmptySelection
          showMultiCorrectSummary
          onChoose={choose}
          onDraftChange={(id, val) => setDraftText(current => ({ ...current, [id]: val }))}
        />
      ))}

      <div className="quiz-footer">
        {!result ? (
          <>
            <p>Đã trả lời {Object.keys(selections).length}/{quiz.items.length} câu. Đáp án chỉ kiểm tra trên máy chủ sau khi nộp.</p>
            <button type="button" className="quiz-btn quiz-btn--primary" disabled={submitting || loading} onClick={submit}>
              {submitting ? 'Đang chấm…' : 'Nộp bài & xem giải thích'}
            </button>
          </>
        ) : (
          <div className="lms-actions">
            <button type="button" className="quiz-btn quiz-btn--primary" onClick={loadQuiz} disabled={loading}>
              Làm đề ngẫu nhiên khác
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
