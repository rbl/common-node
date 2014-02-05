/**
 * A connect middleware to log the processing stack
 */

var Logger = require("rbl/logger");

module.exports = function(options) {
    var counterVal = 0;
    
    options = options || {};
    options.simpleForm = options.simpleForm || {};
    options.simpleRegEx = options.simpleRegEx || [];

    return function(req, res, next) {
        // Log the incoming request
        counterVal++;
        var counter = "[" + counterVal + "] ";
        
        //Logger.warni(req);
        
        // Look at the file extension to see if we want the simple form
        var url = req.url;
        var ix = url.indexOf("?");
        
        if (ix!=-1) {
            url = url.slice(0,ix);
        }        

        var useSimple = false;
        ix = url.lastIndexOf(".");
        if (ix!=-1) {
            var ext = url.slice(ix+1);
            
            if (options.simpleForm[ext]) {
                useSimple = true;
            }
        }
        for(var i=0; i<options.simpleRegEx.length; i++) {
            var re = options.simpleRegEx[i];
            if (re.exec(url)) {
                useSimple = true;
                break;
            }
            Logger.debugi("Expression ",re," failed");
        }
        if (useSimple) {
            // Simple form only and we're out!
            Logger.debugi(counter, " ", req.method, " ", req.url);
            return next();            
        }
        
        Logger.hr();
        Logger.debugi(counter, " Starting ", req.method, " ", req.url, "\n", req.headers);
        Logger.debugi(counter, " Request Query ", req.query);

        //Logger.warni(counter, req);

        // Wrap writeHead to hook into the exit path through the layers.
        var writeHead = res.writeHead;
        // Store the original function
        (function(counter, req, res, writeHead) {
            res.writeHead = function(code, headers) {
                res.writeHead = writeHead;
                // Put the original back
                // Log the outgoing response
                Logger.warni(counter, " Ending ", req.method, " ", req.url, " ", code);
                if (options.headers && res._headers) Logger.debugi(counter, "Response Headers\n", res._headers);

                if ((code >= 400) && (code<=600) && options.errorStackTrace) Logger.logStackUntil();
                //L.logStackUntil();
                
                // var cookie = res.getHeader("Set-Cookie");
                // if (cookie) {
                //     Logger.debug("Set-Cookie: ",cookie);
                // } else {
                //     //Logger.debug("No Set-Cookie header");
                // }
                
                res.writeHead(code, headers);
                // Call the original
            };

        })(counter, req, res, writeHead);


        // If the logBody option is set we will try to log the body
        if (options.logBody) {
            var haveWrittenParams = false;
            var origWrite = res.write;
            (function(oWrite) {
                var myWrite;
                myWrite = res.write = function(chunk, encoding) {

                    if (!haveWrittenParams) {
                        Logger.debugi(counter, " Request Params ", req.params);
                        Logger.infoi(counter, ">> Received this body:");
                        Logger.infoi(counter, req.body);
                        Logger.error(counter, "<< Sending this response:");
                        haveWrittenParams = true;
                    }

                    Logger.errori(counter, chunk);

                    // Swap-a-rooney
                    res.write = oWrite;
                    var returnVal = res.write(chunk, encoding);
                    res.write = myWrite;

                    return returnVal;
                }

            })(origWrite);

            var origEnd = res.end;
            (function(oEnd) {
                var myEnd;
                myEnd = res.end = function(chunk, encoding) {

                    if (!haveWrittenParams) {
                        Logger.debugi(counter, " Request Params ", req.params);
                        Logger.infoi(counter, ">> Received this body:");
                        Logger.infoi(counter, req.body);
                        Logger.error(counter, "<< Sending this response:");
                        haveWrittenParams = true;
                    }

                    Logger.errori(counter, chunk);

                    // Swap-a-rooney
                    res.end = oEnd;
                    var returnVal = res.end(chunk, encoding);
                    res.end = myEnd;

                    return returnVal;
                }

            })(origEnd);


        }
        
        
        // We would like to know when there is data and stuff
        // req.on("data", function(data) {
        //     Logger.warni(counter, "Got",data.length,"bytes of data");
        // });
        // req.on("end", function() {
        //     Logger.warni(counter, "It ended");
        // });
        // 
        // 
        // 
        // (function(counter, req, original_on) {
        //     req.on = function(event, cb) {
        //         Logger.warni(counter," event =", event);
        //         original_on.call(req, event, cb);
        //     };
        // })(counter, req, req.on);

        // Pass through to the next layer
        return next();
    };
}