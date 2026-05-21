import jsPDF from 'jspdf';
import 'jspdf-autotable';
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

  doc.autoTable({
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
