const Wallet = require('../models/walletSchema');
const User = require('../models/userSchema');

async function  addToWallet (userId, amount, transactionType, description) {
    try {
        let wallet = await Wallet.findOne({userId});
        let user = await User.findById(userId)

        if(!wallet){
            wallet = new Wallet ({
                userId,
                balance: 0,
                transactions: []
            })
        }
if(transactionType=="Credit"){
        wallet.balance += amount;
}else if(transactionType=="Debit"){
        wallet.balance -= amount;
    }


        wallet.transactions.push({
            transactionType,
            amount,
            date: new Date(),
            description
        });
        await wallet.save();
        if(transactionType == 'Credit'){
            console.log(`₹${amount} credited to wallet of ${user.name}`);
        }else{
            console.log(`₹${amount} debited from wallet of ${user.name}`);
        }
        return wallet; 

    } catch (error) {
        console.log('Add to wallet error:', error);
        return res.status(500).json({ success: false, message: "Add to wallet server error"});
    }
}

module.exports = {
    addToWallet
}