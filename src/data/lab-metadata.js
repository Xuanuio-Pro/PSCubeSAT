// Public navigation metadata. Lesson content is served by the authenticated API.
export const LABS = [
  {
    "id": 0,
    "slug": "lab0",
    "title": "Giới thiệu Tổng quan",
    "subtitle": "PTIT STEM CubeSat Overview",
    "icon": "🛰️",
    "color": "var(--accent-blue)",
    "bgColor": "var(--accent-blue-glow)",
    "features": [
      "video",
      "document",
      "componentViewer"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 1,
    "slug": "lab1",
    "title": "Máy tính trên bo mạch (OBC)",
    "subtitle": "On-Board Computer — ESP32",
    "icon": "🖥️",
    "color": "var(--accent-purple)",
    "bgColor": "var(--accent-purple-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 2,
    "slug": "lab2",
    "title": "Phân hệ Năng lượng (EPS)",
    "subtitle": "Electrical Power System",
    "icon": "🔋",
    "color": "var(--accent-green)",
    "bgColor": "var(--accent-green-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 3,
    "slug": "lab3",
    "title": "Xử lý Dữ liệu và Lệnh (CDH)",
    "subtitle": "Command and Data Handling",
    "icon": "📊",
    "color": "var(--accent-orange)",
    "bgColor": "var(--accent-orange-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial",
      "voltageChart"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 4,
    "slug": "lab4",
    "title": "Phân hệ Cảm biến (Sensor)",
    "subtitle": "Sensors — IMU, GPS, Camera",
    "icon": "🔬",
    "color": "var(--accent-cyan)",
    "bgColor": "var(--accent-cyan-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial",
      "attitude3d",
      "gpsMap",
      "camera"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 5,
    "slug": "lab5",
    "title": "Truyền thông và Trạm mặt đất",
    "subtitle": "Communication and Ground Station",
    "icon": "📡",
    "color": "var(--accent-purple)",
    "bgColor": "var(--accent-purple-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial",
      "groundStation"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 6,
    "slug": "lab6",
    "title": "Phân hệ Cấu trúc (Structure)",
    "subtitle": "Mechanical Structure and Integration",
    "icon": "🔩",
    "color": "var(--accent-orange)",
    "bgColor": "var(--accent-orange-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial",
      "systemCheck"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 7,
    "slug": "lab7",
    "title": "Tích hợp Hệ thống và Nhiệm vụ",
    "subtitle": "System Integration and Mission",
    "icon": "🚀",
    "color": "var(--accent-blue)",
    "bgColor": "var(--accent-blue-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial",
      "attitude3d",
      "gpsMap",
      "voltageChart"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  },
  {
    "id": 8,
    "slug": "lab8",
    "title": "Capstone Mini-Project",
    "subtitle": "Custom Dashboard and Real-world Application",
    "icon": "🏆",
    "color": "var(--accent-cyan)",
    "bgColor": "var(--accent-cyan-glow)",
    "features": [
      "video",
      "document",
      "blockly",
      "monaco",
      "compiler",
      "flasher",
      "serial",
      "dashboardBuilder"
    ],
    "description": "Khám phá nội dung và các hoạt động học tập của lab."
  }
];
export const getLabById = id => LABS.find(lab => lab.id === id);
export const getLabBySlug = slug => LABS.find(lab => lab.slug === slug);
