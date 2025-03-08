import log from "../../helpers/logger"; // Import the logger
import { Tokens } from "./chain-params";

export default function createWatchToken({ getChainParams }) {
  return async function requestWatchToken(provider, token) {
    log.debug("requestWatchToken called", { token });

    if (![Tokens.stPNK, Tokens.PNK].includes(token)) {
      log.warn("Invalid token requested", { token });
      throw new Error(`Invalid token: ${token}`);
    }

    try {
      const chainId = Number.parseInt(
        await provider.request({
          method: "eth_chainId",
        }),
        16
      );

      log.debug("Fetched chainId", { chainId });

      const tokenParams = getChainParams(chainId)?.tokens ?? {};
      const tokenData = tokenParams[token];

      if (tokenData && !isAssetWatched({ ...tokenData, chainId })) {
        log.debug("Token not watched, attempting to add", { tokenData });

        await addToken(provider, tokenData);
        storeWatchedAsset({ ...tokenData, chainId });

        log.debug("Token successfully added", { tokenData });
      } else {
        log.debug("Token already watched", { tokenData });
      }
    } catch (err) {
      log.error(`Error when adding token ${token}:`, err);
    }
  };
}

async function addToken(provider, { address, symbol, decimals = 18, image }) {
  log.debug("addToken called", { address, symbol });

  try {
    return await provider.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address,
          symbol,
          decimals,
          image,
        },
      },
    });
  } catch (err) {
    log.error("Error in addToken", err);
  }
}

const getStorageKey = ({ chainId, symbol, address }) =>
  `@@kleros/court/tokens/${symbol}/${chainId}/${address}`;

function isAssetWatched({ chainId, symbol, address }) {
  const key = getStorageKey({ chainId, symbol, address });

  try {
    const watched = JSON.parse(window.localStorage.getItem(key)) === true;
    log.debug("Checked if asset is watched", { key, watched });
    return watched;
  } catch (err) {
    log.error("Error in isAssetWatched", err);
    return false;
  }
}

function storeWatchedAsset({ chainId, symbol, address }) {
  const key = getStorageKey({ chainId, symbol, address });

  try {
    window.localStorage.setItem(key, "true");
    log.debug("Stored watched asset", { key });
  } catch (err) {
    log.error("Error in storeWatchedAsset", err);
  }
}
