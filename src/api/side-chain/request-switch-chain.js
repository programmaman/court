import log from "../../helpers/logger"; // Import the logger
import Web3 from "web3";
import { getSideChainParams, isSupportedSideChain } from "./chain-params";

const { toHex } = Web3.utils;

export default async function requestSwitchChain(provider, destinationChainId) {
  log.debug("requestSwitchChain called", { destinationChainId });

  try {
    log.debug("Attempting to switch chain", { destinationChainId });
    return await switchChain(provider, { chainId: destinationChainId });
  } catch (err) {
    log.warn("Failed to switch chain, checking if chain needs to be added", { error: err });

    // This error code indicates that the chain has not been added to MetaMask
    if (err.code === 4902 && isSupportedSideChain(destinationChainId)) {
      log.debug("Chain not found in MetaMask, attempting to add chain", { destinationChainId });
      return await addChain(provider, getSideChainParams(destinationChainId));
    }

    log.error("Error in requestSwitchChain", { error: err });
    throw err;
  }
}

async function addChain(provider, { chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls }) {
  log.debug("Adding new chain to MetaMask", { chainId, chainName });

  try {
    return await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: toHex(chainId),
          chainName: chainName,
          nativeCurrency: nativeCurrency,
          rpcUrls: rpcUrls,
          blockExplorerUrls: blockExplorerUrls,
        },
      ],
    });
  } catch (err) {
    log.error("Error in addChain", { chainId, error: err });
    throw err;
  }
}

async function switchChain(provider, { chainId }) {
  log.debug("Switching chain in MetaMask", { chainId });

  try {
    return await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: toHex(chainId),
        },
      ],
    });
  } catch (err) {
    log.error("Error in switchChain", { chainId, error: err });
    throw err;
  }
}
