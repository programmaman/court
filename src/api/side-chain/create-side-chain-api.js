import log from "../../helpers/logger"; // Import the logger
import Web3 from "web3";
import KlerosLiquidExtraViews from "../../assets/contracts/kleros-liquid-extra-views.json";
import KlerosLiquid from "../../assets/contracts/kleros-liquid.json";
import TokenBridgeXDai from "../../assets/contracts/token-bridge-xdai.json";
import WrappedPinakion from "../../assets/contracts/wrapped-pinakion.json";
import XPinakion from "../../assets/contracts/x-pinakion.json";
import { getCounterPartyChainId, isSupportedSideChain } from "./chain-params";
import * as xDai from "./xdai-api";

export default async function createSideChainApi(provider) {
  log.debug("createSideChainApi called");

  const web3 = new Web3(provider);
  const chainId = await web3.eth.getChainId();

  log.debug("Fetched chainId", { chainId });

  if (!isSupportedSideChain(chainId)) {
    log.warn("Unsupported chain ID", { chainId });
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const api = xDai.createApi(xDaiParametersFactory(web3));

  log.debug("SideChain API created successfully");

  return api;
}

const xDaiParametersFactory = (web3) => {
  log.debug("xDaiParametersFactory called");

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

  log.debug("Contracts initialized");

  contracts.tokenBridge.options.handleRevert = true;
  contracts.wrappedPinakion.options.handleRevert = true;
  contracts.klerosLiquidExtraViews.options.handleRevert = true;
  contracts.klerosLiquid.options.handleRevert = true;

  log.debug("Contract options set");

  return {
    ...contracts,
    chainId: 100,
    destinationChainId: getCounterPartyChainId(100),
  };
};

function ensureEnv(key, msg = `process.env.${key} is not defined`) {
  log.debug("ensureEnv called", { key });

  const value = process.env[key];

  if (!value) {
    log.warn("Missing environment variable", { key });
    throw new Error(msg);
  }

  return value;
}
