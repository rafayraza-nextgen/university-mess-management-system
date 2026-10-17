import { jsPDF } from "jspdf";
// jspdf-autotable v5 exports a standalone `autoTable(doc, options)` function.
// The old v3/v4 prototype-patching style (`doc.autoTable(...)`) is no longer
// applied automatically under Vite/ESM (it only auto-patches if a `window.jsPDF`
// global exists), so the function form must be used explicitly.
import { autoTable } from "jspdf-autotable";

/**
 * Generates and downloads a formal University Mess billing memo as PDF.
 *
 * @param {Object} params - Invoice generation parameters
 * @param {Object} params.student - Student profile { full_name, student_id, email }
 * @param {Object} params.invoice - Invoice record { billing_month, total_amount, payment_status, created_at }
 * @param {Array} params.ledger - Array of ledger entries for the month { date, mealType, mainDish, price, status }
 * @param {Object} params.totals - Calculated totals { consumedTotal, paidTotal, balanceDue, mealCount }
 * @param {string} params.universityName - University name (default: "University Mess Administration")
 * @param {string} params.generatedBy - System/admin identifier (default: "Mess Administration System")
 */
export function generateBillingMemoPDF({
  student,
  invoice,
  ledger = [],
  totals = {},
  universityName = "UNIVERSITY MESS ADMINISTRATION",
  generatedBy = "Mess Administration System",
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // ============================================================
  // COLOR PALETTE (Professional academic/administrative theme)
  // ============================================================
  const colors = {
    primary: [15, 23, 42],       // slate-950
    secondary: [51, 65, 85],     // slate-700
    accent: [30, 64, 175],       // blue-800
    accentLight: [219, 234, 254], // blue-50
    text: [30, 41, 59],          // slate-800
    textLight: [100, 116, 139],  // slate-500
    border: [203, 213, 225],     // slate-300
    tableHeader: [15, 23, 42],   // slate-950
    tableAltRow: [248, 250, 252], // slate-50
    success: [22, 101, 52],      // emerald-800
    danger: [153, 27, 27],       // red-800
    warning: [146, 64, 14],      // amber-800
  };

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================
  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatMonthLabel = (billingMonth) => {
    // billing_month stored as "YYYY-MM" or "Month YYYY"
    if (!billingMonth) return "—";
    if (billingMonth.includes("-")) {
      const [year, month] = billingMonth.split("-");
      return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    return billingMonth;
  };

  const drawLine = (y, color = colors.border, width = 0.5) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const addText = (text, x, y, options = {}) => {
    const { size = 10, color = colors.text, style = "normal", align = "left" } = options;
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont("helvetica", style);
    doc.text(text, x, y, { align });
  };

  // ============================================================
  // HEADER SECTION
  // ============================================================
  let y = margin - 2;

  // University Crest/Logo placeholder (rectangle)
  doc.setFillColor(...colors.accent);
  doc.roundedRect(pageWidth / 2 - 12, y, 24, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("UM", pageWidth / 2, y + 7, { align: "center" });

  y += 25;

  // University Name
  addText(universityName.toUpperCase(), pageWidth / 2, y, {
    size: 16,
    color: colors.primary,
    style: "bold",
    align: "center",
  });

  y += 6;

  // Horizontal rule
  drawLine(y, colors.accent, 1.2);
  y += 6;

  // "MEMORANDUM" label
  addText("M E M O R A N D U M", pageWidth / 2, y, {
    size: 14,
    color: colors.accent,
    style: "bold",
    align: "center",
  });

  y += 10;

  // ============================================================
  // MEMO METADATA BLOCK
  // ============================================================
  const metaStartY = y;
  const labelX = margin;
  const valueX = margin + 55;
  const lineHeight = 6;

  const metaFields = [
    { label: "Date:", value: formatDate(new Date()) },
    { label: "To:", value: `${student?.full_name || "Student"} (${student?.student_id || "—"})` },
    { label: "From:", value: "Mess Administrator" },
    { label: "Subject:", value: `Monthly Billing Report — ${formatMonthLabel(invoice?.billing_month)}` },
  ];

  metaFields.forEach((field) => {
    addText(field.label, labelX, y, { size: 10, color: colors.secondary, style: "bold" });
    addText(field.value, valueX, y, { size: 10, color: colors.text, style: "normal" });
    y += lineHeight;
  });

  y += 4;
  drawLine(y, colors.border, 0.4);
  y += 6;

  // ============================================================
  // INTRODUCTORY BODY TEXT
  // ============================================================
  const introText = `This memorandum serves as the official billing statement for the billing period ending ${formatMonthLabel(invoice?.billing_month)}. The following summary details all meal charges incurred, payments received, and the current balance due on your mess account.`;
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.setFontSize(10);
  doc.setTextColor(...colors.text);
  doc.setFont("helvetica", "normal");
  doc.text(splitIntro, margin, y);
  y += splitIntro.length * 5 + 6;

  // ============================================================
  // SUMMARY BOXES (Key Figures)
  // ============================================================
  const boxWidth = (contentWidth - 10) / 3;
  const boxHeight = 22;
  const boxY = y;

  const summaryItems = [
    { label: "Meals Consumed", value: formatCurrency(totals.consumedTotal), color: colors.accent },
    { label: "Payments Received", value: formatCurrency(totals.paidTotal), color: colors.success },
    { label: "Balance Due", value: formatCurrency(totals.balanceDue), color: totals.balanceDue > 0 ? colors.danger : colors.success },
  ];

  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * (boxWidth + 5);
    // Box background
    doc.setFillColor(...item.color[0] === colors.accent[0] ? colors.accentLight : (item.color[0] === colors.success[0] ? [209, 250, 229] : [254, 242, 242]));
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, "F");
    // Label
    addText(item.label, boxX + boxWidth / 2, boxY + 7, { size: 8, color: colors.textLight, align: "center" });
    // Value
    addText(item.value, boxX + boxWidth / 2, boxY + 16, { size: 14, color: item.color, style: "bold", align: "center" });
  });

  y = boxY + boxHeight + 10;

  // ============================================================
  // DETAILED LEDGER TABLE (single table — totals live in the footer)
  //
  // The totals are NOT a second autoTable. They are rows in this table's
  // `foot` array, so the column widths are computed exactly once and the
  // amounts align perfectly under the "Amount" column. Each label cell uses
  // `colSpan` to push its value into the final right-aligned column.
  // ============================================================
  if (ledger && ledger.length > 0) {
    addText("Detailed Meal Charges", margin, y, { size: 12, color: colors.primary, style: "bold" });
    y += 6;

    const tableData = ledger.map((entry, idx) => [
      idx + 1,
      formatDate(entry.date),
      entry.mealType,
      entry.mainDish || "—",
      entry.status || "Consumed",
      formatCurrency(entry.price),
    ]);

    // The balance color applies only to its own footer cell, overriding the
    // default footer text color set in footStyles below.
    const balanceColor = totals.balanceDue > 0 ? colors.danger : colors.success;

    // Footer rows. The 6 columns are: # | Date | Meal | Dish | Status | Amount.
    //   Row 1 spans 4 (label) + Status (count) + Amount (money).
    //   Rows 2-3 span 5 (label) + Amount (money).
    // Every cell forces a white fill so the striped body theme cannot bleed in.
    const totalsFooter = [
      [
        {
          content: "Total Meals Consumed",
          colSpan: 4,
          styles: { halign: "right", fontStyle: "bold", fillColor: [255, 255, 255] },
        },
        {
          content: String(totals.mealCount || ledger.length),
          styles: { halign: "center", fontStyle: "bold", fillColor: [255, 255, 255] },
        },
        {
          content: formatCurrency(totals.consumedTotal),
          styles: { halign: "right", fontStyle: "bold", fillColor: [255, 255, 255] },
        },
      ],
      [
        {
          content: "Total Payments Received",
          colSpan: 5,
          styles: { halign: "right", fontStyle: "bold", fillColor: [255, 255, 255] },
        },
        {
          content: formatCurrency(totals.paidTotal),
          styles: { halign: "right", fontStyle: "bold", fillColor: [255, 255, 255] },
        },
      ],
      [
        {
          content: "Balance Due",
          colSpan: 5,
          styles: { halign: "right", fontStyle: "bold", fillColor: [255, 255, 255] },
        },
        {
          content: formatCurrency(totals.balanceDue),
          styles: {
            halign: "right",
            fontStyle: "bold",
            textColor: balanceColor,
            fillColor: [255, 255, 255],
          },
        },
      ],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Date", "Meal", "Dish", "Status", "Amount"]],
      body: tableData,
      foot: totalsFooter,
      theme: "striped",
      styles: {
        fontSize: 9,
        font: "helvetica",
        textColor: colors.text,
        lineColor: colors.border,
        lineWidth: 0.2,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: colors.tableHeader,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
      },
      // The totals band: clean white background with bold text, visually
      // separated from the striped body rows above it.
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: colors.primary,
        fontStyle: "bold",
        fontSize: 9,
        lineColor: colors.border,
        lineWidth: 0.2,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: colors.tableAltRow,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },   // #
        1: { cellWidth: 28, halign: "center" },   // Date
        2: { cellWidth: 25, halign: "center" },   // Meal
        3: { cellWidth: "auto" },                 // Dish
        4: { cellWidth: 25, halign: "center" },   // Status
        5: { cellWidth: 30, halign: "right" },    // Amount
      },
      didDrawPage: (data) => {
        // Footer on each table page
        doc.setFontSize(7);
        doc.setTextColor(...colors.textLight);
        doc.text(
          `Generated by ${generatedBy} on ${formatDate(new Date())}`,
          margin,
          pageHeight - 6
        );
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          pageWidth - margin,
          pageHeight - 8,
          { align: "right" }
        );
      },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ============================================================
  // PAYMENT STATUS BADGE
  // ============================================================
  if (invoice?.payment_status) {
    const status = invoice.payment_status;
    const isPaid = status.toLowerCase() === "paid";
    const badgeColor = isPaid ? colors.success : colors.warning;
    const badgeBg = isPaid ? [209, 250, 229] : [254, 243, 199];

    doc.setFillColor(...badgeBg);
    doc.roundedRect(pageWidth / 2 - 30, y, 60, 10, 2, 2, "F");
    addText(`Payment Status: ${status.toUpperCase()}`, pageWidth / 2, y + 6.5, {
      size: 10,
      color: badgeColor,
      style: "bold",
      align: "center",
    });
    y += 18;
  }

  // ============================================================
  // FOOTER / SIGN-OFF
  // ============================================================
  drawLine(y, colors.primary, 0.8);
  y += 8;

  // Sign-off lines
  addText("This is a system-generated document and does not require a physical signature.", pageWidth / 2, y, {
    size: 8,
    color: colors.textLight,
    align: "center",
  });
  y += 6;

  addText("Mess Administrator", pageWidth / 2, y, {
    size: 11,
    color: colors.primary,
    style: "bold",
    align: "center",
  });
  y += 5;

  addText(universityName, pageWidth / 2, y, {
    size: 9,
    color: colors.textLight,
    align: "center",
  });
  y += 5;

  addText(`Generated on ${formatDate(new Date())} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, y, {
    size: 7,
    color: colors.textLight,
    align: "center",
  });
  y += 5;

  // Document ID / Reference
  const docRef = `INV-${invoice?.billing_month?.replace(/[^0-9]/g, "") || "0000"}-${(student?.student_id || "STU").toUpperCase()}`;
  addText(`Document Reference: ${docRef}`, pageWidth / 2, y, {
    size: 7,
    color: colors.textLight,
    align: "center",
  });

  // ============================================================
  // PAGE BORDER (optional professional touch)
  // ============================================================
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // ============================================================
  // SAVE / DOWNLOAD
  // ============================================================
  const fileName = `mess-billing-${invoice?.billing_month?.replace(/\s+/g, "-") || "report"}-${student?.student_id || "student"}.pdf`;
  doc.save(fileName);
}

/**
 * Convenience wrapper for use in StudentDashboard.jsx
 * Fetches required data and calls generateBillingMemoPDF
 */
export async function downloadInvoicePDF(supabase, studentId, invoice, ledger, totals) {
  // Fetch student profile
  const { data: student } = await supabase
    .from("users")
    .select("full_name, student_id, email")
    .eq("id", studentId)
    .single();

  generateBillingMemoPDF({
    student,
    invoice,
    ledger,
    totals,
  });
}