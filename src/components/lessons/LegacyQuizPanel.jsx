import { useCallback, useEffect, useState } from 'react';
import { request } from '../../contexts/auth-api';
import { Notice } from '../classes/LmsCommon';
import '../classes/classes.css';
import '../classes/quiz.css';

function formatChoiceIds(value) {
  return String(value || '').split('|').filter(Boolean).map(v => v.toUpperCase()).join(', ');
}

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

      {displayItems.map((item, index) => {
        const qType = item.question_type || 'single_choice';
        const currentAns = selections[item.question_id] || '';
        const multiSelected = new Set(currentAns ? currentAns.split('|') : []);
        const tfSelected = qType === 'true_false' && currentAns
          ? Object.fromEntries(currentAns.split('|').filter(p => p.includes(':')).map(pair => pair.split(':')))
          : {};
        const verdict = (correct, picked) => (result ? (correct ? ' correct' : picked ? ' wrong' : '') : '');
        const explainChoice = (choice, tone) => {
          const text = item.choice_explanations?.[choice.id];
          return result && tone && text
            ? <p className={`quiz-choice-note${tone}`}>{text}</p>
            : null;
        };

        return (
          <fieldset className="quiz-question" key={item.question_id} disabled={Boolean(result) || submitting}>
            <legend><span>Câu {index + 1}</span> {item.prompt}</legend>

            {qType === 'single_choice' && item.choices.map(choice => {
              const tone = verdict(item.correct_choice_id === choice.id, currentAns === choice.id);
              return (
                <div className="quiz-choice-block" key={choice.id}>
                  <label className={`quiz-choice${currentAns === choice.id ? ' selected' : ''}${tone}`}>
                    <input
                      type="radio"
                      name={`legacy-${lessonId}-${item.question_id}`}
                      checked={currentAns === choice.id}
                      onChange={() => choose(item.question_id, choice.id)}
                    />
                    <span>{choice.text}</span>
                    {result && currentAns === choice.id && <em className="quiz-picked">Bạn đã chọn</em>}
                    {result && item.correct_choice_id === choice.id && <strong>Đáp án đúng</strong>}
                  </label>
                  {explainChoice(choice, tone)}
                </div>
              );
            })}

            {qType === 'multiple_choice' && (
              <>
                <small className="lms-secondary">Chọn tất cả các phương án đúng:</small>
                {item.choices.map(choice => {
                  const isChecked = multiSelected.has(choice.id);
                  const isCorrectChoice = Boolean(result && item.correct_choice_id?.split('|').includes(choice.id));
                  const tone = verdict(isCorrectChoice, isChecked);
                  return (
                    <div className="quiz-choice-block" key={choice.id}>
                      <label className={`quiz-choice${isChecked ? ' selected' : ''}${tone}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={event => {
                            const next = new Set(multiSelected);
                            if (event.target.checked) next.add(choice.id);
                            else next.delete(choice.id);
                            choose(item.question_id, [...next].sort().join('|'));
                          }}
                        />
                        <span>{choice.text}</span>
                        {result && isChecked && <em className="quiz-picked">Bạn đã chọn</em>}
                        {isCorrectChoice && <strong>Đáp án đúng</strong>}
                      </label>
                      {explainChoice(choice, tone)}
                    </div>
                  );
                })}
                {result && item.correct_choice_id && (
                  <p className="lms-secondary"><strong>Đáp án đúng:</strong> {formatChoiceIds(item.correct_choice_id)}</p>
                )}
              </>
            )}

            {qType === 'true_false' && (
              <>
                <small className="lms-secondary">Chọn Đúng hoặc Sai cho từng mệnh đề:</small>
                {item.choices.map((choice, cIdx) => {
                  const letter = String.fromCharCode(97 + cIdx);
                  const val = tfSelected[choice.id] || '';
                  const rightVal = result && item.correct_choice_id
                    ? Object.fromEntries(item.correct_choice_id.split('|').map(pair => pair.split(':')))
                    : {};
                  const tone = verdict(Boolean(val) && val === rightVal[choice.id], Boolean(val));
                  return (
                    <div className="quiz-choice-block" key={choice.id}>
                      <div className={`quiz-choice quiz-tf-row${tone}`}>
                        <span><strong>{letter})</strong> {choice.text}</span>
                        <div className="quiz-tf-options">
                          {['Đ', 'S'].map(opt => (
                            <label key={opt}>
                              <input
                                type="radio"
                                name={`legacy-${lessonId}-${item.question_id}-${choice.id}`}
                                checked={val === opt}
                                onChange={() => {
                                  const next = { ...tfSelected, [choice.id]: opt };
                                  const encoded = Object.keys(next).sort().map(k => `${k}:${next[k]}`).join('|');
                                  choose(item.question_id, encoded);
                                }}
                              />
                              {opt === 'Đ' ? 'Đúng' : 'Sai'}
                            </label>
                          ))}
                        </div>
                        {result && val && <em className="quiz-picked">Bạn chọn: {val === 'Đ' ? 'Đúng' : 'Sai'}</em>}
                      </div>
                      {explainChoice(choice, tone)}
                    </div>
                  );
                })}
                {result && item.correct_choice_id && (
                  <p className="lms-secondary"><strong>Đáp án đúng:</strong> {item.correct_choice_id}</p>
                )}
              </>
            )}

            {qType === 'short_answer' && (
              <div className="quiz-short-answer">
                <label>
                  Câu trả lời của bạn
                  <input
                    type="text"
                    maxLength={64}
                    value={draftText[item.question_id] ?? currentAns}
                    placeholder="Nhập kết quả (VD: 10 hoặc -1.5)"
                    onChange={event => {
                      const val = event.target.value;
                      setDraftText(current => ({ ...current, [item.question_id]: val }));
                      choose(item.question_id, val.trim() ? val : '');
                    }}
                  />
                </label>
                {result && item.correct_choice_id && (
                  <p className="lms-secondary"><strong>Đáp án đúng:</strong> {item.correct_choice_id}</p>
                )}
              </div>
            )}

            {result && item.explanation && (
              <div className="quiz-explanation">
                <p>{item.explanation}</p>
                {item.source_reference && <small>Nguồn: {item.source_reference}</small>}
              </div>
            )}
          </fieldset>
        );
      })}

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
