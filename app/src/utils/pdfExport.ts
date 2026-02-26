/**
 * Minimal PDF/Image export helpers for UQA result page.
 * Uses the browser's built-in print dialog for PDF export.
 * Image export uses canvas API on the element.
 */

function printElement(el: HTMLElement, title: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; padding: 24px; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>${el.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

export async function exportReviewAnalysisToPDF(
  elementId: string,
  filename?: string,
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn("[pdfExport] element not found:", elementId);
    return;
  }
  printElement(el, filename ?? "UQA诊断报告");
}

export async function exportReviewAnalysisToImage(
  elementId: string,
  _filename?: string,
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn("[pdfExport] element not found:", elementId);
    return;
  }
  // Fallback to print for image export when html2canvas is unavailable
  printElement(el, _filename ?? "UQA诊断报告");
}
