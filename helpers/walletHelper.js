const Wallet = require('../models/walletSchema');

async function  addToWallet (userId, amount, transactionType, description) {
    try {
        let wallet = await Wallet.findOne({userId});

        if(!wallet){
            wallet = new Wallet ({
                userId,
                balance: 0,
                transactions: []
            })
        }

        wallet.balance += amount;

        wallet.transactions.push({
            transactionType,
            amount,
            date: new Date(),
            description
        });
        await wallet.save();
        console.log(`₹${amount} added to wallet of ${userId}`);
        return wallet; 

    } catch (error) {
        console.log('Add to wallet error:', error);
        return res.status(500).json({ success: false, message: "Add to wallet server error"});
    }
}

module.exports = {
    addToWallet
}