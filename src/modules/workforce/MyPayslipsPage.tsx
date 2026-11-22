import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import { FileText } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";

function downloadSlip(run: any) {
  const employee = run.payslip;
  const doc = new jsPDF();
  doc.setFillColor(22, 35, 67); doc.rect(0, 0, 210, 35, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text("SALARY SLIP", 15, 17); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`${run.periodStart} to ${run.periodEnd} · ${employee.currency}`, 15, 26);
  doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(employee.employeeName, 15, 49); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Employee ID: ${employee.employeeNumber}`, 15, 57); doc.text(`Pay basis: ${employee.structureSnapshot.payBasis}`, 15, 64);
  let y = 82; doc.setFillColor(239, 243, 250); doc.rect(15, y - 6, 180, 10, "F"); doc.setFont("helvetica", "bold"); doc.text("Description", 18, y); doc.text("Type", 125, y); doc.text("Amount", 192, y, { align: "right" }); y += 13;
  doc.setFont("helvetica", "normal");
  for (const line of employee.lines) { if (y > 265) { doc.addPage(); y = 20; } doc.text(doc.splitTextToSize(String(line.name), 95)[0], 18, y); doc.text(String(line.kind).replaceAll("_", " "), 125, y); doc.text(formatMoney(line.amountMinor, employee.currency), 192, y, { align: "right" }); y += 9; }
  y += 6; doc.setDrawColor(200, 210, 225); doc.line(15, y, 195, y); y += 10; doc.setFont("helvetica", "bold"); doc.text("Gross earnings", 18, y); doc.text(formatMoney(employee.grossEarningsMinor, employee.currency), 192, y, { align: "right" }); y += 8; doc.text("Deductions", 18, y); doc.text(formatMoney(employee.deductionsMinor, employee.currency), 192, y, { align: "right" }); y += 8; doc.setFontSize(12); doc.text("Net pay", 18, y); doc.text(formatMoney(employee.netPayMinor, employee.currency), 192, y, { align: "right" }); y += 8; doc.setFontSize(9); doc.text(`Paid: ${formatMoney(employee.paidMinor, employee.currency)} · Status: ${employee.paidMinor >= employee.netPayMinor ? "Paid" : employee.paidMinor > 0 ? "Partially paid" : "Unpaid"}`, 18, y); doc.save(`salary-slip-${employee.employeeNumber}-${run.periodStart}.pdf`);
}

export function MyPayslipsPage() {
  const [runs, setRuns] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { void api.listMyPayroll().then(setRuns).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load payslips")).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-indigo-700">Employee self-service</p><h1 className="mt-1 text-2xl font-bold">My payslips</h1><p className="mt-1 text-sm text-slate-600">Finalized salary history stays available here, including unpaid and partial payment tracking.</p></div>{loading ? <p className="text-sm text-slate-500">Loading salary history…</p> : runs.length ? <div className="grid gap-4">{runs.map((run) => <article key={run.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold">{run.periodStart} – {run.periodEnd}</p><p className="mt-1 text-sm text-slate-600">Net pay: <strong>{formatMoney(run.payslip.netPayMinor, run.currency)}</strong></p><p className="mt-1 text-xs text-slate-500">Paid {formatMoney(run.payslip.paidMinor, run.currency)} · {run.payslip.lines.length} payroll lines</p></div><Button variant="secondary" onClick={() => downloadSlip(run)}><FileText className="mr-2 h-4 w-4" />Download salary slip</Button></div></article>)}</div> : <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-medium">No finalized salary slips</p><p className="mt-1 text-sm text-slate-500">Your salary slips will appear after payroll is finalized.</p></div>}</div>;
}
