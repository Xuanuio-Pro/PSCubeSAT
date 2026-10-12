import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useSerial } from '../../contexts/SerialContext';

export default function VoltageChart({ maxPoints = 60 }) {
  const { subscribe } = useSerial();
  const [data, setData] = useState([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const unsub = subscribe((entry) => {
      if (entry.type !== 'rx') return;
      try {
        // Try to parse JSON with battery_v or temp
        const text = entry.text.trim();
        if (text.startsWith('{')) {
          const json = JSON.parse(text);
          if (json.battery_v !== undefined) {
            timeRef.current++;
            setData(prev => {
              const next = [...prev, { time: timeRef.current, value: json.battery_v }];
              return next.length > maxPoints ? next.slice(-maxPoints) : next;
            });
          }
        }
      } catch { /* not JSON */ }
    });
    return unsub;
  }, [subscribe, maxPoints]);

  // Demo data if no real serial
  useEffect(() => {
    if (data.length > 0) return;
    const demo = [];
    for (let i = 0; i < 30; i++) {
      demo.push({ time: i, value: 3.7 + Math.sin(i * 0.3) * 0.3 + (Math.random() - 0.5) * 0.1 });
    }
    setData(demo);
  }, []);

  const option = {
    backgroundColor: 'transparent',
    grid: { top: 40, right: 16, bottom: 12, left: 12, containLabel: true },
    title: {
      text: 'Điện áp Pin (V)',
      textStyle: { color: '#8b949e', fontSize: 12, fontWeight: 500 },
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
        return `<b>t = ${p.name}</b><br/>Điện áp: <b style="color:#3fb950">${p.value.toFixed(3)} V</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 10, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: (v) => Math.floor((v.min - 0.2) * 10) / 10,
      max: (v) => Math.ceil((v.max + 0.2) * 10) / 10,
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 10, formatter: '{value} V' },
      splitLine: { lineStyle: { color: '#1a1f2e' } },
    },
    series: [{
      data: data.map(d => d.value),
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#3fb950', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(63,185,80,0.3)' },
            { offset: 1, color: 'rgba(63,185,80,0)' },
          ],
        },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        label: {
          position: 'insideEndTop', distance: 5,
          backgroundColor: 'rgba(255,255,255,0.94)', padding: [3, 5], borderRadius: 4,
        },
        data: [
          { yAxis: 3.3, label: { formatter: 'Ngưỡng sụt áp', color: '#f85149', fontSize: 10 }, lineStyle: { color: '#f85149', type: 'dashed' } },
          { yAxis: 4.2, label: { formatter: 'Đầy pin', color: '#3fb950', fontSize: 10 }, lineStyle: { color: '#3fb950', type: 'dashed' } },
        ],
      },
    }],
    animation: true,
    animationDuration: 300,
  };

  return (
    <div className="card">
      <ReactECharts option={option} style={{ height: '300px' }} notMerge={true} />
    </div>
  );
}
