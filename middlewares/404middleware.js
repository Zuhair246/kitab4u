const pageNotFound = (req, res, next) => {
    res.status(404);
    if(req.xhr || req.headers["content-type"] === "application/json") {
        return res.json({ success: false, message: "Route Not Found!"});
    }
    return res.render("404-page", {statusCode: 404, message: "Page Not Found!"});
}

module.exports = pageNotFound;