// Shared sparkline option for single-series sensor charts with optional threshold lines.
export function makeSparkOption({ title, unit, color, data, min = undefined, max = undefined, markLines = [] }) {
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
      min: min ?? ((v) => Number.isFinite(v.min) ? Math.floor(v.min - 2) : 0),
      max: max ?? ((v) => Number.isFinite(v.max) ? Math.ceil(v.max + 2) : 1),
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 9, formatter: `{value}` },
      splitLine: { lineStyle: { color: '#1a1f2e' } },
    },
    series: [{
      data: data.map(d => d.value),
      type: 'line',
      smooth: true,
      symbol: data.length === 1 ? 'circle' : 'none',
      symbolSize: 6,
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
