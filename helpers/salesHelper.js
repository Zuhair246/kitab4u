const Order = require('../models/orderSchema');

const getDateFilter = async function getDateFilter( range, startDate, endDate ) {
    try {
        const now = new Date();
        let from, to;

        switch ( range ) {
            case "daily":
                from = new Date(now);
                from.setHours(0, 0, 0, 0);
                to = new Date(now);
                to.setHours(23,59,59,999);
                break;

            case "weekly":
                from = new Date(now.getTime() - 7*24*60*60*1000);
                to = now;
                break;

            case "monthly":
                from = new Date(now);
                from.setMonth(now.getMonth() - 1);
                to =now;
                break;

            case "yearly":
                from = new Date(now);
                from.setFullYear(now.getFullYear() - 1);
                to = now;
                break;

            case "custom":
                from = new Date(startDate);
                to = new Date(endDate);
                break;

            default:
                from = new Date(0);
                to = now;
        }

        return { createdAt: { $gte: from, $lte: to} };
    } catch (error) {
        console.log('Date filter error:', error);
    }
}

const getKPIData = async function getKPIData ( dateFilter ) {
    const data = await Order.aggregate([
        { $match: dateFilter },

        { $unwind: "$orderedItems" },

        {
            $addFields:{
                // grossAmount: {
                //     $multiply: ["$orderedItems.salePrice" , "$orderedItems.quantity"]
                // },
                itemDiscount: {
                    $multiply: [
                        { $subtract: ["$orderedItems.salePrice" , "$orderedItems.price"] },
                        "$orderedItems.quantity"
                    ]
                },
                // couponDiscount: "$discount",
                // shippingCharge: "$shippingCharge",
                // netAmount: "$finalPayableAmount"
            }
        },

        {
            $group: {
                _id: null,
                
                totalOrders: { $addToSet: "$orderId" },

                grossRevenue: { $sum: "$finalAmount" },
                netRevenue: { $sum: "$finalPayableAmount" },

                totalDiscountFromOffers: { $sum: "$itemDiscount" },
                totalCouponDiscount: { $sum: "$discount" },

                totalShippingCharge: { $sum: "$shippingCharge"},


                deliveredOrders: {
                    $sum: {
                        $cond: [ { $eq: ["$status" , "Delivered"] }, 1, 0 ]
                    }
                },
                cancelledOrders: {
                    $sum: {
                        $cond: [ { $eq: ["$status" , "Cancelled" ] }, 1, 0 ]
                    }
                },
                returnedOrders: {
                    $sum: {
                        $cond: [ { $eq: ["$status" , "Returned" ] }, 1, 0 ]
                    }
                },
                cancelledItems: {
                    $sum: {
                        $cond: [ { $eq: ["$orderedItems.itemStatus" , "Cancelled"] }, 1, 0 ]
                    }
                },
                returnedItems: {
                    $sum: {
                        $cond: [ { $eq: ["$orderedItems.itemStatus" , "Returned"] }, 1, 0 ]
                    }
                }
            }
        },

        {
            $project: {
                _id: 0,
                totalOrders: { $size: "$totalOrders" },

                grossRevenue: 1,
                netRevenue: 1,

                totalDiscountFromOffers: 1,
                totalCouponDiscount: 1,
                totalShippingCharge: 1,

                deliveredOrders: 1,
                cancelledOrders: 1,
                returnedOrders: 1,
                cancelledItems: 1,
                returnedItems: 1

            }
        }
    ]);
    return data[0] || {};
};

const getDetailedOrders = async function getDetailedOrders (dateFilter) {
    return await Order.find(dateFilter)
                                .populate("userId" , "name, email")
                                .sort( { createdAt: -1 })
                                .lean();
}

module.exports = {
  getDateFilter,
  getKPIData,
  getDetailedOrders
} 