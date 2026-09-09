import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

type BarcodeKind = 'PAT' | 'COPY' | 'THS' | 'SHF' | 'EQP';

export default function Barcodes() {
  const [kind, setKind] = useState<BarcodeKind>('COPY');
  const [values, setValues] = useState('COPY-000001\nCOPY-000002');
  const items = values.split(/\n+/).map((v) => v.trim()).filter(Boolean).map((value) => value.startsWith(`${kind}-`) ? value : `${kind}-${value}`);

  return <div className="max-w-5xl mx-auto space-y-5"><div className="no-print"><h1 className="text-2xl font-serif font-semibold text-primary-800">Code-128 Barcode Generator</h1><p className="text-sm text-neutral-500">Generate printable labels for patrons, copies, theses, shelves, and equipment. No QR codes.</p></div><section className="card p-4 no-print grid sm:grid-cols-3 gap-3"><select value={kind} onChange={(e) => setKind(e.target.value as BarcodeKind)} className="input"><option value="PAT">PAT- patron card</option><option value="COPY">COPY- book copy</option><option value="THS">THS- thesis/repository item</option><option value="SHF">SHF- shelf/location</option><option value="EQP">EQP- equipment</option></select><textarea value={values} onChange={(e) => setValues(e.target.value)} className="input sm:col-span-2 min-h-28" placeholder="One code per line" /><button onClick={() => window.print()} className="btn-primary sm:col-span-3">Print labels</button></section><section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3">{items.map((value) => <BarcodeLabel key={value} value={value} />)}</section><style>{'@media print {.no-print{display:none}.card{box-shadow:none;border:1px solid #ddd}.print\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}'}</style></div>;
}

function BarcodeLabel({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', width: 2, height: 64, displayValue: true, fontSize: 14, margin: 8 }); }, [value]);
  return <div className="card p-4 text-center break-inside-avoid"><svg ref={ref} className="mx-auto max-w-full" /><div className="text-xs text-neutral-500 mt-2">Smart Library</div></div>;
}
