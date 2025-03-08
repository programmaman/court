import log from "loglevel";

// Set log level dynamically
log.setLevel(process.env.NODE_ENV === "development" ? "debug" : "warn");

export default log;
