import { Link } from 'react-router-dom';
import { LABS } from '../data/labs';

export default function HomePage() {
  return (
    <div className="home-page animate-fadeInUp">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <h1 id="home-hero-title">Làm chủ Công nghệ<br />Vệ tinh CubeSat</h1>
        <p>Khóa học thực hành chuyên sâu từ cơ bản đến nâng cao. Xây dựng, lập trình, mô phỏng và điều khiển vệ tinh siêu nhỏ 1U của riêng bạn ngay trên trình duyệt.</p>
        <div className="home-stats" aria-label="Thông tin khóa học">
          <div><strong>9</strong><span>Bài thực hành</span></div>
          <div><strong>6+</strong><span>Phân hệ phần cứng</span></div>
          <div><strong>3D</strong><span>Mô phỏng realtime</span></div>
        </div>
      </section>

      <section className="course-section" aria-labelledby="course-title">
        <h2 id="course-title" className="section-title">Lộ trình khóa học</h2>
        <div className="lab-grid-premium">
          {LABS.map((lab, index) => (
            <Link key={lab.id} to={`/${lab.slug}`} style={{ animationDelay: `${index * 0.1}s` }} className="lab-card-premium animate-fadeInUp">
              <h3>Lab {lab.id}: {lab.title.split('(')[0].trim()}</h3>
              <p>{lab.description}</p>
              <div className="lab-meta">
                <span className="lab-meta-tags">{lab.features.length} tính năng</span>
                <span className="home-card-action">Bắt đầu học →</span>
              </div>
            </Link>
          ))}
        </div>
        <Link to="/lab0" className="home-start-button">Bắt đầu <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
