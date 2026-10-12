export default function VideoPlayer({ url }) {
  if (!url) {
    return (
      <div className="video-player">
        <div className="video-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Video bài giảng sẽ được cập nhật</span>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player">
      <iframe
        src={url}
        title="Video bài giảng"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
