const User = require ('../../models/userSchema')

const customerInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search.trim();
        }

        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page);
        }

        const limit = 7;

        const query = {
            isAdmin: false,
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ]
        };

          const totalUsers = await User.countDocuments(query);
          const totalPages = Math.ceil(totalUsers / limit) || 1;
        
        const userData = await User.find(query)
            .sort({_id: -1})
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        res.render("customers", {
            data: userData,
            totalPages,
            currentPage: page,
            search
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
};

const customerBlocked = async (req,res) => {
    try {
        let id = req.query.id;
        await User.updateOne({_id: id}, {$set:{isBlocked: true}});
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const customerUnBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({_id: id}, {$set:{isBlocked:false}})
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

module.exports = {
    customerInfo,
    customerBlocked,
    customerUnBlocked
}