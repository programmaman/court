import Web3 from "web3";
import KlerosLiquidExtraViews from "../../assets/contracts/kleros-liquid-extra-views.json";
import KlerosLiquid from "../../assets/contracts/kleros-liquid.json";
import TokenBridgeXDai from "../../assets/contracts/token-bridge-xdai.json";
import WrappedPinakion from "../../assets/contracts/wrapped-pinakion.json";
import XPinakion from "../../assets/contracts/x-pinakion.json";
import { getCounterPartyChainId, isSupportedSideChain } from "./chain-params";
import * as xDai from "./xdai-api";

// Secure logging function
const log = (message, data = {}) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[SideChainAPI] ${message}`, data);
  }
};

export default async function createSideChainApi(provider) {
  log("createSideChainApi called");

  const web3 = new Web3(provider);
  const chainId = await web3.eth.getChainId();

  log("Fetched chainId", { chainId });

  if (!isSupportedSideChain(chainId)) {
    console.error(`[SideChainAPI] Unsupported chain ID: ${chainId}`);
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const api = xDai.createApi(xDaiParametersFactory(web3));

  log("SideChain API created successfully");

  return api;
}

const xDaiParametersFactory = (web3) => {
  log("xDaiParametersFactory called");

  const contracts = {
    tokenBridge: new web3.eth.Contract(TokenBridgeXDai.abi, ensureEnv("REACT_APP_TOKEN_BRIDGE_XDAI_ADDRESS")),
    wrappedPinakion: new web3.eth.Contract(WrappedPinakion.abi, ensureEnv("REACT_APP_PINAKION_XDAI_ADDRESS")),
    xPinakion: new web3.eth.Contract(XPinakion.abi, ensureEnv("REACT_APP_RAW_PINAKION_XDAI_ADDRESS")),
    klerosLiquidExtraViews: new web3.eth.Contract(
      KlerosLiquidExtraViews.abi,
      ensureEnv("REACT_APP_KLEROS_LIQUID_EXTRA_VIEWS_XDAI_ADDRESS")
    ),
    klerosLiquid: new web3.eth.Contract(KlerosLiquid.abi, ensureEnv("REACT_APP_KLEROS_LIQUID_XDAI_ADDRESS")),
  };

  log("Contracts initialized");

  contracts.tokenBridge.options.handleRevert = true;
  contracts.wrappedPinakion.options.handleRevert = true;
  contracts.klerosLiquidExtraViews.options.handleRevert = true;
  contracts.klerosLiquid.options.handleRevert = true;

  log("Contract options set");

  return {
    ...contracts,
    chainId: 100,
    destinationChainId: getCounterPartyChainId(100),
  };
};

function ensureEnv(key, msg = `process.env.${key} is not defined`) {
  log("ensureEnv called", { key });

  const value = process.env[key];

  if (value === "" || value === undefined || value === null) {
    console.error(`[SideChainAPI] ${msg}`);
    throw new Error(msg);
  }

  return value;
}
