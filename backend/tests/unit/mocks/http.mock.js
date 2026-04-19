const createMockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  user: null,
  ...overrides,
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

module.exports = {
  createMockReq,
  createMockRes,
};
