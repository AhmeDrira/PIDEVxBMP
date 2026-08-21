const buildReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ...overrides,
});

const buildRes = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  res.send = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  res.setHeader = jest.fn((key, value) => {
    res.headers[key] = value;
    return res;
  });

  return res;
};

const buildNext = () => jest.fn();

const chainableQuery = (value, options = {}) => {
  const query = {};
  const methods = ['select', 'sort', 'skip', 'limit', 'lean', 'populate'];

  methods.forEach((method) => {
    query[method] = jest.fn(() => query);
  });

  if (options.reject) {
    query.exec = jest.fn().mockRejectedValue(value);
    query.then = (resolve, reject) => Promise.reject(value).then(resolve, reject);
    query.catch = (reject) => Promise.reject(value).catch(reject);
    return query;
  }

  query.exec = jest.fn().mockResolvedValue(value);
  query.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  query.catch = (reject) => Promise.resolve(value).catch(reject);

  return query;
};

module.exports = {
  buildReq,
  buildRes,
  buildNext,
  chainableQuery,
  createMockReq: buildReq,
  createMockRes: buildRes,
};
