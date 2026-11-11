import { Link } from 'react-router-dom';
import { LABS } from '../data/lab-metadata';

const LAB_SYLLABUS_META = {
  0: {
    code: 'SYS-00',
    subsystem: 'Kiến trúc tổng thể',
    summary: 'Khảo sát cấu trúc cơ khí chuẩn 1U (10×10×10 cm), sơ đồ khối các phân hệ điện tử và quy trình nhiệm vụ vệ tinh tầm thấp.',
    tags: ['Mô hình 3D phân hệ', 'Tài liệu kỹ thuật', 'Video tổng quan'],
  },
  1: {
    code: 'OBC-01',
    subsystem: 'On-Board Computer',
    summary: 'Lập trình vi điều khiển trung tâm ESP32: điều khiển GPIO, giao tiếp nối tiếp UART, kết nối Wi-Fi Station/AP và dựng máy chủ Web nội bộ.',
    tags: ['ESP32 MCU', 'GPIO / UART', 'Wi-Fi Web Server'],
  },
  2: {
    code: 'EPS-02',
    subsystem: 'Electrical Power System',
    summary: 'Giám sát điện áp pin Li-Ion, dòng tiêu thụ và công suất pin mặt trời qua bus I2C; cài đặt chế độ tiết kiệm năng lượng khẩn cấp.',
    tags: ['ADC / INA219', 'Quản lý nguồn', 'Biểu đồ điện áp'],
  },
  3: {
    code: 'CDH-03',
    subsystem: 'Command & Data Handling',
    summary: 'Đóng gói khung bản tin Telemetry định dạng chuẩn, lưu trữ nhật ký nhiệm vụ trên hệ thống tệp thẻ nhớ SD và giải mã lệnh điều khiển.',
    tags: ['SD Card FS', 'Khung bản tin', 'Xử lý lệnh'],
  },
  4: {
    code: 'SEN-04',
    subsystem: 'Sensors & Attitude',
    summary: 'Thu thập dữ liệu môi trường, giải thuật góc quay 3 trục từ cảm biến quán tính IMU 6-DoF, định vị bản đồ GPS NMEA và chụp ảnh payload.',
    tags: ['IMU 3D Attitude', 'GPS NMEA Map', 'Camera Payload'],
  },
  5: {
    code: 'COM-05',
    subsystem: 'Ground Station Link',
    summary: 'Thiết lập kênh truyền thông vệ tinh – trạm mặt đất qua giao thức MQTT/Serial, giám sát tín hiệu thu phát và gửi lệnh điều khiển từ xa.',
    tags: ['MQTT Telemetry', 'Ground Station', 'Uplink / Downlink'],
  },
  6: {
    code: 'STR-06',
    subsystem: 'Structure & Scheduling',
    summary: 'Kiểm tra tích hợp khung cơ khí chịu lực, lập lịch đa nhiệm phi phong tỏa và giám sát độ tin cậy bằng bộ định thời Watchdog Timer.',
    tags: ['Task Scheduler', 'Watchdog Timer', 'Chẩn đoán hệ thống'],
  },
  7: {
    code: 'INT-07',
    subsystem: 'System Integration',
    summary: 'Hợp nhất toàn bộ phân hệ trên hệ điều hành thời gian thực FreeRTOS, phối hợp đa tác vụ thu thập cảm biến, lưu trữ và phát dẫn dữ liệu.',
    tags: ['FreeRTOS Tasks', 'Tích hợp 1U', 'Mô phỏng quỹ đạo'],
  },
  8: {
    code: 'CAP-08',
    subsystem: 'Capstone Mission',
    summary: 'Thiết kế bảng điều khiển trạm mặt đất tùy chỉnh, vận hành kịch bản nhiệm vụ vệ tinh hoàn chỉnh và phân tích dữ liệu thu về.',
    tags: ['Dashboard Builder', 'Kịch bản bay', 'Báo cáo tổng kết'],
  },
};

const SUBSYSTEM_BUS = [
  { id: 'OBC', name: 'Máy tính trung tâm (OBC)', spec: 'ESP32 Dual-Core · 240 MHz', bus: 'SPI / I2C / UART' },
  { id: 'EPS', name: 'Phân hệ năng lượng (EPS)', spec: 'Solar Array · Li-Ion 3.7V', bus: 'I2C Telemetry' },
  { id: 'ADCS', name: 'Cảm biến & định hướng', spec: 'IMU 6-DoF · GPS NEO-6M', bus: 'I2C / UART NMEA' },
  { id: 'CDH', name: 'Xử lý lệnh & lưu trữ', spec: 'Flash / SD Telemetry Log', bus: 'SPI Bus' },
  { id: 'COM', name: 'Truyền thông mặt đất', spec: 'Wi-Fi / MQTT / Web Serial', bus: '2.4 GHz / USB-UART' },
];

export default function HomePage() {
  const foundationLab = LABS[0];
  const coreLabs = LABS.slice(1);
  const foundationMeta = LAB_SYLLABUS_META[0];

  return (
    <div className="home-page animate-fadeInUp">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <span className="home-eyebrow">PTIT STEM · HỆ THỐNG ĐÀO TẠO VỆ TINH NANO</span>
          <h1 id="home-hero-title">Lập trình &amp; vận hành vệ tinh CubeSat 1U</h1>
          <p>
            Thực hành trực tiếp trên vi điều khiển ESP32, cảm biến quỹ đạo, nguồn EPS và trạm thu phát mặt đất ngay trên trình duyệt.
          </p>
          <div className="home-hero-actions">
            <Link to="/lab0" className="home-primary-cta">
              Bắt đầu lộ trình <span aria-hidden="true">→</span>
            </Link>
            <a href="#course-title" className="home-secondary-cta">
              Cấu trúc 9 bài Lab
            </a>
          </div>
        </div>

        <aside className="home-hero-schematic" aria-label="Sơ đồ kiến trúc phần cứng CubeSat 1U">
          <div className="schematic-header">
            <span className="schematic-code">CUBESAT-1U // BUS ARCHITECTURE</span>
            <span className="schematic-status">
              <span className="schematic-status-dot" aria-hidden="true" />
              ESP32 TELEMETRY READY
            </span>
          </div>
          <div className="schematic-body">
            {SUBSYSTEM_BUS.map((node) => (
              <div key={node.id} className="schematic-node">
                <span className="schematic-node-id">{node.id}</span>
                <div className="schematic-node-info">
                  <strong>{node.name}</strong>
                  <small>{node.spec}</small>
                </div>
                <code className="schematic-node-bus">{node.bus}</code>
              </div>
            ))}
          </div>
          <div className="schematic-footer">
            <span>CHUẨN KHUNG: 100 × 100 × 100 mm</span>
            <span>BIÊN DỊCH: BLOCKLY &amp; C++ (.INO)</span>
          </div>
        </aside>
      </section>

      <section className="home-spec-strip" aria-label="Thông số chương trình đào tạo">
        <div className="home-spec-cell">
          <strong>09</strong>
          <span>Học phần thực hành theo lộ trình mở khóa tuần tự</span>
        </div>
        <div className="home-spec-cell">
          <strong>32</strong>
          <span>Bài tập lập trình nhúng thực tế trên phần cứng ESP32</span>
        </div>
        <div className="home-spec-cell">
          <strong>05</strong>
          <span>Phân hệ vệ tinh chuẩn 1U: OBC, EPS, CDH, Sensor, Comms</span>
        </div>
        <div className="home-spec-cell">
          <strong>Web Serial</strong>
          <span>Biên dịch, nạp firmware và đọc Telemetry trực tiếp</span>
        </div>
      </section>

      <section className="course-section" aria-labelledby="course-title">
        <div className="course-section-header">
          <div>
            <h2 id="course-title" className="section-title">Lộ trình kỹ thuật 9 bài Lab</h2>
            <p className="section-subtitle">
              Từ kiến trúc cơ điện tử tổng quan đến lập trình từng phân hệ và tích hợp hệ điều hành thời gian thực FreeRTOS.
            </p>
          </div>
        </div>

        {foundationLab && (
          <Link to={`/${foundationLab.slug}`} className="lab-foundation-banner">
            <div className="lab-foundation-left">
              <div className="lab-card-Topline">
                <span className="lab-index-badge">LAB 00</span>
                <span className="lab-subsystem-code">{foundationMeta.code} · {foundationMeta.subsystem}</span>
              </div>
              <h3>{foundationLab.title}</h3>
              <p>{foundationMeta.summary}</p>
            </div>
            <div className="lab-foundation-right">
              <div className="lab-tag-list">
                {foundationMeta.tags.map((tag) => (
                  <span key={tag} className="lab-tech-tag">{tag}</span>
                ))}
              </div>
              <span className="lab-row-arrow" aria-hidden="true">↗</span>
            </div>
          </Link>
        )}

        <div className="lab-grid-premium">
          {coreLabs.map((lab) => {
            const meta = LAB_SYLLABUS_META[lab.id] || {
              code: `LAB-0${lab.id}`,
              subsystem: lab.subtitle,
              summary: lab.description,
              tags: [`${lab.features.length} công cụ`],
            };
            return (
              <Link
                key={lab.id}
                to={`/${lab.slug}`}
                className="lab-card-premium"
              >
                <div className="lab-card-Topline">
                  <span className="lab-index-badge">LAB 0{lab.id}</span>
                  <span className="lab-subsystem-code">{meta.code} · {meta.subsystem}</span>
                  <span className="lab-row-arrow" aria-hidden="true">↗</span>
                </div>
                <h3>Lab {lab.id}: {lab.title.split('(')[0].trim()}</h3>
                <p>{meta.summary}</p>
                <div className="lab-meta">
                  <div className="lab-tag-list">
                    {meta.tags.map((tag) => (
                      <span key={tag} className="lab-tech-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
