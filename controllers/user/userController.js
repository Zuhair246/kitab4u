


const loadHomePage = async (req,res) => {
    try {

        return res.render('homePage')
    }catch (error) {

        console.log("Home Page Not Found")
        res.status(500).send("Server error")
        
    }
}

const pageNotFound = async (req,res)=>  {
    try{
        res.render("404-page")
    }catch (error) {
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadHomePage,
    pageNotFound
}

