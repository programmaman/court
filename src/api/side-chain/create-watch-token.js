import { Tokens } from "./chain-params";

// Secure logging function
const log = (message, data = {}) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[WatchToken] ${message}`, data);
  }
};

export default function createWatchToken({ getChainParams }) {
  return async function requestWatchToken(provider, token) {
    log("requestWatchToken called", { token });

    if (![Tokens.stPNK, Tokens.PNK].includes(token)) {
      log("Invalid token requested", { token });
      throw new Error(`Invalid token: ${token}`);
    }

    try {
      const chainId = Number.parseInt(
        await provider.request({
          method: "eth_chainId",
        }),
        16
      );

      log("Fetched chainId", { chainId });

      const tokenParams = getChainParams(chainId)?.tokens ?? {};
      const tokenData = tokenParams[token];

      if (tokenData && !isAssetWatched({ ...tokenData, chainId })) {
        log("Token not watched, attempting to add", { tokenData });

        await addToken(provider, tokenData);
        storeWatchedAsset({ ...tokenData, chainId });

        log("Token successfully added", { tokenData });
      } else {
        log("Token already watched", { tokenData });
      }
    } catch (err) {
      console.error(`[WatchToken] Error when adding token ${token}:`, err);
    }
  };
}

async function addToken(provider, { address, symbol, decimals = 18, image }) {
  log("addToken called", { address, symbol });

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
    console.error("[WatchToken] Error in addToken", err);
  }
}

const getStorageKey = ({ chainId, symbol, address }) =>
  `@@kleros/court/tokens/${symbol}/${chainId}/${address}`;

function isAssetWatched({ chainId, symbol, address }) {
  const key = getStorageKey({ chainId, symbol, address });

  try {
    const watched = JSON.parse(window.localStorage.getItem(key)) === true;
    log("Checked if asset is watched", { key, watched });
    return watched;
  } catch (err) {
    console.error("[WatchToken] Error in isAssetWatched", err);
    return false;
  }
}

function storeWatchedAsset({ chainId, symbol, address }) {
  const key = getStorageKey({ chainId, symbol, address });

  try {
    window.localStorage.setItem(key, "true");
    log("Stored watched asset", { key });
  } catch (err) {
    console.error("[WatchToken] Error in storeWatchedAsset", err);
  }
}
