import logo from '../../assets/logo.svg';
import satellite from '../../assets/Satellite.svg';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-orbit">
        <img src={logo} alt="" className="loading-logo" />
        <div className="loading-satellite-track">
          <div className="loading-satellite-pos">
            <img src={satellite} alt="" className="loading-satellite" />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">Đang tải</span>
    </div>
  );
}
