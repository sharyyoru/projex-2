"use client";

import dynamic from "next/dynamic";
import type { Invoice } from "./InvoiceManagement";

const InvoicePDFViewer = dynamic(() => import("./InvoicePDF").then(mod => mod.InvoicePDFViewer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>
});

type Props = {
  invoice: Invoice;
  onClose: () => void;
};

export default function InvoicePdfModal({ invoice, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{invoice.invoice_number}</h3>
            <p className="text-xs text-slate-500">{invoice.invoice_type === "quote" ? "Quote" : "Invoice"} for {invoice.client_name}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">×</button>
        </div>
        <div className="flex-1 overflow-hidden">
          <InvoicePDFViewer invoice={invoice} />
        </div>
      </div>
    </div>
  );
}
