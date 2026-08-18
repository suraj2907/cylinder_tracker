import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envConfig[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("ERROR: Supabase URL or Service Role Key is missing in your .env file!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// 1. Read mappings from party_name_mapping.csv
function loadNameMappings() {
  const mappings = {};
  const mappingPath = "C:\\Users\\Suraj\\OneDrive\\Desktop\\party_name_mapping.csv";
  if (!fs.existsSync(mappingPath)) {
    console.warn("WARNING: party_name_mapping.csv not found on Desktop. Skipping mapping overrides.");
    return mappings;
  }
  const content = fs.readFileSync(mappingPath, 'utf-8');
  const rows = content.split('\n');
  rows.forEach((row, idx) => {
    if (idx === 0 || !row.trim()) return; // skip header
    const cells = row.split(',');
    if (cells.length >= 2) {
      const ledgerName = cells[0].replace(/"/g, '').trim().toLowerCase();
      const canonicalName = cells[1].replace(/"/g, '').trim();
      if (ledgerName && canonicalName) {
        mappings[ledgerName] = canonicalName;
      }
    }
  });
  return mappings;
}

// Inline CSV line-splitter that handles quoted newlines
function splitCSVToRows(content) {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r') {
      // ignore carriage return
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// Inline CSV row-parser that handles quotes
function parseCSVRow(text) {
  const result = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Strip parentheses and anything inside them, e.g., "19/06/2026 (59)" -> "19/06/2026"
  const cleanDateStr = dateStr.replace(/\s*\([^)]*\)/g, '').trim();
  const parts = cleanDateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    // Ensure year has only digits
    const year = parts[2].replace(/\D/g, '').trim();
    return `${year}-${month}-${day}`;
  }
  return null;
}

function resolveRestaurantName(partyName, dbRestaurants, nameMappings) {
  const mappedNameLower = partyName.toLowerCase();
  
  if (nameMappings[mappedNameLower]) {
    return nameMappings[mappedNameLower];
  }
  
  const dbMatch = dbRestaurants.find(r => r.name.toLowerCase() === mappedNameLower);
  if (dbMatch) {
    return dbMatch.name;
  }
  
  // Fallback overrides for unmatched raw names in Sales Summary Report
  const fallbackOverrides = {
    'ashwini': 'Ashwini Amritulaya',
    'parvez bhiya kalp': 'Kalp',
    'simran sweets': 'Simran Sweets',
    'simran restaurant': 'Simran Sweets',
    'jasbeer kaur bhatia': 'Jasbeer Kaur Bhatia',
    'jasbeer kaur': 'Jasbeer Kaur Bhatia',
    'karnail singh bhatia': 'Jasbeer Kaur Bhatia',
    'grandvista ventures private limited': 'GRANDVISTA VENTURES PRIVATE LIMITED',
    'grandvista ventures': 'GRANDVISTA VENTURES PRIVATE LIMITED',
    'shri gurudev agro india private limited': 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED',
    'shri gurudev agro': 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED',
    'bajrang tadka': 'Bajrang Tadka Point',
    'bajrang tadka point': 'Bajrang Tadka Point'
  };
  
  if (fallbackOverrides[mappedNameLower]) {
    return fallbackOverrides[mappedNameLower];
  }
  
  return partyName;
}

async function runImport() {
  const nameMappings = loadNameMappings();
  const reportPath = "C:\\Users\\Suraj\\OneDrive\\Desktop\\Cylinder tracker ss\\[MS Shree Balaji Agencies] Sales Summary Report as of 18-08-2026.csv";
  const folderPath = "C:\\Users\\Suraj\\OneDrive\\Desktop\\Cylinder tracker ss\\Parties Statement";

  if (!fs.existsSync(reportPath)) {
    console.error(`ERROR: Sales Summary Report not found at: ${reportPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(folderPath)) {
    console.error(`ERROR: Ledger folder not found at: ${folderPath}`);
    process.exit(1);
  }

  // Fetch all existing restaurants from Supabase to match canonical names
  console.log("Fetching existing restaurants from Supabase...");
  const { data: dbRestaurants, error: restError } = await supabase.from('restaurants').select('name');
  if (restError) {
    console.error("ERROR: Failed to fetch restaurants from Supabase:", restError.message);
    process.exit(1);
  }
  
  const dbRestaurantNames = dbRestaurants.map(r => r.name.toLowerCase());
  const dbNameMapping = {};
  dbRestaurants.forEach(r => {
    dbNameMapping[r.name.toLowerCase()] = r.name;
  });

  const billsToInsert = [];
  const paymentsToInsert = [];
  const processedInvoices = new Set();

  // Helper to ensure restaurant exists in Supabase
  async function ensureRestaurantExists(resolvedName) {
    if (resolvedName.toLowerCase() === "gaspoint petroleum (india) limited") {
      return false;
    }
    if (!dbRestaurantNames.includes(resolvedName.toLowerCase())) {
      console.log(`Restaurant "${resolvedName}" not found — creating it now...`);
      const { error: createErr } = await supabase
        .from('restaurants')
        .insert({ name: resolvedName });
      if (createErr) {
        console.error(`ERROR: Failed to create restaurant "${resolvedName}": ${createErr.message}`);
        return false;
      }
      dbRestaurantNames.push(resolvedName.toLowerCase());
      dbRestaurants.push({ name: resolvedName });
    }
    return true;
  }

  // 1. Process Sales Summary Report to import ALL Invoices
  console.log("Processing Sales Summary Report...");
  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  const reportRows = splitCSVToRows(reportContent);

  for (let idx = 0; idx < reportRows.length; idx++) {
    const rowText = reportRows[idx];
    if (idx === 0 || !rowText.trim()) continue; // skip header

    const parsedRow = parseCSVRow(rowText);
    if (parsedRow.length < 11) continue;

    const [invoiceNoStr, invoiceDateStr, contactName, amountStr, remainingStr, statusStr, dueDateStr, link, payType, category, createdBy] = parsedRow;
    
    if (invoiceNoStr === 'Invoice No') continue; // skip header fallback
    if (!payType || (!payType.toLowerCase().includes('credit') && !payType.toLowerCase().includes('cash'))) continue;

    const billDate = parseDate(invoiceDateStr);
    if (!billDate) continue;

    const resolvedName = resolveRestaurantName(contactName, dbRestaurants, nameMappings);
    
    // Auto-create restaurant if missing
    const ok = await ensureRestaurantExists(resolvedName);
    if (!ok) continue;

    const amount = parseFloat(amountStr) || 0;
    const remaining = parseFloat(remainingStr) || 0;
    const parsedInvoiceNo = parseInt(invoiceNoStr, 10) || null;

    // Back-calculate GST
    const taxable = amount / 1.18;
    const totalTax = amount - taxable;
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;

    const paymentStatus = (statusStr || '').toLowerCase().replace(' ', '_');

    billsToInsert.push({
      restaurant_name: resolvedName,
      bill_date: billDate,
      gst_mode: 'gst',
      items: [{ description: "Legacy Import", hsn: null, qty: 1, rate: amount }],
      subtotal: amount,
      taxable_amount: parseFloat(taxable.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      total_amount: amount,
      payment_status: paymentStatus || (remaining === 0 ? 'paid' : 'unpaid'),
      amount_paid: amount - remaining,
      due_date: parseDate((dueDateStr || '').split(' (')[0].trim()) || billDate,
      payment_type: payType.toLowerCase().includes('cash') ? 'cash' : 'credit',
      invoice_no: parsedInvoiceNo,
      legacy_invoice_no: parsedInvoiceNo,
      created_by: createdBy || 'Suraj'
    });
    
    processedInvoices.add(parsedInvoiceNo);
  }

  // 2. Process Individual Restaurant Ledger files for Payments and Opening Balances
  console.log("Processing individual restaurant statement files...");
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = splitCSVToRows(content);
    
    let partyName = "";
    let ledgerRows = [];
    let openingBalance = 0;

    rows.forEach(rowText => {
      if (!rowText.trim()) return;
      
      if (rowText.includes("Party Name:")) {
        const parts = parseCSVRow(rowText);
        const namePart = parts.find(p => p.startsWith("Party Name:"));
        if (namePart) {
          partyName = namePart.replace("Party Name:", "").trim();
        }
      }

      const parsedRow = parseCSVRow(rowText);
      if (parsedRow.length >= 9 && parsedRow[1] !== 'Voucher') {
        if (parsedRow[1] === 'Opening Balance') {
          openingBalance = parseFloat(parsedRow[6]) || 0; // Balance column
          return;
        }
        ledgerRows.push(parsedRow);
      }
    });

    if (!partyName) continue;

    const resolvedName = resolveRestaurantName(partyName, dbRestaurants, nameMappings);
    const ok = await ensureRestaurantExists(resolvedName);
    if (!ok) continue;

    // Update Opening Balance in Supabase restaurants table
    const { error: balanceErr } = await supabase
      .from('restaurants')
      .update({ previous_balance: openingBalance })
      .eq('name', resolvedName);
      
    if (balanceErr) {
      console.error(`ERROR: Failed to update previous_balance for "${resolvedName}":`, balanceErr.message);
    } else if (openingBalance > 0) {
      console.log(`Set Opening Balance for "${resolvedName}" to ₹${openingBalance}`);
    }

    // Process Payment-in rows only
    ledgerRows.forEach(row => {
      const [dateStr, voucher, srNo, paymentMode, creditStr, debitStr, balanceStr, dueDateStr, paymentStatus] = row;
      const billDate = parseDate(dateStr);
      if (!billDate) return;

      if (voucher === "Payment-in") {
        const amount = parseFloat(creditStr) || 0; // Payment-in amounts are in the Credit column
        
        let parsedMode = 'Cash';
        if (paymentMode) {
          const modeLower = paymentMode.toLowerCase();
          if (modeLower.includes('upi')) parsedMode = 'UPI';
          else if (modeLower.includes('cash')) parsedMode = 'Cash';
          else parsedMode = paymentMode.split('\n')[0].split(' ')[0].trim();
        }

        paymentsToInsert.push({
          restaurant_name: resolvedName,
          amount: amount,
          payment_mode: parsedMode,
          date: billDate,
          user_name: 'Suraj',
          note: `Legacy Import (Ref #${srNo})`
        });
      }
    });
  }

  // 3. Clear existing legacy data before insert
  console.log("Cleaning up existing legacy data from Supabase...");
  const { error: delBillsErr } = await supabase.from('bills').delete().not('legacy_invoice_no', 'is', null);
  if (delBillsErr) console.error("Error cleaning up bills:", delBillsErr.message);

  const { error: delPaymentsErr } = await supabase.from('payments').delete().like('note', 'Legacy Import%');
  if (delPaymentsErr) console.error("Error cleaning up payments:", delPaymentsErr.message);

  // 4. Bulk Insert Invoices
  console.log(`Inserting ${billsToInsert.length} bills into Supabase...`);
  let totalInvoicesImported = 0;
  for (let i = 0; i < billsToInsert.length; i += 50) {
    const chunk = billsToInsert.slice(i, i + 50);
    const { error } = await supabase.from('bills').insert(chunk);
    if (error) {
      console.error(`ERROR inserting bills chunk:`, error.message);
    } else {
      totalInvoicesImported += chunk.length;
    }
  }

  // 5. Bulk Insert Payments
  console.log(`Inserting ${paymentsToInsert.length} payments into Supabase...`);
  let totalPaymentsImported = 0;
  for (let i = 0; i < paymentsToInsert.length; i += 50) {
    const chunk = paymentsToInsert.slice(i, i + 50);
    const { error } = await supabase.from('payments').insert(chunk);
    if (error) {
      console.error(`ERROR inserting payments chunk:`, error.message);
    } else {
      totalPaymentsImported += chunk.length;
    }
  }

  console.log("-----------------------------------------");
  console.log("IMPORT COMPLETED:");
  console.log(`- Total Invoices Imported: ${totalInvoicesImported}`);
  console.log(`- Total Payments Imported: ${totalPaymentsImported}`);
  console.log("-----------------------------------------");
}

runImport();
