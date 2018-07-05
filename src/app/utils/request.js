import config from '../../configs/config';

function createHeaders(headers) {
  return new Headers(headers);
}

function createRequest(path, params) {
  return new Request(`${config.api.url}${path}`, params);
}

export {
  createHeaders,
  createRequest,
};
