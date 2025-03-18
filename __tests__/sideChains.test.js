import {
  getSideChainId,
  getSideChainParams,
  getSideChainParamsFromMainChainId,
  getMainChainId,
  isSupportedSideChain,
  isSupportedMainChain,
  isSupportedChain,
  getCounterPartyChainId,
} from "../src/api/side-chain"


describe("Side Chain Parameter Functions", () => {
  const mockSideChainId = 100;
  const mockMainChainId = 1;

  test("getSideChainParams should return valid params for supported side chains", () => {
    const params = getSideChainParams(mockSideChainId);
    expect(params).toHaveProperty("chainId", mockSideChainId);
    expect(params).toHaveProperty("mainChainId", mockMainChainId);
  });

  test("getSideChainParams should throw an error for unsupported chains", () => {
    expect(() => getSideChainParams(999)).toThrow("Unsupported side-chain ID: 999");
  });

  test("getMainChainId should return the correct main chain ID", () => {
    expect(getMainChainId(mockSideChainId)).toBe(mockMainChainId);
  });

  test("getCounterPartyChainId should return side chain ID from main chain", () => {
    expect(getCounterPartyChainId(mockMainChainId)).toBe(mockSideChainId);
  });

  test("getCounterPartyChainId should return main chain ID from side chain", () => {
    expect(getCounterPartyChainId(mockSideChainId)).toBe(mockMainChainId);
  });

  test("getCounterPartyChainId should throw an error for unsupported chains", () => {
    expect(() => getCounterPartyChainId(999)).toThrow("Unsupported chain ID: 999");
  });

  test("isSupportedSideChain should return true for valid side chain", () => {
    expect(isSupportedSideChain(mockSideChainId)).toBe(true);
  });

  test("isSupportedSideChain should return false for unsupported side chain", () => {
    expect(isSupportedSideChain(999)).toBe(false);
  });

  test("isSupportedMainChain should return true for valid main chain", () => {
    expect(isSupportedMainChain(mockMainChainId)).toBe(true);
  });

  test("isSupportedMainChain should return false for unsupported main chain", () => {
    expect(isSupportedMainChain(999)).toBe(false);
  });

  test("isSupportedChain should return true for supported chains", () => {
    expect(isSupportedChain(mockSideChainId)).toBe(true);
    expect(isSupportedChain(mockMainChainId)).toBe(true);
  });

  test("isSupportedChain should return false for unsupported chains", () => {
    expect(isSupportedChain(999)).toBe(false);
  });
});
