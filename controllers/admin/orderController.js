import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Product from '../../models/productSchema.js';
import { addToWallet } from '../../helpers/walletHelper.js';

const orderListing = async (req, res) => {
    try {
        let { page = 1, limit = 6, search = '', filter = '', sortBy='' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

        let query = {};

        if(search) {
              query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                {'orderedItems.name': {$regex: search, $options: 'i'}},
                {status : {$regex: search,$options: 'i'}}
              ];

              const dateSearch = new Date(search);
              if(!isNaN(dateSearch)) {
                const nextDay = new Date(dateSearch);
                nextDay.setDate(nextDay.getDate() + 1);
                query.$or.push({
                    createdAt: { $gte: dateSearch, $lt: nextDay },
                });
              }

        const matchedUsers = await User.find(
            { name: {$regex: search, $options: 'i'} },
            { _id: 1}
        );
        const matchedUserIds =  matchedUsers.map(user => user._id);
        if(matchedUserIds.length > 0) {
            query.$or.push( { userId: {$in: matchedUserIds } } );
        }
        }

        if (filter && filter.trim() !== '') {
               query.status = new RegExp(`^${filter}$`, 'i');
        }

        let sortOption = { createdAt: -1 };
        switch(sortBy) {
            case 'date_asc': 
            sortOption = { createdAt: 1 };
            break;
            case 'date_desc':
            sortOption = {createdAt: -1};
            break;
            case 'total_asc':
            sortOption = {finalAmount: 1};
            break;
            case 'total_desc':
            sortOption = {finalAmount: -1};
            break;
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
                                                    .populate('userId', 'name email')
                                                    .sort(sortOption)
                                                    .skip((page - 1) * limit)
                                                    .limit(limit)

        const formattedOrders = orders.map(order => ({
            _id: order._id,
            orderId: order.orderId,
            createdAt: order.createdAt,
            totalAmount: order.finalPayableAmount,
            status: order.status.toLocaleLowerCase().replace(/\s/g, '_'),
            user: {
                name: order.userId?.name || 'Unknown',
                email: order.userId?.email || '-',
            },
            items: order.orderedItems.map(i => ({
                name: i.name,
                image: i.image
            })),
        }));

        res.render('orderListing', {
            orders: formattedOrders,
            totalPages,
            currentPage: page,
            sortBy,
            search,
            filter
        });

    } catch (error) {
        const err = new Error("Admin order listing server error");
        throw err;
    }
}

const viewOrderDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id)
                                                  .populate('userId', 'name email')
                                                  .populate('orderedItems.product', 'name images variants');

        if(!order) return res.redirect('/admin/userOrders');

        res.render('orderedItemsDetails', {
            order
        })
    } catch (error) {
        const err = new Error("Admin order details loading server error");
        throw err;
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await Order.findById(orderId);
        if(!order) return res.status(404).json({success: false, message: 'Order not found'});

        order.status = status;
        if(status == "Delivered") {
            order.paymentStatus = "Paid";
        }

        const activeItems = order.orderedItems.filter(
            item => !["Cancelled", "Returned"].includes(item.itemStatus)
        )
        activeItems.forEach(item => (item.itemStatus = status));
        await order.save();

        for(const item of activeItems) {
            const product = await Product.findById(item.product);
            if(!product) continue;

            const variant = product.variants.id(item.variantId);
            if(!variant) continue;

            if(['Cancelled', 'Returned'].includes(status)) {
                    variant.stock += item.quantity;
            }
            await product.save();
        }
        return res.status(200).json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
        const err = new Error("Admin order status update server error");
        err.redirect = `/admin/userOrders/${req.params.orderId}?error=` + encodeURIComponent("Admin order status update internal server error");
        throw err;
    }
}

const orderReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body;

        const order = await Order.findById(orderId);
        if(!order) {
            return res.status(400).json( { success: false, message: "Order not found" } );
        }

        order.status = action === 'approve' ? "Returned" : "Return Rejected";

        const activeItems = order.orderedItems.filter(item => !['Cancelled', 'Returned'].includes(item.itemStatus))
        for (const item of activeItems) {
            item.itemStatus = action === 'approve' ? "Returned" : "Return Rejected";

            if(action === 'approve'){
                const product = await Product.findById(item.product);
                const variant = product?.variants.id(item.variantId);
                if(variant) {
                    variant.stock += item.quantity;
                    await product.save();
                }
                // order.finalPayableAmount -= finalPayableAmount;
            }
        }

        if(action === 'approve'){
            await addToWallet(order.userId, order.finalPayableAmount - order.shippingCharge, 'Credit', `Refund for Returned Order: #${order.orderId}`);
            order.paymentStatus = 'Refunded';
        }

        await order.save();

        if(action !== 'approve'){
            return res.status(400).josn( { success: false, message: "Return not Rejected"})
        }

        return res.status(200).json( { success: true, message: "Order Return Approved!"})
    } catch (error) {
        const err = new Error("Admin order return request update server error");
        err.redirect = `/admin/userOrders/${req.params.orderId}?error=` + encodeURIComponent("Admin order return request update internal server error");
        throw err;
    }
}

const itemReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { action } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(400).json({ success: false, message: "Return item Order not found !"} );
        }

        const  item = order.orderedItems.id(itemId);
        if(!item) {
            return res.status(400).json( { success: false, message: "Return item not found"} );
        }

        item.itemStatus = action === 'approve' ? "Returned" : "Return Rejected";

        const allReturned = order.orderedItems.every(item => item.itemStatus === 'Returned');
        if(allReturned) {
            order.status = 'Returned';
        }

        if(action === 'approve') {
            const product = await Product.findById(item.product);
            const variant = product?.variants.id(item.variantId);
            if(variant) {
                variant.stock += item.quantity;
                await product.save();
            }

            let itemRefundAmount = item.price * item.quantity;
            if(order.couponApplied && order.discount >0 && order.finalPayableAmount >0){
                const share = (item.price * item.quantity) / order.totalPrice;
                const itemDiscount = Math.round(order.discount * share);
                itemRefundAmount -= itemDiscount;
            }
            if(allReturned){
                order.paymentStatus = "Refunded";
            }
            await addToWallet(order.userId, itemRefundAmount, 'Credit', `Refund for Returned item "${item.name}" from Order #${order.orderId}`);
            order.finalPayableAmount -= itemRefundAmount;
            await order.save()
        }

        await order.save()
        if(action !== 'approve'){
            return res.status(400).json({success: false, message: "Item return Rejected"})
        }
        return res.status(200).json( { success: true, message: "Item return approved" } );

    } catch (error) {
        const err = new Error("Admin item return request update server error");
        err.redirect = `/admin/userOrders/${req.params.orderId}?error=` + encodeURIComponent("Admin item return request update internal server error");
        throw err;
    }
}

export default {
    orderListing,
    viewOrderDetails,
    updateOrderStatus,
    orderReturnRequest,
    itemReturnRequest
}