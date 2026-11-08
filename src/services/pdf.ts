import { jsPDF } from "jspdf";

function pdfMoney(amountMinor: number | undefined | null) {
  return `INR ${(Number(amountMinor || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PdfInvoice = {
  invoiceNumber: string;
  documentStatus: string;
  acknowledgementStatus: string;
  invoiceDate: string;
  dueDate: string;
  termSource: string;
  creditDays?: number;
  amountMinor: number;
  outstandingMinor: number;
  notes?: string;
  partySnapshot?: any;
  customer?: any;
};

function newReport(title: string, subtitle: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(22, 35, 67);
  doc.rect(0, 0, pageWidth, 37, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(title, 16, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, 16, 26);
  doc.setTextColor(25, 35, 55);
  return doc;
}

export function downloadInvoicePdf(invoice: PdfInvoice, ledger: any[] = [], ackHistory: any[] = []) {
  const doc = newReport("INVOICE", `Invoice ${invoice.invoiceNumber}  •  Generated ${new Date().toLocaleDateString()}`);
  const left = 16;
  let y = 50;
  const customer = invoice.customer ?? invoice.partySnapshot ?? {};
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("BILL TO", left, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(String(customer.displayName || "Customer"), left, y + 7);
  const company = customer.companyName || "";
  if (company) doc.text(String(company), left, y + 13);
  const address = customer.billingAddress;
  const addressLine = [address?.line1, address?.city, address?.state, address?.postalCode].filter(Boolean).join(", ");
  if (addressLine) doc.text(doc.splitTextToSize(addressLine, 88), left, y + 19);

  const right = 124;
  doc.setFont("helvetica", "bold"); doc.text("INVOICE DETAILS", right, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${invoice.documentStatus}`, right, y + 7);
  doc.text(`Invoice date: ${invoice.invoiceDate}`, right, y + 14);
  doc.text(`Due date: ${invoice.dueDate}`, right, y + 21);
  doc.text(`Acknowledgement: ${invoice.acknowledgementStatus?.replace(/_/g, " ") || "Not shared"}`, right, y + 28);

  y = 94;
  doc.setFillColor(239, 243, 250); doc.roundedRect(left, y, 178, 13, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("DESCRIPTION", left + 4, y + 8.5); doc.text("AMOUNT", 190, y + 8.5, { align: "right" });
  y += 21;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Invoice receivable · ${invoice.invoiceNumber}`, left + 4, y); doc.text(pdfMoney(invoice.amountMinor), 190, y, { align: "right" });
  y += 11;
  doc.setDrawColor(220, 226, 235); doc.line(left, y, 194, y);
  y += 9;
  const paid = invoice.amountMinor - invoice.outstandingMinor;
  doc.setFontSize(9); doc.text("Invoice total", 130, y); doc.text(pdfMoney(invoice.amountMinor), 190, y, { align: "right" });
  y += 7; doc.text("Paid to date", 130, y); doc.setTextColor(20, 125, 90); doc.text(pdfMoney(paid), 190, y, { align: "right" });
  y += 7; doc.setFont("helvetica", "bold"); doc.setTextColor(22, 35, 67); doc.text("Balance due", 130, y); doc.text(pdfMoney(invoice.outstandingMinor), 190, y, { align: "right" });

  y += 17;
  doc.setFontSize(11); doc.text("Payment history", left, y); y += 7;
  doc.setFillColor(239, 243, 250); doc.rect(left, y - 4, 178, 8, "F");
  doc.setFontSize(8); doc.text("DATE", left + 3, y + 1); doc.text("EVENT", 65, y + 1); doc.text("REFERENCE", 123, y + 1); doc.text("AMOUNT", 191, y + 1, { align: "right" });
  y += 10;
  const entries = [...ledger].sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
  if (!entries.length) { doc.setFont("helvetica", "normal"); doc.text("No payment or ledger events recorded.", left + 3, y); y += 7; }
  for (const entry of entries) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(String(entry.effectiveDate || "—"), left + 3, y);
    doc.text(String(entry.type || "event").replace(/_/g, " ").slice(0, 26), 65, y);
    doc.text(String(entry.payment?.reference || "—").slice(0, 25), 123, y);
    doc.text(pdfMoney(entry.amountMinor), 191, y, { align: "right" });
    y += 7;
  }
  y += 8;
  if (ackHistory.length) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Customer acknowledgement", left, y); y += 7;
    for (const event of ackHistory) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`${new Date(event.eventAt).toLocaleDateString()} · ${String(event.status).replace(/_/g, " ")} · ${event.responsiblePersonName || ""}`.slice(0, 100), left + 2, y);
      y += 6;
    }
  }
  if (invoice.notes?.trim()) {
    y += 7;
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Notes", left, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(doc.splitTextToSize(invoice.notes, 175), left, y);
  }
  doc.save(`${invoice.invoiceNumber.replace(/[^a-z0-9_-]/gi, "_")}.pdf`);
}

export function downloadInvoiceReportPdf(rows: any[], dateFrom: string, dateTo: string) {
  const period = dateFrom || dateTo ? `${dateFrom || "Beginning"} to ${dateTo || "Today"}` : "All invoice dates";
  const doc = newReport("INVOICE ACTIVITY REPORT", `${period}  •  Generated ${new Date().toLocaleDateString()}`);
  const headers = ["INVOICE", "CUSTOMER", "STATUS", "DATE", "TOTAL", "BALANCE"];
  const widths = [37, 49, 26, 27, 27, 27];
  const left = 8;
  const pageWidth = doc.internal.pageSize.getWidth();
  const drawHeader = (y: number) => {
    doc.setFillColor(239, 243, 250); doc.rect(left, y - 5, pageWidth - 16, 10, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    let x = left + 2;
    headers.forEach((header, i) => { doc.text(header, x, y + 1); x += widths[i]; });
  };
  let y = 50; drawHeader(y); y += 11;
  rows.forEach((row, index) => {
    if (y > 278) { doc.addPage(); y = 20; drawHeader(y); y += 11; }
    if (index % 2) { doc.setFillColor(249, 250, 252); doc.rect(left, y - 4, pageWidth - 16, 9, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    const values = [row.invoiceNumber || "—", row.customer?.displayName || "Customer", row.documentStatus || "—", row.invoiceDate || "—", pdfMoney(row.amountMinor), pdfMoney(row.outstandingMinor)];
    let x = left + 2;
    values.forEach((value, i) => { doc.text(doc.splitTextToSize(String(value), widths[i] - 3)[0], x, y + 1); x += widths[i]; });
    y += 9;
  });
  doc.save(`invoice-activity-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadCommitmentReportPdf(commitments: any[], customerName = "Customer") {
  const safeName = customerName.replace(/[^a-z0-9_-]/gi, "_").slice(0, 48) || "customer";
  const doc = newReport("PAYMENT COMMITMENT REPORT", `${customerName}  •  Generated ${new Date().toLocaleDateString()}`);
  const left = 16;
  const right = 194;
  let y = 50;
  if (commitments.length === 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("No payment commitments are recorded for this customer.", left, y);
  }
  commitments.forEach((commitment, index) => {
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFillColor(239, 243, 250); doc.roundedRect(left, y, right - left, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`${index + 1}. ${commitment.promisedDate || "Promise date not set"}`, left + 4, y + 6);
    doc.text(String(commitment.status || "upcoming").replace(/_/g, " ").toUpperCase(), right - 4, y + 6, { align: "right" });
    y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Promised amount: ${pdfMoney(commitment.promisedAmountMinor)}`, left + 3, y);
    doc.text(`Fulfilled: ${pdfMoney(commitment.fulfilledAmountMinor)}`, 105, y);
    y += 7;
    if (commitment.responsiblePerson) { doc.text(`Customer contact: ${String(commitment.responsiblePerson).slice(0, 75)}`, left + 3, y); y += 7; }
    const invoices = (commitment.invoices || []).map((invoice: any) => invoice.invoiceNumber).filter(Boolean).join(", ");
    if (invoices) { doc.text(doc.splitTextToSize(`Invoices: ${invoices}`, right - left - 6), left + 3, y); y += 7; }
    if (commitment.delayReason) { doc.text(doc.splitTextToSize(`Reason: ${commitment.delayReason}`, right - left - 6), left + 3, y); y += 7; }
    y += 6;
  });
  doc.save(`${safeName}-commitment-report.pdf`);
}
