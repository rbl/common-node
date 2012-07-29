var Crypto = require("crypto");

exports.forEmail = function(email, options) {
    
    if (typeof email === "string") {
        options.email = email;
    } else {
        options = email || {};
    }

    if (!options.hash && !options.email) {
        options.email = "";
    }

    if (options.email) {
        // Replace any hash value in the options with the hash of the email
        options.hash = exports.hashEmail(options.email);
    }
    var gravatar = "http://www.gravatar.com/avatar/"+options.hash+"?";
    
    if (!options.style) options.style="identicon";    
 
    if (options.style) {
        gravatar += "d=" + options.style + "&";
    }
    
    if (options.size) {
        gravatar += "s=" + options.size + "&";
    }
    
    // Always safe to trim the very last character
    gravatar = gravatar.slice(0, gravatar.length-1);
    return gravatar;
}

exports.hashEmail = function(email) {
    if (!email) {
        return "00000000000000000000000000000000";
    }
    
    var toHash = email.trim().toLowerCase();
    var hash = Crypto.createHash("md5");
    hash.update(toHash);
    
    return hash.digest("hex");
}