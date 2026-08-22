import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportToPDF = (restaurants, tot21, tot192, totAll) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text('Cylinder Tracker Report', 14, 22);
  
  // Summary
  doc.setFontSize(11);
  doc.text(`Total Cylinders: ${totAll}`, 14, 30);
  doc.text(`21 KG: ${tot21}`, 14, 36);
  doc.text(`19.2 KG: ${tot192}`, 14, 42);

  // Table Data
  const tableColumn = ["#", "Restaurant Name", "21 KG", "19.2 KG", "Total"];
  const tableRows = [];

  restaurants.forEach((r, index) => {
    const rowData = [
      index + 1,
      r.name,
      r.kg21,
      r.kg192,
      r.total
    ];
    tableRows.push(rowData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [255, 107, 53] }
  });

  doc.save(`Cylinder_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportToExcel = (restaurants, batchStats) => {
  const wb = XLSX.utils.book_new();

  // 1. Restaurants Sheet
  const wsRestaurantsData = [
    ["Rank", "Restaurant Name", "21 KG", "19.2 KG", "Total"]
  ];
  restaurants.forEach((r, i) => {
    wsRestaurantsData.push([i + 1, r.name, r.kg21, r.kg192, r.total]);
  });
  const wsRestaurants = XLSX.utils.aoa_to_sheet(wsRestaurantsData);
  XLSX.utils.book_append_sheet(wb, wsRestaurants, "Restaurants Summary");

  // 2. Batches Sheet
  const wsBatchesData = [
    ["Batch #", "Khali Date", "Total Entries", "21 KG", "19.2 KG", "Total Cylinders", "Notes"]
  ];
  batchStats.forEach(b => {
    wsBatchesData.push([b.batch, b.khaliDate, b.count, b.kg21, b.kg192, b.kg21 + b.kg192, b.note]);
  });
  const wsBatches = XLSX.utils.aoa_to_sheet(wsBatchesData);
  XLSX.utils.book_append_sheet(wb, wsBatches, "Batches Overview");

  // Write and download
  XLSX.writeFile(wb, `Cylinder_Tracker_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// Export individual customer passbook / ledger statement to professional PDF
export const exportPartyLedgerPDF = (partyName, activities = [], profile = {}, periodLabel = 'All Time', stats = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Header banner
  doc.setFillColor(14, 116, 144); // Slate / Sky dark
  doc.rect(0, 0, 210, 24, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('M/S SHREE BALAJI AGENCIES', 14, 11);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gaspoint Petroleum Commercial LPG Distributor • Rajnandgaon (C.G.) • 9407922288', 14, 18);
  doc.text('CUSTOMER STATEMENT', 196, 11, { align: 'right' });
  doc.text(`Period: ${periodLabel}`, 196, 18, { align: 'right' });

  // Party info block
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(partyName || 'Customer', 14, 32);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const phone = profile.mobile ? `Mobile: ${profile.mobile}` : 'Mobile: -';
  const gst = profile.gst_num ? `GSTIN: ${profile.gst_num}` : '';
  const addr = profile.address ? `Address: ${profile.address}` : '';
  doc.text([phone, gst, addr].filter(Boolean).join(' | '), 14, 38);

  // Summary box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 43, 182, 16, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 43, 182, 16, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL DELIVERED', 20, 49);
  doc.text('KHALI RETURNED', 65, 49);
  doc.text('NET CYLINDERS', 115, 49);
  doc.text('CURRENT OUTSTANDING', 160, 49);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${(stats.del21 || 0) + (stats.del192 || 0)} units`, 20, 55);
  doc.text(`${(stats.ret21 || 0) + (stats.ret192 || 0)} units`, 65, 55);
  doc.text(`${stats.netHolding !== undefined ? stats.netHolding : ((stats.del21 || 0) + (stats.del192 || 0) - (stats.ret21 || 0) - (stats.ret192 || 0))} cyl`, 115, 55);
  
  doc.setTextColor(225, 29, 72);
  const closingBal = activities[0]?.runningBalance !== undefined ? activities[0].runningBalance : (stats.closingRupee || 0);
  doc.text(`Rs. ${Number(closingBal).toLocaleString('en-IN')}`, 160, 55);

  // Table
  const tableColumn = ["Date", "Type", "Details / Ref", "Batch", "Delivered", "Khali Ret", "Bill Amt (Rs.)", "Paid (Rs.)", "Closing Bal (Rs.)", "By"];
  const tableRows = activities.map(item => {
    let typeLabel = "SUPPLY";
    if (item.kind === 'bill') typeLabel = "INVOICE";
    else if (item.kind === 'payment') typeLabel = item.paymentMode || "PAYMENT";
    else if (item.kind === 'cylinder') typeLabel = item.isReturn ? "RETURN" : "SUPPLY";

    const details = item.kind === 'bill' ? (item.invoiceLabel || 'Bill') :
                    item.kind === 'cylinder' ? (`${item.qty}x ${item.type}`) :
                    (item.note || 'Payment Received');

    const delivered = item.kind === 'cylinder' && !item.isReturn ? `${item.qty} ${item.type}` : '-';
    const khaliRet = item.kind === 'cylinder' && item.isReturn ? `${item.qty} ${item.type}` : '-';
    const billAmt = item.kind === 'bill' ? Number(item.amount).toLocaleString('en-IN') : '-';
    const paidAmt = item.kind === 'payment' ? Number(item.amount).toLocaleString('en-IN') : '-';
    const bal = item.runningBalance !== undefined ? Number(item.runningBalance).toLocaleString('en-IN') : '-';

    return [
      item.date || '',
      typeLabel,
      details,
      item.batchNum ? `#${item.batchNum}` : '-',
      delivered,
      khaliRet,
      billAmt,
      paidAmt,
      bal,
      item.userName || 'Suraj'
    ];
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 64,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18 },
      2: { cellWidth: 34 },
      3: { cellWidth: 12 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 18, halign: 'right' },
      8: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      9: { cellWidth: 14 }
    }
  });

  const safeName = (partyName || 'Party').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Ledger_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// Export individual customer passbook / ledger statement to Excel (.xlsx)
export const exportPartyLedgerExcel = (partyName, activities = [], profile = {}, periodLabel = 'All Time', stats = {}) => {
  const wb = XLSX.utils.book_new();

  const closingBal = activities[0]?.runningBalance !== undefined ? activities[0].runningBalance : (stats.closingRupee || 0);

  const headerRows = [
    ["M/S SHREE BALAJI AGENCIES - CUSTOMER STATEMENT"],
    [`Customer Name: ${partyName}`, `Mobile: ${profile.mobile || '-'}`, `GSTIN: ${profile.gst_num || '-'}`, `Period: ${periodLabel}`],
    [`Closing Balance: Rs. ${Number(closingBal).toLocaleString('en-IN')}`, `Net Cylinders Holding: ${stats.netHolding || 0} Cylinders`],
    [],
    ["Date", "Type", "Details / Reference", "Batch #", "Delivered Qty", "Khali Returned Qty", "Bill Amount (Rs.)", "Paid Amount (Rs.)", "Closing Balance (Rs.)", "Recorded By"]
  ];

  const dataRows = activities.map(item => {
    let typeLabel = "SUPPLY";
    if (item.kind === 'bill') typeLabel = "INVOICE";
    else if (item.kind === 'payment') typeLabel = item.paymentMode || "PAYMENT";
    else if (item.kind === 'cylinder') typeLabel = item.isReturn ? "RETURN" : "SUPPLY";

    const details = item.kind === 'bill' ? (item.invoiceLabel || 'Bill') :
                    item.kind === 'cylinder' ? (`${item.qty}x ${item.type}`) :
                    (item.note || 'Payment Received');

    const delivered = item.kind === 'cylinder' && !item.isReturn ? `${item.qty} ${item.type}` : '';
    const khaliRet = item.kind === 'cylinder' && item.isReturn ? `${item.qty} ${item.type}` : '';
    const billAmt = item.kind === 'bill' ? Number(item.amount) : '';
    const paidAmt = item.kind === 'payment' ? Number(item.amount) : '';
    const bal = item.runningBalance !== undefined ? Number(item.runningBalance) : '';

    return [
      item.date || '',
      typeLabel,
      details,
      item.batchNum ? `#${item.batchNum}` : '',
      delivered,
      khaliRet,
      billAmt,
      paidAmt,
      bal,
      item.userName || 'Suraj'
    ];
  });

  const allRows = [...headerRows, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  
  // Set custom column widths
  ws['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Type
    { wch: 28 }, // Details
    { wch: 10 }, // Batch
    { wch: 16 }, // Delivered
    { wch: 16 }, // Khali Ret
    { wch: 16 }, // Bill Amt
    { wch: 16 }, // Paid Amt
    { wch: 18 }, // Closing Bal
    { wch: 14 }  // Recorded By
  ];

  const safeName = (partyName || 'Party').replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, "Customer Ledger");
  XLSX.writeFile(wb, `Ledger_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
