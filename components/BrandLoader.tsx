import Image from "next/image";

export function BrandLoader({ label = "データを読み込んでいます", fullPage = false }: { label?: string; fullPage?: boolean }) {
  return <div className={`ismo-loader${fullPage ? " ismo-loader-full" : ""}`} role="status" aria-live="polite">
    <div className="ismo-loader-visual" aria-hidden="true">
      <span className="ismo-loader-orbit orbit-one" />
      <span className="ismo-loader-orbit orbit-two" />
      <span className="ismo-loader-spark spark-one" />
      <span className="ismo-loader-spark spark-two" />
      <div className="ismo-loader-logo"><Image src="/ismo-symbol.png" width={52} height={52} alt="" priority={fullPage} /></div>
    </div>
    <div className="ismo-loader-copy"><strong>SEE WHAT OTHERS MISS<span>.</span></strong><small>{label}</small></div>
  </div>;
}
