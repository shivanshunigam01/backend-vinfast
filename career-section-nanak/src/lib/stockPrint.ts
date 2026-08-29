import { toast } from "sonner";

export type StockPrintVendor = {
  name?: string;
  legalName?: string;
  gstin?: string;
};

export type StockPrintMeta = { label: string; value: string };

export type StockPrintOptions = {
  title: string;
  documentNo?: string;
  vendor?: StockPrintVendor;
  meta?: StockPrintMeta[];
  bodyHtml: string;
};

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function metaTable(meta: StockPrintMeta[] = []) {
  if (!meta.length) return "";
  return `<table class="meta"><tbody>${meta
    .map(
      (m) =>
        `<tr><th>${escapeHtml(m.label)}</th><td>${escapeHtml(m.value)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

export function openStockPrintPdf(options: StockPrintOptions) {
  const origin = window.location.origin;
  const vendor = options.vendor;
  const vendorBlock = vendor?.name
    ? `<div class="vendor">
        <p class="vendor-label">Vendor / OEM</p>
        <p class="vendor-name">${escapeHtml(vendor.legalName || vendor.name)}</p>
        ${vendor.gstin ? `<p class="vendor-sub">GSTIN: ${escapeHtml(vendor.gstin)}</p>` : ""}
      </div>`
    : "";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #102f49; margin: 0; padding: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0068b5; padding-bottom: 12px; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { height: 52px; object-fit: contain; }
    .brand-text h1 { margin: 0; font-size: 18px; color: #0068b5; }
    .brand-text p { margin: 4px 0 0; font-size: 11px; color: #647d91; }
    .doc-title { text-align: right; }
    .doc-title h2 { margin: 0; font-size: 20px; }
    .doc-title p { margin: 4px 0 0; font-size: 12px; color: #647d91; }
    .vendor { margin: 0 0 16px; padding: 12px 14px; border: 1px solid #d7e4ee; border-radius: 8px; background: #f7fbfe; }
    .vendor-label { margin: 0; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #647d91; font-weight: 700; }
    .vendor-name { margin: 4px 0 0; font-size: 16px; font-weight: 700; }
    .vendor-sub { margin: 4px 0 0; font-size: 11px; color: #647d91; }
    table.meta { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 12px; }
    table.meta th, table.meta td { border: 1px solid #d7e4ee; padding: 8px 10px; text-align: left; vertical-align: top; }
    table.meta th { width: 180px; background: #eef6fb; color: #416177; }
    table.data { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    table.data th, table.data td { border: 1px solid #d7e4ee; padding: 8px; text-align: left; }
    table.data th { background: #0068b5; color: #fff; }
    .footer { margin-top: 18px; font-size: 10px; color: #7a91a2; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${origin}/patliputra-logo.png" alt="Patliputra VinFast" />
      <div class="brand-text">
        <h1>Patliputra VinFast</h1>
        <p>Stock Pipeline Document</p>
      </div>
    </div>
    <div class="doc-title">
      <h2>${escapeHtml(options.title)}</h2>
      ${options.documentNo ? `<p>${escapeHtml(options.documentNo)}</p>` : ""}
      <p>${escapeHtml(new Date().toLocaleString())}</p>
    </div>
  </div>
  ${vendorBlock}
  ${metaTable(options.meta)}
  ${options.bodyHtml}
  <p class="footer">Generated from Patliputra VinFast Stock Pipeline. Use Print → Save as PDF.</p>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked — allow pop-ups to print PDF.");
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

export function dataTable(headers: string[], rows: string[][]) {
  return `<table class="data"><thead><tr>${headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}
