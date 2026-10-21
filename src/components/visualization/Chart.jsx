import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register only chart types actually used by the lab panels.
echarts.use([BarChart, LineChart, ScatterChart, DataZoomComponent, GridComponent,
  LegendComponent, MarkLineComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

/** @param {{option: object, style?: import('react').CSSProperties, notMerge?: boolean}} props */
export default function Chart(props) {
  return <ReactEChartsCore echarts={echarts} {...props} />;
}
