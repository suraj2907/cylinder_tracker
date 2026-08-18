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
  console.error("Please add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file to continue.");
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
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function runImport() {
  const nameMappings = loadNameMappings();
  const folderPath = "C:\\Users\\Suraj\\OneDrive\\Desktop\\Cylinder tracker ss\\Parties Statement";
  
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

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
  console.log(`Found ${files.length} ledger CSV files to import.`);

  let totalInvoicesImported = 0;
  let totalPaymentsImported = 0;

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = splitCSVToRows(content);
    
    let partyName = "";
    let ledgerRows = [];

    // Parse header and records
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
        ledgerRows.push(parsedRow);
      }
    });

    if (!partyName) {
      console.warn(`WARNING: Could not find party name in file ${file}. Skipping.`);
      continue;
    }

    // Resolve name through mappings
    const mappedNameLower = partyName.toLowerCase();
    let resolvedName = partyName;
    if (nameMappings[mappedNameLower]) {
      resolvedName = nameMappings[mappedNameLower];
    } else if (dbNameMapping[mappedNameLower]) {
      resolvedName = dbNameMapping[mappedNameLower];
    } else {
      // Find closest case-insensitive match
      const matchedName = dbRestaurants.find(r => r.name.toLowerCase() === mappedNameLower);
      if (matchedName) {
        resolvedName = matchedName.name;
      }
    }

    // Skip supplier/unregistered names
    if (resolvedName.toLowerCase() === "gaspoint petroleum (india) limited") {
      console.log(`Skipping supplier ledger: ${partyName}`);
      continue;
    }

    // Verify restaurant exists in Supabase
    if (!dbRestaurantNames.includes(resolvedName.toLowerCase())) {
      console.warn(`WARNING: Restaurant "${resolvedName}" does not exist in your restaurants table. Skipping statements for ${partyName}.`);
      continue;
    }

    console.log(`Importing ledger for "${resolvedName}" (${ledgerRows.length} entries)...`);

    const billsToInsert = [];
    const paymentsToInsert = [];

    ledgerRows.forEach(row => {
      const [dateStr, voucher, srNo, paymentMode, creditStr, debitStr, balanceStr, dueDateStr, paymentStatus] = row;
      
      const billDate = parseDate(dateStr);
      if (!billDate) return;

      if (voucher === "Sales Invoice") {
        const amount = parseFloat(creditStr) || 0;
        const remaining = parseFloat(balanceStr) || 0;
        
        // Back-calculate GST
        const taxable = amount / 1.18;
        const totalTax = amount - taxable;
        const cgst = totalTax / 2;
        const sgst = totalTax / 2;

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
          due_date: parseDate(dueDateStr) || billDate,
          payment_type: 'credit',
          created_by: 'Suraj'
        });
      } else if (voucher === "Payment-in") {
        const amount = parseFloat(debitStr) || 0;
        
        // Strip bank name from mode e.g., "Upi (SBIN 6789)" -> "UPI"
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

    // Bulk insert bills in chunks of 50
    for (let i = 0; i < billsToInsert.length; i += 50) {
      const chunk = billsToInsert.slice(i, i + 50);
      const { error } = await supabase.from('bills').insert(chunk);
      if (error) {
        console.error(`ERROR: Failed to import bills chunk for ${resolvedName}:`, error.message);
      } else {
        totalInvoicesImported += chunk.length;
      }
    }

    // Bulk insert payments in chunks of 50
    for (let i = 0; i < paymentsToInsert.length; i += 50) {
      const chunk = paymentsToInsert.slice(i, i + 50);
      const { error } = await supabase.from('payments').insert(chunk);
      if (error) {
        console.error(`ERROR: Failed to import payments chunk for ${resolvedName}:`, error.message);
      } else {
        totalPaymentsImported += chunk.length;
      }
    }
  }

  console.log("-----------------------------------------");
  console.log("IMPORT COMPLETED:");
  console.log(`- Total Invoices Imported: ${totalInvoicesImported}`);
  console.log(`- Total Payments Imported: ${totalPaymentsImported}`);
  console.log("-----------------------------------------");
}

runImport();
