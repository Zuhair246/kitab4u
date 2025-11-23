const User = require('../../models/userSchema');
const Walllet = require('../../models/walletSchema');

const loadWallet = async (req, res) =>{
    try {
        const userId = req.session.user || req.user;
        if (!userId) {
            return res.redirect('/login')
        }
        const user = User.findById(userId);

        let wallet = await Walllet.findOne({userId: userId});

        if(!wallet){
            wallet = {
                balance: 0,
                transactions: []
            }
        };
        
        const currentPage = parseInt(req.query.page) || 1 ;
        const transactionsPerPage = 20;
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / transactionsPerPage);

        const startIndex = (currentPage -1) * transactionsPerPage;
        const paginatedTransactions = wallet.transactions.slice(startIndex, startIndex+transactionsPerPage).reverse();

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