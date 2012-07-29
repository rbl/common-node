/**
 * Module dependencies.
 */
var Logger = require("rbl/logger");

module.exports = function(redirectname, code) {
    code = code || 302;
    return function(req, res, next) {
        var path = "https://"+redirectname+req.url;
        Logger.debug("Redirecting ",code,"to",path);
        res.redirect(path, code)
    }
}