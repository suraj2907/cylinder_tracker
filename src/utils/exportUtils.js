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

// Generate professional vector Tax Invoice PDF document
export const generateInvoicePDFDoc = (bill, profile = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const invLabel = bill.invoiceLabel || (bill.invoice_no ? `INV-${String(bill.invoice_no).padStart(4, '0')}` : 'INVOICE');
  const isGst = bill.gst_mode === 'gst';

  // Header Banner
  doc.setFillColor(15, 23, 42); // Dark slate
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('M/S SHREE BALAJI AGENCIES', 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Authorized Commercial LPG Distributor • Kamthi Line Beside SBI ATM, Rajnandgaon (C.G.) 491441', 14, 17);
  doc.text('Phone: 9407922288 | Email: msspagency@gmail.com | GSTIN: 22SNZPS3600E1ZH', 14, 22);

  // Invoice Title Badge
  doc.setFillColor(isGst ? 2 : 71, isGst ? 132 : 85, isGst ? 199 : 105);
  doc.roundedRect(150, 7, 46, 12, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(isGst ? 'TAX INVOICE' : 'PLAIN BILL', 173, 15, { align: 'center' });

  // Bill To & Invoice Meta block
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 14, 34);
  
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(bill.restaurant_name || profile.name || 'Customer', 14, 40);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  let yPos = 45;
  if (profile.address) {
    doc.text(`Address: ${profile.address}`, 14, yPos);
    yPos += 5;
  }
  const phoneStr = profile.mobile ? `Phone: +91-${profile.mobile}` : '';
  const partyGst = bill.gst_num || profile.gst_num ? `GSTIN: ${bill.gst_num || profile.gst_num}` : '';
  doc.text([phoneStr, partyGst].filter(Boolean).join(' | '), 14, yPos);

  // Invoice Details on the Right
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice No:`, 140, 34);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 116, 144);
  doc.text(invLabel, 196, 34, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice Date:`, 140, 40);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(bill.bill_date || new Date().toISOString().slice(0, 10), 196, 40, { align: 'right' });

  if (bill.batch_num) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Batch #:`, 140, 46);
    doc.setFont('helvetica', 'bold');
    doc.text(`Batch #${bill.batch_num}`, 196, 46, { align: 'right' });
  }

  // Items Table
  const tableColumn = isGst 
    ? ["#", "Item Description", "HSN", "Qty", "Rate (Rs.)", "Amount (Rs.)"]
    : ["#", "Item Description", "Qty", "Rate (Rs.)", "Amount (Rs.)"];

  const itemsArr = Array.isArray(bill.items) ? bill.items : [];
  const tableRows = itemsArr.map((it, idx) => {
    const qty = parseFloat(it.qty) || 0;
    const rate = parseFloat(it.rate) || 0;
    const amt = qty * rate;
    return isGst ? [
      idx + 1,
      it.description || it.item_name || 'Cylinder',
      it.hsn || '27111900',
      `${qty} PCS`,
      Number(rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ] : [
      idx + 1,
      it.description || it.item_name || 'Cylinder',
      `${qty} PCS`,
      Number(rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ];
  });

  const tableStartY = Math.max(yPos + 7, 52);
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: tableStartY,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: isGst ? {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    } : {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 90 },
      2: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 6;

  // Summary box on right
  // Summary calculations
  const totAmt = Number(bill.total_amount || 0);
  const taxable = Number(bill.taxable_amount || 0);
  const cgst = Number(bill.cgst || 0);
  const sgst = Number(bill.sgst || 0);
  const paidAmt = Number(bill.amount_paid || (bill.payment_status === 'paid' ? totAmt : 0));
  const prevBal = parseFloat(profile.previous_balance !== undefined ? profile.previous_balance : (bill.previous_balance || 0));
  const currentBal = profile.current_balance !== undefined ? parseFloat(profile.current_balance) : (prevBal + totAmt - paidAmt);

  // Bank details Box (Left)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, 96, 42, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY, 96, 42, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('BANK & PAYMENT DETAILS', 18, finalY + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text('Bank: State Bank of India, RAJNANDGAON', 18, finalY + 12);
  doc.text('Account Name: MS SHREE BALAJI AGENCIES', 18, finalY + 17);
  doc.text('A/C No: 43204193003  |  IFSC: SBIN0000464', 18, finalY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 116, 144);
  doc.text('UPI ID: 9407922288-1@okbizaxis', 18, finalY + 28);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Accepted: GPay / PhonePe / Paytm / BHIM UPI', 18, finalY + 34);

  // Totals Breakdown Box (Right)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(114, finalY, 82, 42, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(114, finalY, 82, 42, 2, 2, 'S');

  let rY = finalY + 5;
  if (isGst) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Taxable Amount:', 118, rY);
    doc.text(`Rs. ${taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });
    rY += 4.5;
    doc.text('CGST @ 9%:', 118, rY);
    doc.text(`Rs. ${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });
    rY += 4.5;
    doc.text('SGST @ 9%:', 118, rY);
    doc.text(`Rs. ${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });
    rY += 5;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Total Amount:', 118, rY);
  doc.text(`Rs. ${totAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });
  rY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Received Amount:', 118, rY);
  doc.text(`Rs. ${paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });
  rY += 4.5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Previous Balance:', 118, rY);
  doc.text(`Rs. ${prevBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });
  rY += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72);
  doc.text('Current Balance:', 118, rY);
  doc.text(`Rs. ${currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, rY, { align: 'right' });

  // Total in Words Box Below
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Amount (in words):', 14, finalY + 48);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(numberToWords(Math.round(totAmt)), 50, finalY + 48);

  // Footer note
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Terms: Goods once sold will not be taken back. Empty cylinders returnable; loss/damage chargeable.', 14, finalY + 54);
  doc.text('Authorized Signatory • M/S SHREE BALAJI AGENCIES', 196, finalY + 54, { align: 'right' });

  return doc;
};

// Convert number to Indian words
function numberToWords(num) {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return `${num} Rupees Only`;
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Rupees Only' : 'Rupees Only';
  return str.trim();
}

// Export individual invoice as PDF download
export const exportBillPDF = (bill, profile = {}) => {
  const doc = generateInvoicePDFDoc(bill, profile);
  const invLabel = bill.invoiceLabel || (bill.invoice_no ? `INV-${String(bill.invoice_no).padStart(4, '0')}` : 'INVOICE');
  const safeName = (bill.restaurant_name || profile.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Invoice_${invLabel}_${safeName}.pdf`);
};

// Share invoice directly into party WhatsApp chat with PDF attachment
export const shareInvoicePDFOnWhatsApp = async (bill, profile = {}) => {
  const doc = generateInvoicePDFDoc(bill, profile);
  const invLabel = bill.invoiceLabel || (bill.invoice_no ? `INV-${String(bill.invoice_no).padStart(4, '0')}` : 'INVOICE');
  const safeName = (bill.restaurant_name || profile.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Invoice_${invLabel}_${safeName}.pdf`;

  const phone = profile.mobile || bill.mobile || '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const totAmt = Number(bill.total_amount || 0);
  const prevBal = parseFloat(profile.previous_balance !== undefined ? profile.previous_balance : (bill.previous_balance || 0));
  const currentBal = profile.current_balance !== undefined ? parseFloat(profile.current_balance) : (prevBal + totAmt - paidAmt);
  const onlineLink = bill.invoice_link || `https://cylinder-tracker.vercel.app/`;

  const message = `🧾 *TAX INVOICE*\n` +
    `Dear *${bill.restaurant_name || profile.name || 'Customer'}*,\n\n` +
    `Your invoice *${invLabel}* of amount *₹${totAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}* dated *${bill.bill_date || new Date().toISOString().slice(0, 10)}* is generated.\n\n` +
    `📄 *View Invoice:* ${onlineLink}\n\n` +
    (prevBal > 0 ? `⏮️ *Previous Balance:* ₹${prevBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` : '') +
    `🔴 *Total Balance Due:* ₹${currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n` +
    `💳 *UPI ID for Payment:* 9407922288-1@okbizaxis\n` +
    `🏦 *Bank:* MS SHREE BALAJI AGENCIES | A/C: 43204193003 | IFSC: SBIN0000464 | SBI Rajnandgaon\n\n` +
    `*M/S SHREE BALAJI AGENCIES*\n` +
    `📞 9407922288 | msspagency@gmail.com`;

  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

  // 1. Mobile Native Share: Directly attaches and shares PDF document into WhatsApp chat
  if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `Invoice ${invLabel}`,
        text: message
      });
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share error, falling back:', err);
      }
    }
  }

  // 2. Desktop Fallback: Open WhatsApp direct chat
  const encoded = encodeURIComponent(message);
  const url = recipient ? `https://wa.me/${recipient}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
};
