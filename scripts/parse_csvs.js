import fs from 'fs';
import path from 'path';

const dir = 'C:/Users/Suraj/.gemini/antigravity-ide/brain/69502644-5e0a-4197-971f-614be140fa63/.user_uploaded';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

const results = {};

for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  
  let partyName = '';
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].toLowerCase().startsWith('party name:')) {
      partyName = lines[i].replace(/party name:/i, '').trim();
    }
  }

  let closingBal = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].toLowerCase().includes('closing balance')) {
      const parts = lines[i].split(',').map(s => s.replace(/"/g, '').trim());
      const nums = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
      if (nums.length > 0) {
        closingBal = nums[0]; // First number in Closing Balance row
      }
      break;
    }
  }

  if (partyName) {
    results[partyName] = closingBal;
  }
}

console.log('Total party CSVs parsed:', Object.keys(results).length);
let totalPending = 0;
let totalCust = 0;
const sorted = Object.entries(results).sort((a,b) => b[1] - a[1]);
console.log('\n--- ALL PARTY CLOSING BALANCES FROM RAW CSVs ---');
sorted.forEach(([p, bal]) => {
  if (bal > 0) {
    console.log(p.padEnd(45), ':', bal);
  }
  totalPending += bal;
  if (!p.toLowerCase().includes('gaspoint')) {
    totalCust += bal;
  }
});

console.log('\n========================================');
console.log('TOTAL WITH Gaspoint Petroleum:', totalPending);
console.log('TOTAL Pure Customer Pending:', totalCust);
console.log('========================================');
