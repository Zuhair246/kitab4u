const Orders = require('../../models/orderSchema');
const { getDateFilter } = require('../../helpers/salesHelper')

const loadDashboard = async (req, res) => {
    try {
        const [dashboardData] = await Orders.aggregate([
            { $unwind: '$orderedItems' },
            { $match: { "orderedItems.itemStatus" : "Delivered" } },
            {
                $group: {
                    _id: "$orderedItems.product",
                    totalSoldQuantity: { $sum: "$orderedItems.quantity" }
                }
            },
            { 
                $facet: {
                    
                    topProducts: [
                        { $sort: { totalSoldQuantity: -1 } },
                        { $limit: 10 },
                        { 
                            $lookup: {
                                from: "products",
                                localField: "_id",
                                foreignField: "_id",
                                as: "product"
                            }
                        },
                        { $unwind: "$product" },
                        {
                            $project: {
                                _id: 0,
                                productName: "$product.name",
                                totalSoldQuantity: 1
                            }
                        }
                    ],

                    topCategories: [
                        { $sort: { totalSoldQuantity: -1 } },
                        {
                            $lookup: {
                                from: "products",
                                localField: "_id",
                                foreignField: "_id",
                                as: "product"
                            }
                        },
                        { $unwind: "$product" },
                        {
                            $group: {
                                _id: "$product.categoryId",
                                topProductCount: { $sum: 1 }
                            }
                        },
                        { $sort: { topProductCount: -1 } },
                        {
                            $lookup: {
                                from: "categories",
                                localField: "_id",
                                foreignField: "_id",
                                as: "category"
                            }
                        },
                        { $unwind: "$category" },
                        {
                            $project: {
                                categoryName: "$category.name",
                                topProductCount: 1
                            }
                        }
                    ]
            } 
        }
        ]);
        
        return res.status(200).render('dashboard', {
            topProducts: dashboardData.topProducts,
            topCategories: dashboardData.topCategories
        })
        
    } catch (error) {
        const err = new Error("Admin Dashboard load error");
        throw err;
    }
}
const chartDataController = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const dateFilter = await getDateFilter(range, startDate, endDate);

        const orders = await Order.find(dateFilter)
            .sort({ createdAt: 1 })  // ascending for chart
            .lean();

        let labels = [];
        let data = [];

        orders.forEach(order => {
            labels.push(order.createdAt.toLocaleDateString());
            data.push(order.finalPayableAmount ?? order.finalAmount);
        });

        return res.json({ labels, data });

    } catch (error) {
        const err = new Error("Chart report load server error");
        err.redirect = "/admin/salesReport?error=Server error";
        throw err;
    }
};

module.exports = {
    loadDashboard
}

