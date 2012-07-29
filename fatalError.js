/**
 * Dependencies
 */

var Logger = require("rbl/logger");

fatalError = function fatalError() {
    Logger.error(arguments);
    Logger.error("Error is fatal. Exiting");
    process.exit(-1);
}