import Orders from '../../models/orderSchema.js';

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

const chartData = async (req, res) => {
  try {
    const { range } = req.query;
    const now = new Date();

    let matchStage = {};
    let groupStage = {};
    let labels = [];

    if (range === "today") {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      matchStage = { createdAt: { $gte: from, $lte: now } };

      groupStage = {
        _id: { $dateToString: { format: "%H", date: "$createdAt" } },
        totalSales: { $sum: "$finalPayableAmount" }
      };

      labels = ["00","01","02","03","04","05","06","07","08","09","10","11",
                "12","13","14","15","16","17","18","19","20","21","22","23"];
    }

    if (range === "daily") {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);

      matchStage = { createdAt: { $gte: from, $lte: now } };

      groupStage = {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$finalPayableAmount" }
      };

      labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        return d.toISOString().slice(0, 10); 
      });
    }

if (range === "weekly") {
  const from = new Date();
  from.setDate(from.getDate() - 28);

  matchStage = { createdAt: { $gte: from, $lte: new Date() } };

  groupStage = {
    _id: {
      $concat: [
        "Week ",
        { $toString: { $isoWeek: "$createdAt" } }
      ]
    },
    totalSales: { $sum: "$finalPayableAmount" }
  };


  labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
}

    if (range === "monthly") {
      const from = new Date(now);
      from.setMonth(now.getMonth() - 11);
      from.setDate(1);

      matchStage = { createdAt: { $gte: from, $lte: now } };

      groupStage = {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        totalSales: { $sum: "$finalPayableAmount" }
      };

      labels = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(from);
        d.setMonth(from.getMonth() + i);
        return d.toISOString().slice(0, 7); 
      });
    }

if (range === "yearly") {
  matchStage = {};

  groupStage = {
    _id: { $dateToString: { format: "%Y", date: "$createdAt" } },
    totalSales: { $sum: "$finalPayableAmount" }
  };

  labels = [];
}

    const salesData = await Orders.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { _id: 1 } }
    ]);

    const salesMap = {};
    salesData.forEach(item => {
      salesMap[item._id] = item.totalSales;
    });

    const data = labels.length
      ? labels.map(label => salesMap[label] || 0)
      : salesData.map(i => i.totalSales);

    return res.status(200).json({ labels, data });

  } catch (error) {
    console.log("Chart Error:", error);
    res.status(500).json({ message: "Chart load failed" });
  }
};

export default {
    loadDashboard,
    chartData
}

