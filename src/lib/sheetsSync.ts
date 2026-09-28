import { Transaction } from "../types";
import { db } from "./firebase";
import { doc, writeBatch } from "firebase/firestore";

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getMonthName(date: Date): string {
  return INDONESIAN_MONTHS[date.getMonth()];
}

function getSoftColor(index: number) {
  const colors = [
    { red: 0.85, green: 0.92, blue: 0.98 }, // light blue
    { red: 0.98, green: 0.85, blue: 0.85 }, // light red
    { red: 0.85, green: 0.98, blue: 0.85 }, // light green
    { red: 0.98, green: 0.95, blue: 0.85 }, // light yellow
    { red: 0.92, green: 0.85, blue: 0.98 }, // light purple
    { red: 0.85, green: 0.98, blue: 0.98 }, // light cyan
    { red: 0.98, green: 0.85, blue: 0.95 }, // magenta
    { red: 0.95, green: 0.98, blue: 0.85 }  // pale lime
  ];
  return colors[index % colors.length];
}

function getHeaderRow() {
  return {
    values: [
      { userEnteredValue: { stringValue: "Hari" } },
      { userEnteredValue: { stringValue: "Tanggal & Waktu (WIB)" } },
      { userEnteredValue: { stringValue: "Platform / Toko" } },
      { userEnteredValue: { stringValue: "Kategori" } },
      { userEnteredValue: { stringValue: "Metode Pembayaran" } },
      { userEnteredValue: { stringValue: "Harga (Rp)" } },
      { userEnteredValue: { stringValue: "Catatan" } }
    ].map(v => ({
      ...v,
      userEnteredFormat: {
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE"
      }
    }))
  };
}

// Moves every Qicau-created export spreadsheet (any year) to Google Drive's
// trash, not permanent delete, so the user can still recover it from Drive
// for a while if this was pressed by mistake. Returns how many were trashed.
export async function trashSheetsFiles(token: string): Promise<number> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name contains 'Qicau_Export_' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );
  if (!searchRes.ok) {
    const err = await searchRes.json();
    throw new Error(`Drive API Error: ${err.error?.message}`);
  }
  const searchData = await searchRes.json();
  const files: { id: string }[] = searchData.files || [];

  for (const file of files) {
    const trashRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ trashed: true })
    });
    if (!trashRes.ok) {
      const err = await trashRes.json();
      throw new Error(`Drive API Error: ${err.error?.message}`);
    }
  }

  return files.length;
}

export async function syncToSheets(
  transactions: Transaction[],
  token: string, 
  onProgress?: (msg: string) => void
) {
  const log = (msg: string) => {
    console.log(msg);
    if (onProgress) onProgress(msg);
  };

  if (transactions.length === 0) {
    return "Tidak ada transaksi untuk disinkronisasi.";
  }

  log(`Memulai pengecekan sinkronisasi...`);

  // Group ALL transactions by Year -> Month -> Transactions
  const groupedAll: Record<number, Record<string, Transaction[]>> = {};
  
  transactions.forEach(tx => {
    const d = new Date(tx.created_at);
    const year = d.getFullYear();
    const monthName = getMonthName(d);
    
    if (!groupedAll[year]) groupedAll[year] = {};
    if (!groupedAll[year][monthName]) groupedAll[year][monthName] = [];
    
    groupedAll[year][monthName].push(tx);
  });

  const categories = Array.from(new Set(transactions.map(tx => tx.kategori || "Lainnya")));
  const paymentMethods = Array.from(new Set(transactions.map(tx => tx.payment_method || "QRIS")));

  const batchUpdateFirestore = writeBatch(db);
  let hasUpdates = false;
  let totalSynced = 0;

  for (const yearStr of Object.keys(groupedAll)) {
    const year = parseInt(yearStr);
    const fileName = `Qicau_Export_${year}`;
    
    log(`Mencari file ${fileName} di Google Drive...`);
    
    // Check if file exists
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!searchRes.ok) {
       const err = await searchRes.json();
       throw new Error(`Drive API Error: ${err.error?.message}`);
    }
    const searchData = await searchRes.json();
    let spreadsheetId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;
    let isNewFile = false;

    if (!spreadsheetId) {
      log(`File ${fileName} belum ada, membuat baru...`);
      isNewFile = true;
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: { title: fileName },
          sheets: [{
            properties: {
              title: "Summary",
              gridProperties: { frozenRowCount: 0 }
            }
          }]
        })
      });

      if (!createRes.ok) {
         const err = await createRes.json();
         throw new Error(`Sheet Create Error: ${err.error?.message}`);
      }
      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;
    }

    log(`File siap. Mengecek halaman bulanan...`);

    // Fetch existing sheets to know which month sheets exist
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title),charts,bandedRanges)`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const spreadData = await getRes.json();
    const sheetIdMap: Record<string, number> = {};
    (spreadData.sheets || []).forEach((s: any) => {
      sheetIdMap[s.properties.title] = s.properties.sheetId;
    });
    let existingTabs: string[] = Object.keys(sheetIdMap);
    const summarySheetInfo = (spreadData.sheets || []).find((s: any) => s.properties.title === "Summary");
    const summarySheetId = summarySheetInfo?.properties?.sheetId || 0;
    const existingCharts = summarySheetInfo?.charts || [];
    const hasExistingBandings = (summarySheetInfo?.bandedRanges?.length || 0) > 0;

    // Determine which transactions to sync for this year
    const months = Object.keys(groupedAll[year]);
    const txsToSyncByMonth: Record<string, Transaction[]> = {};
    
    for (const month of months) {
      // If the file is new, we must sync ALL transactions for this year, even if previously marked exported
      if (isNewFile) {
        txsToSyncByMonth[month] = groupedAll[year][month];
      } else {
        txsToSyncByMonth[month] = groupedAll[year][month].filter(tx => !tx.is_exported);
      }
    }

    // Process appending for each month in this year that has unsynced TXs
    const newlyCreatedSheets = new Set<string>();

    for (const month of months) {
      const txs = txsToSyncByMonth[month] || [];
      if (txs.length === 0) continue; // nothing to append for this month

      const tabName = `${month} ${year}`;
      
      // If tab doesn't exist, create it
      if (!existingTabs.includes(tabName)) {
        log(`Membuat sheet baru untuk ${tabName}...`);
        const addSheetAndHeader = {
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName,
                  gridProperties: { frozenRowCount: 1 }
                }
              }
            }
          ]
        };

        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(addSheetAndHeader)
        });

        if (!updateRes.ok) {
          const err = await updateRes.json();
          throw new Error(`Failed to add sheet ${tabName}: ${err.error?.message}`);
        }
        const updatedData = await updateRes.json();
        const newSheetId = updatedData.replies[0].addSheet.properties.sheetId;
        existingTabs.push(tabName);
        sheetIdMap[tabName] = newSheetId;
        newlyCreatedSheets.add(tabName);

        // Layout: Row 1 = header (frozen), Row 2+ = data. Side tables on cols I-J start at row 2.
        const formatReq = {
           requests: [
             // Column header at row 1
             {
               updateCells: {
                 range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
                 rows: [getHeaderRow()],
                 fields: "userEnteredValue,userEnteredFormat"
               }
             },
             // Data row formatting from row 2 onward — center + middle + wrap
             {
               repeatCell: {
                 range: { sheetId: newSheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
                 cell: {
                   userEnteredFormat: {
                     horizontalAlignment: "CENTER",
                     verticalAlignment: "MIDDLE",
                     wrapStrategy: "WRAP"
                   }
                 },
                 fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)"
               }
             },
             // Currency format on column F (Harga) from row 2
             {
               repeatCell: {
                 range: { sheetId: newSheetId, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
                 cell: {
                   userEnteredFormat: {
                     numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" }
                   }
                 },
                 fields: "userEnteredFormat.numberFormat"
               }
             },
             {
               updateDimensionProperties: {
                 range: { sheetId: newSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 7 },
                 properties: { pixelSize: 150 },
                 fields: "pixelSize"
               }
             },
             // Banding starts at header row 1
             {
               addBanding: {
                 bandedRange: {
                   range: { sheetId: newSheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 7 },
                   rowProperties: {
                     headerColor: { red: 0.2, green: 0.2, blue: 0.2 },
                     firstBandColor: { red: 1, green: 1, blue: 1 },
                     secondBandColor: { red: 0.96, green: 0.96, blue: 0.96 }
                   }
                 }
               }
             }
           ]
        };
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: "POST",
          headers: {
             "Authorization": `Bearer ${token}`,
             "Content-Type": "application/json"
          },
          body: JSON.stringify(formatReq)
        });
      } else {
        // Existing tab — check if it was migrated to the previous (now-deprecated) layout
        // where main table header was pushed to row 3. If so, un-migrate by deleting rows 1-2.
        const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A1:A2`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const checkData = await checkRes.json();
        const a1 = checkData.values?.[0]?.[0] || "";
        const a2 = checkData.values?.[1]?.[0] || "";
        const wasPreviouslyMigrated = a1 === "" && a2.startsWith("Transaksi ");

        if (wasPreviouslyMigrated) {
          log(`Mengembalikan layout tabel utama untuk ${tabName}...`);
          const undoReq = {
            requests: [
              // Delete the 2 leading rows (empty + name banner) to bring header back to row 1
              {
                deleteDimension: {
                  range: { sheetId: sheetIdMap[tabName], dimension: "ROWS", startIndex: 0, endIndex: 2 }
                }
              },
              // Restore frozen row count to 1
              {
                updateSheetProperties: {
                  properties: { sheetId: sheetIdMap[tabName], gridProperties: { frozenRowCount: 1 } },
                  fields: "gridProperties.frozenRowCount"
                }
              }
            ]
          };
          const undoRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(undoReq)
          });
          if (!undoRes.ok) {
            const err = await undoRes.json();
            console.warn(`Layout revert for ${tabName} failed:`, err);
          }
        }
      }

      // Sort transactions chronologically ascending
      txs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Append data
      log(`Sinkronisasi ${txs.length} transaksi ke ${tabName}...`);
      let lastDateStr = "";
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const plainRows = txs.map(tx => {
         const dateObj = new Date(tx.created_at);
         // Force 2-digit day/month + 4-digit year so date string is always "DD/MM/YYYY" (10 chars)
         const dateStr = dateObj.toLocaleDateString('id-ID', {
           timeZone: 'Asia/Jakarta',
           day: '2-digit', month: '2-digit', year: 'numeric'
         });
         const timeStr = dateObj.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
         const localDateForDay = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
         const dayIndex = localDateForDay.getDay();

         let hariName = "";
         if (dateStr !== lastDateStr) {
           hariName = dayNames[dayIndex];
           lastDateStr = dateStr;
         }

         return [
           hariName,
           `${dateStr}, ${timeStr}`,
           tx.platform || "",
           tx.kategori || "",
           tx.payment_method || "",
           tx.harga,
           tx.detail || ""
         ];
      });

      const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${tabName}'!A:G:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: plainRows })
      });

      if (!appendRes.ok) {
         const err = await appendRes.json();
         throw new Error(`Failed to append to ${tabName}: ${err.error?.message}`);
      }
      
      // Update Monthly Side Tables & Validations
      // Side table layout: Row 1 empty (under frozen pane), Row 2 = name, Row 3 = header, Row 4+ = stats,
      // Rows 9-10 = empty (2-cell gap), Row 11 = kategori name, Row 12 = kategori header, Row 13+ = categories
      const currentSheetId = sheetIdMap[tabName];
      const sideNameFormat = {
        textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 1, green: 1, blue: 1 } },
        backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE"
      };
      const sideHeaderFormat = {
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        backgroundColor: { red: 0.35, green: 0.35, blue: 0.35 },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE"
      };
      let monthlySideRows: any[] = [
        // Row 1 (index 0): empty (under frozen pane)
        { values: [] },
        // Row 2 (index 1): Table name "Statistik {tabName}"
        {
          values: [
            { userEnteredValue: { stringValue: `Statistik ${tabName}` }, userEnteredFormat: sideNameFormat },
            { userEnteredValue: { stringValue: "" }, userEnteredFormat: sideNameFormat }
          ]
        },
        // Row 3 (index 2): Column header
        {
          values: [
            { userEnteredValue: { stringValue: "Metrik" }, userEnteredFormat: sideHeaderFormat },
            { userEnteredValue: { stringValue: "Nilai" }, userEnteredFormat: sideHeaderFormat }
          ]
        },
        // Row 4 (index 3): Total Hari — robust unique-date count, data starts at row 2
        { values: [ { userEnteredValue: { stringValue: "Total Hari" } }, { userEnteredValue: { formulaValue: '=IFERROR(ROWS(UNIQUE(FILTER(ARRAYFORMULA(LEFT(B2:B, 10)), B2:B<>""))), 0)' } } ] },
        // Row 5 (index 4): Total Transaksi
        { values: [ { userEnteredValue: { stringValue: "Total Transaksi" } }, { userEnteredValue: { formulaValue: "=COUNTA(B2:B)" } } ] },
        // Row 6 (index 5): Total Pengeluaran
        { values: [ { userEnteredValue: { stringValue: "Total Pengeluaran" } }, { userEnteredValue: { formulaValue: "=SUM(F:F)" }, userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" } } } ] },
        // Row 7 (index 6): Rata-rata Tx Harian
        { values: [ { userEnteredValue: { stringValue: "Rata-rata Transaksi Harian" } }, { userEnteredValue: { formulaValue: "=IF(J4>0, J5/J4, 0)" }, userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0.0" } } } ] },
        // Row 8 (index 7): Rata-rata Pengeluaran Harian
        { values: [ { userEnteredValue: { stringValue: "Rata-rata Pengeluaran Harian" } }, { userEnteredValue: { formulaValue: "=IF(J4>0, J6/J4, 0)" }, userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" } } } ] },
        // Rows 9-10 (indexes 8-9): 2-cell gap
        { values: [] },
        { values: [] },
        // Row 11 (index 10): Table name "Kategori {tabName}"
        {
          values: [
            { userEnteredValue: { stringValue: `Kategori ${tabName}` }, userEnteredFormat: sideNameFormat },
            { userEnteredValue: { stringValue: "" }, userEnteredFormat: sideNameFormat }
          ]
        },
        // Row 12 (index 11): Column header
        {
          values: [
            { userEnteredValue: { stringValue: "Kategori" }, userEnteredFormat: sideHeaderFormat },
            { userEnteredValue: { stringValue: "Total" }, userEnteredFormat: sideHeaderFormat }
          ]
        }
      ];

      categories.forEach(cat => {
        monthlySideRows.push({
          values: [
            { userEnteredValue: { stringValue: cat } },
            { userEnteredValue: { formulaValue: `=SUMIF(D:D, "${cat}", F:F)` }, userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" } } }
          ]
        });
      });

      // Apply center + middle alignment universally (preserves any explicit bg/fg color)
      monthlySideRows = monthlySideRows.map((row: any) => ({
        values: row.values?.map((val: any) => ({
          ...val,
          userEnteredFormat: {
            ...val.userEnteredFormat,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        })) || []
      }));

      // Pad with empty rows to clear out any remnant old text
      for (let i = 0; i < 5; i++) {
        monthlySideRows.push({ values: [] });
      }

      const sideReq: any = {
        requests: [
          // Unmerge banners first (safe if not yet merged) so updateCells doesn't conflict
          { unmergeCells: { range: { sheetId: currentSheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 8, endColumnIndex: 10 } } },
          { unmergeCells: { range: { sheetId: currentSheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 8, endColumnIndex: 10 } } },
          {
            updateCells: {
              range: { sheetId: currentSheetId, startRowIndex: 0, endRowIndex: monthlySideRows.length, startColumnIndex: 8, endColumnIndex: 10 },
              rows: monthlySideRows,
              fields: "userEnteredValue,userEnteredFormat"
            }
          },
          // Merge banner rows after writing
          { mergeCells: { range: { sheetId: currentSheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 8, endColumnIndex: 10 }, mergeType: "MERGE_ALL" } },
          { mergeCells: { range: { sheetId: currentSheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 8, endColumnIndex: 10 }, mergeType: "MERGE_ALL" } },
          // Data validation for Kategori (column D, rows 2+)
          {
            setDataValidation: {
              range: { sheetId: currentSheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
              rule: {
                condition: { type: "ONE_OF_LIST", values: categories.map(c => ({ userEnteredValue: c })) },
                showCustomUi: true,
                strict: true
              }
            }
          },
          // Data validation for Pembayaran (column E, rows 2+)
          {
            setDataValidation: {
              range: { sheetId: currentSheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
              rule: {
                condition: { type: "ONE_OF_LIST", values: paymentMethods.map(c => ({ userEnteredValue: c })) },
                showCustomUi: true,
                strict: true
              }
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: currentSheetId, dimension: "COLUMNS", startIndex: 8, endIndex: 10 },
              properties: { pixelSize: 220 },
              fields: "pixelSize"
            }
          }
        ]
      };

      if (newlyCreatedSheets.has(tabName)) {
        // Basic filter covers main header at row 1 + data
        sideReq.requests.push({
          setBasicFilter: {
            filter: {
              range: { sheetId: currentSheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 7 }
            }
          }
        });

        // Conditional formatting for Kategori (rows 2+)
        categories.forEach((c, idx) => {
          sideReq.requests.push({
            addConditionalFormatRule: {
              rule: {
                ranges: [{ sheetId: currentSheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 }],
                booleanRule: {
                  condition: { type: "TEXT_EQ", values: [{ userEnteredValue: c }] },
                  format: { backgroundColor: getSoftColor(idx) }
                }
              },
              index: 0
            }
          });
        });

        // Conditional formatting for Pembayaran (rows 2+)
        paymentMethods.forEach((method, idx) => {
          sideReq.requests.push({
            addConditionalFormatRule: {
              rule: {
                ranges: [{ sheetId: currentSheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 }],
                booleanRule: {
                  condition: { type: "TEXT_EQ", values: [{ userEnteredValue: method }] },
                  format: { backgroundColor: getSoftColor(idx + 4) }
                }
              },
              index: 0
            }
          });
        });

        // Side table banding — Stats section (header row 3 + data rows 4-8)
        sideReq.requests.push({
          addBanding: {
            bandedRange: {
              range: { sheetId: currentSheetId, startRowIndex: 2, endRowIndex: 8, startColumnIndex: 8, endColumnIndex: 10 },
              rowProperties: { headerColor: { red: 0.2, green: 0.2, blue: 0.2 }, firstBandColor: { red: 1, green: 1, blue: 1 }, secondBandColor: { red: 0.96, green: 0.96, blue: 0.96 } }
            }
          }
        });
        // Side table banding — Kategori section (header row 12 + data rows 13+)
        sideReq.requests.push({
          addBanding: {
            bandedRange: {
              range: { sheetId: currentSheetId, startRowIndex: 11, endRowIndex: 12 + categories.length, startColumnIndex: 8, endColumnIndex: 10 },
              rowProperties: { headerColor: { red: 0.2, green: 0.2, blue: 0.2 }, firstBandColor: { red: 1, green: 1, blue: 1 }, secondBandColor: { red: 0.96, green: 0.96, blue: 0.96 } }
            }
          }
        });
      }

      const sideRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(sideReq)
      });
      if (!sideRes.ok) {
         const err = await sideRes.json();
         console.error("SideReq failed:", err);
         throw new Error(`SideReq Error: ${err.error?.message || JSON.stringify(err)}`);
      }

      // Mark these transactions as synced in Firestore
      txs.forEach(tx => {
        const docRef = doc(db, "transactions", tx.id);
        batchUpdateFirestore.update(docRef, { is_exported: true });
        hasUpdates = true;
        totalSynced++;
      });
    }

    // Rebuild Summary Sheet dynamically based on existing month tabs
    log(`Memperbarui halaman Summary...`);

    // Filter existing tabs to only those that match month names (exclude Summary or random sheets)
    const activeMonthTabs = existingTabs.filter(t => t !== "Summary" && INDONESIAN_MONTHS.some(m => t.startsWith(m)));

    let sumFormula = "=0";
    let totalTxFormula = "=0";
    let totalDaysFormula = "=0";

    // New layout: Monthly side tables have stats at J4-J6 (Total Hari, Total Tx, Total Pengeluaran)
    if (activeMonthTabs.length > 0) {
      sumFormula = "=" + activeMonthTabs.map(m => `IFERROR('${m}'!J6, 0)`).join(" + ");
      totalTxFormula = "=" + activeMonthTabs.map(m => `IFERROR('${m}'!J5, 0)`).join(" + ");
      totalDaysFormula = "=" + activeMonthTabs.map(m => `IFERROR('${m}'!J4, 0)`).join(" + ");
    }

    // Summary layout: Row 1 = name, Row 2 = header, Rows 3-7 = stats, Rows 8-9 = empty (2-cell gap),
    // Row 10 = kategori name, Row 11 = kategori header, Row 12+ = categories
    // B3 = Total Hari, B4 = Total Transaksi, B5 = Avg Tx, B6 = Avg Spend, B7 = Total Pengeluaran
    const avgTxPerDayFormula = `=IF(B3>0, B4/B3, 0)`;     // refs B4 (Total Tx) / B3 (Total Hari)
    const avgSpendPerDayFormula = `=IF(B3>0, B7/B3, 0)`;  // refs B7 (Total Pengeluaran, forward ref) / B3 (Total Hari)

    const summaryNameFormat = {
      textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 1, green: 1, blue: 1 } },
      backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE"
    };
    const summaryHeaderFormat = {
      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      backgroundColor: { red: 0.35, green: 0.35, blue: 0.35 },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE"
    };

    let summaryRows: any[] = [
      // Row 1 (index 0): Table name "Statistik Total"
      {
        values: [
          { userEnteredValue: { stringValue: "Statistik Total" }, userEnteredFormat: summaryNameFormat },
          { userEnteredValue: { stringValue: "" }, userEnteredFormat: summaryNameFormat }
        ]
      },
      // Row 2 (index 1): Column header
      {
        values: [
          { userEnteredValue: { stringValue: "Metrik" }, userEnteredFormat: summaryHeaderFormat },
          { userEnteredValue: { stringValue: "Nilai" }, userEnteredFormat: summaryHeaderFormat }
        ]
      },
      // Row 3 (index 2): Total Hari
      {
        values: [
          { userEnteredValue: { stringValue: "Total Hari" } },
          { userEnteredValue: { formulaValue: totalDaysFormula } }
        ]
      },
      // Row 4 (index 3): Total Transaksi
      {
        values: [
          { userEnteredValue: { stringValue: "Total Transaksi" } },
          { userEnteredValue: { formulaValue: totalTxFormula } }
        ]
      },
      // Row 5 (index 4): Rata-rata Tx Harian
      {
        values: [
          { userEnteredValue: { stringValue: "Rata-rata Transaksi Harian" } },
          { userEnteredValue: { formulaValue: avgTxPerDayFormula }, userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0.0" } } }
        ]
      },
      // Row 6 (index 5): Rata-rata Pengeluaran Harian
      {
        values: [
          { userEnteredValue: { stringValue: "Rata-rata Pengeluaran Harian" } },
          { userEnteredValue: { formulaValue: avgSpendPerDayFormula }, userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" } } }
        ]
      },
      // Row 7 (index 6): Total Pengeluaran
      {
        values: [
           { userEnteredValue: { stringValue: "Total Pengeluaran" } },
           { userEnteredValue: { formulaValue: sumFormula }, userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" } } }
        ]
      },
      // Rows 8-9 (indexes 7-8): 2-cell gap
      { values: [] },
      { values: [] },
      // Row 10 (index 9): Table name "Pengeluaran per Kategori"
      {
        values: [
          { userEnteredValue: { stringValue: "Pengeluaran per Kategori" }, userEnteredFormat: summaryNameFormat },
          { userEnteredValue: { stringValue: "" }, userEnteredFormat: summaryNameFormat }
        ]
      },
      // Row 11 (index 10): Column header
      {
        values: [
           { userEnteredValue: { stringValue: "Kategori" }, userEnteredFormat: summaryHeaderFormat },
           { userEnteredValue: { stringValue: "Total" }, userEnteredFormat: summaryHeaderFormat }
        ]
      }
    ];

    categories.forEach(cat => {
       let catFormula = "=0";
       if (activeMonthTabs.length > 0) {
         catFormula = "=" + activeMonthTabs.map(m => `IFERROR(SUMIF('${m}'!D:D, A${summaryRows.length + 1}, '${m}'!F:F), 0)`).join(" + ");
       }
       summaryRows.push({
         values: [
           { userEnteredValue: { stringValue: cat } },
           { userEnteredValue: { formulaValue: catFormula }, userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "[$Rp-421] #,##0" } } }
         ]
       });
    });

    // Apply center + middle alignment universally
    summaryRows = summaryRows.map((row: any) => ({
      values: row.values?.map((val: any) => ({
        ...val,
        userEnteredFormat: {
          ...val.userEnteredFormat,
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE"
        }
      })) || []
    }));

    // Pad with empty rows to clear out any remnant old text
    for (let i = 0; i < 5; i++) {
      summaryRows.push({ values: [] });
    }

    const updateSummaryReq: any = {
      requests: [
        // Unmerge banners first to avoid conflicts on re-sync
        { unmergeCells: { range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 } } },
        { unmergeCells: { range: { sheetId: summarySheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 } } },
        {
          updateCells: {
            range: { sheetId: summarySheetId, startRowIndex: 0, startColumnIndex: 0, endRowIndex: summaryRows.length, endColumnIndex: 2 },
            rows: summaryRows,
            fields: "userEnteredValue,userEnteredFormat"
          }
        },
        // Merge banner rows after writing
        { mergeCells: { range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: summarySheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 }, mergeType: "MERGE_ALL" } },
        {
          updateDimensionProperties: {
            range: { sheetId: summarySheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 2 },
            properties: { pixelSize: 220 }, // Wider columns for summary
            fields: "pixelSize"
          }
        }
      ]
    };

    // Summary tab: no frozen rows (freeze only applies to monthly tabs)
    updateSummaryReq.requests.push({
      updateSheetProperties: {
        properties: { sheetId: summarySheetId, gridProperties: { frozenRowCount: 0 } },
        fields: "gridProperties.frozenRowCount"
      }
    });

    // Delete old bandings (they may be at outdated positions) then re-add at new layout positions
    if (hasExistingBandings) {
      (summarySheetInfo?.bandedRanges || []).forEach((bnd: any) => {
        if (bnd.bandedRangeId !== undefined) {
          updateSummaryReq.requests.push({ deleteBanding: { bandedRangeId: bnd.bandedRangeId } });
        }
      });
    }
    // Stats banding: header at row 2 (0-indexed 1), data rows 3-7
    updateSummaryReq.requests.push({
      addBanding: {
        bandedRange: {
          range: { sheetId: summarySheetId, startRowIndex: 1, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 2 },
          rowProperties: {
            headerColor: { red: 0.2, green: 0.2, blue: 0.2 },
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.96, green: 0.96, blue: 0.96 }
          }
        }
      }
    });
    // Kategori banding: header at row 11 (0-indexed 10), data rows 12+
    updateSummaryReq.requests.push({
      addBanding: {
        bandedRange: {
          range: { sheetId: summarySheetId, startRowIndex: 10, endRowIndex: 11 + categories.length, startColumnIndex: 0, endColumnIndex: 2 },
          rowProperties: {
            headerColor: { red: 0.2, green: 0.2, blue: 0.2 },
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.96, green: 0.96, blue: 0.96 }
          }
        }
      }
    });

    const pieChartSpec = {
      title: "Alokasi Pengeluaran (%)",
      pieChart: {
        domain: {
          // Categories now at rows 12+ (0-indexed 11+)
          sourceRange: { sources: [{ sheetId: summarySheetId, startRowIndex: 11, endRowIndex: 11 + categories.length, startColumnIndex: 0, endColumnIndex: 1 }] }
        },
        series: {
          sourceRange: { sources: [{ sheetId: summarySheetId, startRowIndex: 11, endRowIndex: 11 + categories.length, startColumnIndex: 1, endColumnIndex: 2 }] }
        }
      }
    };

    if (existingCharts.length > 0) {
      updateSummaryReq.requests.push({
        updateChartSpec: {
          chartId: existingCharts[0].chartId,
          spec: pieChartSpec
        }
      });
    } else {
      updateSummaryReq.requests.push({
        addChart: {
          chart: {
            spec: pieChartSpec,
            position: { overlayPosition: { anchorCell: { sheetId: summarySheetId, rowIndex: 0, columnIndex: 3 } } }
          }
        }
      });
    }

    const summaryUpdateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updateSummaryReq)
    });
    if (!summaryUpdateRes.ok) {
       const err = await summaryUpdateRes.json();
       console.error("SummaryReq failed:", err);
       throw new Error(`SummaryReq Error: ${err.error?.message || JSON.stringify(err)}`);
    }

    log(`File Google Sheets untuk tahun ${year} sudah terupdate.`);
  }

  if (hasUpdates) {
    log("Menyimpan status sinkronisasi ke database...");
    await batchUpdateFirestore.commit();
    return `Berhasil menyinkronkan ${totalSynced} transaksi baru!`;
  }
  
  return "Semua data sudah tersinkronisasi pada Google Sheets (tidak ada transaksi baru).";
}
