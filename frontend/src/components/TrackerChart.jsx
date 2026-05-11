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

ChartJS.register(CategoryScale, TimeScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

const ELEC_COLOUR = 'rgb(0, 212, 255)';
const GAS_COLOUR  = 'rgb(251, 146, 60)';

function calcAverage(rates) {
  if (!rates || !rates.length) return null;
  return rates.reduce((sum, r) => sum + r.value_inc_vat, 0) / rates.length;
}

/**
 * Daily bar chart showing Octopus Tracker unit rates for electricity and gas.
 * Each bar represents one day's rate in p/kWh.
 */
export default function TrackerChart({ electricityRates = [], gasRates = [] }) {
  const chartData = useMemo(() => {
    const sortedElec = [...electricityRates].sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));
    const sortedGas  = [...gasRates].sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));

    return {
      datasets: [
        {
          label: 'Electricity (p/kWh)',
          data: sortedElec.map(r => ({ x: new Date(r.valid_from), y: r.value_inc_vat })),
          backgroundColor: 'rgba(0, 212, 255, 0.55)',
          borderColor: ELEC_COLOUR,
          borderWidth: 1,
          barPercentage: 0.85,
          categoryPercentage: 0.85,
        },
        {
          label: 'Gas (p/kWh)',
          data: sortedGas.map(r => ({ x: new Date(r.valid_from), y: r.value_inc_vat })),
          backgroundColor: 'rgba(251, 146, 60, 0.55)',
          borderColor: GAS_COLOUR,
          borderWidth: 1,
          barPercentage: 0.85,
          categoryPercentage: 0.85,
        },
      ],
    };
  }, [electricityRates, gasRates]);

  const elecAvg = useMemo(() => calcAverage(electricityRates), [electricityRates]);
  const gasAvg  = useMemo(() => calcAverage(gasRates),         [gasRates]);

  const annotations = {};
  if (elecAvg !== null) {
    annotations.elecAvg = {
      type: 'line',
      scaleID: 'y',
      value: elecAvg,
      borderColor: ELEC_COLOUR,
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `Avg ${elecAvg.toFixed(2)}p`,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: ELEC_COLOUR,
        font: { size: 11 },
        position: 'end',
      },
    };
  }
  if (gasAvg !== null) {
    annotations.gasAvg = {
      type: 'line',
      scaleID: 'y',
      value: gasAvg,
      borderColor: GAS_COLOUR,
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `Avg ${gasAvg.toFixed(2)}p`,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: GAS_COLOUR,
        font: { size: 11 },
        position: 'start',
      },
    };
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day', displayFormats: { day: 'dd MMM' } },
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: 'rgba(255,255,255,0.7)', maxRotation: 45, font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: {
          color: 'rgba(255,255,255,0.7)',
          font: { size: 11 },
          callback: v => `${v}p`,
        },
        title: { display: true, text: 'Unit Rate (p/kWh)', color: 'rgba(255,255,255,0.6)' },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: { color: 'white', usePointStyle: true, pointStyle: 'circle', padding: 16 },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (items.length && items[0].raw) {
              return new Date(items[0].raw.x).toLocaleDateString('en-GB', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
              });
            }
            return '';
          },
          label: (ctx) => {
            if (ctx.raw && ctx.raw.y != null) return ` ${ctx.dataset.label}: ${ctx.raw.y.toFixed(2)}p`;
            return '';
          },
        },
      },
      annotation: { annotations },
    },
  };

  if (!electricityRates.length && !gasRates.length) return null;

  return (
    <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
      <h3 className="text-white font-semibold text-base mb-4">Daily Unit Rates — Last 14 Days</h3>
      <div className="h-[420px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
