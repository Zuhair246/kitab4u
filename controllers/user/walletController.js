const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

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

module.exports = {
    loadWallet,
    
}