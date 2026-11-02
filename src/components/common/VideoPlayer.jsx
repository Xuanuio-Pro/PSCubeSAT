import { useEffect, useRef } from 'react';

function NativeVideo({ url, initialPosition, onSegment }) {
  const player = useRef(null);
  const last = useRef(null);
  const pending = useRef(null);
  const send = useRef(onSegment);
  send.current = onSegment;
  const flush = () => {
    const range = pending.current;
    pending.current = null;
    if (range && range[1] > range[0]) send.current?.(range[0], range[1], range[1]);
  };
  useEffect(() => () => {
    const range = pending.current;
    if (range && range[1] > range[0]) send.current?.(range[0], range[1], range[1]);
  }, []);
  const sample = () => {
    const video = player.current;
    const now = performance.now();
    const position = video.currentTime;
    if (!video.paused && !video.seeking && last.current) {
      const elapsed = (now - last.current.clock) / 1000;
      const played = position - last.current.position;
      if (played > 0 && played <= Math.max(1, elapsed * 2.25)) {
        if (!pending.current) pending.current = [last.current.position, position];
        else pending.current[1] = position;
        if (pending.current[1] - pending.current[0] >= 5) flush();
      } else if (played !== 0) flush();
    }
    last.current = { position, clock: now };
  };
  return <video ref={player} src={url} controls preload="metadata" aria-label="Video bài giảng"
    onLoadedMetadata={() => { if (initialPosition > 0) player.current.currentTime = Math.min(initialPosition, player.current.duration); }}
    onPlaying={() => { last.current = { position: player.current.currentTime, clock: performance.now() }; }}
    onTimeUpdate={sample} onSeeking={() => { flush(); last.current = null; }}
    onPause={() => { flush(); last.current = null; }} onEnded={flush}
    style={{ width: '100%', maxHeight: 520, background: '#0f172a' }} />;
}

export default function VideoPlayer({ url, initialPosition = 0, onSegment = undefined, trackingMode = 'native' }) {
  if (!url) return <div className="video-player"><div className="video-placeholder"><span>Video bài giảng sẽ được cập nhật</span></div></div>;
  const native = /\.(mp4|webm|ogg|ogv)(?:\?|#|$)/i.test(url);
  if (native) return <NativeVideo url={url} initialPosition={initialPosition} onSegment={trackingMode === 'native' ? onSegment : undefined} />;
  return <div className="video-player"><iframe src={url} title="Video bài giảng" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>;
}
