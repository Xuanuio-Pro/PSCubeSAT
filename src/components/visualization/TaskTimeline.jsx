import ReactECharts from './Chart';

export default function TaskTimeline({ events }) {
  const phases = ['sample', 'start', 'done'];
  const labels = ['Nhận dữ liệu', 'Bắt đầu', 'Hoàn tất'];
  const option = {
    grid: { left: 75, right: 20, top: 20, bottom: 85 },
    tooltip: { trigger: 'item', valueFormatter: value => typeof value === 'number' ? new Date(value).toLocaleTimeString() : String(value) },
    xAxis: { type: 'time', splitNumber: 3, axisLabel: { hideOverlap: true, fontSize: 10 } },
    // Rows follow the task names actually seen in the log (current and older Lab3-03 firmware).
    // Lab3-05 events carry a `lane` (the producer that queued them) so each source gets its own row.
    yAxis: { type: 'category', data: [...new Set(events.map(event => event.lane ?? event.name))] },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    series: phases.map((phase, index) => ({
      name: labels[index], type: 'scatter', symbolSize: 12,
      itemStyle: { color: ['#167eac', '#db9011', '#169c78'][index] },
      data: events.filter(event => event.phase === phase).map(event => [event.at, event.lane ?? event.name]),
    })),
    legend: { data: labels, bottom: 35, textStyle: { fontSize: 10 } },
    animation: false,
  };
  return <ReactECharts option={option} style={{ height: 250 }} />;
}
