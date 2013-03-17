/**
 * A connect middleware to look at the request session and decide if there is a user and if
 * that user has a particular required role for this middleware chain.
 */

var Logger = require("rbl/logger");

/**
 * Send the object as JSON.
 * 
 * Rather than using the implementation from ControllerHelpers we embed this directly
 * because ControllerHelpers (might) include us and the circular require is bizarro world.
 */ 
var sendJSON = function sendJSON(res,obj,code) {
    var code = code || 200;

    var body = JSON.stringify(obj);
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

/**
 * The single export is a function which returns the correctly configured middleware
 * function.
 */
module.exports = function requireRole(requiredRole, failurePath) {

    var requiredRole = requiredRole;

    // Used to send failure when that happens
    function sendFail(req, res, failurePath) {

        // If they can explicitly take json, then give them json and a 401. This means
        // */* won't match here
        if (req.header("accept").indexOf("/json") != -1) {
            var result = {
                error: 'access_denied',
                error_description: 'The current user, if any, is not allowed access to this resource.',
            };

            return sendJSON(res,result,401);
        }
        
        // Since they don't seem to want JSON, redirect to the failure path
        if (failurePath && failurePath !== "") {
            return res.redirect(failurePath);
        }
        
        // Aack! just deny them then
        res.writeHead(401, {
            'Content-Type': 'text/plain'
        });
        res.end("401 Access Denied\n\nThe current user, if any, is not allowed access to this resource.");
    }
  
    // The real middleware function
    return function(req, res, next)  {
        // Does the incoming request have a user at all?
        var user = req.session.user;

        if (!user && requiredRole) {
          // Fail!
          Logger.warn("No token was found, but resource requires scope '",requiredRole,"'");
          return sendFail(req,res,failurePath);
        }

        // Verify that the required scope is in there
        if (requiredRole) {
            var scopes = user.allowedRoles;
            Logger.debugi("Allowed scopes are",scopes);

            if (!scopes || scopes.length === 0) 
            {
                Logger.warn("session does not contain any scopes");
                return sendFail(req,res,failurePath);
            }

            var gotIt = false;
            if ((requiredRole === "__ANY__") && (scopes.length>0)) {
                gotIt = true;
            } else {
                for(var i=0; i<scopes.length; i++) {
                    var scope = scopes[i];
                    if (scope == requiredRole) {
                        gotIt = true;
                        break;
                    }
                }
            }

            if (!gotIt) {
                Logger.warni("Allowed scopes ",scopes," did not contain required scope ",requiredRole);
                return sendFail(req,res,failurePath);
            }
        }
        // Woo Hoo! Got the scope!

        // Pass through to the next layer
        return next();
    };
};

