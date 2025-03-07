import createWatchToken from "./create-watch-token";
import { getSideChainParams } from "./chain-params";

export { SideChainApiProvider, useSideChainApi } from "./react-adapters";
export * from "./chain-params";

export { default as requestSwitchChain } from "./request-switch-chain";

// Secure logging function
const log = (message, data = {}) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Index] ${message}`, data);
  }
};

log("Initializing requestWatchToken");

export const requestWatchToken = createWatchToken({
  getChainParams: getSideChainParams,
});

log("requestWatchToken initialized successfully");
