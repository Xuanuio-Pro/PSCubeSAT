import ReactECharts from './Chart';

export default function TaskTimeline({ events }) {
  const phases = ['sample', 'start', 'done'];
  const labels = ['Nhận dữ liệu', 'Bắt đầu', 'Hoàn tất'];
  const option = {
    grid: { left: 75, right: 20, top: 20, bottom: 85 },
    tooltip: { trigger: 'item', valueFormatter: value => typeof value === 'number' ? new Date(value).toLocaleTimeString() : String(value) },
    xAxis: { type: 'time', splitNumber: 3, axisLabel: { hideOverlap: true, fontSize: 10 } },
    yAxis: { type: 'category', data: ['LED', 'Sensor', 'Network'] },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    series: phases.map((phase, index) => ({
      name: labels[index], type: 'scatter', symbolSize: 12,
      itemStyle: { color: ['#167eac', '#db9011', '#169c78'][index] },
      data: events.filter(event => event.phase === phase).map(event => [event.at, event.name]),
    })),
    legend: { data: labels, bottom: 35, textStyle: { fontSize: 10 } },
    animation: false,
  };
  return <ReactECharts option={option} style={{ height: 250 }} />;
}
