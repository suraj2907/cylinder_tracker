import React, { useState, useMemo } from 'react';
import DateRangePicker from './DateRangePicker';

function formatLocalYMD(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Gstr3bReport({
  items = [],
  purchaseBills = [],
  bills = []
}) {
  const [dateRange, setDateRange] = useState(() => {
    // Default to the current quarter
    const today = new Date();
    const currentMonth = today.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    return {
      startDate: formatLocalYMD(start),
      endDate: formatLocalYMD(today)
    };
  });

  const reportData = useMemo(() => {
    const { startDate, endDate } = dateRange;

    // --- 3.1 OUTWARD SUPPLIES ---
    // Outward taxable supplies
    let outwardTaxableVal = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;

    // Outward nil-rated / exempted
    let outwardNilRatedVal = 0;

    bills.forEach(b => {
      if (b.bill_date >= startDate && b.bill_date <= endDate) {
        if (b.gst_mode === 'gst') {
          outwardTaxableVal += parseFloat(b.taxable_amount) || 0;
          outwardCgst += parseFloat(b.cgst) || 0;
          outwardSgst += parseFloat(b.sgst) || 0;
        } else {
          outwardNilRatedVal += parseFloat(b.total_amount) || 0;
        }
      }
    });

    // --- 4. ELIGIBLE INPUT TAX CREDIT (ITC) ---
    let itcCgst = 0;
    let itcSgst = 0;

    // --- 5. EXEMPT / NIL-RATED INWARD SUPPLIES ---
    let exemptPurchaseVal = 0;

    purchaseBills.forEach(pb => {
      if (pb.purchase_date >= startDate && pb.purchase_date <= endDate && Array.isArray(pb.items)) {
        pb.items.forEach(line => {
          const itemObj = items.find(i => i.id === line.item_id);
          if (itemObj) {
            const lineAmount = (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0);
            if (itemObj.gst_applicable !== false) {
              const lineGstRate = parseFloat(line.gst_rate) || 18;
              const lineTaxable = lineAmount / (1 + lineGstRate / 100);
              const lineTax = lineAmount - lineTaxable;
              itcCgst += (lineTax / 2);
              itcSgst += (lineTax / 2);
            } else {
              exemptPurchaseVal += lineAmount;
            }
          }
        });
      }
    });

    const taxPayable = outwardCgst + outwardSgst;
    const taxReceivable = itcCgst + itcSgst;
    const netGstPayable = taxPayable - taxReceivable;

    return {
      outwardTaxableVal,
      outwardCgst,
      outwardSgst,
      outwardNilRatedVal,
      itcCgst,
      itcSgst,
      exemptPurchaseVal,
      taxPayable,
      taxReceivable,
      netGstPayable
    };
  }, [items, purchaseBills, bills, dateRange]);

  const handleDownloadCsv = () => {
    const { startDate, endDate } = dateRange;
    const rd = reportData;

    // Helper to format dates to DD/MM/YYYY for presentation
    const formatPresentationDate = (dStr) => {
      if (!dStr) return '';
      const [y, m, d] = dStr.split('-');
      return `${d}/${m}/${y}`;
    };

    const csvContent = `Company Name: M/S Shree Balaji Agencies
Phone No: 9407922288


GST-3B Report
Dated: ${formatPresentationDate(startDate)}/${formatPresentationDate(endDate)}



Dated: ${startDate}-${endDate}
3.1 Details of Outward supplies and Inward supplies liable to reverse charge
Nature of Supplies,Total Taxable Value,Integrated Tax,Central Tax,State/UT Tax,Cess
"Outward taxable supplies(Other than zero rated, nil rated and exempted)",${rd.outwardTaxableVal.toFixed(2)},0.0,${rd.outwardCgst.toFixed(2)},${rd.outwardSgst.toFixed(2)},0.0
Outward taxable supplies(Zero Rated),0.0,0.0,0.0,0.0,0.0
Outward taxable supplies(Nil rated and exempted),${rd.outwardNilRatedVal.toFixed(2)},0.0,0.0,0.0,0.0
Inward supplies(Liable to reverse charge),0.0,0.0,0.0,0.0,0.0
Non-GST outward supplies,0.0,0.0,0.0,0.0,0.0


"3.2 Details of Inter-State supplies made to unregistered persons, composition dealer and UIN holders"
Place of Supply(State/UT),Supplies made to Unregistered,Supplies made to composition taxable,Supplies made to UIN holders
"",Total Taxable Value,Amount of Integrated Tax,Total Taxable Value,Amount of Integrated Tax,Total Taxable Value,Amount of Integrated Tax


4. Details of Eligible Input Tax Credit
Details,Integrated Tax,Central Tax,State/UT Tax,CESS
(A) ITC Available (whether in full or part),"","","",""
Import of goods,0.0,0.0,0.0,0.0
Import of services,0.0,0.0,0.0,0.0
Inward Supplies liable to reverse charge (other than 1 & 2 above),0.0,0.0,0.0,0.0
Inward Supplies for ISD,0.0,0.0,0.0,0.0
All other ITC,0.0,${rd.itcCgst.toFixed(2)},${rd.itcSgst.toFixed(2)},0.0
(D) Ineligible ITC,"","","",""
As per section 17(5),0.0,0.0,0.0,0.0
Other,0.0,0.0,0.0,0.0


"5. Details of exempt, nil-rated and non-GST inward supplies"
Nature of Supplies,Inter-State supplies,Intra-State supplies
"From a supplier under composition scheme, Exempt and Nil rated supply",0.0,${rd.exemptPurchaseVal.toFixed(2)}
Non GST supply,0.0,0.0
`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `GSTR3B_Report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            🧾 GSTR-3B Quarterly Filing Report
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Aggregated outward sales and eligible input tax credit (ITC) for CA tax filing.</p>
        </div>

        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
        >
          📥 Download GSTR-3B CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Date Filter */}
        <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft flex flex-col justify-between">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filing Period</label>
          <div className="mt-2.5">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* GST Payable Card */}
        <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft md:col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              {reportData.netGstPayable >= 0 ? 'Net GST Payable' : 'Net ITC Carried Forward'}
            </span>
            <span className={`text-2xl font-black block mt-1.5 ${
              reportData.netGstPayable >= 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              ₹{Math.abs(reportData.netGstPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right text-xs text-slate-500 font-bold space-y-1">
            <div>Tax Payable (Sales): <span className="text-slate-800">₹{reportData.taxPayable.toLocaleString()}</span></div>
            <div>Tax Receivable (ITC): <span className="text-slate-800">₹{reportData.taxReceivable.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* GSTR-3B Interactive Tables */}
      <div className="space-y-6">
        {/* Table 3.1 */}
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
          <div className="bg-slate-50 px-5 py-4 border-b border-customBorder">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              3.1 Details of Outward supplies and Inward supplies liable to reverse charge
            </h3>
          </div>

          {/* MOBILE CARDS */}
          <div className="block lg:hidden divide-y divide-slate-100">
            <div className="p-4 space-y-1.5">
              <span className="text-xs font-black text-slate-800 block">Outward taxable supplies</span>
              <span className="text-[10px] text-slate-400 font-semibold block">(Other than zero rated, nil rated and exempted)</span>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Taxable Value</span>
                <span className="text-sm font-black text-slate-900">₹{reportData.outwardTaxableVal.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                <span>CGST ₹{reportData.outwardCgst.toFixed(2)}</span>
                <span>SGST ₹{reportData.outwardSgst.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4 space-y-1.5">
              <span className="text-xs font-black text-slate-800 block">Outward taxable supplies</span>
              <span className="text-[10px] text-slate-400 font-semibold block">(Nil rated and exempted)</span>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Value</span>
                <span className="text-sm font-black text-slate-900">₹{reportData.outwardNilRatedVal.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4">
              <span className="text-xs font-bold text-slate-400 block">Inward supplies (Liable to reverse charge)</span>
              <span className="text-sm font-black text-slate-400">₹0.00</span>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                  <th className="px-4 py-2.5">Nature of Supplies</th>
                  <th className="px-4 py-2.5 text-right">Total Taxable Value</th>
                  <th className="px-4 py-2.5 text-right">Integrated Tax</th>
                  <th className="px-4 py-2.5 text-right">Central Tax</th>
                  <th className="px-4 py-2.5 text-right">State/UT Tax</th>
                  <th className="px-4 py-2.5 text-right">Cess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">Outward taxable supplies (Other than zero rated, nil rated and exempted)</td>
                  <td className="px-4 py-3 text-right">₹{reportData.outwardTaxableVal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{reportData.outwardCgst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{reportData.outwardSgst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">Outward taxable supplies (Nil rated and exempted)</td>
                  <td className="px-4 py-3 text-right">₹{reportData.outwardNilRatedVal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                </tr>
                <tr className="text-slate-400">
                  <td className="px-4 py-3">Inward supplies (Liable to reverse charge)</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 4 */}
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
          <div className="bg-slate-50 px-5 py-4 border-b border-customBorder">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              4. Details of Eligible Input Tax Credit (ITC)
            </h3>
          </div>

          {/* MOBILE CARDS */}
          <div className="block lg:hidden divide-y divide-slate-100">
            <div className="p-4 space-y-1.5">
              <span className="text-xs font-black text-slate-800 block">(A) ITC Available - All other ITC</span>
              <div className="flex items-center gap-3 text-[11px] text-slate-700 font-bold pt-1">
                <span>CGST ₹{reportData.itcCgst.toFixed(2)}</span>
                <span>SGST ₹{reportData.itcSgst.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4">
              <span className="text-xs font-bold text-slate-400 block">(D) Ineligible ITC - As per section 17(5)</span>
              <span className="text-sm font-black text-slate-400">₹0.00</span>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                  <th className="px-4 py-2.5">Details</th>
                  <th className="px-4 py-2.5 text-right">Integrated Tax</th>
                  <th className="px-4 py-2.5 text-right">Central Tax</th>
                  <th className="px-4 py-2.5 text-right">State/UT Tax</th>
                  <th className="px-4 py-2.5 text-right">Cess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">(A) ITC Available - All other ITC</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{reportData.itcCgst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{reportData.itcSgst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                </tr>
                <tr className="text-slate-400">
                  <td className="px-4 py-3">(D) Ineligible ITC - As per section 17(5)</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 5 */}
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
          <div className="bg-slate-50 px-5 py-4 border-b border-customBorder">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              5. Details of exempt, nil-rated and non-GST inward supplies
            </h3>
          </div>

          {/* MOBILE CARDS */}
          <div className="block lg:hidden divide-y divide-slate-100">
            <div className="p-4 space-y-1">
              <span className="text-xs font-black text-slate-800 block">From a supplier under composition scheme, Exempt and Nil rated supply</span>
              <span className="text-sm font-black text-slate-700">₹{reportData.exemptPurchaseVal.toFixed(2)} <span className="text-[10px] font-bold text-slate-400 uppercase">Intra-State</span></span>
            </div>
            <div className="p-4">
              <span className="text-xs font-bold text-slate-400 block">Non-GST supply</span>
              <span className="text-sm font-black text-slate-400">₹0.00</span>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                  <th className="px-4 py-2.5">Nature of Supplies</th>
                  <th className="px-4 py-2.5 text-right">Inter-State supplies</th>
                  <th className="px-4 py-2.5 text-right">Intra-State supplies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">From a supplier under composition scheme, Exempt and Nil rated supply</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{reportData.exemptPurchaseVal.toFixed(2)}</td>
                </tr>
                <tr className="text-slate-400">
                  <td className="px-4 py-3">Non-GST supply</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                  <td className="px-4 py-3 text-right">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
