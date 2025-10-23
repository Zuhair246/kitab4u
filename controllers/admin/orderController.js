const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Payment = require('../../models/paymentSchema');
const { name } = require('ejs');
const { image } = require('pdfkit');

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
            totalAmount: order.finalAmount,
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
        console.log('Admin Side Order Listing Error:' ,error);
        return res.redirect('/pageNotFound')
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
        console.log("Admin order details error:", error);
        return res.redirect('/pageNotFound')
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await Order.findById(orderId);
        if(!order) return res.status(404).json({success: false, message: 'Order not found'});

        order.status = status;
        order.orderedItems.forEach(item => (item.itemStatus = status));
        await order.save();

        for(const item of order.orderedItems) {
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
        console.log("Update order status by admin error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

const updateItemStatus = async (req, res) => {
    try {
        const {orderId, itemId} = req.params;
        const { status } = req.body;

        const order = await Order.findById(orderId);
        if(!order) res.status(404).json({ success: false, message: "Order not found"})

        const item = order.orderedItems.id(itemId);
        if(!item) res.status(404).json({ success: false, message: "Item not found"});

       item.itemStatus = status;
        await order.save();

        for(const item of order.orderedItems) {
            const product = await Product.findById(item.product);
            if(!product) continue;

            const variant = product.variants.id(item.variantId);
            if(!variant) continue;

            if(['Cancelled', 'Returned'].includes(status)) {
                    variant.stock += item.quantity;
            }
            await product.save();
        }

        return res.status(200).json({ success: true, message: "Item staus updated"})
        
    } catch (error) {
        console.log('Item status udate error:', error)
        res.status(500).json({ success: false, message: "Internal server error !"})
    }
}

module.exports = {
    orderListing,
    viewOrderDetails,
    updateOrderStatus,
    updateItemStatus
}