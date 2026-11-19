import { PASSWORD_RULES } from '../../utils/passwordPolicy';

export default function PasswordRequirements({ value = '', id }) {
  return (
    <ul id={id} className="password-requirements" aria-label="Yêu cầu mật khẩu">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li key={rule.id} className={ok ? 'is-met' : undefined}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span> {rule.label}
            <span className="sr-only">{ok ? ' (đã đạt)' : ' (chưa đạt)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
