import axios from "axios";
import log from "../helpers/logger";
import web3DeriveAccount from "../temp/web3-derive-account";

const signData = async (web3, data, address) => {
  log.debug("Signing data for address:", address);
  return await web3.eth.personal.sign(data, address, "");
};

export const accessSettings = async ({ patch, web3, address, settings }) => {
  log.debug("accessSettings called", { patch, address });

  const derived = await web3DeriveAccount(web3, address, patch);
  if (!derived && !patch) {
    log.warn("No derived account stored, throwing error.");
    throw new Error("No derived account stored.");
  }

  const payload = {
    address,
    settings,
    signature: derived
      ? derived.sign(JSON.stringify(settings)).signature
      : await signData(web3, JSON.stringify(settings), address),
  };

  try {
    log.debug(`Sending ${patch ? "PATCH" : "POST"} request to user settings.`);
    const response = await axios[patch ? "patch" : "post"](process.env.REACT_APP_USER_SETTINGS_URL, { payload });
    log.debug("User settings updated successfully.");
    return response.data;
  } catch (err) {
    log.error("Error updating user settings:", err.message);

    if (!patch) {
      return { error: "An unexpected error occurred." };
    }

    log.debug("Retrying with derived account settings.");
    const settingsWithDerived = { ...settings, derivedAccountAddress: { S: derived.address } };
    const payloadWithDerived = {
      address,
      settings: settingsWithDerived,
      signature: await signData(web3, JSON.stringify(settingsWithDerived), address),
    };

    try {
      const response = await axios.patch(process.env.REACT_APP_USER_SETTINGS_URL, { payload: payloadWithDerived });
      log.debug("User settings updated successfully with derived account.");
      return response.data;
    } catch (err) {
      log.error("Retry failed:", err.message);
      return { error: "An unexpected error occurred." };
    }
  }
};

export const postJustification = async ({ web3, account, justification }) => {
  log.debug("postJustification called", { account });

  const derived = await web3DeriveAccount(web3, account, true);
  const payload = {
    account,
    chainId: await web3.eth.getChainId(),
    justification,
    signature: derived
      ? derived.sign(JSON.stringify(justification)).signature
      : await signData(web3, JSON.stringify(justification), account),
  };

  try {
    log.debug("Sending POST request to put-justification.");
    await axios.post(`${process.env.REACT_APP_JUSTIFICATIONS_URL}/put-justification`, payload);
    log.debug("Justification posted successfully.");
  } catch (err) {
    log.error("Error posting justification:", err.message);

    if (derived) {
      log.debug("Retrying with derived account signature.");
      const derivedPayload = {
        ...payload,
        derived: derived.address,
        derivedSignature: await signData(
          web3,
          `Sign this to confirm derived account address ${derived.address}. This will be used to provide justifications.`,
          account
        ),
      };

      try {
        await axios.post(`${process.env.REACT_APP_JUSTIFICATIONS_URL}/put-justification`, derivedPayload);
        log.debug("Justification posted successfully with derived signature.");
      } catch (innerErr) {
        log.error("Retry failed:", innerErr.message);
      }
    }
  }
};
