"use client";

import { useEffect, useState } from "react";
import { analyticsProvider, type DeviceType, type HeatmapSnapshot } from "@/lib/analytics";
import { getLast30DaysRange } from "@/lib/date-range";
import { useSiteWorkspace } from "@/lib/site-workspace";

const range = getLast30DaysRange();

export function HeatmapOverlay({ device, mode, onData }: { device: string; mode: string; onData?: (data: HeatmapSnapshot | null) => void }) {
  const { selectedSiteId } = useSiteWorkspace();
  const [data, setData] = useState<HeatmapSnapshot | null>(null);
  const [error, setError] = useState(false);
  const mappedDevice: DeviceType = device === "PC" ? "desktop" : device === "Tablet" ? "tablet" : "mobile";

  useEffect(() => {
    setData(null);
    setError(false);
    analyticsProvider.getHeatmap(selectedSiteId, range, { device: mappedDevice, pagePath: "/" })
      .then(value => { setData(value); onData?.(value); })
      .catch(() => { setError(true); onData?.(null); });
  }, [mappedDevice, onData, selectedSiteId]);

  if (error) return <div className="heat-state">データを読み込めませんでした</div>;
  if (!data) return <div className="heat-state"><i />ヒートマップを集計中</div>;

  if (mode === "スクロール") {
    return <div className="scroll-overlay">{data.scrollReach.map(row => <div key={row.depth} style={{ top: `${row.depth}%` }}><span>{row.depth}%</span><b>{row.percentage}% reached</b></div>)}</div>;
  }

  return <div className="heatmap-overlay" aria-label={`${data.sampleSize.toLocaleString()}セッションのヒートマップ`}>
    {data.points.map(point => <i key={point.id} title={`${point.elementId ?? "element"}: ${Math.round(point.weight * 100)}`} style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: .25 + point.weight * .55, transform: `translate(-50%,-50%) scale(${.7 + point.weight})` }} />)}
    <span className="heat-sample">n={data.sampleSize.toLocaleString()} sessions</span>
  </div>;
}
