export const serverError = (err, req, res, next) => {
    const url = req.url || null;
    console.error(`url: ${url}`)
    console.error(`method: ${req.method}`)
    console.error(err.stack || err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error!";

    if(req.xhr || (req.headers["content-type"] || "").includes( "application/json" )) {
        return res.status(statusCode).json({ 
            success: false,
            message,
            redirect: err.redirect || null
        });
    }

    if(err.redirect) {
        return res.redirect(err.redirect)
    }

    return res.status(statusCode).render("500", {
        statusCode,
        message,
        url
    });
}
