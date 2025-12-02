const serverError = (err, req, res, next) => {
    console.error("Error:", err.stack || err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error!";

    if(req.xhr || req.headers["content-type"] === "application/json") {
        return res.status(statusCode).json({ 
            success: false,
            message
        });
    }

    return res.status(statusCode).render("500", {
        statusCode,
        message
    });
}

module.exports = serverError;