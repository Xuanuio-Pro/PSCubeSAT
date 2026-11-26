function formatChoiceIds(value) {
  return String(value || '').split('|').filter(Boolean).map(v => v.toUpperCase()).join(', ');
}

export default function QuizQuestionBody({
  item,
  index,
  questionId,
  radioName,
  currentAns,
  draftValue,
  revealed,
  disabled,
  requireToneForExplanation = false,
  allowEmptySelection = false,
  showMultiCorrectSummary = false,
  onChoose,
  onDraftChange,
}) {
  const qType = item.question_type || 'single_choice';
  const multiSelected = new Set(qType === 'multiple_choice' && currentAns ? currentAns.split('|').filter(Boolean) : []);
  const tfSelected = qType === 'true_false' && currentAns
    ? Object.fromEntries(currentAns.split('|').filter(p => p.includes(':')).map(pair => pair.split(':')))
    : {};
  const rightTf = revealed && item.correct_choice_id
    ? Object.fromEntries(item.correct_choice_id.split('|').filter(p => p.includes(':')).map(pair => pair.split(':')))
    : {};

  // After reveal: green for right choice, red for wrongly picked choice.
  const revealedItem = revealed && Boolean(item.correct_choice_id);
  const verdict = (correct, picked) => (revealedItem ? (correct ? ' correct' : picked ? ' wrong' : '') : '');
  const explain = (choiceId, tone = '') => {
    const text = item.choice_explanations?.[choiceId];
    if (!revealed || !text) return null;
    if (requireToneForExplanation && !tone) return null;
    return <p className={`quiz-choice-note${tone}`}>{text}</p>;
  };

  return (
    <fieldset className="quiz-question" disabled={disabled}>
      <legend><span>Câu {index + 1}</span> {item.prompt}</legend>

      {qType === 'single_choice' && item.choices.map(choice => {
        const isCorrect = revealed && item.correct_choice_id === choice.id;
        const isPicked = currentAns === choice.id;
        const tone = verdict(isCorrect, isPicked);
        return (
          <div className="quiz-choice-block" key={choice.id}>
            <label className={`quiz-choice${isPicked ? ' selected' : ''}${tone}`}>
              <input
                type="radio"
                name={radioName}
                checked={isPicked}
                onChange={() => onChoose(questionId, choice.id)}
              />
              <span>{choice.text}</span>
              {revealed && isPicked && <em className="quiz-picked">Bạn đã chọn</em>}
              {isCorrect && <strong>Đáp án đúng</strong>}
            </label>
            {explain(choice.id, tone)}
          </div>
        );
      })}

      {qType === 'multiple_choice' && (
        <>
          <small className="lms-secondary">Chọn tất cả các phương án đúng:</small>
          {item.choices.map(choice => {
            const isChecked = multiSelected.has(choice.id);
            const isCorrectChoice = Boolean(revealed && item.correct_choice_id?.split('|').includes(choice.id));
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
                      const sorted = [...next].sort().join('|');
                      if (sorted || allowEmptySelection) onChoose(questionId, sorted);
                    }}
                  />
                  <span>{choice.text}</span>
                  {revealed && isChecked && <em className="quiz-picked">Bạn đã chọn</em>}
                  {isCorrectChoice && <strong>Đáp án đúng</strong>}
                </label>
                {explain(choice.id, tone)}
              </div>
            );
          })}
          {showMultiCorrectSummary && revealed && item.correct_choice_id && (
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
            const tone = verdict(Boolean(val) && val === rightTf[choice.id], Boolean(val));
            return (
              <div className="quiz-choice-block" key={choice.id}>
                <div className={`quiz-choice quiz-tf-row${tone}`}>
                  <span><strong>{letter})</strong> {choice.text}</span>
                  <div className="quiz-tf-options">
                    {['Đ', 'S'].map(opt => (
                      <label key={opt}>
                        <input
                          type="radio"
                          name={`${radioName}-${choice.id}`}
                          checked={val === opt}
                          onChange={() => {
                            const next = { ...tfSelected, [choice.id]: opt };
                            const encoded = Object.keys(next).sort().map(k => `${k}:${next[k]}`).join('|');
                            onChoose(questionId, encoded);
                          }}
                        />
                        {opt === 'Đ' ? 'Đúng' : 'Sai'}
                      </label>
                    ))}
                  </div>
                  {revealed && val && <em className="quiz-picked">Bạn chọn: {val === 'Đ' ? 'Đúng' : 'Sai'}</em>}
                </div>
                {explain(choice.id, tone)}
              </div>
            );
          })}
          {revealed && item.correct_choice_id && (
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
              value={draftValue ?? currentAns}
              placeholder="Nhập kết quả (VD: 10 hoặc -1.5)"
              onChange={event => {
                const val = event.target.value;
                onDraftChange(questionId, val);
                if (val.trim()) onChoose(questionId, val);
                else if (allowEmptySelection) onChoose(questionId, '');
              }}
            />
          </label>
          {revealed && item.correct_choice_id && (
            <p className="lms-secondary"><strong>Đáp án đúng:</strong> {item.correct_choice_id}</p>
          )}
        </div>
      )}

      {revealed && item.explanation && (
        <div className="quiz-explanation">
          <p>{item.explanation}</p>
          {item.source_reference && <small>Nguồn: {item.source_reference}</small>}
        </div>
      )}
    </fieldset>
  );
}
