import Order from '../models/orderSchema.js';

export const getDateFilter = ( range, startDate, endDate ) => {
    try {
        const now = new Date();
        let from, to;

        if( startDate && endDate ) {
          from = new Date(startDate);
          from.setHours(0, 0, 0, 0);

          to = new Date(endDate);
          to.setHours(23, 59, 59, 999);

        } else {

        switch ( range ) {
            case "daily":
                from = new Date(now);
                from.setHours(0, 0, 0, 0);
                to = new Date(now);
                to.setHours(23, 59, 59, 999);
                break;

            case "weekly":
                from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                to = now;
                break;

            case "monthly":
                from = new Date();
                from.setMonth(now.getMonth() - 1);
                to =now;
                break;

            case "yearly":
                from = new Date();
                from.setFullYear(now.getFullYear() - 1);
                to = now;
                break;

            default:
                from = new Date(0);
                to = now;
        }
        }

        return { createdAt: { $gte: from, $lte: to} };
    } catch (error) {
        console.log('Date filter helper server error:', error);
    }
}

export const getKPIData = async function getKPIData(dateFilter) {
  const data = await Order.aggregate([

    { $match: dateFilter },

    {
      $facet: {

        //  ORDER LEVEL METRICS
        orderStats: [
          {
            $group: {
              _id: null,

              totalOrders: { $sum: 1 },

              grossRevenue: { $sum: "$finalAmount" },
              netRevenue: { $sum: "$finalPayableAmount" },

              totalCouponDiscount: { $sum: "$discount" },
              totalShippingCharge: { $sum: "$shippingCharge" },

              deliveredOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0]
                }
              },

              cancelledOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0]
                }
              },

              returnedOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "Returned"] }, 1, 0]
                }
              }

            }
          }
        ],

        //  ITEM LEVEL METRICS
        itemStats: [
          { $unwind: "$orderedItems" },

          {
            $addFields: {
              itemDiscount: {
                $multiply: [
                  { $subtract: ["$orderedItems.salePrice", "$orderedItems.price"] },
                  "$orderedItems.quantity"
                ]
              }
            }
          },

          {
            $group: {
              _id: null,

              totalDiscountFromOffers: { $sum: "$itemDiscount" },

              cancelledItems: {
                $sum: {
                  $cond: [
                    { $eq: ["$orderedItems.itemStatus", "Cancelled"] },
                    1,
                    0
                  ]
                }
              },

              returnedItems: {
                $sum: {
                  $cond: [
                    { $eq: ["$orderedItems.itemStatus", "Returned"] },
                    1,
                    0
                  ]
                }
              }

            }
          }
        ]
      }
    },

    //  MERGE BOTH RESULTS
    {
      $project: {
        totalOrders: { $ifNull: [{ $arrayElemAt: ["$orderStats.totalOrders", 0] }, 0] },

        grossRevenue: { $ifNull: [{ $arrayElemAt: ["$orderStats.grossRevenue", 0] }, 0] },
        netRevenue: { $ifNull: [{ $arrayElemAt: ["$orderStats.netRevenue", 0] }, 0] },

        totalCouponDiscount: { $ifNull: [{ $arrayElemAt: ["$orderStats.totalCouponDiscount", 0] }, 0] },
        totalShippingCharge: { $ifNull: [{ $arrayElemAt: ["$orderStats.totalShippingCharge", 0] }, 0] },

        deliveredOrders: { $ifNull: [{ $arrayElemAt: ["$orderStats.deliveredOrders", 0] }, 0] },
        cancelledOrders: { $ifNull: [{ $arrayElemAt: ["$orderStats.cancelledOrders", 0] }, 0] },
        returnedOrders: { $ifNull: [{ $arrayElemAt: ["$orderStats.returnedOrders", 0] }, 0] },

        totalDiscountFromOffers: { $ifNull: [{ $arrayElemAt: ["$itemStats.totalDiscountFromOffers", 0] }, 0] },
        cancelledItems: { $ifNull: [{ $arrayElemAt: ["$itemStats.cancelledItems", 0] }, 0] },
        returnedItems: { $ifNull: [{ $arrayElemAt: ["$itemStats.returnedItems", 0] }, 0] }
      }
    }

  ]);

  return data[0] || {};
};
