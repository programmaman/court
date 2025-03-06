import axios from "axios";
import web3DeriveAccount from "../temp/web3-derive-account";

const signData = async (web3, data, address) => {
  return await web3.eth.personal.sign(data, address, "");
};

export const accessSettings = async ({ patch, web3, address, settings }) => {
  const derived = await web3DeriveAccount(web3, address, patch);
  if (!derived && !patch) {
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
    const response = await axios[patch ? "patch" : "post"](process.env.REACT_APP_USER_SETTINGS_URL, { payload });
    return response.data;
  } catch (err) {
    console.error(err.message);
    if (!patch) {
      return { error: "An unexpected error occurred." };
    }

    const settingsWithDerived = { ...settings, derivedAccountAddress: { S: derived.address } };
    const payloadWithDerived = {
      address,
      settings: settingsWithDerived,
      signature: await signData(web3, JSON.stringify(settingsWithDerived), address),
    };

    try {
      const response = await axios.patch(process.env.REACT_APP_USER_SETTINGS_URL, { payload: payloadWithDerived });
      return response.data;
    } catch (err) {
      console.error(err.message);
      return { error: "An unexpected error occurred." };
    }
  }
};

export const postJustification = async ({ web3, account, justification }) => {
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
    await axios.post(`${process.env.REACT_APP_JUSTIFICATIONS_URL}/put-justification`, payload);
  } catch (err) {
    console.error(err.message);
    if (derived) {
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
      } catch (innerErr) {
        console.error(innerErr.message);
      }
    }
  }
};