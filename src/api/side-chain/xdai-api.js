import log from "../../helpers/logger"; // Import the logger
import Web3 from "web3";
import createError from "../../helpers/create-error";
import { promiEventToAsyncGenerator } from "../../helpers/transactions";

const { BN, toBN, toWei } = Web3.utils;

const ZERO = toBN("0");

export function createApi({
                            chainId,
                            destinationChainId,
                            tokenBridge,
                            wrappedPinakion,
                            xPinakion,
                            klerosLiquid,
                            klerosLiquidExtraViews,
                          }) {
  log.debug("createApi called", { chainId, destinationChainId });

  async function getBalance({ address }) {
    log.debug("getBalance called", { address });
    const balance = toBN(await wrappedPinakion.methods.balanceOf(address).call());
    log.debug("Fetched balance", { address, balance: balance.toString() });
    return balance;
  }

  async function getRawBalance({ address }) {
    log.debug("getRawBalance called", { address });
    const balance = toBN(await xPinakion.methods.balanceOf(address).call());
    log.debug("Fetched raw balance", { address, balance: balance.toString() });
    return balance;
  }

  async function getTokenStats({ address }) {
    log.debug("getTokenStats called", { address });

    try {
      const [balance, staked, fromExtraView] = await Promise.all([
        getBalance({ address }),
        _getStakedTokens({ address }),
        _getTokensStatsFromExtraView({ address }),
      ]);

      const { locked, stakedPlusPending } = fromExtraView;
      const pendingStake = stakedPlusPending.sub(staked);
      const mixinFromView = pendingStake.eq(ZERO) ? { locked } : { pendingStake, locked };

      const available = _getAvailableTokens({ balance, locked, staked });

      log.debug("Token stats fetched", { address, balance: balance.toString(), staked: staked.toString(), locked: locked.toString(), available: available.toString() });

      return {
        balance,
        staked,
        ...mixinFromView,
        available,
      };
    } catch (error) {
      log.error("Error in getTokenStats", { address, error });
      throw error;
    }
  }

  async function _getStakedTokens({ address }) {
    log.debug("_getStakedTokens called", { address });
    const juror = await klerosLiquid.methods.jurors(address).call();
    const stakedTokens = toBN(juror.stakedTokens);
    log.debug("Fetched staked tokens", { address, stakedTokens: stakedTokens.toString() });
    return stakedTokens;
  }

  async function _getTokensStatsFromExtraView({ address }) {
    log.debug("_getTokensStatsFromExtraView called", { address });
    const { lockedTokens, stakedTokens } = await klerosLiquidExtraViews.methods.getJuror(address).call();

    const stats = {
      locked: toBN(lockedTokens),
      stakedPlusPending: toBN(stakedTokens),
    };

    log.debug("Fetched extra view stats", { address, stats });
    return stats;
  }

  function _getAvailableTokens({ balance, locked, staked }) {
    log.debug("_getAvailableTokens called", { balance: balance.toString(), locked: locked.toString(), staked: staked.toString() });

    const available = BN.min(balance.sub(locked), balance.sub(staked));
    const finalAvailable = available.lt(ZERO) ? ZERO : available;

    log.debug("Computed available tokens", { available: finalAvailable.toString() });

    return finalAvailable;
  }

  async function _getFee({ amount }) {
    log.debug("_getFee called", { amount: amount.toString() });

    try {
      amount = toBN(amount);
      const feeType = await tokenBridge.methods.HOME_TO_FOREIGN_FEE().call();
      const token = xPinakion.options.address;
      const fee = toBN(await tokenBridge.methods.calculateFee(feeType, token, amount).call());

      log.debug("Fetched bridge fee", { amount: amount.toString(), fee: fee.toString() });

      return fee;
    } catch (error) {
      log.error("Error in _getFee", { amount: amount.toString(), error });
      throw error;
    }
  }

  async function getRelayedAmount({ originalAmount }) {
    log.debug("getRelayedAmount called", { originalAmount: originalAmount.toString() });

    try {
      const relayedAmount = toBN(originalAmount).sub(await _getFee({ amount: originalAmount }));
      log.debug("Computed relayed amount", { originalAmount: originalAmount.toString(), relayedAmount: relayedAmount.toString() });
      return relayedAmount;
    } catch (error) {
      log.error("Error in getRelayedAmount", { originalAmount: originalAmount.toString(), error });
      throw error;
    }
  }

  const BASIS_POINTS_MULTIPLIER = toBN("10000");

  async function getFeeRatio() {
    log.debug("getFeeRatio called");

    try {
      const relayedAmount = toBN(toWei("1"));
      const fee = await _getFee({ amount: relayedAmount });

      const ratioBasisPoints = fee.mul(BASIS_POINTS_MULTIPLIER).div(relayedAmount);
      const feeRatio = ratioBasisPoints.toNumber() / BASIS_POINTS_MULTIPLIER.toNumber();

      log.debug("Computed fee ratio", { fee: fee.toString(), ratioBasisPoints: ratioBasisPoints.toString(), feeRatio });
      return feeRatio;
    } catch (error) {
      log.error("Error in getFeeRatio", { error });
      throw error;
    }
  }

  async function getRequiredAmount({ desiredAmount }) {
    log.debug("getRequiredAmount called", { desiredAmount: desiredAmount.toString() });

    try {
      desiredAmount = toBN(desiredAmount);

      if (desiredAmount.isZero()) {
        log.debug("Desired amount is zero, returning zero.");
        return toBN("0");
      }

      const fee = await _getFee({ amount: desiredAmount });
      const feeRateBasisPoints = fee.mul(BASIS_POINTS_MULTIPLIER).div(desiredAmount);

      const requiredAmount = desiredAmount.mul(BASIS_POINTS_MULTIPLIER).div(BASIS_POINTS_MULTIPLIER.sub(feeRateBasisPoints));

      log.debug("Computed required amount", {
        desiredAmount: desiredAmount.toString(),
        fee: fee.toString(),
        feeRateBasisPoints: feeRateBasisPoints.toString(),
        requiredAmount: requiredAmount.toString(),
      });

      return requiredAmount;
    } catch (error) {
      log.error("Error in getRequiredAmount", { desiredAmount: desiredAmount.toString(), error });
      throw error;
    }
  }


  async function* deposit({ address, amount }) {
    log.debug("deposit called", { address, amount: amount.toString() });

    try {
      amount = toBN(amount);

      const [balance, allowance] = await Promise.all([getRawBalance({ address }), _getRawAllowance({ address })]);

      log.debug("Fetched balance and allowance", {
        address,
        balance: balance.toString(),
        allowance: allowance.toString(),
      });

      if (balance.lt(amount)) {
        log.warn("Amount is greater than balance", { address, amount: amount.toString(), balance: balance.toString() });
        throw createError("Amount is greater than balance");
      }

      const buffer = [
        { key: "approve", state: "none" },
        { key: "deposit", state: "none" },
      ];

      // Only call approve if there is not enough allowance for the bridge to spend tokens
      if (allowance.lt(amount)) {
        log.debug("Allowance is lower than amount, starting approval", {
          address,
          amount: amount.toString(),
          allowance: allowance.toString(),
        });

        yield [...buffer];

        try {
          for await (const approve of promiEventToAsyncGenerator(
            xPinakion.methods.approve(wrappedPinakion.options.address, amount).send({ from: address })
          )) {
            buffer[0] = {
              ...buffer[0],
              ...approve,
            };

            log.debug("Approval progress", { address, approve });
            yield [...buffer];
          }

          log.debug("Approval completed", { address });
        } catch (err) {
          log.error("Failed to approve PNK spend", { address, error: err });
          throw createError("Failed to approve PNK spend", err);
        }
      } else {
        log.debug("Approval skipped as allowance is sufficient", { address, allowance: allowance.toString() });
        buffer[0] = {
          ...buffer[0],
          state: "skipped",
        };
        yield [...buffer];
      }

      try {
        log.debug("Starting deposit process", { address, amount: amount.toString() });

        for await (const deposit of promiEventToAsyncGenerator(
          wrappedPinakion.methods.deposit(amount).send({ from: address })
        )) {
          buffer[1] = {
            ...buffer[1],
            ...deposit,
          };

          log.debug("Deposit progress", { address, deposit });
          yield [...buffer];
        }

        log.debug("Deposit completed", { address });
      } catch (err) {
        log.error("Failed to deposit tokens", { address, error: err });
        throw createError("Failed to deposit tokens", err);
      }
    } catch (error) {
      log.error("Error in deposit function", { address, error });
      throw error;
    }
  }

  async function _getRawAllowance({ address }) {
    log.debug("_getRawAllowance called", { address });

    try {
      const allowance = toBN(await xPinakion.methods.allowance(address, wrappedPinakion.options.address).call());
      log.debug("Fetched raw allowance", { address, allowance: allowance.toString() });
      return allowance;
    } catch (error) {
      log.error("Error in _getRawAllowance", { address, error });
      throw error;
    }
  }

  async function* withdraw({ amount, address }) {
    log.debug("withdraw called", { address, amount: amount.toString() });

    try {
      amount = toBN(amount);
      const balance = await getBalance({ address });

      log.debug("Fetched balance for withdrawal", { address, balance: balance.toString() });

      if (balance.lt(amount)) {
        log.warn("Amount is greater than balance", { address, amount: amount.toString(), balance: balance.toString() });
        throw createError("Amount is greater than balance");
      }

      const buffer = [{ key: "withdraw", state: "none" }];
      yield [...buffer];

      try {
        log.debug("Starting withdrawal process", { address, amount: amount.toString() });

        for await (const deposit of promiEventToAsyncGenerator(
          wrappedPinakion.methods.withdrawAndConvertToPNK(amount, address).send({ from: address })
        )) {
          log.debug("Withdrawal progress", { address, deposit });
          yield [{ ...buffer[0], ...deposit }];
        }

        log.debug("Withdrawal completed", { address });
      } catch (err) {
        log.error("Failed to withdraw tokens", { address, error: err });
        throw createError("Failed to withdraw tokens", err);
      }
    } catch (error) {
      log.error("Error in withdraw function", { address, error });
      throw error;
    }
  }

  return {
    chainId,
    destinationChainId,
    getBalance,
    getRawBalance,
    getTokenStats,
    getFeeRatio,
    getRelayedAmount,
    getRequiredAmount,
    deposit,
    withdraw,
  };
}
