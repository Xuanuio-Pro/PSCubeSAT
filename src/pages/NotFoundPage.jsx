import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <Link to="/" className="not-found-content" aria-label="Trở về trang chủ">
        <img src={logo} alt="" className="not-found-logo" />
        <h1 className="not-found-title">404 NOT FOUND</h1>
      </Link>
    </div>
  );
}
