const User = require('../../models/userSchema');
const { getDateFilter, getKPIData, getDetailedOrders } = require('../../helpers/salesHelper');

const loadSales = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const dateFilter = await getDateFilter(range, startDate, endDate);

        const kpis = await getKPIData(dateFilter);

        const detailed = await getDetailedOrders(dateFilter);

        const usersCalc = await User.aggregate([ { $match:{ isAdmin: false } }, { $count:'users' } ] );
        const totalCustomers = usersCalc[0]?.users || 0;

        res.render('salesReport', {
            kpis,
            detailed,
            totalCustomers
        })
    } catch (error) {
        console.log('Sales page load error:', error);
        return res.redirect('/pageNotFound')
    }
}

module.exports ={
    loadSales
}