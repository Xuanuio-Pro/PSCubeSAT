import '../../pages/lab-questions.css';

const KIND_LABELS = { doc: 'Sau phần Doc', practice: 'Sau phần Thực hành' };
const QUESTION_TYPE_LABELS = {
  single_choice: 'Trắc nghiệm 1 đáp án',
  multiple_choice: 'Trắc nghiệm nhiều đáp án',
  true_false: 'Đúng / Sai',
  short_answer: 'Trả lời ngắn',
};

// Read-only rendering. Answers and grading are never handled in the browser (AGENTS.md rule 5).
export function QuestionList({ questions }) {
  if (!questions.length) return <p className="lab-questions-empty">Chưa có câu hỏi — giảng viên sẽ bổ sung.</p>;
  return <ol className="lab-questions-items">
    {questions.map(question => <li key={question.id}>
      <p className="lab-questions-prompt">{question.prompt}</p>
      <small>{QUESTION_TYPE_LABELS[question.type] || question.type}</small>
      {question.choices?.length > 0 && <ul className="lab-questions-choices">
        {question.choices.map(choice => <li key={choice.id}><b>{choice.id}.</b> {choice.text}</li>)}
      </ul>}
    </li>)}
  </ol>;
}

/**
 * One "❓ Câu hỏi kiểm tra" block. `renderExercise` turns an exercise id into a link or button.
 * @param {{ checkpoint: any, index?: number, renderExercise: (id: string) => import('react').ReactNode, as?: 'li' | 'div' }} props
 */
export function CheckpointCard({ checkpoint, index, renderExercise, as = 'li' }) {
  /** @type {any} */
  const Tag = as;
  const headingId = `checkpoint-${checkpoint.id}`;
  return <Tag className="lab-questions-checkpoint">
    <header>
      <span className={`lab-questions-kind lab-questions-kind--${checkpoint.kind}`}>{KIND_LABELS[checkpoint.kind]}</span>
      <h2 id={headingId}>{index !== undefined && <span className="lab-questions-index">{index + 1}.</span>} {checkpoint.label}</h2>
    </header>
    <p className="lab-questions-topics"><strong>Nội dung kiểm tra:</strong> {checkpoint.topics}</p>
    {checkpoint.exercises.length > 0 && <div className="lab-questions-exercises">
      <span>Bài thực hành liên quan:</span>
      <ul>{checkpoint.exercises.map(id => <li key={id}>{renderExercise(id)}</li>)}</ul>
    </div>}
    {checkpoint.questions.length > 0 && (
      <section aria-labelledby={headingId} className="lab-questions-body">
        <QuestionList questions={checkpoint.questions} />
      </section>
    )}
  </Tag>;
}
