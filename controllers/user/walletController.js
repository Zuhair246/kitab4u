const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const { addToWallet } = require('../../helpers/walletHelper');
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');

const loadWallet = async (req, res) =>{
    try {
        const userId = req.session.user || req.user;
        if (!userId) {
            return res.redirect('/login')
        }
        const user = await User.findById(userId);

        let wallet = await Wallet.findOne({userId});

        if(!wallet){
            wallet = {
                balance: 0,
                transactions: []
            }
        };

        const sortedTransaction = wallet.transactions.sort(
            (a,b) => new Date(b.date) - new Date(a.date)
        )
        
        const currentPage = parseInt(req.query.page) || 1 ;
        const transactionsPerPage = 5;
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / transactionsPerPage);

        const startIndex = (currentPage -1) * transactionsPerPage;
        const paginatedTransactions = sortedTransaction.slice(startIndex, startIndex+transactionsPerPage);

        res.render('wallet', {
            user,
            wallet,
            paginatedTransactions,
            currentPage,
            totalPages
        })
    } catch (error) {
        console.log('Error loading wallet:', error);
        return res.redirect('/pageNotFound')
    }
}

const addMoney = async ( req, res ) => {
    try {
        const userId = req.session.user?._id || req.session.user?._id;
        if(!userId) {
            return res.status(401).message({ success: false, message: "Please login for adding money to your wallet!"})
        }

        let { amount }= req.body;
        amount = Number(amount);
        if(!amount || amount <= 0 ) {
            return res.status(400).json({ success: false, message: "Invalid amount!" })
        }

        const options = {
            amount: amount *100,
            currency: "INR",
            receipt: `wallet_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);

        return res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        })        
    } catch (error) {
        console.log('Error adding money to the wallet:', error);
        return res.status(500).json({ success: false, message: "Internal server error for add money to wallet"})
    }
}

const verifyPayment = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        if(!userId) {
            return res.status(401).message({ success: false, message: "Please login for adding money to your wallet!"});
        }
        
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: "Missing datas for verification" });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                                                                .update(body.toString())
                                                                .digest("hex");
             
        // Prevent duplicate credit: if transaction with this paymentId already exists, skip
        const wallet = await Wallet.findOne({ userId });

        if (wallet && wallet.transactions.some(tx => tx.razorpayPaymentId === razorpay_payment_id)) {
        // already processed
        return res.status(200).json({ success: true, message: "Payment already processed" });
        }

        if(expectedSignature === razorpay_signature) {
            const creditedAmount = Number(amount) / 100; //convert back from paisa to rupees iteself
            await addToWallet(userId, creditedAmount, "Credit", `Added by you on ${new Date().toLocaleDateString()}`);
            return res.status(200).json({ success: true, message: `${creditedAmount} credited to your wallet`})
        } else {
            return res.json({
                success: false,
                message: "Payment verification failed"
            });
        }
    } catch (error) {
        console.log("Wallet - Razorpay Verification error:", error);
        return res.status(500).json({ success: false, message: "Internal server error in add to wallet verification!"})
    }
}

module.exports = {
    loadWallet,
    addMoney,
    verifyPayment
}