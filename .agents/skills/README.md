# Bộ skill thiết kế FE của PSCubeSAT

Các skill được cài theo phạm vi dự án trong `.agents/skills`, không phải dependency của ứng dụng. Codex có thể nhận diện chúng từ lượt làm việc tiếp theo.

| Skill | Nguồn | Cách dùng |
|---|---|---|
| `frontend-design` | [Anthropic](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design) | Chọn hướng mỹ thuật, typography và bố cục cho giao diện mới |
| `ui-ux-pro-max` | [NextLevelBuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/56ea9cf174ed86786187daa9de0e6247cb0747e4/.claude/skills/ui-ux-pro-max) | Tra cứu palette, chart, UX, responsive và hướng dẫn React |
| `web-design-guidelines` | [Vercel Labs](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines) | Kiểm tra accessibility, tương tác và giao diện trước khi bàn giao |
| `design-taste-frontend` | [Leonxlnx](https://github.com/Leonxlnx/taste-skill) | Bản Taste Skill có sẵn tại `taste-skill/`; được giữ nguyên, không ghi đè hoặc cài bản trùng |
| `impeccable` | [pbakaus](https://github.com/pbakaus/impeccable/tree/dad8dbb3aac21ad1fa236c110315ef4abece23e8/.agents/skills/impeccable) | Audit, simplify, polish, responsive và thiết kế màn hình ứng dụng |
| `motion-design` | [LottieFiles](https://github.com/LottieFiles/motion-design-skill/tree/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design) | Timing, easing và chuyển động có mục đích |

## Dùng cho dự án này

- Dashboard, editor và màn hình Lab: ưu tiên hướng dẫn sản phẩm của Impeccable và tra cứu UI/UX Pro Max; dùng Vercel để rà soát.
- Trang giới thiệu hoặc giao diện mới: chọn một hướng thiết kế từ frontend-design hoặc Taste Skill, tránh trộn nhiều hướng mỹ thuật.
- Khi cần animation: bổ sung motion-design, có hỗ trợ reduced motion.
- Yêu cầu của người dùng vẫn được ưu tiên: giữ các khối trực quan theo bản PTIT-STEM-CUBE, Serial Monitor đứng đầu, giao diện gọn, dữ liệu thật và chức năng đang hoạt động. Cài skill không tự thay đổi giao diện hay cho phép thay thế các khối này.

Ví dụ yêu cầu: “Dùng ui-ux-pro-max và web-design-guidelines để rà soát màn hình Lab4, giữ bố cục hiện tại.”

## Kiểm tra công cụ cục bộ

UI/UX Pro Max có đầy đủ script Python và dữ liệu CSV. Chạy từ thư mục dự án, dùng Python của môi trường hiện tại:

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "dashboard monitoring" --domain product --max-results 1
```

Không cần biến `CLAUDE_PLUGIN_ROOT` khi gọi script bằng đường dẫn trên. Impeccable có launcher Windows tại `impeccable/scripts/impeccable.cmd`; khi áp dụng skill, làm theo hướng dẫn trong SKILL.md. Launcher có thể tải binary tương ứng ở lần chạy đầu; cài đặt này chưa chạy launcher hoặc bật hook tự động.

Năm bộ mới được cài bằng installer chính thức của Codex, ghim commit upstream. Các file SKILL.md và tài liệu nguồn được giữ nguyên. Chi tiết checksum nằm trong `installed-sources.json`.
