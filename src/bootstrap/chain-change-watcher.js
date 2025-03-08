import { useEffect } from "react";
import t from "prop-types";
import log from "../../helpers/logger"; // Import logger
import useChainId from "../hooks/use-chain-id";
import usePrevious from "../hooks/use-previous";

export default function ChainChangeWatcher({ children }) {
  log.debug("ChainChangeWatcher mounted."); // Log component mount
  useReloadOnChainChanged();
  return children;
}

ChainChangeWatcher.propTypes = {
  children: t.node.isRequired,
};

function useReloadOnChainChanged() {
  const chainId = useChainId();
  const previousChainId = usePrevious(chainId);

  useEffect(() => {
    if (chainId !== undefined && previousChainId !== undefined && chainId !== previousChainId) {
      log.debug(`Chain changed: ${previousChainId} → ${chainId}. Reloading page.`);
      window.location.reload();
    }
  }, [previousChainId, chainId]);
}
