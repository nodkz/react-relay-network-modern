/* @flow */
/* eslint-disable no-param-reassign, prefer-const */

import { createRequestError } from './createRequestError';
import RelayResponse from './RelayResponse';
import type {
  Middleware,
  MiddlewareNextFn,
  RelayRequestAny,
  RawMiddleware,
  RawMiddlewareNextFn,
} from './definition';
import formatMiddleware from './middlewares/format';

async function runFetch(req: RelayRequestAny): Promise<any> {
  let { url } = req.fetchOpts;
  if (!url) url = '/graphql';

  if (!req.fetchOpts.headers.Accept) req.fetchOpts.headers.Accept = '*/*';
  if (!req.fetchOpts.headers['Content-Type'] && !req.isFormData()) {
    req.fetchOpts.headers['Content-Type'] = 'application/json';
  }

  // $FlowFixMe
  const resFromFetch = await fetch(url, req.fetchOpts);
  return resFromFetch;
}

export default function fetchWithMiddleware(
  req: RelayRequestAny,
  middlewares: Middleware[],
  rawMiddlewares: RawMiddleware[],
  noThrow?: boolean
): Promise<RelayResponse> {
  const baseFetch: RawMiddlewareNextFn = compose(...rawMiddlewares)(runFetch);
  const formatFetch: MiddlewareNextFn = compose(formatMiddleware())(baseFetch);
  const wrappedFetch: MiddlewareNextFn = compose(...middlewares)(formatFetch);

  return wrappedFetch(req).then(res => {
    if (!noThrow && (!res || res.errors || !res.data)) {
      throw createRequestError(req, res);
    }
    return res;
  });
}

/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */
function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  } else {
    const last = funcs[funcs.length - 1];
    const rest = funcs.slice(0, -1);
    return (...args) => rest.reduceRight((composed, f) => f(composed), last(...args));
  }
}
