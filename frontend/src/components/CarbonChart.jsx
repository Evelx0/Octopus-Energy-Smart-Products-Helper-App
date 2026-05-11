import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  TimeScale,
  LinearScale,
  BarElement,
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
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const INTENSITY_COLOURS = {
  'very low': { bg: 'rgba(16, 185, 129, 0.8)',  border: 'rgb(16, 185, 129)'  },
  'low':      { bg: 'rgba(110, 231, 183, 0.8)', border: 'rgb(110, 231, 183)' },
  'moderate': { bg: 'rgba(245, 158, 11, 0.8)',  border: 'rgb(245, 158, 11)'  },
  'high':     { bg: 'rgba(220, 38, 38, 0.8)',   border: 'rgb(220, 38, 38)'   },
  'very high':{ bg: 'rgba(153, 27, 27, 0.8)',   border: 'rgb(153, 27, 27)'   },
};

const LEGEND_ITEMS = [
  { label: 'Very Low',  key: 'very low'  },
  { label: 'Low',       key: 'low'       },
  { label: 'Moderate',  key: 'moderate'  },
  { label: 'High',      key: 'high'      },
  { label: 'Very High', key: 'very high' },
];

function getColour(index) {
  const key = (index || 'moderate').toLowerCase();
  return INTENSITY_COLOURS[key] || INTENSITY_COLOURS['moderate'];
}

export default function CarbonChart({ carbonData = [], showNowLine = false, noCard = false }) {
  const { points, avgIntensity } = useMemo(() => {
    if (!carbonData || !carbonData.data) return { points: [], avgIntensity: null };

    const pts = carbonData.data
      .map(slot => ({
        x: new Date(slot.from),
        y: slot.intensity.actual ?? slot.intensity.forecast ?? 0,
        index: slot.intensity.index,
      }))
      .sort((a, b) => a.x - b.x);

    const valid = pts.filter(p => p.y > 0);
    const avg = valid.length ? valid.reduce((s, p) => s + p.y, 0) / valid.length : null;

    return { points: pts, avgIntensity: avg };
  }, [carbonData]);

  const data = {
    datasets: [
      {
        label: 'Carbon Intensity (gCO₂/kWh)',
        data: points,
        backgroundColor: (ctx) => {
          if (!ctx.raw) return INTENSITY_COLOURS['moderate'].bg;
          return getColour(ctx.raw.index).bg;
        },
        borderColor: (ctx) => {
          if (!ctx.raw) return INTENSITY_COLOURS['moderate'].border;
          return getColour(ctx.raw.index).border;
        },
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      },
    ],
  };

  const annotations = {};

  if (avgIntensity !== null) {
    annotations.avgLine = {
      type: 'line',
      scaleID: 'y',
      value: avgIntensity,
      borderColor: 'rgba(255,255,255,0.6)',
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `Avg ${Math.round(avgIntensity)} gCO₂`,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        font: { size: 11 },
        position: 'end',
      },
    };
  }

  if (showNowLine) {
    annotations.nowLine = {
      type: 'line',
      scaleID: 'x',
      value: new Date(),
      borderColor: 'rgba(255,255,255,0.7)',
      borderWidth: 2,
      borderDash: [4, 4],
      label: {
        display: true,
        content: 'Now',
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: 'white',
        font: { size: 11 },
        position: 'start',
      },
    };
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: { hour: 'HH:mm' },
        },
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: 'rgba(255,255,255,0.7)', maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: 'rgba(255,255,255,0.7)' },
        title: { display: true, text: 'Carbon Intensity (gCO₂/kWh)', color: 'rgba(255,255,255,0.6)' },
      },
    },
    plugins: {
      legend: { display: false },
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
            if (ctx.raw) {
              const idx = ctx.raw.index
                ? ` (${ctx.raw.index.replace(/\b\w/g, c => c.toUpperCase())})`
                : '';
              return ` ${ctx.raw.y} gCO₂/kWh${idx}`;
            }
            return '';
          },
        },
      },
      annotation: { annotations },
    },
  };

  const inner = (
    <>
      {!noCard && (
        <h3 className="text-white font-semibold text-base mb-3">Carbon Intensity</h3>
      )}
      {/* Custom legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {LEGEND_ITEMS.map(({ label, key }) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-300">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: INTENSITY_COLOURS[key].bg }}
            />
            {label}
          </span>
        ))}
      </div>
      <div className="h-[300px]">
        <Bar data={data} options={options} />
      </div>
    </>
  );

  if (noCard) return <div>{inner}</div>;

  return (
    <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
      {inner}
    </div>
  );
}
