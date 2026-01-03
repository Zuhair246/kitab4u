import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import { getDateFilter, getKPIData } from '../../helpers/salesHelper.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const loadSales = async (req, res) => {
    try {
        let { range, startDate, endDate } = req.query;
        
        startDate = startDate ? new Date(startDate) : null;
        endDate = endDate ? new Date(endDate) : null;

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if( startDate && startDate > today || endDate && endDate > today ) {
            return res.redirect(`/admin/salesReport?error=${encodeURIComponent("Dates should not be future!")}`);
        }
        if( startDate && endDate && startDate > endDate ){
            return res.redirect(`/admin/salesReport?error=${encodeURIComponent("End date should not be before start date!")}`);
        }

        const dateFilter = await getDateFilter(range, startDate, endDate);

        const kpis = await getKPIData(dateFilter);

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalOrdersCount = await Order.countDocuments(dateFilter);

        const detailed = await Order.find(dateFilter)
                                                    .populate("userId" , "name email")
                                                    .sort( { createdAt: -1 } )
                                                    .skip(skip)
                                                    .limit(limit)
                                                    .lean();
        
        const totalPages = Math.ceil(totalOrdersCount / limit);
        
        const usersCalc = await User.aggregate([ { $match:{ isAdmin: false } }, { $count:'users' } ] );
        const totalCustomers = usersCalc[0]?.users || 0;

        const totalAmount = detailed.reduce( (sum, price) => {
            return sum + ( price.finalPayableAmount || 0 ) ;
        }, 0);

        const totalDiscount = detailed.reduce( (sum, disc) => {
            return sum + ( disc.discount || 0 );
        }, 0);

        const salesTrend = await Order.aggregate([
            {
                $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                total: { $sum: "$finalPayableAmount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.render('salesReport', {
            salesTrend,
            kpis,
            detailed,
            totalCustomers,
            totalAmount,
            totalDiscount,
            pagination: {
                total: totalOrdersCount,
                page,
                limit,
                totalPages
            },
            range,
            startDate,
            endDate
        })
    } catch (error) {
        const err = new Error("Load Sales Report server error!");
        throw err;
    }
}

const downloadSalesPDF = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const dateFilter = await getDateFilter(range, startDate, endDate);

    const doc = new PDFDocument({ size: "A4", margin: 30 });

    const sales = await Order.find(dateFilter)
      .populate("userId", "name")
      .populate("orderedItems.product", "name")
      .sort({ createdAt: -1 })
      .lean();

    const kpi = await getKPIData(dateFilter);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales_report.pdf"
    );

    doc.pipe(res);

    doc
  .fontSize(18)
  .font("Helvetica-Bold")
  .text("KITAB4U", { align: "left" });

doc
  .fontSize(10)
  .font("Helvetica")
  .fillColor("#555")
  .text("Online Book Store", { align: "left" });

doc.moveDown(0.5);
doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke("#ccc");
doc.moveDown(1);

    // -------------------------------
    // TITLE
    // -------------------------------
    doc.fontSize(22).fillColor("#000").text("Sales Report", { align: "center" });
    doc.moveDown(1.5);

    // -------------------------------
    // TABLE CONFIG
    // -------------------------------
    let y = doc.y + 10;
    const rowHeight = 22;

    const col = {
      date: 70,
      id: 85,
      customer: 90,
      product: 120,
      amount: 65,
      payment: 70,
      status: 65
    };

    const startX = 30;
    const totalWidth = Object.values(col).reduce((a, b) => a + b, 0);

    // -------------------------------
    // TABLE HEADER
    // -------------------------------
    doc.rect(startX, y, totalWidth, rowHeight).fill("#1e40af");
    doc.fillColor("white").fontSize(8);

    let x = startX;
    doc.text("Date", x + 3, y + 7); x += col.date;
    doc.text("Order ID", x + 3, y + 7); x += col.id;
    doc.text("Customer", x + 3, y + 7); x += col.customer;
    doc.text("Product", x + 3, y + 7); x += col.product;
    doc.text("Amount", x + 3, y + 7); x += col.amount;
    doc.text("Payment", x + 3, y + 7); x += col.payment;
    doc.text("Status", x + 3, y + 7);

    y += rowHeight;

    // -------------------------------
    // TABLE ROWS
    // -------------------------------
    sales.forEach(order => {
      order.orderedItems.forEach((item, i) => {

        const isEven = i % 2 === 0;
        doc.rect(startX, y, totalWidth, rowHeight)
           .fill(isEven ? "#f1f5f9" : "#ffffff");

        doc.fillColor("#000").fontSize(8);

        let cx = startX;

        doc.text(
          new Date(order.createdAt).toLocaleDateString(),
          cx + 3, y + 6
        ); cx += col.date;

        doc.text(order.orderId, cx + 3, y + 6); cx += col.id;

        doc.text(order.userId?.name || "-", cx + 3, y + 6, {
          width: col.customer - 5
        }); cx += col.customer;

        doc.text(
          item.product?.name || item.name || "-",
          cx + 3, y + 6,
          { width: col.product - 5 }
        ); cx += col.product;

        doc.text(`Rs: ${item.salePrice}/-`, cx + 3, y + 6); cx += col.amount;

        doc.text(order.paymentMethod || "-", cx + 3, y + 6); cx += col.payment;

        doc.text(order.status || "-", cx + 3, y + 6);

        y += rowHeight;

        // Page break
        if (y > doc.page.height - 120) {
          doc.addPage();
          y = 40;
        }
      });
    });

    // -------------------------------
    // SUMMARY SECTION
    // -------------------------------
    doc.addPage();
    doc.moveDown(1);

    doc.fontSize(18).fillColor("#000")
      .text("Sales Summary", { align: "center" });
    doc.moveDown(1.5);

    const summaryX = 120;
    let sy = doc.y;

    const drawSummaryRow = (label, value, color) => {
      doc.rect(100, sy, 350, 28).fill(color);
      doc.fillColor("#000").fontSize(11).text(label, 120, sy + 8);
      doc.font("Helvetica-Bold")
         .text(value, 330, sy + 8, { align: "right" });
      doc.font("Helvetica");
      sy += 32;
    };

    drawSummaryRow("Gross Revenue", `Rs: ${kpi.grossRevenue.toFixed(2)}`, "#e0f2fe");
    drawSummaryRow("Shipping Charges", `Rs: ${kpi.totalShippingCharge.toFixed(2)}`, "#f8fafc");
    drawSummaryRow(
      "Total Discount",
      `Rs: ${(kpi.totalDiscountFromOffers + kpi.totalCouponDiscount).toFixed(2)}`,
      "#fee2e2"
    );
    drawSummaryRow("Net Revenue", `Rs: ${kpi.netRevenue.toFixed(2)}`, "#dcfce7");

    doc.end();

  } catch (error) {
    console.error(error);
    const err = new Error("PDF download server error");
    err.redirect = "/admin/salesReport?error=Server error";
    throw err;
  }
};

const downloadSalesExcel = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const dateFilter = await getDateFilter(range, startDate, endDate);

    const sales = await Order.find(dateFilter)
      .populate("userId", "name")
      .populate("orderedItems.product", "name variants.coverType")
      .sort({ createdAt: -1 })
      .lean();

      const kpi = await getKPIData(dateFilter);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    // -----------------------------
    // COLUMN DEFINITIONS (A–D)
    // -----------------------------
    sheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Order Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 20 },

      { header: "Product", key: "product", width: 30 },
      { header: "Cover Type", key: "coverType", width: 15 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Item Status", key: "itemStatus", width: 15 },
      { header: "Return Reason", key: "returnReason", width: 25 },

      { header: "Gross Amount", key: "gross", width: 15 },
      { header: "Offer Discount", key: "discount", width: 15 },
      { header: "Net Amount", key: "net", width: 15 },

      { header: "Payment Method", key: "payment", width: 18 },
      { header: "Order Status", key: "orderStatus", width: 15 }
    ];

    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true };
    });

    // -----------------------------
    // ROW DATA
    // -----------------------------
    sales.forEach(order => {
      order.orderedItems.forEach(item => {
        const gross = item.salePrice * item.quantity;
        const discount = (item.price - item.salePrice) * item.quantity;
        const net = item.price * item.quantity;

        sheet.addRow({
          orderId: order.orderId,
          date: order.createdAt.toLocaleDateString(),
          customer: order.userId?.name || "-",

          product: item.product?.name || "-",
          coverType: item.coverType || "-",
          quantity: item.quantity,
          itemStatus: item.itemStatus || "-",
          returnReason: item.returnReason || "-",

          gross: `₹${gross.toFixed(2)}`,
          discount: `₹${discount.toFixed(2)}`,
          net: `₹${net.toFixed(2)}`,

          payment: order.paymentMethod,
          orderStatus: order.status
        });
      });
    });

    // -----------------------------
    // SUMMARY SECTION
    // -----------------------------
    sheet.addRow({});
    const summaryRow = sheet.addRow({ product: "TOTAL SUMMARY" });
    summaryRow.font = { 
        bold: true,
        size: 20,
        color: { argb: "FFFFFFF"}
    };
    summaryRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF343A40" }
    };

    const grossRow = sheet.addRow({
      product: "Gross Revenue:",
      gross: `₹${kpi.grossRevenue.toFixed(2)}`
    });

    grossRow.font = { 
        size: 14,
        color: { argb: "FF0D6EFD"}
    };
    grossRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFCCE5FF" }
    }

    const ShippingRow = sheet.addRow({
        product: "Total Shipping Charge:",
        gross: `₹${kpi.totalShippingCharge.toFixed(2)}`
    });

    ShippingRow.font = { 
        size: 14,
        color: { argb: "00000" }
    };
    ShippingRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8F9FA" }
    }

    const discountRow = sheet.addRow({
      product: "Total Discount:",
      gross: `₹${(kpi.totalDiscountFromOffers + kpi.totalCouponDiscount).toFixed(2)}`
    });

    discountRow.font = { 
        size: 14,
        color: { argb: "FF721C24" }
    };
    discountRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8D7DA" }
    }

    const netRow = sheet.addRow({
      product: "Net Revenue:",
      gross: `₹${kpi.netRevenue.toFixed(2)}`
    });
    
    netRow.font = { 
        size: 14,
        color: { argb: "FF155724" }
    };
    netRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD4EDDA" }
    }

    // -----------------------------
    // RESPONSE
    // -----------------------------
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales_report.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(error);
    const err = new Error("Excel download server error");
    err.redirect = "/admin/salesReport?error=Server error";
    throw err;
  }
};

export default {
    loadSales,
    downloadSalesPDF,
    downloadSalesExcel,
}