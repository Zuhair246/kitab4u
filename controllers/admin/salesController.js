const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const { getDateFilter, getKPIData } = require('../../helpers/salesHelper');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const loadSales = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const dateFilter = await getDateFilter(range, startDate, endDate);

        const kpis = await getKPIData(dateFilter);

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

const filterSales = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.body;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const dateFilter = await getDateFilter( range, startDate, endDate );

        const totalOrders = await Order.countDocuments(dateFilter);

        const sales = await Order.find(dateFilter)
                                                .populate("userId" , "name")
                                                .sort({ createdAt: -1 })
                                                .skip(skip)
                                                .limit(limit)
                                                .lean();

        const totalPages = Math.ceil( totalOrders / limit );

        return res.json({
            success: true,
            currentPage: page,
            totalPages,
            totalOrders,
            limit,
            sales,
            range,
            startDate,
            endDate
        });
    } catch (error) {
        const err = new Error("Sales report filter server error");
        err.redirect = "/admin/salesReport?error=Server error";
        throw err;
    }
}

const downloadSalesPDF = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const dateFilter = await getDateFilter(range, startDate, endDate);

        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({ margin: 20 });

        // Fetch orders + user + items
        const sales = await Order.find(dateFilter)
            .populate("userId", "name")
            .populate("orderedItems.product", "title name")
            .sort({ createdAt: -1 })
            .lean();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=sales_report.pdf");

        doc.pipe(res);

        // -------------------------------
        // TITLE
        // -------------------------------
        doc.fontSize(22).fillColor("#000").text("Sales Report", { align: "center" });
        doc.moveDown(1.5);

        // Table positions
        const tableTop = 130;
        let y = tableTop;

        const rowHeight = 30;

        // Column widths
        const col = {
            id: 100,
            product: 120,
            amount: 70,
            discount: 70,
            date: 80,
            payment: 80,
            status: 70
        };

        const totalWidth =
            col.id + col.product + col.amount + col.discount +
            col.date + col.payment + col.status;

        // -------------------------------
        // TABLE HEADER
        // -------------------------------
        doc.rect(30, y, totalWidth, rowHeight).fill("#1e40af");

        doc.fillColor("white").fontSize(8);
        doc.text("Order ID", 35, y + 10);
        doc.text("Product", 35 + col.id , y + 10);
        doc.text("Amount", 35 + col.id  + col.product, y + 10);
        doc.text("Discount", 35 + col.id  + col.product + col.amount, y + 10);
        doc.text("Date", 35 + col.id  + col.product + col.amount + col.discount, y + 10);
        doc.text("Payment", 35 + col.id  + col.product + col.amount + col.discount + col.date, y + 10);
        doc.text("Status", 35 + col.id  + col.product + col.amount + col.discount + col.date + col.payment, y + 10);

        y += rowHeight;

        // -------------------------------
        // TABLE ROWS (multiple items per order)
        // -------------------------------
        sales.forEach((sale) => {
            sale.orderedItems.forEach((item, i) => {
                const isEvenRow = (i % 2 === 0);

                // Background color
                doc.rect(30, y, totalWidth, rowHeight).fill(isEvenRow ? "#f1f5f9" : "#ffffff");

                const productName =
                    item.product?.title ||
                    item.product?.name ||
                    item.name ||
                    "-";

                doc.fillColor("black").fontSize(8);

                doc.text(sale.orderId, 35, y + 10);
                doc.text(productName, 35 + col.id , y + 10);

                doc.text(`Rs: ${item.salePrice}/-`, 35 + col.id  + col.product, y + 10);
                doc.text(
                    `Rs: ${(item.price - item.salePrice).toFixed(2)}/-`,
                    35 + col.id  + col.product + col.amount,
                    y + 10
                );

                doc.text(
                    new Date(sale.createdAt).toLocaleDateString(),
                    35 + col.id  + col.product + col.amount + col.discount,
                    y + 10
                );

                doc.text(
                    sale.paymentMethod || "-",
                    35 + col.id  + col.product + col.amount + col.discount + col.date,
                    y + 10
                );

                doc.text(
                    sale.status || "-",
                    35 + col.id  + col.product + col.amount + col.discount + col.date + col.payment,
                    y + 10
                );

                y += rowHeight;

                // Page break logic
                if (y > doc.page.height - 50) {
                    doc.addPage();
                    y = 50;
                }
            });
        });

        doc.end();

    } catch (error) {
        console.log(error);
        
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
            .populate("orderedItems.product", "name")
            .sort({ createdAt: -1 })
            .lean();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Sales Report");

        sheet.columns = [
            { header: "Order ID", key: "id", width: 20 },
            { header: "Customer Name", key: "name", width: 20 },
            { header: "Product", key: "product", width: 30 },
            { header: "Paid Amount", key: "amount", width: 20 },
            { header: "Discount", key: "discount", width: 15 },
            { header: "Date", key: "date", width: 20 },
            { header: "Payment Method", key: "payment", width: 20 },
            { header: "Status", key: "status", width: 15 },
        ];

        sheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true };
        });

        sales.forEach(sale => {
            sale.orderedItems.forEach(item => {
                sheet.addRow({
                    id: sale.orderId,
                    name: sale.userId?.name || "-",
                    product: item.product?.name || "-",
                    amount: `₹${item.salePrice}/-`,
                    discount: `₹${(item.price - item.salePrice).toFixed(2)}/-`,
                    date: sale.createdAt.toLocaleDateString(),
                    payment: sale.paymentMethod,
                    status: sale.status
                });
            });
        });

        res.setHeader("Content-Disposition", "attachment; filename=sales_report.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.log(error);
        
        const err = new Error("Excel download server error");
        err.redirect = "/admin/salesReport?error=Server error";
        throw err;
    }
};


module.exports ={
    loadSales,
    filterSales,
    downloadSalesPDF,
    downloadSalesExcel,
}