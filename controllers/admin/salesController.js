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

        // get all sales (NO pagination)
        const sales = await Order.find(dateFilter)
            .populate("userId", "name")
            .sort({ createdAt: -1 })
            .lean();

        const doc = new PDFDocument({ margin: 30 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=sales_report.pdf");

        doc.pipe(res);

        doc.fontSize(20).text("Sales Report", { align: "center" });
        doc.moveDown();

        sales.forEach((sale) => {
            doc.fontSize(12).text(`Order ID: ${sale.orderId}`);
            doc.text(`Customer: ${sale.userId?.name || "-"}`);
            doc.text(`Final Amount: ₹${sale.finalPayableAmount}`);
            doc.text(`Date: ${sale.createdAt.toLocaleDateString()}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
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
            .sort({ createdAt: -1 })
            .lean();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Sales Report");

        sheet.columns = [
            { header: "Order ID", key: "id", width: 35 },
            { header: "Customer Name", key: "name", width: 20 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Date", key: "date", width: 20 }
        ];

        sheet.getRow(1).eachCell((cell)=>{
            cell.font = { bold: true }
        })

        sales.forEach((sale) => {
            sheet.addRow({
                id: sale.orderId,
                name: sale.userId?.name || "-",
                amount: sale.finalPayableAmount + '/-',
                date: sale.createdAt.toLocaleDateString(),
            });
        });

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