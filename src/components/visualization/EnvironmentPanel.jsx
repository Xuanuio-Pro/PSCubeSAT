import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useSerial } from '../../contexts/SerialContext';

const MAX_POINTS = 60;

// ---------- helpers ----------
function makeSparkOption({ title, unit, color, data, min, max, markLines = [] }) {
  return {
    backgroundColor: 'transparent',
    grid: { top: 38, right: 12, bottom: 12, left: 12, containLabel: true },
    title: {
      text: title,
      textStyle: { color: '#8b949e', fontSize: 11, fontWeight: 500 },
      left: 10,
      top: 8,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: '#e6edf3', fontSize: 12 },
      formatter: (params) => {
        const p = params[0];
        return `<b>t = ${p.name}</b><br/>${title}: <b style="color:${color}">${p.value.toFixed(1)} ${unit}</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 9, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: min ?? ((v) => Math.floor(v.min - 2)),
      max: max ?? ((v) => Math.ceil(v.max + 2)),
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 9, formatter: `{value}` },
      splitLine: { lineStyle: { color: '#1a1f2e' } },
    },
    series: [{
      data: data.map(d => d.value),
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '55' },
            { offset: 1, color: color + '00' },
          ],
        },
      },
      ...(markLines.length > 0 ? {
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            position: 'insideEndTop', distance: 4,
            backgroundColor: 'rgba(255,255,255,0.94)', padding: [2, 4], borderRadius: 3,
          },
          data: markLines.map(({ value, label, lineColor }) => ({
            yAxis: value,
            label: { formatter: label, color: lineColor, fontSize: 9 },
            lineStyle: { color: lineColor, type: 'dashed', width: 1 },
          })),
        },
      } : {}),
    }],
    animation: true,
    animationDuration: 300,
  };
}

function makeDemoSeries(base, amplitude, length = 30) {
  return Array.from({ length }, (_, i) => ({
    time: i,
    value: base + Math.sin(i * 0.35) * amplitude + (Math.random() - 0.5) * amplitude * 0.4,
  }));
}

// ---------- Component ----------
export default function EnvironmentPanel({ maxPoints = MAX_POINTS }) {
  const { subscribe } = useSerial();
  const tickRef = useRef(0);

  const [temp, setTemp] = useState(() => makeDemoSeries(28, 3));
  const [hum, setHum] = useState(() => makeDemoSeries(55, 8));
  const [pres, setPres] = useState(() => makeDemoSeries(1013, 5));

  // Latest values for badge display
  const latest = {
    temp: temp[temp.length - 1]?.value ?? 0,
    hum:  hum[hum.length - 1]?.value ?? 0,
    pres: pres[pres.length - 1]?.value ?? 0,
  };

  useEffect(() => {
    const push = (setter, value, tick) =>
      setter(prev => {
        const next = [...prev, { time: tick, value }];
        return next.length > maxPoints ? next.slice(-maxPoints) : next;
      });

    const unsub = subscribe((entry) => {
      if (entry.type !== 'rx') return;
      try {
        const text = entry.text.trim();
        if (!text.startsWith('{')) return;
        const json = JSON.parse(text);
        tickRef.current++;
        const t = tickRef.current;
        if (json.temp_c     !== undefined) push(setTemp, json.temp_c, t);
        if (json.temperature !== undefined) push(setTemp, json.temperature, t);
        if (json.humidity   !== undefined) push(setHum, json.humidity, t);
        if (json.pressure   !== undefined) push(setPres, json.pressure, t);
        if (json.baro_hpa   !== undefined) push(setPres, json.baro_hpa, t);
      } catch { /* not JSON */ }
    });
    return unsub;
  }, [subscribe, maxPoints]);

  const charts = [
    {
      key: 'temp',
      data: temp,
      opts: makeSparkOption({
        title: 'Nhiệt độ (°C)',
        unit: '°C',
        color: '#f85149',
        data: temp,
        markLines: [
          { value: 0,  label: '0 °C',  lineColor: '#388bfd' },
          { value: 85, label: '85 °C', lineColor: '#f85149' },
        ],
      }),
    },
    {
      key: 'hum',
      data: hum,
      opts: makeSparkOption({
        title: 'Độ ẩm (%RH)',
        unit: '%RH',
        color: '#388bfd',
        data: hum,
        min: 0,
        max: 100,
        markLines: [
          { value: 30, label: '30% (khô)',  lineColor: '#e3b341' },
          { value: 80, label: '80% (ẩm)',   lineColor: '#388bfd' },
        ],
      }),
    },
    {
      key: 'pres',
      data: pres,
      opts: makeSparkOption({
        title: 'Áp suất (hPa)',
        unit: 'hPa',
        color: '#a371f7',
        data: pres,
        markLines: [
          { value: 1013.25, label: '1 atm', lineColor: '#8b949e' },
        ],
      }),
    },
  ];

  const badges = [
    { label: 'Nhiệt độ',   value: latest.temp.toFixed(1), unit: '°C',   color: '#f85149', emoji: '🌡️' },
    { label: 'Độ ẩm',      value: latest.hum.toFixed(1),  unit: '%RH',  color: '#388bfd', emoji: '💧' },
    { label: 'Áp suất',    value: latest.pres.toFixed(1), unit: 'hPa',  color: '#a371f7', emoji: '🔵' },
  ];

  return (
    <div className="card environment-panel">
      {/* Header */}
      <div className="card-header">
        <h3>🌍 Cảm biến Môi trường</h3>
        <div className="environment-summary">
          {badges.map(b => (
            <span key={b.label} style={{ color: b.color }}>
              {b.emoji} {b.value} {b.unit}
            </span>
          ))}
        </div>
      </div>

      {/* Badge row */}
      <div className="environment-readings">
        {badges.map(b => (
          <div
            key={b.label}
            className="environment-reading"
            style={{
              background: '#161b22',
              border: `1px solid ${b.color}33`,
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ color: '#8b949e', fontSize: '11px' }}>{b.emoji} {b.label}</span>
            <span className="environment-reading-value" style={{ color: b.color }}>
              <span>{b.value}</span>
              <span className="environment-reading-unit">{b.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Sparkline charts */}
      <div className="environment-charts">
        {charts.map(({ key, opts }) => (
          <ReactECharts
            key={key}
            option={opts}
            style={{ height: '190px', minWidth: 0, width: '100%' }}
            notMerge={true}
          />
        ))}
      </div>
    </div>
  );
}
