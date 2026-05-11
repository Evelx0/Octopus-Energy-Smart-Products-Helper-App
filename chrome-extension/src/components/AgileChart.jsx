import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const IMPORT_COLOUR = 'rgb(0, 212, 255)';
const IMPORT_FILL   = 'rgba(0, 212, 255, 0.25)';
const EXPORT_COLOUR = 'rgb(255, 71, 160)';
const EXPORT_FILL   = 'rgba(255, 71, 160, 0.2)';

// Returns theme-aware colours for Chart.js (which can't be overridden by CSS).
function getChartTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    labelColour:  isLight ? '#1e1b4b' : 'white',
    tickColour:   isLight ? 'rgba(30,27,75,0.75)'  : 'rgba(255,255,255,0.7)',
    gridColour:   isLight ? 'rgba(109,40,217,0.12)' : 'rgba(255,255,255,0.08)',
    titleColour:  isLight ? 'rgba(30,27,75,0.6)'   : 'rgba(255,255,255,0.6)',
    nowLineColour:isLight ? 'rgba(30,27,75,0.5)'   : 'rgba(255,255,255,0.7)',
    nowLabelBg:   isLight ? 'rgba(237,233,254,0.9)' : 'rgba(0,0,0,0.6)',
    nowLabelColor:isLight ? '#1e1b4b'               : 'white',
  };
}

function calcAverage(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((sum, r) => sum + r.value_inc_vat, 0) / arr.length;
}

function toChartPoints(rates) {
  return rates
    .map(r => ({ x: new Date(r.valid_from), y: r.value_inc_vat }))
    .sort((a, b) => a.x - b.x);
}

export default function AgileChart({ importRates = [], exportRates = [], showNowLine = false }) {
  const importPoints = useMemo(() => toChartPoints(importRates), [importRates]);
  const exportPoints = useMemo(() => toChartPoints(exportRates), [exportRates]);
  const importAvg    = useMemo(() => calcAverage(importRates), [importRates]);
  const exportAvg    = useMemo(() => calcAverage(exportRates), [exportRates]);

  // Read theme at render time — Chart.js colours can't be set by CSS.
  const theme = getChartTheme();

  const hasExport = exportPoints.length > 0;

  const data = {
    datasets: [
      {
        label: 'Agile Import',
        data: importPoints,
        borderColor: IMPORT_COLOUR,
        backgroundColor: IMPORT_FILL,
        fill: true,
        stepped: 'before',
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0,
      },
      ...(hasExport ? [{
        label: 'Agile Export',
        data: exportPoints,
        borderColor: EXPORT_COLOUR,
        backgroundColor: EXPORT_FILL,
        fill: true,
        stepped: 'before',
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0,
      }] : []),
    ],
  };

  // Build annotation objects
  const annotations = {};

  if (importAvg !== null) {
    annotations.importAvg = {
      type: 'line',
      scaleID: 'y',
      value: importAvg,
      borderColor: IMPORT_COLOUR,
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `Avg* ${importAvg.toFixed(2)}p`,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: IMPORT_COLOUR,
        font: { size: 11 },
        position: 'end',
      },
    };
  }

  if (hasExport && exportAvg !== null) {
    annotations.exportAvg = {
      type: 'line',
      scaleID: 'y',
      value: exportAvg,
      borderColor: EXPORT_COLOUR,
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `Avg* ${exportAvg.toFixed(2)}p`,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: EXPORT_COLOUR,
        font: { size: 11 },
        position: 'start',
      },
    };
  }

  if (showNowLine) {
    annotations.nowLine = {
      type: 'line',
      scaleID: 'x',
      value: new Date(),
      borderColor: theme.nowLineColour,
      borderWidth: 2,
      borderDash: [4, 4],
      label: {
        display: true,
        content: 'Now',
        backgroundColor: theme.nowLabelBg,
        color: theme.nowLabelColor,
        font: { size: 11 },
        position: 'start',
      },
    };
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: { hour: 'HH:mm' },
        },
        grid: { color: theme.gridColour },
        ticks: { color: theme.tickColour, maxRotation: 0 },
      },
      y: {
        grid: { color: theme.gridColour },
        ticks: { color: theme.tickColour },
        title: { display: true, text: 'Price (p/kWh)', color: theme.titleColour },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: theme.labelColour,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (items.length && items[0].raw) {
              return new Date(items[0].raw.x).toLocaleTimeString('en-GB', {
                hour: '2-digit', minute: '2-digit',
              });
            }
            return '';
          },
          label: (ctx) => {
            if (ctx.raw) return ` ${ctx.dataset.label}: ${ctx.raw.y.toFixed(2)}p/kWh`;
            return '';
          },
        },
      },
      annotation: { annotations },
    },
  };

  return (
    <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
      <h3 className="font-semibold text-base mb-4" style={{ color: theme.labelColour }}>
        Agile Import &amp; Export Tariffs
      </h3>
      <div className="h-[420px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
