import {
  CandlestickSeries,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  version as chartLibraryVersion,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chartTheme } from '@/charts/chartTheme';

function normalizeCandles(candles = []) {
  return (Array.isArray(candles) ? candles : [])
    .filter((candle) => candle && candle.time != null)
    .map((candle) => ({
      time: candle.time,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume ?? 0),
    }))
    .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value)));
}

function getSeriesSupport(chart) {
  if (!chart) {
    return { mode: 'none', reason: 'Chart instance was not created.' };
  }

  if (typeof chart.addSeries === 'function' && CandlestickSeries && HistogramSeries) {
    return { mode: 'v5', reason: 'Using lightweight-charts v5 addSeries API.' };
  }

  if (typeof chart.addCandlestickSeries === 'function' && typeof chart.addHistogramSeries === 'function') {
    return { mode: 'legacy', reason: 'Using legacy series API fallback.' };
  }

  if (typeof chart.addSeries === 'function' && LineSeries) {
    return { mode: 'line-fallback', reason: 'Candlestick series unavailable, using line chart fallback.' };
  }

  return { mode: 'none', reason: 'No supported series API found on chart instance.' };
}

function ChartFallback({ message, detail }) {
  return (
    <div className="panel p-5">
      <div className="mb-4">
        <p className="metric-label">Price Action</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Candlestick chart</h3>
      </div>
      <div className="flex h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-panel-soft/50 px-6 text-center">
        <p className="text-base font-semibold text-white">{message}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function ChartContainer({ candles }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [chartError, setChartError] = useState(null);
  const normalizedCandles = useMemo(() => normalizeCandles(candles), [candles]);

  useEffect(() => {
    setChartError(null);
  }, [normalizedCandles.length]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    if (!normalizedCandles.length) {
      return undefined;
    }

    let chart = null;
    let disposed = false;

    try {
      chart = createChart(containerRef.current, {
        autoSize: true,
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        grid: chartTheme.grid,
        layout: chartTheme.layout,
        rightPriceScale: {
          borderColor: chartTheme.borderColor,
        },
        timeScale: {
          borderColor: chartTheme.borderColor,
          timeVisible: true,
        },
      });

      chartRef.current = chart;

      const support = getSeriesSupport(chart);

      if (import.meta.env.DEV) {
        console.info('ChartContainer: lightweight-charts version', chartLibraryVersion);
        console.info('ChartContainer: series mode', support.mode, support.reason);
      }

      if (support.mode === 'none') {
        throw new Error(support.reason);
      }

      let primarySeries = null;

      if (support.mode === 'v5') {
        primarySeries = chart.addSeries(CandlestickSeries, {
          upColor: '#2fcf8f',
          downColor: '#f87171',
          borderVisible: false,
          wickUpColor: '#2fcf8f',
          wickDownColor: '#f87171',
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: '#4f74ff',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        });

        primarySeries.setData(
          normalizedCandles.map((candle) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })),
        );

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

        volumeSeries.setData(
          normalizedCandles.map((candle) => ({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? 'rgba(47, 207, 143, 0.45)' : 'rgba(248, 113, 113, 0.45)',
          })),
        );
      } else if (support.mode === 'legacy') {
        primarySeries = chart.addCandlestickSeries({
          upColor: '#2fcf8f',
          downColor: '#f87171',
          borderVisible: false,
          wickUpColor: '#2fcf8f',
          wickDownColor: '#f87171',
        });

        const volumeSeries = chart.addHistogramSeries({
          color: '#4f74ff',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        });

        primarySeries.setData(
          normalizedCandles.map((candle) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })),
        );

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

        volumeSeries.setData(
          normalizedCandles.map((candle) => ({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? 'rgba(47, 207, 143, 0.45)' : 'rgba(248, 113, 113, 0.45)',
          })),
        );
      } else if (support.mode === 'line-fallback') {
        primarySeries = chart.addSeries(LineSeries, {
          color: '#2fcf8f',
          lineWidth: 2,
        });

        primarySeries.setData(
          normalizedCandles.map((candle) => ({
            time: candle.time,
            value: candle.close,
          })),
        );
      }

      chart.timeScale().fitContent();

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserverRef.current = new ResizeObserver(() => {
          if (!disposed && containerRef.current && chart) {
            chart.applyOptions({
              width: containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
        });
        resizeObserverRef.current.observe(containerRef.current);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('ChartContainer initialization failed:', error);
      }
      setChartError(error instanceof Error ? error.message : 'Chart unavailable right now.');
    }

    return () => {
      disposed = true;

      if (resizeObserverRef.current && containerRef.current) {
        try {
          resizeObserverRef.current.unobserve(containerRef.current);
          resizeObserverRef.current.disconnect();
        } catch {
          // Ignore cleanup issues for chart resize observers.
        }
        resizeObserverRef.current = null;
      }

      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {
          // Ignore chart cleanup failures to keep route teardown safe.
        }
        chartRef.current = null;
      }
    };
  }, [normalizedCandles]);

  if (!normalizedCandles.length) {
    return (
      <ChartFallback
        message="Chart unavailable right now"
        detail="Recent candle data is not available yet. The rest of the analysis is still usable while the chart waits for valid price history."
      />
    );
  }

  if (chartError) {
    return (
      <ChartFallback
        message="Chart unavailable right now"
        detail="The chart could not be initialized, but the rest of this page remains available. Try refreshing later if you need the visual price history."
      />
    );
  }

  return (
    <div className="panel p-5">
      <div className="mb-4">
        <p className="metric-label">Price Action</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Candlestick chart</h3>
      </div>
      <div ref={containerRef} className="h-[380px] w-full" />
    </div>
  );
}

export default ChartContainer;
