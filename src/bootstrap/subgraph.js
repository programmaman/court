import log from "/../helpers/logger"; // Import logger

log.debug("Initializing subgraph configuration...");

export const displaySubgraph = {
  1: process.env.REACT_APP_SUBGRAPH_MAINNET_DISPLAY || log.warn("Missing subgraph URL for Mainnet"),
  100: process.env.REACT_APP_SUBGRAPH_GNOSIS_DISPLAY || log.warn("Missing subgraph URL for Gnosis"),
  10200: "https://api.studio.thegraph.com/query/61738/kleros-display-chiado/version/latest",
  11155111: "https://api.studio.thegraph.com/query/61738/kleros-display-sepolia/version/latest",
};

log.debug("Subgraph configuration loaded:", displaySubgraph);
