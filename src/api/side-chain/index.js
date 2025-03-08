import log from "../../helpers/logger";
import createWatchToken from "./create-watch-token";
import { getSideChainParams } from "./chain-params";

export { SideChainApiProvider, useSideChainApi } from "./react-adapters";
export * from "./chain-params";
export { default as requestSwitchChain } from "./request-switch-chain";

// Use loglevel for debugging
log.debug("Initializing requestWatchToken");

export const requestWatchToken = createWatchToken({
  getChainParams: getSideChainParams,
});

log.debug("requestWatchToken initialized successfully");
