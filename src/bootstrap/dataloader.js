import log from "../helpers/logger";
import Dataloader from "dataloader";
import axios from "axios";
import arbitrableWhitelist from "../temp/arbitrable-whitelist";
import { getReadOnlyRpcUrl } from "./web3";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { displaySubgraph } from "./subgraph"; // Import logger

/**
 * Extracts and returns the protocol from a given URI.
 * @param {string} uri - The URI to analyze.
 * @returns {string} The protocol type.
 */
const getURIProtocol = (uri) => {
  log.debug(`Extracting protocol from URI: ${uri}`);

  if (!uri || typeof uri !== "string") {
    log.error("Invalid URI provided to getURIProtocol.");
    throw new Error("Invalid URI format.");
  }

  const normalizedUri = uri.replace(":", "").split("/");
  return uri.startsWith("/") ? normalizedUri[1] : normalizedUri[0];
};

/**
 * Converts a given URI to an HTTP-compatible format.
 * @param {string} uri - The URI to convert.
 * @returns {string} The HTTP-formatted URI.
 */
const getHttpUri = (uri) => {
  log.debug(`Converting URI to HTTP format: ${uri}`);

  if (!uri || typeof uri !== "string") {
    log.error("Invalid URI provided to getHttpUri.");
    throw new Error("Invalid URI format.");
  }

  const protocol = getURIProtocol(uri);
  log.debug(`Identified protocol: ${protocol}`);

  try {
    switch (protocol) {
      case "http":
      case "https":
      case "ipns":
        return uri; // No transformation needed

      case "fs":
        if (uri.includes("/ipfs/")) {
          return uri.split(":/").pop();
        }
        log.error(`Unrecognized fs protocol in URI: ${uri}`);
        throw new Error(`Unrecognized protocol ${protocol}`);

      case "ipfs":
        return transformIpfsUri(uri);

      default:
        log.error(`Unsupported protocol detected: ${protocol}`);
        throw new Error(`Unrecognized protocol ${protocol}`);
    }
  } catch (error) {
    log.error(`Error processing URI: ${uri} - ${error.message}`);
    throw error;
  }
};

/**
 * Transforms an IPFS URI into a valid HTTP URL.
 * @param {string} uri - The IPFS URI.
 * @returns {string} The formatted HTTP URL.
 */
const transformIpfsUri = (uri) => {
  log.debug(`Transforming IPFS URI: ${uri}`);

  let formattedUri = uri.replace("://", ":/");

  if (formattedUri.startsWith("/ipfs") || formattedUri.startsWith("ipfs/")) {
    if (formattedUri.startsWith("/")) {
      formattedUri = formattedUri.substring(1);
    }
    return `https://cdn.kleros.link/${formattedUri}`;
  }

  if (formattedUri.startsWith("ipfs:/")) {
    return `https://cdn.kleros.link/${formattedUri.split(":/").pop()}`;
  }

  log.error(`Unrecognized IPFS format: ${uri}`);
  throw new Error("Unrecognized IPFS format.");
};

export { getURIProtocol, getHttpUri };

const fetchDataFromScript = async (scriptString, scriptParameters) => {
  log.debug("fetchDataFromScript called.", { scriptParameters });

  const { default: iframe } = await import("iframe");
  log.debug("Iframe module imported successfully.");

  let resolver;
  const returnPromise = new Promise((resolve) => {
    resolver = resolve;
  });

  window.onmessage = (message) => {
    log.debug("Received message from iframe.", { messageData: message.data });

    if (message.data.target === "script") {
      log.debug("Message target matches 'script'. Resolving promise.");
      resolver(message.data.result);
    }
  };

  log.debug("Creating iframe for script execution.");

  const frameBody = `<script type='text/javascript'>
    const scriptParameters = ${JSON.stringify(scriptParameters)}
    let resolveScript
    let rejectScript
    const returnPromise = new Promise((resolve, reject) => {
      resolveScript = resolve
      rejectScript = reject
    })

    returnPromise.then(result => {window.parent.postMessage(
      {
        target: 'script',
        result
      },
      '*'
    )})

    ${scriptString}
    getMetaEvidence()
  </script>`;

  try {
    const _ = iframe({
      body: frameBody,
      sandboxAttributes: [
        "allow-scripts",
        arbitrableWhitelist[scriptParameters.arbitrableChainID]?.includes(
          scriptParameters.arbitrableContractAddress.toLowerCase()
        )
          ? "allow-same-origin"
          : undefined,
      ],
    });

    log.debug("Iframe created successfully.");
    _.iframe.style.display = "none";
  } catch (error) {
    log.error("Error while creating iframe:", error.message);
    throw error;
  }

  return returnPromise;
};

const funcs = {
  async getMetaEvidence(chainID, arbitrated, arbitrator, disputeId) {
    log.debug("getMetaEvidence called.", { chainID, disputeId });

    const startTime = Date.now();
    const maxTime = 120000;
    const waitTime = 5000;

    while (Date.now() - startTime < maxTime) {
      try {
        log.debug(`Fetching MetaEvidence URI for disputeId ${disputeId} on chainID ${chainID}...`);
        const metaEvidenceUriData = await axios.get(
          `${process.env.REACT_APP_METAEVIDENCE_URL}?chainId=${chainID}&disputeId=${disputeId}`
        );

        const uri = metaEvidenceUriData.data?.metaEvidenceUri;
        if (!uri) {
          log.warn(`No MetaEvidence log found for disputeId ${disputeId} on chainID ${chainID}`);
          throw new Error(`No MetaEvidence log for disputeId ${disputeId} on chainID ${chainID}`);
        }

        log.debug(`Fetching MetaEvidence JSON from URI: ${uri}`);
        let metaEvidenceJSON = (await axios.get(getHttpUri(uri))).data;

        // Processing legacy keys to updated keys
        log.debug("Processing legacy keys in MetaEvidence JSON...");
        const updateDict = {
          evidenceDisplayInterfaceURL: "evidenceDisplayInterfaceURI",
          evidenceDisplayInterfaceURLHash: "evidenceDisplayInterfaceHash",
        };

        Object.entries(updateDict).forEach(([legacyKey, updatedKey]) => {
          if (metaEvidenceJSON[legacyKey]) {
            metaEvidenceJSON[updatedKey] = metaEvidenceJSON[legacyKey];
            delete metaEvidenceJSON[legacyKey];
          }
        });

        // Ensure rulingOptions.type is set
        if (metaEvidenceJSON.rulingOptions && !metaEvidenceJSON.rulingOptions.type) {
          log.debug("Setting default rulingOptions type to 'single-select'.");
          metaEvidenceJSON.rulingOptions.type = "single-select";
        }

        // Handling Dynamic Script
        if (metaEvidenceJSON.dynamicScriptURI) {
          const scriptURI =
            chainID === 1 && disputeId === "1621"
              ? getHttpUri("/ipfs/Qmf1k727vP7qZv21MDB8vwL6tfVEKPCUQAiw8CTfHStkjf")
              : getHttpUri(metaEvidenceJSON.dynamicScriptURI);

          log.debug(`Fetching dynamic script from: ${scriptURI}`);
          const fileResponse = await axios.get(scriptURI);

          if (fileResponse.status !== 200) {
            log.error(`Failed to fetch dynamic script file at ${scriptURI}.`);
            throw new Error(`Unable to fetch dynamic script file at ${scriptURI}.`);
          }

          const injectedParameters = {
            arbitratorChainID: metaEvidenceJSON.arbitratorChainID || chainID,
            arbitrableChainID: metaEvidenceJSON.arbitrableChainID || chainID,
            disputeID: disputeId,
            arbitrableContractAddress: arbitrated,
            arbitratorJsonRpcUrl: getReadOnlyRpcUrl(metaEvidenceJSON.arbitratorChainID || chainID),
            arbitrableJsonRpcUrl: getReadOnlyRpcUrl(metaEvidenceJSON.arbitrableChainID || arbitrator),
          };

          if (!injectedParameters.arbitratorJsonRpcUrl) {
            log.warn(`Missing 'arbitratorJsonRpcUrl' for chain ID ${injectedParameters.arbitratorChainID}.`);
          }
          if (!injectedParameters.arbitrableJsonRpcUrl) {
            log.warn(`Missing 'arbitrableJsonRpcUrl' for chain ID ${injectedParameters.arbitrableChainID}.`);
          }

          log.debug("Executing dynamic script...");
          const metaEvidenceEdits = await fetchDataFromScript(fileResponse.data, injectedParameters);

          metaEvidenceJSON = {
            ...metaEvidenceJSON,
            ...metaEvidenceEdits,
          };

          log.debug("MetaEvidence JSON updated with dynamic script edits.");
        }

        log.debug("Successfully retrieved and processed MetaEvidence.");
        return metaEvidenceJSON;
      } catch (err) {
        log.warn(`Failed to get the evidence, retrying in ${waitTime / 1000} seconds...`, err.message);
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }

    log.error("Max retries reached. Returning fallback MetaEvidence.");
    return {
      description:
        "In case you have an AdBlock enabled, please disable it and refresh the page. It may be preventing the correct working of the page. If that's not the case, the data for this case is not formatted correctly or has been tampered since the time of its submission. Please refresh the page and refuse to arbitrate if the problem persists.",
      title: "Invalid or tampered case data, refuse to arbitrate.",
    };
  },

  async loadPolicy(URI) {
    log.debug("loadPolicy called.", { URI });

    if (!URI) {
      log.error("No URI provided.");
      return;
    }

    const prefix = URI.startsWith("/ipfs/") ? "" : "/ipfs/";
    const policyURL = `https://cdn.kleros.link${prefix}${URI}`;

    log.debug(`Constructed policy URL: ${policyURL}`);

    try {
      log.debug(`Fetching policy data from: ${policyURL}`);
      const res = await axios.get(policyURL);

      if (res.status !== 200) {
        log.error(`HTTP Error: Unable to fetch file at ${policyURL}. Status: ${res.status}`);
        throw new Error(`HTTP Error: Status ${res.status}`);
      }

      log.debug("Policy data successfully retrieved.");
      return res.data;
    } catch (error) {
      log.error(`Failed to load policy from ${policyURL}:`, error.message);

      return {
        description: "Please contact the governance team.",
        name: "Invalid Court Data",
        summary:
          "The data for this court is not formatted correctly or has been tampered since the time of its submission.",
      };
    }
  },
};

export const dataloaders = Object.keys(funcs).reduce((acc, f) => {
  log.debug(`Initializing dataloader for function: ${f}`);

  acc[f] = new Dataloader(
    (argsArr) => {
      log.debug(`Loading batch for function: ${f}`, { batchArgs: argsArr });
      return Promise.all(argsArr.map((args) => funcs[f](...args)));
    },
    {
      cacheKeyFn: JSON.stringify,
    }
  );

  return acc;
}, {});

export const useDataloader = Object.keys(dataloaders).reduce((acc, f) => {
  acc[f] = function useData() {
    log.debug(`useDataloader hook initialized for function: ${f}`);

    const [state, setState] = useState({});
    const loadedRef = useRef({});
    let mounted = useRef(true);

    useEffect(() => {
      log.debug(`Component using ${f} mounted.`);
      return () => {
        log.debug(`Component using ${f} unmounted.`);
        mounted.current = false;
      };
    }, []);

    return (...args) => {
      const key = JSON.stringify(args);
      log.debug(`useDataloader called for ${f} with args:`, { key });

      if (loadedRef.current[key]) {
        log.debug(`Returning cached result for ${f}.`);
        return state[key];
      }

      return (
        dataloaders[f].load(args).then((res) => {
          if (mounted.current) {
            log.debug(`Setting state for ${f}.`, { key, result: res });
            loadedRef.current[key] = true;
            setState((state) => ({ ...state, [key]: res }));
          }
        }) && undefined
      );
    };
  };

  Object.defineProperty(acc[f], "name", { value: f });
  return acc;
}, {});

const evidenceFetcher = async ([subgraph, disputeId]) => {
  log.debug(`Fetching evidence for disputeID: ${disputeId} from subgraph: ${subgraph}`);

  try {
    const evidence = await axios
      .post(
        subgraph,
        {
          query: `
          query getDispute($id: String!) {
            dispute(id: $id) {
              evidenceGroup {
                evidence {
                  URI
                  sender
                  creationTime
                }
              }
            }
          }
        `,
          variables: { id: disputeId },
        },
        { headers: { "Content-Type": "application/json" } }
      )
      .then((res) => res.data.data.dispute.evidenceGroup.evidence);

    log.debug(`Received ${evidence.length} evidence items for disputeID: ${disputeId}`);

    return (
      await Promise.all(
        evidence.map(async (evidenceItem) => {
          try {
            const uri = getHttpUri(evidenceItem.URI);
            log.debug(`Fetching evidence file from URI: ${uri}`);

            try {
              const fileRes = await axios.get(uri);
              if (fileRes.status !== 200) {
                log.error(`HTTP Error: Unable to fetch file at ${uri}. Status: ${fileRes.status}`);
                throw new Error(`HTTP Error: Status ${fileRes.status}`);
              }

              log.debug(`Successfully fetched evidence file from: ${uri}`);

              return {
                evidenceJSON: fileRes.data,
                submittedAt: evidenceItem.creationTime,
                submittedBy: evidenceItem.sender,
              };
            } catch (requestError) {
              log.warn(`Failed to fetch evidence file at ${uri}.`, { error: requestError.message });

              return {
                error: `${requestError.message}. Requested URI: ${uri}`,
                submittedAt: evidenceItem.creationTime,
                submittedBy: evidenceItem.sender,
              };
            }
          } catch (uriError) {
            log.error(`Invalid URI for evidence: ${evidenceItem.URI}`, { error: uriError.message });
            return null;
          }
        })
      )
    ).filter((e) => !!e); // Filter out null values from invalid URIs
  } catch (error) {
    log.error(`Failed to fetch evidence from subgraph ${subgraph}:`, { error: error.message });
    return [];
  }
};

export function useEvidence(chainId, disputeID) {
  log.debug(`useEvidence called with chainId: ${chainId}, disputeID: ${disputeID}`);

  const { data } = useSWR(chainId && disputeID ? [displaySubgraph[chainId], disputeID] : null, evidenceFetcher, {
    revalidateOnReconnect: false,
  });

  if (data) {
    log.debug(`useEvidence retrieved data for disputeID: ${disputeID}`);
  } else {
    log.warn(`useEvidence returned no data for disputeID: ${disputeID}`);
  }

  return data;
}

export const VIEW_ONLY_ADDRESS = "0x0000000000000000000000000000000000000000";
